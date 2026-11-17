
const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

const { ticketTypes } = require('./types');
const {
  ticketPanelComponents,
  ticketCloseButton,
  ticketJoinButton,
  ticketTakenButton
} = require('./components');
const {
  ticketThreadName,
  parseTicketThread,
  getNextTicketNumber,
  ticketNumberLabel,
  ticketTitleFromThreadName
} = require('./naming');

const scheduledClosures = new Map();
const closingTickets = new Set();
const COLOR = 0x5865f2;

function roleIdFromConfig(guild, config = {}) {
  const name = (config.teamRoleName || 'Team').toLowerCase();
  return guild.roles.cache.find(role => role.name.toLowerCase() === name)?.id || null;
}

function hasRole(interaction, roleId) {
  if (!roleId || roleId === 'none') return false;
  const roles = interaction.member?.roles;
  return Boolean(roles?.cache?.has(roleId) ||
    (Array.isArray(roles) && roles.includes(roleId)));
}

function isTicketTeam(interaction, supportRoleId, config = {}) {
  return Boolean(
    hasRole(interaction, roleIdFromConfig(interaction.guild, config)) ||
    hasRole(interaction, supportRoleId) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
  );
}

async function getTicketSupportRoleId(thread) {
  const messages = await thread.messages.fetch({ limit: 100 }).catch(() => new Map());
  const openingMessage = [...messages.values()].find(message =>
    message.author.id === thread.client.user.id &&
    message.components.some(row => row.components.some(component =>
      component.customId?.startsWith('ticket:close:'))));
  const button = openingMessage?.components.flatMap(row => row.components)
    .find(component => component.customId?.startsWith('ticket:close:'));
  const id = button?.customId?.split(':')[2];
  return id && id !== 'none' ? id : null;
}

function closeRequestComponents() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:approve-close')
      .setLabel('Schließung zustimmen')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket:deny-close')
      .setLabel('Ablehnen')
      .setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary)
  );
}

function clearScheduledClosure(threadId) {
  const pending = scheduledClosures.get(threadId);
  if (pending) clearTimeout(pending.timeout);
  scheduledClosures.delete(threadId);
  return pending;
}

async function closeTicket(thread, ticket, closedBy = null, reason = null) {
  if (closingTickets.has(thread.id)) return false;
  const current = parseTicketThread(thread);
  if (!current || current.state !== 'offen') return false;
  closingTickets.add(thread.id);
  try {
    const pending = clearScheduledClosure(thread.id);
    const why = reason || pending?.reason || 'Kein Grund angegeben.';
    const actor = closedBy?.username || pending?.requester || 'Support-Team';

    await thread.setName(ticketThreadName({
      ticketId: ticket.ticketId,
      state: 'geschlossen',
      type: ticket.type,
      ownerId: ticket.ownerId,
      title: ticketTitleFromThreadName(thread, ticket)
    }));
    await thread.send({
      content: `🔒 **${ticketNumberLabel(ticket)}** wurde von **${actor}** geschlossen.\n**Grund:** ${why}`,
      allowedMentions: { parse: [] }
    });

    const owner = await thread.client.users.fetch(ticket.ownerId).catch(() => null);
    if (owner) {
      await owner.send({
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Ticket geschlossen')
          .setDescription(`Dein **${ticketNumberLabel(ticket)}** wurde geschlossen.`)
          .addFields(
            { name: 'Bereich', value: ticketTypes[ticket.type]?.label || ticket.type, inline: true },
            { name: 'Bearbeitet von', value: actor, inline: true },
            { name: 'Grund', value: why.slice(0, 1024) }
          )
          .setTimestamp()],
        allowedMentions: { parse: [] }
      }).catch(error => console.warn('[Tickets] DM fehlgeschlagen:', error.message));
    }

    await thread.setLocked(true, 'Ticket geschlossen');
    await thread.setArchived(true, 'Ticket geschlossen');
    return true;
  } finally {
    closingTickets.delete(thread.id);
  }
}

async function requestTicketClose(thread, ticket, requester, minutes = 1440, reason = null) {
  if (scheduledClosures.has(thread.id)) return false;
  const recent = await thread.messages.fetch({ limit: 100 });
  const hasPending = recent.some(message => message.components.some(row =>
    row.components.some(component =>
      component.customId === 'ticket:approve-close' && !component.disabled)));
  if (hasPending) return false;

  const closesAt = Math.floor(Date.now() / 1000) + minutes * 60;
  const message = await thread.send({
    content: `<@${ticket.ownerId}>`,
    embeds: [new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('Schließungsvorschlag')
      .setDescription(`${requester} schlägt vor, **${ticketNumberLabel(ticket)}** zu schließen.\n\n**Grund:** ${reason || 'Kein Grund angegeben.'}\nOhne Antwort wird das Ticket <t:${closesAt}:R> automatisch geschlossen.`)
      .setTimestamp()],
    components: [closeRequestComponents()],
    allowedMentions: { users: [ticket.ownerId] }
  });

  const timeout = setTimeout(async () => {
    try {
      const latest = parseTicketThread(thread);
      if (latest?.state === 'offen') {
        await closeTicket(thread, latest, null, reason);
        await message.edit({ components: [] }).catch(() => null);
      }
    } catch (error) {
      console.error('[Tickets] Automatische Schließung fehlgeschlagen:', error);
    }
  }, minutes * 60_000);
  scheduledClosures.set(thread.id, {
    timeout,
    reason,
    requester: requester.username,
    messageId: message.id
  });
  return true;
}

async function createTicket(interaction, config = {}) {
  const parts = interaction.customId.split(':');
  const hasType = Boolean(ticketTypes[parts[2]]);
  const type = hasType ? parts[2] : (interaction.isStringSelectMenu() ? interaction.values[0] : 'support');
  const channelId = hasType ? parts[3] : parts[2];
  const supportRoleId = (hasType ? parts[4] : parts[3]) || 'none';
  const notificationId = config.ticketNotificationChannelId || (hasType ? parts[5] : parts[4]);
  if (!ticketTypes[type]) return interaction.reply({ content: 'Unbekannte Ticket-Kategorie.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) {
    return interaction.editReply('Der Ticket-Startkanal ist nicht verfügbar.');
  }
  const active = await channel.threads.fetchActive();
  const existing = active.threads.find(thread => {
    const t = parseTicketThread(thread);
    return t?.ownerId === interaction.user.id && t.state === 'offen' && t.type === type;
  });
  if (existing) return interaction.editReply(`Du hast bereits ein offenes Ticket: <#${existing.id}>`);

  const ticketId = await getNextTicketNumber(channel);
  const thread = await channel.threads.create({
    name: ticketThreadName({ ticketId, type, ownerId: interaction.user.id, title: interaction.user.username }),
    type: ChannelType.PrivateThread,
    invitable: false,
    autoArchiveDuration: 1440,
    reason: `${ticketTypes[type].label}-Ticket von ${interaction.user.username}`
  });
  await thread.members.add(interaction.user.id);
  const teamId = roleIdFromConfig(interaction.guild, config) || (supportRoleId !== 'none' ? supportRoleId : null);
  await thread.send({
    content: `<@${interaction.user.id}>`,
    embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`${ticketNumberLabel({ ticketId })} · ${ticketTypes[type].label}`)
      .setDescription('Beschreibe hier dein Anliegen. Das Support-Team kann beitreten und dir helfen. Ein Teammitglied kann eine Schließung vorschlagen; du kannst zustimmen oder ablehnen.')
      .setTimestamp()],
    components: [ticketCloseButton(teamId, notificationId)],
    allowedMentions: { users: [interaction.user.id] }
  });

  if (notificationId && notificationId !== 'none') {
    try {
      const notifications = await interaction.guild.channels.fetch(notificationId);
      if (notifications?.isTextBased() && !notifications.isThread?.()) {
        await notifications.send({
          content: teamId ? `<@&${teamId}>` : undefined,
          embeds: [new EmbedBuilder()
            .setColor(0xfee75c)
            .setTitle('Neues Ticket')
            .setDescription(`${interaction.user} hat ein neues Ticket erstellt.`)
            .addFields(
              { name: 'Ticket-ID', value: `#${ticketId}`, inline: true },
              { name: 'Ticket', value: `<#${thread.id}>`, inline: true }
            )
            .setTimestamp()],
          components: [ticketJoinButton(thread.id, teamId)],
          allowedMentions: teamId ? { roles: [teamId] } : { parse: [] }
        });
      }
    } catch (error) {
      console.error('[Tickets] Team-Benachrichtigung fehlgeschlagen:', error);
    }
  }
  return interaction.editReply(`Dein privates Ticket wurde erstellt: <#${thread.id}>`);
}

async function joinTicket(interaction, config = {}) {
  const [, , threadId, supportRoleId = 'none'] = interaction.customId.split(':');
  const thread = await interaction.guild.channels.fetch(threadId).catch(() => null);
  const ticket = parseTicketThread(thread);
  if (!ticket || ticket.state !== 'offen') return interaction.reply({ content: 'Dieses Ticket ist nicht mehr offen.', flags: MessageFlags.Ephemeral });
  if (!isTicketTeam(interaction, supportRoleId, config)) {
    return interaction.reply({ content: 'Nur das Support-Team darf beitreten.', flags: MessageFlags.Ephemeral });
  }
  await thread.members.add(interaction.user.id);
  if (interaction.component.label === 'Ticket übernehmen') {
    await interaction.update({ components: [ticketTakenButton(interaction.user.username)] });
    await thread.send({ content: `${interaction.user} hat dieses Ticket übernommen.`, allowedMentions: { parse: [] } });
  } else {
    await interaction.reply({ content: `Du bist dem Ticket beigetreten: <#${thread.id}>`, flags: MessageFlags.Ephemeral });
  }
}

async function handleTicketCommand(interaction, config = {}) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'setup') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Dafür brauchst du „Server verwalten“.', flags: MessageFlags.Ephemeral });
    }
    if (interaction.channel?.type !== ChannelType.GuildText) {
      return interaction.reply({ content: 'Bitte in einem normalen Textkanal ausführen.', flags: MessageFlags.Ephemeral });
    }
    const notifications = interaction.options.getChannel('benachrichtigungskanal', true);
    const supportRole = interaction.options.getRole('supportrolle');
    if (notifications.type !== ChannelType.GuildText) {
      return interaction.reply({ content: 'Bitte einen normalen Textkanal für Benachrichtigungen auswählen.', flags: MessageFlags.Ephemeral });
    }
    await interaction.channel.send({
      embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('Allgemeiner Support')
        .setDescription('Wähle eine Kategorie aus, um einen privaten Support-Thread zu erstellen.')],
      components: ticketPanelComponents(interaction.channel.id, supportRole?.id, notifications.id)
    });
    return interaction.reply({ content: 'Ticket-Menü eingerichtet.', flags: MessageFlags.Ephemeral });
  }

  const thread = interaction.channel;
  const ticket = parseTicketThread(thread);
  if (!ticket || ticket.state !== 'offen') {
    return interaction.reply({ content: 'Diesen Befehl kannst du nur in einem offenen Ticket verwenden.', flags: MessageFlags.Ephemeral });
  }
  const supportRoleId = await getTicketSupportRoleId(thread);
  const team = isTicketTeam(interaction, supportRoleId, config);
  const owner = interaction.user.id === ticket.ownerId;

  if (subcommand === 'close' || subcommand === 'close-anfrage') {
    if (!team) return interaction.reply({ content: 'Nur das Support-Team darf Tickets schließen oder eine Schließung anfragen.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = interaction.options.getString('grund') || null;
    if (subcommand === 'close') {
      const closed = await closeTicket(thread, ticket, interaction.user, reason);
      return interaction.editReply(closed ? `${ticketNumberLabel(ticket)} geschlossen.` : 'Das Ticket ist bereits geschlossen.');
    }
    const minutes = interaction.options.getInteger('minuten', true);
    const sent = await requestTicketClose(thread, ticket, interaction.user, minutes, reason);
    return interaction.editReply(sent
      ? `Schließungsanfrage gesendet. Ohne Antwort wird das Ticket in ${minutes} Minuten geschlossen.`
      : 'Es gibt bereits eine offene Schließungsanfrage.');
  }

  if (!team && !owner) return interaction.reply({ content: 'Dafür musst du Ticket-Ersteller oder Teil des Support-Teams sein.', flags: MessageFlags.Ephemeral });
  if (subcommand === 'add') {
    const user = interaction.options.getUser('mitglied', true);
    await thread.members.add(user.id);
    return interaction.reply({ content: `<@${user.id}> wurde hinzugefügt.`, flags: MessageFlags.Ephemeral });
  }
  if (subcommand === 'rename') {
    const title = interaction.options.getString('name', true);
    const name = ticketThreadName({ ticketId: ticket.ticketId, state: ticket.state, type: ticket.type, ownerId: ticket.ownerId, title });
    await thread.setName(name);
    return interaction.reply({ content: `Ticket umbenannt in **${name}**.`, flags: MessageFlags.Ephemeral });
  }
}

async function handleTicketInteraction(interaction, config = {}) {
  const isCommand = interaction.isChatInputCommand() && interaction.commandName === 'ticket';
  const isComponent = (interaction.isButton() || interaction.isStringSelectMenu()) &&
    interaction.customId?.startsWith('ticket:');
  if (!isCommand && !isComponent) return false;

  try {
    if (isCommand) await handleTicketCommand(interaction, config);
    else if (interaction.customId.startsWith('ticket:create:')) await createTicket(interaction, config);
    else if (interaction.isButton() && interaction.customId.startsWith('ticket:join:')) await joinTicket(interaction, config);
    else if (interaction.isButton() && interaction.customId.startsWith('ticket:close:')) {
      const ticket = parseTicketThread(interaction.channel);
      if (!ticket || ticket.state !== 'offen') {
        await interaction.reply({ content: 'Dieses Ticket ist bereits geschlossen.', flags: MessageFlags.Ephemeral });
      } else {
        const supportRoleId = interaction.customId.split(':')[2];
        if (!isTicketTeam(interaction, supportRoleId, config)) {
          await interaction.reply({ content: 'Nur das Support-Team darf eine Schließung vorschlagen.', flags: MessageFlags.Ephemeral });
        } else {
          const sent = await requestTicketClose(interaction.channel, ticket, interaction.user);
          await interaction.reply({ content: sent ? 'Schließungsvorschlag gesendet.' : 'Es gibt bereits eine offene Schließungsanfrage.', flags: MessageFlags.Ephemeral });
        }
      }
    } else if (interaction.isButton() && ['ticket:approve-close', 'ticket:deny-close'].includes(interaction.customId)) {
      const ticket = parseTicketThread(interaction.channel);
      if (!ticket || ticket.state !== 'offen') {
        await interaction.reply({ content: 'Das Ticket ist bereits geschlossen.', flags: MessageFlags.Ephemeral });
      } else if (interaction.user.id !== ticket.ownerId) {
        await interaction.reply({ content: 'Nur die Person, die das Ticket erstellt hat, darf entscheiden.', flags: MessageFlags.Ephemeral });
      } else if (interaction.customId === 'ticket:deny-close') {
        clearScheduledClosure(interaction.channel.id);
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('Schließung abgelehnt').setDescription('Das Ticket bleibt offen.')],
          components: []
        });
      } else {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Schließung bestätigt').setDescription('Das Ticket wird archiviert.')],
          components: []
        });
        await closeTicket(interaction.channel, ticket, interaction.user);
      }
    } else return false;
  } catch (error) {
    console.error('[Tickets] Interaktion fehlgeschlagen:', error);
    const response = { content: 'Beim Ticketsystem ist ein Fehler aufgetreten. Bitte informiere das Team.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => null);
    } else {
      await interaction.reply(response).catch(() => null);
    }
  }
  return true;
}

module.exports = {
  handleTicketInteraction,
  closeTicket,
  requestTicketClose
};

