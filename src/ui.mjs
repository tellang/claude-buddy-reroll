import { RARITIES, RARITY_STARS, RARITY_WEIGHTS } from './engine.mjs';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const MAGENTA = '\x1b[35m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const WHITE = '\x1b[37m';

export function renderBanner(title = 'SPEAKI BUDDY LAB', subtitle = 'npm-only buddy reroll terminal') {
  const border = '═'.repeat(54);
  return [
    '',
    `${MAGENTA}${border}${RESET}`,
    `${MAGENTA}  ${BOLD}${title}${RESET}`,
    `${DIM}  ${subtitle}${RESET}`,
    `${MAGENTA}${border}${RESET}`,
    '',
  ].join('\n');
}

export function renderPanel(title, lines = [], tone = CYAN) {
  const content = lines.map((line) => `  ${line}`);
  return [
    `${tone}${BOLD}${title}${RESET}`,
    ...content,
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
    return `${WHITE}${RARITY_STARS[rarity].padEnd(6)}${RESET} ${rarity.padEnd(10)} ${DIM}${pct}${RESET}`;
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
    ], YELLOW),
    renderPanel('Rarity Table', renderRarityOverview(), MAGENTA),
  ].join('\n');
}

export function renderCheckScreen({ accountLabel, installLabel, salt, patched, quotaLines, buddyCard }) {
  return [
    renderBanner('SPEAKI BUDDY STATUS', 'current companion, install, and quota'),
    renderPanel('Runtime', [
      `${BOLD}Account${RESET} ${accountLabel}`,
      `${BOLD}Install${RESET} ${installLabel}`,
      `${BOLD}Salt${RESET} ${salt}${patched ? ` ${YELLOW}(patched)${RESET}` : ` ${DIM}(original)${RESET}`}`,
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
