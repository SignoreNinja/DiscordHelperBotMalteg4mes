
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const { ticketTypes } = require('./types');

// Ticket-Auswahl mit allen Kategorien
function ticketPanelComponents(
  ticketChannelId,
  supportRoleId,
  notificationChannelId
) {
  const buttons = Object.entries(ticketTypes).map(([type, details]) =>
    new ButtonBuilder()
      .setCustomId(
        `ticket:create:${type}:${ticketChannelId}:${supportRoleId || 'none'}:${notificationChannelId || 'none'}`
      )
      .setLabel(details.label)
      .setEmoji(details.emoji)
      .setStyle(ButtonStyle.Primary)
  );

  const rows = [];

  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder()
        .addComponents(buttons.slice(i, i + 5))
    );
  }

  return rows;
}

// Button zum Vorschlagen einer Ticket-Schließung
function ticketCloseButton(
  supportRoleId,
  notificationChannelId
) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `ticket:close:${supportRoleId || 'none'}:${notificationChannelId || 'none'}`
      )
      .setLabel('Schließung vorschlagen')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Primary)
  );
}

// Button für Teammitglieder zum Beitreten
function ticketJoinButton(threadId, teamRoleId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `ticket:join:${threadId}:${teamRoleId || 'none'}`
      )
      .setLabel('Ticket beitreten')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Success)
  );
}

// Button, wenn das Ticket zur Übernahme bereitsteht
function ticketTakeButton(threadId, teamRoleId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(
        `ticket:join:${threadId}:${teamRoleId || 'none'}`
      )
      .setLabel('Ticket übernehmen')
      .setEmoji('📩')
      .setStyle(ButtonStyle.Success)
  );
}

// Anzeige für bereits übernommene Tickets
function ticketTakenButton(username) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:already-taken')
      .setLabel(`Übernommen von ${username}`.slice(0, 80))
      .setEmoji('✅')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

module.exports = {
  ticketPanelComponents,
  ticketCloseButton,
  ticketJoinButton,
  ticketTakeButton,
  ticketTakenButton
};

