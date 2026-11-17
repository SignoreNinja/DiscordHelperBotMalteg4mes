
'use strict';

const {
  ApplicationCommandType,
  ChannelType,
  SlashCommandBuilder
} = require('discord.js');

// Slash-Commands anlegen; die Verarbeitung liegt in den Feature-Handlern.
function buildCommands() {
  const ticket = new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Verwaltet Support-Tickets als private Threads')
    .addSubcommand(command => command
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
    .addSubcommand(command => command
      .setName('close')
      .setDescription('Schließt das aktuelle Ticket sofort')
      .addStringOption(option => option
        .setName('grund')
        .setDescription('Optionaler Schließungsgrund')
        .setMaxLength(500)))
    .addSubcommand(command => command
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
    .addSubcommand(command => command
      .setName('add')
      .setDescription('Fügt ein Mitglied zum Ticket hinzu')
      .addUserOption(option => option
        .setName('mitglied')
        .setDescription('Mitglied, das Zugriff erhalten soll')
        .setRequired(true)))
    .addSubcommand(command => command
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

// Aktualisiert nur unsere Commands; bestehende andere Server-Commands bleiben erhalten.
async function registerCommands(client, guildId) {
  if (!guildId) throw new Error('GUILD_ID fehlt.');

  const guild = await client.guilds.fetch(guildId);
  const existing = await guild.commands.fetch();

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

module.exports = { buildCommands, registerCommands };

