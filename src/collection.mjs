// Collection (Pokédex) — tracks which buddies you've collected

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { SPECIES, RARITIES, RARITY_STARS } from './engine.mjs';
import { padAnsiEnd } from './ansi.mjs';

const HOME = process.env.USERPROFILE || process.env.HOME || '';
const STATE_PATH = resolve(HOME, '.claude', 'buddy-reroll-state.json');

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const GRAY = '\x1b[90m';

const RARITY_COLOR = {
  common: '\x1b[37m',
  uncommon: GREEN,
  rare: CYAN,
  epic: MAGENTA,
  legendary: '\x1b[33;1m',
};

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };

function cloneBones(bones) {
  return {
    rarity: bones.rarity,
    species: bones.species,
    eye: bones.eye,
    hat: bones.hat,
    shiny: Boolean(bones.shiny),
    stats: { ...bones.stats },
  };
}

function normalizeVariant(variant) {
  if (!variant?.salt || !variant?.bones?.species || !variant?.bones?.rarity) return null;
  return {
    salt: variant.salt,
    bones: cloneBones(variant.bones),
    discoveredAt: typeof variant.discoveredAt === 'number' ? variant.discoveredAt : Date.now(),
  };
}

function variantKey(variant) {
  return `${variant.bones.rarity}:${variant.bones.shiny ? 'shiny' : 'normal'}`;
}

function compareVariants(a, b) {
  const rarityDelta = RARITY_ORDER[b.bones.rarity] - RARITY_ORDER[a.bones.rarity];
  if (rarityDelta !== 0) return rarityDelta;
  return Number(b.bones.shiny) - Number(a.bones.shiny);
}

export function getPreferredVariant(entry) {
  const variants = normalizeCollectionEntry(entry).variants;
  if (variants.length === 0) return null;
  return [...variants].sort(compareVariants)[0];
}

export function normalizeCollectionEntry(entry) {
  const variants = Array.isArray(entry?.variants)
    ? entry.variants.map(normalizeVariant).filter(Boolean)
    : [];
  const uniqueVariants = [];
  const seenVariantKeys = new Set();

  for (const variant of variants) {
    const key = variantKey(variant);
    if (seenVariantKeys.has(key)) continue;
    seenVariantKeys.add(key);
    uniqueVariants.push(variant);
  }

  const preferred = uniqueVariants.length > 0 ? [...uniqueVariants].sort(compareVariants)[0] : null;
  const bestRarity = preferred?.bones.rarity || (entry?.bestRarity && entry.bestRarity in RARITY_ORDER ? entry.bestRarity : 'common');
  const shiny = preferred?.bones.shiny || Boolean(entry?.shiny);

  return {
    count: Number.isFinite(entry?.count) ? entry.count : 0,
    bestRarity,
    firstSeen: typeof entry?.firstSeen === 'number' ? entry.firstSeen : Date.now(),
    shiny,
    variants: uniqueVariants,
  };
}

export function ingestCollectionEntry(entry, result) {
  const next = normalizeCollectionEntry(entry);
  next.count += 1;

  const variant = normalizeVariant({
    salt: result?.salt,
    bones: result?.bones,
    discoveredAt: Date.now(),
  });

  if (variant) {
    const key = variantKey(variant);
    const existingIndex = next.variants.findIndex((item) => variantKey(item) === key);
    if (existingIndex === -1) {
      next.variants.push(variant);
    } else if (compareVariants(variant, next.variants[existingIndex]) < 0) {
      next.variants[existingIndex] = variant;
    }
  }

  const preferred = getPreferredVariant(next);
  if (preferred) {
    next.bestRarity = preferred.bones.rarity;
    next.shiny = next.shiny || preferred.bones.shiny;
  } else if (result?.bones?.rarity && RARITY_ORDER[result.bones.rarity] > RARITY_ORDER[next.bestRarity]) {
    next.bestRarity = result.bones.rarity;
    next.shiny = next.shiny || Boolean(result.bones.shiny);
  }

  return next;
}

export function ingestCollectionResults(collection, results) {
  const next = {};
  for (const species of Object.keys(collection || {})) {
    next[species] = normalizeCollectionEntry(collection[species]);
  }

  for (const result of results) {
    const species = result?.bones?.species;
    if (!species) continue;
    next[species] = ingestCollectionEntry(next[species], result);
  }

  return next;
}

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

export function addToCollection(result) {
  const state = loadState();
  const current = state.collection || {};
  state.collection = ingestCollectionResults(current, [result]);
  saveState(state);
  return state.collection[result?.bones?.species];
}

export function addBatchToCollection(results) {
  const state = loadState();
  state.collection = ingestCollectionResults(state.collection || {}, results);
  saveState(state);
}

export function getCollection() {
  const state = loadState();
  return ingestCollectionResults(state.collection || {}, []);
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
  const renderedEntries = SPECIES.map((species, index) => renderSpeciesEntry(species, col[species], index));
  const leftColumnWidth = Math.max(28, ...renderedEntries.map((entry) => entry.width)) + 2;

  const lines = [
    '',
    `${BOLD}  📖 BUDDY DEX${RESET}  ${DIM}${stats.collected}/${stats.total} (${stats.pct}%)${RESET}`,
    `  ${'─'.repeat(40)}`,
    '',
  ];

  const barWidth = 36;
  const filled = Math.round((stats.collected / stats.total) * barWidth);
  const bar = `${GREEN}${'█'.repeat(filled)}${GRAY}${'░'.repeat(barWidth - filled)}${RESET}`;
  lines.push(`  ${bar} ${stats.pct}%`);
  lines.push('');

  for (let i = 0; i < renderedEntries.length; i += 2) {
    const left = padAnsiEnd(renderedEntries[i].text, leftColumnWidth);
    const right = i + 1 < renderedEntries.length ? renderedEntries[i + 1].text : '';
    lines.push(`  ${left}${right}`);
  }

  lines.push('');
  lines.push(`  ${DIM}Pick a species number to roll for it!${RESET}`);
  lines.push(`  ${DIM}Total pulls: ${stats.totalPulls} | Shinies: ${stats.shinies}${RESET}`);
  lines.push(`\n${BOLD}  Rarities${RESET}`);

  for (const rarity of RARITIES) {
    const count = Object.values(col).filter((entry) => entry.bestRarity === rarity).length;
    const color = RARITY_COLOR[rarity];
    lines.push(`    ${color}${RARITY_STARS[rarity].padEnd(6)}${RESET} ${rarity.padEnd(10)} ${count > 0 ? `x${count}` : `${DIM}x0${RESET}`}`);
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
    const text = `${color}${num}. ${species.padEnd(10)} ${stars}${shinyTag}${countTag}${RESET}`;
    return { text, width: `${num}. ${species.padEnd(10)} ${stars}${shinyTag}${countTag}`.length };
  }

  const text = `${GRAY}${num}. ${'???'.padEnd(10)} -${RESET}`;
  return { text, width: `${num}. ${'???'.padEnd(10)} -`.length };
}
