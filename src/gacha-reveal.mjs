export function getRevealAction(str, key) {
  if (!key) return null;
  if (key.name === 'return') return 'next';
  if (key.name === 's') return 'skip';
  if (key.name === 'q') return 'quit';
  if (str === 'Q') return 'quit';
  if (str === 'S') return 'skip';
  return null;
}

export function findNextHighlightIndex(results, startIndex, isHighlight) {
  for (let index = startIndex; index < results.length; index++) {
    if (isHighlight(results[index])) return index;
  }
  return -1;
}
