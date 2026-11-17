
const ticketNumbersByChannel = new Map();

// Bereinigt Texte für Discord-Thread-Namen
function safeTicketText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'anliegen';
}

// Erstellt einen einheitlichen Ticket-Namen
function ticketThreadName({
  ticketId,
  state = 'offen',
  type,
  ownerId,
  title
}) {
  const ticketPrefix = ticketId
    ? `ticket-${String(ticketId).padStart(4, '0')}-`
    : 'ticket-';

  const prefix = `${ticketPrefix}${state}-${type}-`;
  const suffix = `-${ownerId}`;
  const available = 100 - prefix.length - suffix.length;

  return `${prefix}${safeTicketText(title)
    .slice(0, Math.max(1, available))}${suffix}`;
}

// Liest Ticket-Informationen aus einem Thread-Namen
function parseTicketThread(channel) {
  if (!channel?.isThread?.()) return null;

  const numberedMatch =
    /^ticket-(\d{4,})-(offen|geschlossen)-(support|feedback|wunsch|meldung|sonstiges)-.+-(\d{17,20})$/
      .exec(channel.name);

  if (numberedMatch) {
    return {
      ticketId: numberedMatch[1],
      state: numberedMatch[2],
      type: numberedMatch[3],
      ownerId: numberedMatch[4]
    };
  }

  // Alte Tickets ohne Ticketnummer unterstützen
  const legacyMatch =
    /^ticket-(offen|geschlossen)-(support|feedback|wunsch|meldung|sonstiges)-.+-(\d{17,20})$/
      .exec(channel.name);

  if (!legacyMatch) return null;

  return {
    ticketId: null,
    state: legacyMatch[1],
    type: legacyMatch[2],
    ownerId: legacyMatch[3]
  };
}

// Ermittelt die nächste Ticketnummer
async function getNextTicketNumber(ticketChannel) {
  const cached = ticketNumbersByChannel.get(ticketChannel.id);

  if (cached) {
    const next = cached + 1;
    ticketNumbersByChannel.set(ticketChannel.id, next);
    return String(next).padStart(4, '0');
  }

  const active = await ticketChannel.threads
    .fetchActive()
    .catch(() => ({ threads: new Map() }));

  const archived = await ticketChannel.threads
    .fetchArchived({ type: 'private', limit: 100 })
    .catch(() => ({ threads: new Map() }));

  const allThreads = [
    ...active.threads.values(),
    ...archived.threads.values()
  ];

  const highest = allThreads.reduce((maximum, thread) => {
    const ticket = parseTicketThread(thread);

    return ticket?.ticketId
      ? Math.max(maximum, Number(ticket.ticketId))
      : maximum;
  }, 0);

  const next = highest + 1;

  ticketNumbersByChannel.set(ticketChannel.id, next);

  return String(next).padStart(4, '0');
}

// Gibt die Ticketnummer lesbar zurück
function ticketNumberLabel(ticket) {
  return ticket.ticketId
    ? `Ticket #${ticket.ticketId}`
    : 'Dieses Ticket';
}

// Extrahiert den ursprünglichen Ticket-Titel
function ticketTitleFromThreadName(thread, ticket) {
  if (ticket.ticketId) {
    const numbered = new RegExp(
      `^ticket-${ticket.ticketId}-(?:offen|geschlossen)-${ticket.type}-(.+)-${ticket.ownerId}$`
    ).exec(thread.name);

    if (numbered) return numbered[1];
  }

  const legacy = new RegExp(
    `^ticket-(?:offen|geschlossen)-${ticket.type}-(.+)-${ticket.ownerId}$`
  ).exec(thread.name);

  return legacy?.[1] || 'anliegen';
}

module.exports = {
  safeTicketText,
  ticketThreadName,
  parseTicketThread,
  getNextTicketNumber,
  ticketNumberLabel,
  ticketTitleFromThreadName
};

