export function getEventEntries(state, eventId) {
  return (state.eventUses || []).filter((event) => event.id === eventId);
}

export function hasEventEpic(state, eventId) {
  return getEventEntries(state, eventId).some((event) => event.hadEpic === true);
}

export function shouldGuaranteeEventRun({ state, eventId, mode, eventRemaining, results, isEpicResult }) {
  if (mode !== 'event') return false;
  if (eventRemaining !== 1) return false;
  if (hasEventEpic(state, eventId)) return false;
  if (results.some(isEpicResult)) return false;
  return true;
}
