
'use strict';

// Einziger zentraler Einstiegspunkt. Discord-Events werden in bot.js verwaltet.
const { startBot, stopBot } = require('./bot');

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Bot] Beende nach ${signal} ...`);

  try {
    await stopBot();
    process.exit(0);
  } catch (error) {
    console.error('[Bot] Fehler beim Beenden:', error);
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

startBot().catch(error => {
  console.error('[Bot] Start fehlgeschlagen:', error);
  process.exitCode = 1;
});
