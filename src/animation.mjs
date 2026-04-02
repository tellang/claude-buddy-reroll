// Egg hatching animation for buddy gacha reveal

const RESET     = '\x1b[0m';
const BOLD      = '\x1b[1m';
const DIM       = '\x1b[2m';
const GREEN     = '\x1b[32m';
const YELLOW    = '\x1b[33m';
const CYAN      = '\x1b[36m';
const MAGENTA   = '\x1b[35m';
const BLINK     = '\x1b[5m';

const RARITY_COLOR = {
  common:    RESET,
  uncommon:  GREEN,
  rare:      CYAN,
  epic:      MAGENTA,
  legendary: BOLD + YELLOW,
};

const RARITY_REVEAL_DELAY = {
  common:    0,
  uncommon:  500,
  rare:      800,
  epic:      1200,
  legendary: 2000,
};

// 11 frames — offsets for shake: 0,1,-1,1 then crack progression
const FRAMES = [
  // Frame 0-3: shake (rendered with offset applied per-frame)
  [
    '    _____    ',
    '   /     \\   ',
    '  /       \\  ',
    ' |         | ',
    '  \\       /  ',
    '   \\_____/   ',
  ],
  [
    '    _____    ',
    '   /     \\   ',
    '  /       \\  ',
    ' |         | ',
    '  \\       /  ',
    '   \\_____/   ',
  ],
  [
    '    _____    ',
    '   /     \\   ',
    '  /       \\  ',
    ' |         | ',
    '  \\       /  ',
    '   \\_____/   ',
  ],
  [
    '    _____    ',
    '   /     \\   ',
    '  /       \\  ',
    ' |         | ',
    '  \\       /  ',
    '   \\_____/   ',
  ],
  // Frame 4: dot crack
  [
    '    _____    ',
    '   /     \\   ',
    '  /       \\  ',
    ' |    .    | ',
    '  \\       /  ',
    '   \\_____/   ',
  ],
  // Frame 5: crack starts
  [
    '    _____    ',
    '   /     \\   ',
    '  /       \\  ',
    ' |    \u256f    | ',
    '  \\       /  ',
    '   \\_____/   ',
  ],
  // Frame 6-7: crack widens
  [
    '    _____    ',
    '   /  .  \\   ',
    '  /  \u256f \\  \\  ',
    ' |  \u256f   \\  | ',
    '  \\   .   /  ',
    '   \\_____/   ',
  ],
  [
    '    _____    ',
    '   /  .  \\   ',
    '  /  \u256f \\  \\  ',
    ' |  \u256f   \\  | ',
    '  \\   .   /  ',
    '   \\_____/   ',
  ],
  // Frame 8-9: splitting
  [
    '    __ __    ',
    '   / V V \\   ',
    '  / \u256f   \\ \\  ',
    ' | \u256f     \\ | ',
    '  \\   \u256f   /  ',
    '   \\__\u256f__/   ',
  ],
  [
    '    __ __    ',
    '   / V V \\   ',
    '  / \u256f   \\ \\  ',
    ' | \u256f     \\ | ',
    '  \\   \u256f   /  ',
    '   \\__\u256f__/   ',
  ],
  // Frame 10: explosion
  [
    '   \u256c   \u256c   ',
    '  \u256c       \u256c  ',
    ' \u256c    \u2728    \u256c ',
    '  \u256c       \u256c  ',
    ' \u256c    \u2605    \u256c ',
    '   \u256c   \u256c   ',
  ],
];

// Horizontal offsets per shake frame (frames 0-3)
const SHAKE_OFFSETS = [0, 1, -1, 1];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pad(line, offset) {
  if (offset === 0) return line;
  if (offset > 0) return ' '.repeat(offset) + line;
  // negative: trim leading spaces
  const trimCount = Math.min(-offset, line.length - line.trimStart().length);
  return line.slice(trimCount);
}

function renderFrame(frameLines, offset, color) {
  return frameLines.map(l => color + pad(l, offset) + RESET).join('\n');
}

function clearLines(n, out) {
  // Move cursor up n lines then to start of line
  out.write(`\x1b[${n}A\r`);
}

export async function playHatchAnimation(bones) {
  const out = process.stdout;

  // Skip animation if stdout is not a TTY (piped/redirected)
  if (!out.isTTY) {
    return;
  }

  const { rarity } = bones;
  const color = RARITY_COLOR[rarity] || RESET;
  const frameHeight = 6;

  // Hide cursor
  out.write('\x1b[?25l');

  try {
    // ── Shake phase: 3 cycles × 4 frames = 12 iterations ─────────────
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let f = 0; f < 4; f++) {
        const offset = SHAKE_OFFSETS[f];
        out.write(renderFrame(FRAMES[f], offset, DIM) + '\n');
        await sleep(160);
        clearLines(frameHeight, out);
      }
    }

    // ── Crack progression: frames 4-9 ─────────────────────────────────
    for (let f = 4; f <= 9; f++) {
      out.write(renderFrame(FRAMES[f], 0, f >= 6 ? CYAN : DIM) + '\n');
      await sleep(160);
      clearLines(frameHeight, out);
    }

    // ── Explosion frame: frame 10 ──────────────────────────────────────
    out.write(renderFrame(FRAMES[10], 0, BOLD + YELLOW) + '\n');
    await sleep(300);
    clearLines(frameHeight, out);

    // ── Rarity-based reveal delay ──────────────────────────────────────
    const delay = RARITY_REVEAL_DELAY[rarity] ?? 0;

    if (rarity === 'legendary') {
      // Gold border shimmer while waiting
      const shimmerFrames = Math.floor(delay / 200);
      for (let i = 0; i < shimmerFrames; i++) {
        const shimmerColor = i % 2 === 0 ? BOLD + YELLOW : YELLOW;
        out.write(renderFrame(FRAMES[10], 0, shimmerColor) + '\n');
        await sleep(200);
        clearLines(frameHeight, out);
      }
    } else if (rarity === 'epic') {
      // Brief magenta flash
      out.write(renderFrame(FRAMES[10], 0, BOLD + MAGENTA) + '\n');
      await sleep(delay);
      clearLines(frameHeight, out);
    } else {
      // Clear the frame, just wait
      out.write(renderFrame(FRAMES[10], 0, DIM) + '\n');
      await sleep(delay);
      clearLines(frameHeight, out);
    }

    // ── Reveal panel ───────────────────────────────────────────────────
    const { species, eye, hat, shiny, stats } = bones;
    const shinyTag = shiny ? ' \u2728 SHINY!' : '';
    const rarityStars = { common: '★', uncommon: '★★', rare: '★★★', epic: '★★★★', legendary: '★★★★★' };
    const stars = rarityStars[rarity] || '';

    // Epic/Legendary get extra sparkle lines before reveal
    if (rarity === 'epic' || rarity === 'legendary') {
      out.write(`${color}  ·  ✧  ·  ✧  ·  ✧  ·${RESET}\n`);
    }

    if (rarity === 'legendary') {
      // Slow typewriter reveal for legendary
      const title = `  ✦ ${species.toUpperCase()} ${stars} ✦${shinyTag}`;
      out.write(color);
      for (const ch of title) {
        out.write(ch);
        await sleep(60);
      }
      out.write(RESET + '\n');
    } else {
      out.write(`${color}  ✦ ${species.toUpperCase()} ${stars} ✦${shinyTag}${RESET}\n`);
    }

    // Epic/Legendary get extra sparkle lines after reveal
    if (rarity === 'epic' || rarity === 'legendary') {
      out.write(`${color}  ·  ✧  ·  ✧  ·  ✧  ·${RESET}\n`);
    }

    // Brief pause so the reveal is visible before caller prints the card
    await sleep(500);

  } finally {
    // Always restore cursor
    out.write('\x1b[?25h');
  }
}

export async function playQuickReveal(bones) {
  // No animation — used for --no-animation flag or non-TTY output
  const { rarity, species, shiny } = bones;
  const color = RARITY_COLOR[rarity] || RESET;
  const shinyTag = shiny ? ' \u2728 SHINY!' : '';
  const rarityStars = { common: '★', uncommon: '★★', rare: '★★★', epic: '★★★★', legendary: '★★★★★' };
  const stars = rarityStars[rarity] || '';
  process.stdout.write(`${color}  ${species.toUpperCase()}  ${stars}${shinyTag}${RESET}\n`);
}
