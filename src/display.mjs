// Display utilities for buddy cards

import { RARITY_STARS, STAT_FLOORS } from './engine.mjs';
import { renderSprite } from './sprites.mjs';
import { formatEye, formatShinyTag, formatStars, isAsciiOnlyTerminal, toTerminalSafeText } from './terminal.mjs';

const RARITY_STYLE = {
  common:    { border: '─', color: '\x1b[37m',  label: '\x1b[37m'  },  // white
  uncommon:  { border: '═', color: '\x1b[32m',  label: '\x1b[32m'  },  // green
  rare:      { border: '━', color: '\x1b[36m',  label: '\x1b[36m'  },  // cyan
  epic:      { border: '▓', color: '\x1b[35m',  label: '\x1b[35m'  },  // magenta
  legendary: { border: '█', color: '\x1b[33m',  label: '\x1b[33;1m' }, // bold yellow
};

const ASCII_BORDER = {
  common: '-',
  uncommon: '=',
  rare: '=',
  epic: '#',
  legendary: '#',
};

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

function statBar(value, max = 100) {
  const width = 20;
  const filled = Math.round((value / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled) + ` ${value}`;
}

export function renderCard(result, { showSalt = false, index = null, frame = 0 } = {}) {
  const { bones, inspirationSeed } = result;
  const { rarity, species, eye, hat, shiny, stats } = bones;
  const style = RARITY_STYLE[rarity];
  const borderChar = isAsciiOnlyTerminal() ? ASCII_BORDER[rarity] : style.border;
  const stars = formatStars(RARITY_STARS[rarity]);
  const shinyTag = shiny ? formatShinyTag(' ✨ SHINY!') : '';
  const sprite = toTerminalSafeText(renderSprite(species, formatEye(eye), hat, frame));

  const header = index !== null ? `#${index + 1} ` : '';
  const saltLine = showSalt && result.salt ? `${DIM}salt: ${result.salt}${RESET}` : '';

  const lines = [
    '',
    `${style.color}${borderChar.repeat(36)}${RESET}`,
    `${style.color}  ${header}${BOLD}${species.toUpperCase()}${RESET}${style.color}  ${stars}${shinyTag}${RESET}`,
    `${style.color}${borderChar.repeat(36)}${RESET}`,
    '',
    ...sprite.split('\n').map((line) => `  ${line}`),
    '',
    `  ${DIM}Eye:${RESET} ${formatEye(eye)}    ${DIM}Hat:${RESET} ${toTerminalSafeText(hat === 'none' ? '(none)' : hat)}`,
    '',
    `  ${DIM}Stats:${RESET}`,
  ];

  for (const stat of Object.keys(stats)) {
    const val = stats[stat];
    const isHigh = val >= STAT_FLOORS[rarity] + 40;
    const isLow = val <= STAT_FLOORS[rarity];
    const marker = isHigh ? ' ▲' : isLow ? ' ▼' : '';
    lines.push(toTerminalSafeText(`    ${stat.padEnd(10)} ${statBar(val)}${marker}`));
  }

  lines.push('');
  if (saltLine) lines.push(`  ${saltLine}`);
  lines.push(`${style.color}${borderChar.repeat(36)}${RESET}`);
  lines.push('');

  return lines.join('\n');
}

export function renderMiniCard(result, index) {
  const { bones } = result;
  const { rarity, species, eye, shiny } = bones;
  const style = RARITY_STYLE[rarity];
  const stars = formatStars(RARITY_STARS[rarity]);
  const shinyTag = shiny ? formatShinyTag('✨') : '  ';

  const idx = String(index + 1).padStart(2, ' ');
  return `${style.color}${idx}. ${formatEye(eye)} ${species.padEnd(10)} ${stars.padEnd(5)} ${shinyTag}${RESET}`;
}

// Dex rendering is handled directly in cli.mjs
