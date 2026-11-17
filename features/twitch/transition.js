 // Bei einem frisch gestarteten Bot zunächst nur den Ist-Zustand merken.
 // Danach pro Twitch-Stream-ID genau eine Benachrichtigung verschicken.
function shouldAnnounce(previousId, currentId) {
  return currentId !== null && previousId !== undefined && previousId !== currentId;
}

module.exports = { shouldAnnounce };
