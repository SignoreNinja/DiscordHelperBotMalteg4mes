
'use strict';

require('dotenv').config();

const {
  Events,
  MessageFlags
} = require('discord.js');

const { client } = require('./client');
const { config } = require('./config');
const { registerCommands } = require('./command');

const {
  handleTicketInteraction
} = require('./features/tickets/handlers');

const {
  handleStreamInteraction,
  startTwitchNotifications
} = require('./features/twitch/handlers');

// Erforderliche Umgebungsvariablen prüfen
function validateEnvironment() {
  const required = [
    'DISCORD_TOKEN',
    'GUILD_ID'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Fehlende Umgebungsvariablen: ${missing.join(', ')}`
    );
  }
}

let twitchInterval = null;
let shuttingDown = false;

// Wird ausgeführt, sobald Discord verbunden ist
client.once(Events.ClientReady, async readyClient => {
  console.log('--------------------------------');
  console.log(`[Bot] Angemeldet als ${readyClient.user.tag}`);
  console.log(`[Bot] Server-ID: ${config.guildId}`);
  console.log('--------------------------------');

  // Slash-Commands registrieren
  try {
    await registerCommands(client, config.guildId);
    console.log('[Commands] Erfolgreich registriert.');
  } catch (error) {
    console.error('[Commands] Registrierung fehlgeschlagen:', error);
  }

  // Twitch-Benachrichtigungen starten
  const twitchConfigured = Boolean(
    config.streamAlertChannelId &&
    config.twitchClientId &&
    config.twitchClientSecret
  );

  if (twitchConfigured) {
    try {
      twitchInterval = startTwitchNotifications(client, config);

      console.log(
        `[Twitch] Überwachung gestartet (${config.streamPollMinutes} Minuten).`
      );
    } catch (error) {
      console.error('[Twitch] Start fehlgeschlagen:', error);
    }
  } else {
    console.warn(
      '[Twitch] Deaktiviert: Twitch-Konfiguration unvollständig.'
    );
  }

  console.log('[Bot] Alle verfügbaren Module initialisiert.');
});

// Alle Discord-Interaktionen zentral verarbeiten
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.inGuild()) return;

  // Nur den konfigurierten Discord-Server verarbeiten
  if (interaction.guildId !== config.guildId) return;

  try {
    // Ticket-System
    if (await handleTicketInteraction(interaction, config)) {
      return;
    }

    // Twitch-System
    if (await handleStreamInteraction(interaction)) {
      return;
    }

    // Weitere Module können hier eingebunden werden

  } catch (error) {
    console.error('[Interaction] Fehler:', error);

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
      console.error(
        '[Interaction] Fehlerantwort fehlgeschlagen:',
        replyError
      );
    }
  }
});

// Discord-Client-Fehler
client.on(Events.Error, error => {
  console.error('[Discord] Client-Fehler:', error);
});

// Unbehandelte Promise-Fehler
process.on('unhandledRejection', error => {
  console.error('[Node] Unhandled Rejection:', error);
});

// Unerwartete Laufzeitfehler
process.on('uncaughtException', error => {
  console.error('[Node] Uncaught Exception:', error);
  void shutdown('Uncaught Exception', 1);
});

// Bot kontrolliert beenden
async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[Bot] Beende Bot: ${signal}`);

  if (twitchInterval) {
    clearInterval(twitchInterval);
    twitchInterval = null;
  }

  try {
    await client.destroy();
    console.log('[Bot] Discord-Verbindung geschlossen.');
  } catch (error) {
    console.error('[Bot] Fehler beim Beenden:', error);
    exitCode = 1;
  }

  process.exit(exitCode);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Bot starten
async function main() {
  validateEnvironment();

  console.log('[Bot] Starte Discord-Bot ...');

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch(error => {
  console.error('[Bot] Start fehlgeschlagen:', error);
  void shutdown('Startup Error', 1);
});

