import { RARITIES, RARITY_STARS, RARITY_WEIGHTS } from './engine.mjs';
import { padAnsiEnd, visibleLength } from './ansi.mjs';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';

const RARITY_TONE = {
  common: WHITE,
  uncommon: GREEN,
  rare: CYAN,
  epic: MAGENTA,
  legendary: '\x1b[33;1m',
};

export function renderBanner(title = 'SPEAKI BUDDY LAB', subtitle = 'npm-only buddy reroll terminal') {
  const border = '═'.repeat(54);
  return [
    '',
    `${MAGENTA}${border}${RESET}`,
    `${MAGENTA}  ${BOLD}${title}${RESET}`,
    `${DIM}  ${subtitle}${RESET}`,
    `${DIM}  collectible-rpg terminal companion${RESET}`,
    `${MAGENTA}${border}${RESET}`,
    '',
  ].join('\n');
}

export function renderPanel(title, lines = [], tone = CYAN) {
  const width = Math.max(visibleLength(title) + 6, ...lines.map((line) => visibleLength(String(line))), 28);
  const content = lines.map((line) => `  ${tone}│${RESET} ${padAnsiEnd(String(line), width - 4)} ${tone}│${RESET}`);
  return [
    `${tone}┌${'─'.repeat(width - 2)}┐${RESET}`,
    `${tone}│${RESET} ${tone}${BOLD}${title}${RESET}${' '.repeat(Math.max(0, width - visibleLength(title) - 4))}${tone}│${RESET}`,
    `${tone}├${'─'.repeat(width - 2)}┤${RESET}`,
    ...content,
    `${tone}└${'─'.repeat(width - 2)}┘${RESET}`,
    '',
  ].join('\n');
}

export function renderQuotaSummary({ used = 0, limit = 0, starred = false, eventRemaining = 0 } = {}) {
  const remaining = Math.max(0, limit - used);
  return [
    `${BOLD}Quota${RESET} ${remaining}/${limit} left${starred ? '  ⭐' : ''}`,
    `${DIM}Used today: ${used}${RESET}`,
    `${DIM}Event rerolls left: ${eventRemaining}${RESET}`,
  ];
}

export function renderRarityOverview() {
  return RARITIES.map((rarity) => {
    const pct = `${RARITY_WEIGHTS[rarity]}%`.padStart(3);
    const color = RARITY_TONE[rarity] || WHITE;
    return `${color}${RARITY_STARS[rarity].padEnd(6)}${RESET} ${color}${rarity.padEnd(10)}${RESET} ${GRAY}${pct}${RESET}`;
  });
}

export function renderHomeScreen() {
  return [
    renderBanner(),
    renderPanel('What You Can Do', [
      `${GREEN}bdy check${RESET}      current buddy + install state`,
      `${GREEN}bdy gacha 10${RESET}   run a 10-pull session`,
      `${GREEN}bdy reroll${RESET}     preview and patch a chosen buddy`,
      `${GREEN}bdy dex${RESET}        browse collected buddies`,
      `${GREEN}bdy restore${RESET}    restore original salt`,
    ]),
    renderPanel('Design Direction', [
      'Speaki-first terminal UX',
      'npm install is the primary path',
      'dex replays discovered buddies deterministically',
      'forms, rarity, and flavor presented as card sections',
    ], YELLOW),
    renderPanel('Rarity Table', renderRarityOverview(), MAGENTA),
  ].join('\n');
}

export function renderCheckScreen({ accountLabel, installLabel, salt, patched, quotaLines, buddyCard, profileLine = '' }) {
  return [
    renderBanner('SPEAKI BUDDY STATUS', 'current companion, install, and quota'),
    renderPanel('Runtime', [
      `${BOLD}Account${RESET} ${accountLabel}`,
      `${BOLD}Install${RESET} ${installLabel}`,
      `${BOLD}Salt${RESET} ${salt}${patched ? ` ${YELLOW}(patched)${RESET}` : ` ${DIM}(original)${RESET}`}`,
      ...(profileLine ? [profileLine] : []),
    ]),
    renderPanel('Quota', quotaLines, GREEN),
    buddyCard,
  ].join('\n');
}

export function renderSearchStatus({ targetSpecies, criteria, attempts }) {
  const rarityText = criteria?.rarity ? ` @ ${criteria.rarity}` : '';
  const sourceText = criteria?.source ? `${DIM}${criteria.source}${RESET}` : '';
  return `${CYAN}  Searching ${targetSpecies}${rarityText}${RESET} ${sourceText} ${DIM}(attempts: ${attempts})${RESET}`;
}

export { RESET, BOLD, DIM, CYAN, GREEN, MAGENTA, YELLOW, RED };
