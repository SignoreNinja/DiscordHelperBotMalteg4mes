require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { commands } = require('../src/commands');

const required = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'GUILD_ID'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} fehlt in .env`);
  }
}

const rest = new REST({ version: '10' })
  .setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands.map(command => command.toJSON())
      }
    );

    console.log(`${data.length} Slash-Commands registriert.`);
  } catch (error) {
    console.error('Fehler beim Registrieren:', error);
    process.exitCode = 1;
  }
}

registerCommands();

