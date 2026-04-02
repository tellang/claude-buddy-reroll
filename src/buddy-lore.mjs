export const BUDDY_LORE = {
  duck: 'A tiny scout who never loses the thread. It charges first and asks questions later.',
  goose: 'Loud, loyal, and impossible to ignore. It spots trouble before anyone else does.',
  blob: 'Soft-bodied and flexible-minded. It finds answers where the rules run out.',
  cat: 'Proud, focused, and annoyingly observant. Small anomalies rarely escape it.',
  dragon: 'Looks dramatic, thinks precisely. A high-risk fixer built for flipping bad odds.',
  octopus: 'A multitasking specialist that can hold several threads together at once.',
  owl: 'A slow, deep thinker with excellent night vision for patterns and hidden structure.',
  penguin: 'Cool-headed and orderly. It excels at lining up messy systems into clean rows.',
  turtle: 'Slow on the surface, immovable at the core. It wins by refusing to panic.',
  snail: 'Not fast, but incredibly recoverable. It turns setbacks into data and keeps going.',
  ghost: 'Quiet, precise, and hard to catch. It slips through gaps and retrieves what others miss.',
  axolotl: 'Cheerful and regenerative. It is oddly good at bringing broken momentum back to life.',
  capybara: 'The calm center of the room. It keeps everyone steady even when things speed up.',
  cactus: 'Dry humor, strong defenses. It endures longer than anyone expects.',
  robot: 'Reliable, repetitive, and tireless. It handles the boring work without complaint.',
  rabbit: 'Light on its feet and first to move. If there is an opening, it will take it.',
  mushroom: 'Laid-back but environment-aware. It shifts the whole mood around it.',
  chonk: 'Heavy, warm, and reassuring. Costly to carry, but deeply comforting once trusted.',
};

export function wrapLore(text, width = 22, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, width - 1))}…`;
  }

  while (lines.length < maxLines) lines.push('');
  return lines;
}
