
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder, MessageFlags, PermissionFlagsBits
} = require('discord.js');
const { STREAMERS } = require('./streamers');
const { TwitchApi } = require('./api');
const { shouldAnnounce } = require('./transition');

function streamerRolePanel() {
  const buttons = STREAMERS.map(streamer => new ButtonBuilder()
    .setCustomId(`stream-role:${streamer.login}`)
    .setLabel(streamer.displayName)
    .setStyle(ButtonStyle.Primary));
  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  }
  return rows;
}

async function setupStreamRoles(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: 'Dafür benötigst du „Server verwalten“.', flags: MessageFlags.Ephemeral });
  }
  if (!interaction.channel?.isTextBased() || interaction.channel.isThread?.()) {
    return interaction.reply({ content: 'Bitte in einem normalen Textkanal ausführen.', flags: MessageFlags.Ephemeral });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await interaction.guild.roles.fetch();
  for (const streamer of STREAMERS) {
    if (!interaction.guild.roles.cache.some(role => role.name === streamer.roleName)) {
      await interaction.guild.roles.create({
        name: streamer.roleName,
        mentionable: false,
        reason: 'Opt-in-Rolle für Twitch-Live-Benachrichtigungen'
      });
    }
  }
  await interaction.channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x9146FF)
      .setTitle('Twitch-Benachrichtigungen')
      .setDescription('Wähle deine Streamer aus. Durch erneutes Klicken entfernst du die Ping-Rolle wieder.')],
    components: streamerRolePanel(),
    allowedMentions: { parse: [] }
  });
  return interaction.editReply('Streamer-Rollen und Auswahlmenü wurden eingerichtet.');
}

async function toggleStreamRole(interaction) {
  const login = interaction.customId.slice('stream-role:'.length).toLowerCase();
  const streamer = STREAMERS.find(item => item.login === login);
  if (!streamer) return interaction.reply({ content: 'Unbekannter Streamer.', flags: MessageFlags.Ephemeral });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const role = interaction.guild.roles.cache.find(item => item.name === streamer.roleName);
  if (!role) return interaction.editReply('Streamer-Rolle fehlt. Bitte das Auswahlmenü neu einrichten.');
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    return interaction.editReply(`Benachrichtigungen für **${streamer.displayName}** deaktiviert.`);
  }
  await member.roles.add(role);
  return interaction.editReply(`Benachrichtigungen für **${streamer.displayName}** aktiviert.`);
}

async function handleStreamInteraction(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith('stream-role:')) {
    await toggleStreamRole(interaction);
    return true;
  }
  if (interaction.isChatInputCommand() && interaction.commandName === 'stream-rollen') {
    await setupStreamRoles(interaction);
    return true;
  }
  return false;
}

function startTwitchNotifications(client, config) {
  const api = new TwitchApi(config);
  const previousStreams = new Map();
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const channel = await client.channels.fetch(config.streamAlertChannelId);
      if (!channel?.isTextBased() || !channel.guild) {
        throw new Error('Twitch-Benachrichtigungskanal ist kein Server-Textkanal.');
      }
      const live = await api.getLiveStreams(STREAMERS.map(item => item.login));
      const byLogin = new Map(live.map(stream => [stream.user_login.toLowerCase(), stream]));
      for (const streamer of STREAMERS) {
        const stream = byLogin.get(streamer.login);
        const currentId = stream?.id || null;
        const previousId = previousStreams.get(streamer.login);
        if (!shouldAnnounce(previousId, currentId)) {
          previousStreams.set(streamer.login, currentId);
          continue;
        }
        const role = channel.guild.roles.cache.find(item => item.name === streamer.roleName);
        const thumbnail = stream.thumbnail_url
          ?.replace('{width}', '1280').replace('{height}', '720');
        const embed = new EmbedBuilder()
          .setColor(0x9146FF)
          .setTitle(`${stream.user_name} ist jetzt live!`)
          .setDescription((stream.title || 'Schau im Stream vorbei!').slice(0, 4000))
          .setURL(`https://www.twitch.tv/${stream.user_login}`)
          .addFields({ name: 'Kategorie', value: stream.game_name || 'Ohne Kategorie', inline: true })
          .setTimestamp();
        if (thumbnail) embed.setImage(thumbnail);
        try {
          await channel.send({
            content: role ? `<@&${role.id}>` : undefined,
            embeds: [embed],
            allowedMentions: role ? { roles: [role.id] } : { parse: [] }
          });
          previousStreams.set(streamer.login, currentId);
        } catch (error) {
          // Beim nächsten Poll erneut probieren, statt den Stream zu verlieren.
          console.error(`[Twitch] Meldung für ${streamer.login} fehlgeschlagen:`, error);
        }
      }
    } catch (error) {
      console.error('[Twitch] Stream-Abfrage fehlgeschlagen:', error);
    } finally {
      running = false;
    }
  };

  void poll();
  return setInterval(() => void poll(), config.streamPollMinutes * 60_000);
}

module.exports = { handleStreamInteraction, startTwitchNotifications };

