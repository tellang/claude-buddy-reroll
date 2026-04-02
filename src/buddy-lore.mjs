export const BUDDY_LORE = {
  duck: 'A tiny scout that never loses the thread. It charges first, asks questions later, and somehow returns with useful clues every time.',
  goose: 'Loud, loyal, and impossible to ignore. When danger is near, it raises the alarm long before everyone else even notices.',
  blob: 'Soft-bodied and flexible-minded. It slips around rigid rules, absorbs strange ideas, and returns with answers no one saw coming.',
  cat: 'Proud, focused, and annoyingly observant. It notices the one tiny inconsistency that turns a vague hunch into a solved problem.',
  dragon: 'Dramatic in posture, precise in execution. It specializes in turning terrible odds into unforgettable comebacks.',
  octopus: 'A multitasking specialist with a grip on every thread. It can juggle several messy tasks without dropping the important one.',
  owl: 'A slow, deep thinker with sharp night vision for patterns. It remembers what mattered and quietly cuts through noise.',
  penguin: 'Cool-headed and methodical. It lines chaos into neat rows, keeps rhythm under pressure, and refuses sloppy execution.',
  turtle: 'Slow on the surface, immovable at the core. It wins by staying steady long after everyone else starts to rush.',
  snail: 'Never fast, always recoverable. It turns mistakes into maps, then follows those maps until the route is finally clear.',
  ghost: 'Quiet, precise, and difficult to pin down. It slips through blind spots and retrieves what the room forgot to protect.',
  axolotl: 'Cheerful, regenerative, and strangely resilient. It brings broken momentum back to life without making a scene about it.',
  capybara: 'The calm center of the room. It keeps everyone steady, lowers the temperature, and makes hard work feel survivable.',
  cactus: 'Dry humor, strong defenses, and more endurance than expected. It does not move much, but it does not break easily either.',
  robot: 'Reliable, repetitive, and tireless. It handles the boring work, respects the sequence, and never complains about repetition.',
  rabbit: 'Light on its feet and first to move. If there is a narrow opening or a sudden chance, it reaches it before anyone else can react.',
  mushroom: 'Laid-back yet deeply environment-aware. It changes the whole mood of a system by quietly reshaping the space around it.',
  chonk: 'Heavy, warm, and reassuring. Expensive to carry, but once trusted, it becomes the kind of presence everyone depends on.',
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
