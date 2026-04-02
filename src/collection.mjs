// Collection (Pokédex) — tracks which buddies you've collected

import { EYES, HATS, SPECIES, RARITIES, RARITY_STARS } from './engine.mjs';
import { padAnsiEnd } from './ansi.mjs';
import { loadProfileState, saveProfileState } from './profile-state.mjs';

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
const FORMS_PER_SPECIES = (EYES.length * 2) + ((RARITIES.length - 1) * EYES.length * HATS.length * 2);

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
    ownerId: typeof variant.ownerId === 'string' ? variant.ownerId : null,
    bones: cloneBones(variant.bones),
    discoveredAt: typeof variant.discoveredAt === 'number' ? variant.discoveredAt : Date.now(),
  };
}

function variantKey(variant) {
  return [
    variant.bones.rarity,
    variant.bones.eye,
    variant.bones.hat,
    variant.bones.shiny ? 'shiny' : 'normal',
  ].join(':');
}

function compareVariants(a, b) {
  const rarityDelta = RARITY_ORDER[b.bones.rarity] - RARITY_ORDER[a.bones.rarity];
  if (rarityDelta !== 0) return rarityDelta;
  return Number(b.bones.shiny) - Number(a.bones.shiny);
}

export function getPreferredVariant(entry, ownerId = null) {
  const variants = normalizeCollectionEntry(entry, ownerId).variants;
  if (variants.length === 0) return null;
  return [...variants].sort(compareVariants)[0];
}

export function getLatestVariant(entry, ownerId = null) {
  const variants = normalizeCollectionEntry(entry, ownerId).variants;
  if (variants.length === 0) return null;
  return [...variants].sort((a, b) => (b.discoveredAt || 0) - (a.discoveredAt || 0))[0];
}

export function getCollectedRarities(entry, ownerId = null) {
  return Array.from(new Set(normalizeCollectionEntry(entry, ownerId).variants.map((variant) => variant.bones.rarity)));
}

export function getShinyVariant(entry, ownerId = null) {
  const variants = normalizeCollectionEntry(entry, ownerId).variants;
  return variants.find((variant) => variant.bones.shiny) || null;
}

export function getRarityCompletion(entry, ownerId = null) {
  const variants = normalizeCollectionEntry(entry, ownerId).variants;
  const found = new Set(variants.map((variant) => variant.bones.rarity));
  return RARITIES.map((rarity) => ({
    rarity,
    found: found.has(rarity),
  }));
}

export function normalizeCollectionEntry(entry, ownerId = null) {
  const allVariants = Array.isArray(entry?.variants)
    ? entry.variants.map(normalizeVariant).filter(Boolean)
    : [];
  const variants = ownerId
    ? allVariants.filter((variant) => !variant.ownerId || variant.ownerId === ownerId)
    : allVariants;
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

export function ingestCollectionEntry(entry, result, ownerId = null) {
  const next = normalizeCollectionEntry(entry);
  next.count += 1;

  const variant = normalizeVariant({
    salt: result?.salt,
    ownerId,
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

export function ingestCollectionResults(collection, results, ownerId = null) {
  const next = {};
  for (const species of Object.keys(collection || {})) {
    next[species] = normalizeCollectionEntry(collection[species]);
  }

  for (const result of results) {
    const species = result?.bones?.species;
    if (!species) continue;
    next[species] = ingestCollectionEntry(next[species], result, ownerId);
  }

  return next;
}

// ─── Collection ops ─────────────────────────────────

export function addToCollection(result, ownerId = null) {
  const profile = loadProfileState(ownerId || 'anon');
  profile.collection = ingestCollectionResults(profile.collection || {}, [result], ownerId);
  saveProfileState(ownerId || 'anon', profile);
  return profile.collection[result?.bones?.species];
}

export function addBatchToCollection(results, ownerId = null) {
  const profile = loadProfileState(ownerId || 'anon');
  profile.collection = ingestCollectionResults(profile.collection || {}, results, ownerId);
  saveProfileState(ownerId || 'anon', profile);
}

export function getCollection(ownerId = null) {
  const profile = loadProfileState(ownerId || 'anon');
  return ingestCollectionResults(profile.collection || {}, [], ownerId);
}

export function getCollectionStats(ownerId = null) {
  const col = getCollection(ownerId);
  const collected = Object.keys(col).length;
  const total = SPECIES.length;
  const pct = Math.round((collected / total) * 100);
  const totalPulls = Object.values(col).reduce((a, e) => a + e.count, 0);
  const shinies = Object.values(col).filter(e => e.shiny).length;
  const forms = Object.values(col).reduce((sum, entry) => sum + entry.variants.length, 0);
  const totalForms = total * FORMS_PER_SPECIES;
  return { collected, total, pct, totalPulls, shinies, forms, totalForms };
}

// ─── Collection display ─────────────────────────────

export function renderCollection(ownerId = null) {
  const col = getCollection(ownerId);
  const stats = getCollectionStats(ownerId);
  const renderedEntries = SPECIES.map((species, index) => renderSpeciesEntry(species, col[species], index));
  const leftColumnWidth = Math.max(28, ...renderedEntries.map((entry) => entry.width)) + 2;

  const lines = [
    '',
    `${BOLD}  📖 BUDDY DEX${RESET}  ${DIM}Species ${stats.collected}/${stats.total} (${stats.pct}%)${RESET}`,
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
  lines.push(`  ${DIM}Forms found: ${stats.forms}/${stats.totalForms} | Total pulls: ${stats.totalPulls} | Shinies: ${stats.shinies}${RESET}`);
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
