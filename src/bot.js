
'use strict';

require('dotenv').config();

const { Events, MessageFlags } = require('discord.js');
const { client } = require('./client');
const { config } = require('./config');
const { registerCommands } = require('./command');
const { handleTicketInteraction } = require('./features/tickets/handlers');
const {
  handleStreamInteraction,
  startTwitchNotifications
} = require('./features/twitch/handlers');

let listenersRegistered = false;
let startPromise = null;
let twitchInterval = null;
let stopping = false;

function validateConfig() {
  const missing = ['DISCORD_TOKEN', 'GUILD_ID'].filter(
    key => !process.env[key]?.trim()
  );

  if (missing.length) {
    throw new Error(`Fehlende Umgebungsvariablen: ${missing.join(', ')}`);
  }

  if (config.guildId !== process.env.GUILD_ID.trim()) {
    throw new Error('GUILD_ID stimmt nicht mit config.js überein.');
  }
}

async function initializeModules(readyClient) {
  console.log(`[Bot] Online als ${readyClient.user.tag}`);
  console.log(`[Bot] Server-ID: ${config.guildId}`);

  try {
    await registerCommands(readyClient, config.guildId);
  } catch (error) {
    console.error('[Commands] Registrierung fehlgeschlagen:', error);
  }

  const twitchConfigured = Boolean(
    config.streamAlertChannelId &&
    config.twitchClientId &&
    config.twitchClientSecret
  );

  if (twitchConfigured && !twitchInterval && !stopping) {
    try {
      twitchInterval = startTwitchNotifications(readyClient, config);
      console.log(
        `[Twitch] Überwachung aktiv (alle ${config.streamPollMinutes} Minuten).`
      );
    } catch (error) {
      console.error('[Twitch] Start fehlgeschlagen:', error);
    }
  } else if (!twitchConfigured) {
    console.warn('[Twitch] Nicht konfiguriert – Überwachung deaktiviert.');
  }
}

async function handleInteraction(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== config.guildId) {
    return;
  }

  try {
    if (await handleTicketInteraction(interaction, config)) return;
    if (await handleStreamInteraction(interaction)) return;

    // Weitere Feature-Handler hier hinzufügen.
  } catch (error) {
    console.error('[Bot] Interaktionsfehler:', error);

    if (!interaction.isRepliable()) return;

    const response = {
      content: 'Bei der Verarbeitung ist ein Fehler aufgetreten.',
      flags: MessageFlags.Ephemeral
    };

    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      console.error('[Bot] Konnte Fehlerantwort nicht senden:', replyError);
    }
  }
}

function registerListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  client.once(Events.ClientReady, readyClient => {
    void initializeModules(readyClient).catch(error => {
      console.error('[Bot] Modul-Initialisierung fehlgeschlagen:', error);
    });
  });

  client.on(Events.InteractionCreate, interaction => {
    void handleInteraction(interaction).catch(error => {
      console.error('[Bot] Unerwarteter Interaktionsfehler:', error);
    });
  });

  client.on(Events.Error, error => {
    console.error('[Discord] Client-Fehler:', error);
  });
}

function startBot() {
  if (stopping) {
    throw new Error('Der Bot wird gerade beendet.');
  }
  if (startPromise) return startPromise;

  validateConfig();
  registerListeners();

  startPromise = client.login(process.env.DISCORD_TOKEN).then(
    () => client,
    error => {
      startPromise = null;
      throw error;
    }
  );

  return startPromise;
}

async function stopBot() {
  if (stopping) return;
  stopping = true;

  if (twitchInterval) {
    clearInterval(twitchInterval);
    twitchInterval = null;
  }

  await client.destroy();
  console.log('[Bot] Discord-Verbindung geschlossen.');
}

module.exports = { client, startBot, stopBot };

// Unterstützt auch "node bot.js", ohne einen zweiten Einstiegspunkt zu erstellen.
if (require.main === module) {
  require('./index');
}
