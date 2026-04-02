// Collection (Pokédex) — tracks which buddies you've collected

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SPECIES, RARITIES, RARITY_STARS, RARITY_WEIGHTS } from './engine.mjs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const STATE_PATH = resolve(HOME, '.claude', 'buddy-reroll-state.json');

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';

const RARITY_COLOR = {
  common: '\x1b[37m',
  uncommon: GREEN,
  rare: CYAN,
  epic: MAGENTA,
  legendary: `\x1b[33;1m`,
};

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

// ─── State I/O ──────────────────────────────────────

function loadState() {
  try {
    if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {}
  return {};
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

// ─── Collection ops ─────────────────────────────────

export function addToCollection(bones) {
  const state = loadState();
  if (!state.collection) state.collection = {};

  const { species, rarity, shiny } = bones;
  const entry = state.collection[species] || {
    count: 0,
    bestRarity: 'common',
    firstSeen: Date.now(),
    shiny: false,
  };

  entry.count++;
  if (RARITY_ORDER[rarity] > RARITY_ORDER[entry.bestRarity]) {
    entry.bestRarity = rarity;
  }
  if (shiny) entry.shiny = true;

  state.collection[species] = entry;
  saveState(state);
  return entry;
}

export function addBatchToCollection(results) {
  const state = loadState();
  if (!state.collection) state.collection = {};

  for (const r of results) {
    const { species, rarity, shiny } = r.bones;
    const entry = state.collection[species] || {
      count: 0,
      bestRarity: 'common',
      firstSeen: Date.now(),
      shiny: false,
    };
    entry.count++;
    if (RARITY_ORDER[rarity] > RARITY_ORDER[entry.bestRarity]) {
      entry.bestRarity = rarity;
    }
    if (shiny) entry.shiny = true;
    state.collection[species] = entry;
  }

  saveState(state);
}

export function getCollection() {
  const state = loadState();
  return state.collection || {};
}

export function getCollectionStats() {
  const col = getCollection();
  const collected = Object.keys(col).length;
  const total = SPECIES.length;
  const pct = Math.round((collected / total) * 100);
  const totalPulls = Object.values(col).reduce((a, e) => a + e.count, 0);
  const shinies = Object.values(col).filter(e => e.shiny).length;
  return { collected, total, pct, totalPulls, shinies };
}

// ─── Collection display ─────────────────────────────

export function renderCollection() {
  const col = getCollection();
  const stats = getCollectionStats();

  const lines = [
    '',
    `${BOLD}  📖 BUDDY DEX${RESET}  ${DIM}${stats.collected}/${stats.total} (${stats.pct}%)${RESET}`,
    `  ${'─'.repeat(40)}`,
    '',
  ];

  // Progress bar
  const barWidth = 36;
  const filled = Math.round((stats.collected / stats.total) * barWidth);
  const bar = `${GREEN}${'█'.repeat(filled)}${GRAY}${'░'.repeat(barWidth - filled)}${RESET}`;
  lines.push(`  ${bar} ${stats.pct}%`);
  lines.push('');

  // Species grid (2 columns)
  for (let i = 0; i < SPECIES.length; i += 2) {
    const left = renderSpeciesEntry(SPECIES[i], col[SPECIES[i]], i);
    const right = i + 1 < SPECIES.length
      ? renderSpeciesEntry(SPECIES[i + 1], col[SPECIES[i + 1]], i + 1)
      : '';
    lines.push(`  ${left}    ${right}`);
  }

  lines.push('');
  lines.push(`  ${DIM}Total pulls: ${stats.totalPulls} | Shinies: ${stats.shinies}${RESET}`);

  // Rarity breakdown
  lines.push(`\n${BOLD}  Rarities${RESET}`);
  for (const r of RARITIES) {
    const count = Object.values(col).filter(e => e.bestRarity === r).length;
    const color = RARITY_COLOR[r];
    lines.push(`    ${color}${RARITY_STARS[r].padEnd(6)}${RESET} ${r.padEnd(10)} ${count > 0 ? `x${count}` : `${DIM}x0${RESET}`}`);
  }

  lines.push('');
  return lines.join('\n');
}

function renderSpeciesEntry(species, entry, index) {
  const num = String(index + 1).padStart(2);
  if (entry) {
    const color = RARITY_COLOR[entry.bestRarity];
    const stars = RARITY_STARS[entry.bestRarity];
    const shinyTag = entry.shiny ? ' ✨' : '';
    const countTag = entry.count > 1 ? ` x${entry.count}` : '';
    return `${color}${num}. ${species.padEnd(10)} ${stars}${shinyTag}${countTag}${RESET}`;
  } else {
    return `${GRAY}${num}. ${'???'.padEnd(10)} -${RESET}`;
  }
}
