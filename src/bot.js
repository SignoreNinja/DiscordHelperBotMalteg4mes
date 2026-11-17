'use strict';

require('dotenv').config();

const {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
  ApplicationCommandType
} = require('discord.js');

const { handleTicketInteraction } = require('./features/tickets/handlers');
const {
  handleStreamInteraction,
  startTwitchNotifications
} = require('./features/twitch/handlers');

// Zugangsdaten niemals direkt in den Quellcode schreiben.
for (const key of ['DISCORD_TOKEN', 'GUILD_ID']) {
  if (!process.env[key]) {
    throw new Error(`Die Umgebungsvariable ${key} fehlt.`);
  }
}

function pollMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 1
    ? Math.min(60, Math.floor(number))
    : 5;
}

const config = {
  guildId: process.env.GUILD_ID,
  teamRoleName: process.env.TEAM_ROLE_NAME || 'Team',
  ticketNotificationChannelId: process.env.TICKET_NOTIFICATION_CHANNEL_ID || null,
  streamAlertChannelId: process.env.STREAM_ALERT_CHANNEL_ID || null,
  twitchClientId: process.env.TWITCH_CLIENT_ID || null,
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || null,
  streamPollMinutes: pollMinutes(process.env.STREAM_POLL_MINUTES)
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Die Befehlsoptionen entsprechen features/tickets/handlers.js.
function buildCommands() {
  const ticket = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Verwaltet Support-Tickets als private Threads')
    .addSubcommand(subcommand => subcommand
      .setName('setup')
      .setDescription('Erstellt das Ticket-Auswahlmenü im aktuellen Kanal')
      .addChannelOption(option => option
        .setName('benachrichtigungskanal')
        .setDescription('Kanal für Ticket-Benachrichtigungen')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
      .addRoleOption(option => option
        .setName('supportrolle')
        .setDescription('Optionale Rolle für die Ticket-Bearbeitung')))
    .addSubcommand(subcommand => subcommand
      .setName('close')
      .setDescription('Schließt das aktuelle Ticket sofort')
      .addStringOption(option => option
        .setName('grund')
        .setDescription('Optionaler Schließungsgrund')
        .setMaxLength(500)))
    .addSubcommand(subcommand => subcommand
      .setName('close-anfrage')
      .setDescription('Schlägt eine zeitgesteuerte Ticket-Schließung vor')
      .addIntegerOption(option => option
        .setName('minuten')
        .setDescription('Automatisch schließen nach dieser Anzahl Minuten')
        .setMinValue(1)
        .setMaxValue(10080)
        .setRequired(true))
      .addStringOption(option => option
        .setName('grund')
        .setDescription('Optionaler Grund')
        .setMaxLength(500)))
    .addSubcommand(subcommand => subcommand
      .setName('add')
      .setDescription('Fügt ein Mitglied zum Ticket hinzu')
      .addUserOption(option => option
        .setName('mitglied')
        .setDescription('Mitglied, das Zugriff erhalten soll')
        .setRequired(true)))
    .addSubcommand(subcommand => subcommand
      .setName('rename')
      .setDescription('Benennt das Ticket um')
      .addStringOption(option => option
        .setName('name')
        .setDescription('Neuer Ticket-Titel')
        .setMaxLength(50)
        .setRequired(true)));

  const twitch = new SlashCommandBuilder()
    .setName('stream-rollen')
    .setDescription('Erstellt die Twitch-Benachrichtigungsrollen und Buttons');

  return [ticket, twitch];
}

async function registerCommands() {
  const guild = await client.guilds.fetch(config.guildId);
  const existing = await guild.commands.fetch();

  // Andere Slash-Commands (z. B. Moderation) bleiben bestehen.
  for (const command of buildCommands()) {
    const definition = command.toJSON();
    const previous = existing.find(item =>
      item.name === definition.name &&
      item.type === ApplicationCommandType.ChatInput
    );

    if (previous) {
      await guild.commands.edit(previous.id, definition);
    } else {
      await guild.commands.create(definition);
    }
  }
  console.log('[Discord] Ticket- und Twitch-Commands registriert.');
}

let twitchTimer = null;

client.once(Events.ClientReady, async readyClient => {
  console.log(`[Discord] Angemeldet als ${readyClient.user.tag}.`);

  try {
    await registerCommands();
  } catch (error) {
    console.error('[Discord] Slash-Command-Registrierung fehlgeschlagen:', error);
  }

  if (config.streamAlertChannelId && config.twitchClientId && config.twitchClientSecret) {
    twitchTimer = startTwitchNotifications(client, config);
    console.log(`[Twitch] Live-Überwachung alle ${config.streamPollMinutes} Minuten gestartet.`);
  } else {
    console.warn('[Twitch] Nicht gestartet: Twitch-Zugangsdaten oder Stream-Kanal fehlen.');
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.inGuild() || interaction.guildId !== config.guildId) return;

  try {
    if (await handleTicketInteraction(interaction, config)) return;
    if (await handleStreamInteraction(interaction)) return;
    // Weitere Feature-Handler bei Bedarf hier ergänzen.
  } catch (error) {
    console.error('[Discord] Interaktion fehlgeschlagen:', error);
    if (!interaction.isRepliable()) return;

    const response = {
      content: 'Beim Ausführen dieser Aktion ist ein Fehler aufgetreten.',
      flags: MessageFlags.Ephemeral
    };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      console.error('[Discord] Fehlerantwort fehlgeschlagen:', replyError);
    }
  }
});

client.on(Events.Error, error => {
  console.error('[Discord] Client-Fehler:', error);
});

process.on('unhandledRejection', error => {
  console.error('[Node] Unbehandelte Promise-Rejection:', error);
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[Bot] Beende nach ${signal} ...`);
  if (twitchTimer) clearInterval(twitchTimer);
  await client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('[Discord] Anmeldung fehlgeschlagen:', error);
  process.exitCode = 1;
});
