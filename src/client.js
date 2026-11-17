
'use strict';

const {
  Client,
  GatewayIntentBits,
  Partials
} = require('discord.js');

// Eine gemeinsame Discord-Client-Instanz für alle Module.
// Der Login sowie die Event-Handler bleiben in bot.js.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

module.exports = { client };

