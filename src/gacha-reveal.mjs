export function getRevealAction(str, key) {
  if (!key) return null;
  if (key.name === 'return' && key.shift) return 'skip';
  if (key.name === 'return') return 'next';
  if (key.name === 's') return 'skip';
  if (key.name === 'q') return 'quit';
  if (str === 'S') return 'skip';
  if (str === 'Q') return 'quit';
  return null;
}

export function findNextHighlightIndex(results, startIndex, isHighlight) {
  for (let index = startIndex; index < results.length; index++) {
    if (isHighlight(results[index])) return index;
  }
  return -1;
}
