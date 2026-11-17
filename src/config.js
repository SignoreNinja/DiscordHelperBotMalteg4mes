
'use strict';

require('dotenv').config();

function optionalEnv(name) {
  return process.env[name]?.trim() || null;
}

function pollMinutes(value) {
  const minutes = Number(value);

  return Number.isFinite(minutes) && minutes >= 1
    ? Math.min(60, Math.floor(minutes))
    : 5;
}

const config = Object.freeze({
  // Discord
  guildId: optionalEnv('GUILD_ID'),
  teamRoleName: optionalEnv('TEAM_ROLE_NAME') || 'Team',

  // Ticket-System
  ticketNotificationChannelId: optionalEnv(
    'TICKET_NOTIFICATION_CHANNEL_ID'
  ),

  // Twitch-Benachrichtigungen
  streamAlertChannelId: optionalEnv('STREAM_ALERT_CHANNEL_ID'),
  twitchClientId: optionalEnv('TWITCH_CLIENT_ID'),
  twitchClientSecret: optionalEnv('TWITCH_CLIENT_SECRET'),
  streamPollMinutes: pollMinutes(
    process.env.STREAM_POLL_MINUTES
  )
});

module.exports = { config };

