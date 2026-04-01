// Claude Code Buddy Engine — exact replica of the official algorithm
// Source: cli.js v2.1.89 (deobfuscated)

const ORIGINAL_SALT = 'friend-2026-401';

const SPECIES = [
  'duck','goose','blob','cat','dragon','octopus','owl','penguin',
  'turtle','snail','ghost','axolotl','capybara','cactus','robot',
  'rabbit','mushroom','chonk'
];

const EYES = ['·','✦','×','◉','@','°'];

const HATS = ['none','crown','tophat','propeller','halo','wizard','beanie','tinyduck'];

const STATS = ['DEBUGGING','PATIENCE','CHAOS','WISDOM','SNARK'];

const RARITIES = ['common','uncommon','rare','epic','legendary'];

const RARITY_WEIGHTS = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };

const RARITY_STARS = { common: '★', uncommon: '★★', rare: '★★★', epic: '★★★★', legendary: '★★★★★' };

const RARITY_COLORS = { common: 'inactive', uncommon: 'success', rare: 'permission', epic: 'autoAccept', legendary: 'warning' };

const STAT_FLOORS = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 };

// Hash — matches Claude Code's Xk_(): Bun.hash (wyhash) primary, FNV-1a fallback
function fnv1a(str) {
  if (typeof Bun !== 'undefined') return Number(BigInt(Bun.hash(str)) & 0xffffffffn);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Mulberry32 PRNG — exact match to Claude Code's Mk_()
function mulberry32(seed) {
  let state = seed >>> 0;
  return function () {
    state |= 0;
    state = state + 1831565813 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Pick random element — exact match to $T6()
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Roll rarity — exact match to Pk_()
function rollRarity(rng) {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const r of RARITIES) {
    roll -= RARITY_WEIGHTS[r];
    if (roll < 0) return r;
  }
  return 'common';
}

// Roll stats — exact match to Dk_()
function rollStats(rng, rarity) {
  const floor = STAT_FLOORS[rarity];
  const primary = pick(rng, STATS);
  let secondary = pick(rng, STATS);
  while (secondary === primary) secondary = pick(rng, STATS);

  const stats = {};
  for (const stat of STATS) {
    if (stat === primary) {
      stats[stat] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (stat === secondary) {
      stats[stat] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[stat] = floor + Math.floor(rng() * 40);
    }
  }
  return stats;
}

// Full roll — exact match to Zk_()
function rollBones(rng) {
  const rarity = rollRarity(rng);
  return {
    bones: {
      rarity,
      species: pick(rng, SPECIES),
      eye: pick(rng, EYES),
      hat: rarity === 'common' ? 'none' : pick(rng, HATS),
      shiny: rng() < 0.01,
      stats: rollStats(rng, rarity),
    },
    inspirationSeed: Math.floor(rng() * 1e9),
  };
}

// Roll for a given userId + salt — exact match to dh1()
export function roll(userId, salt = ORIGINAL_SALT) {
  const key = userId + salt;
  const rng = mulberry32(fnv1a(key));
  return rollBones(rng);
}

// Generate a random salt (15 chars to match original length)
export function randomSalt() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'buddy-reroll-';
  let suffix = '';
  for (let i = 0; i < 15 - prefix.length; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + suffix;
}

// Multi-roll: generate N buddies with random salts
export function multiRoll(userId, count = 10) {
  const results = [];
  for (let i = 0; i < count; i++) {
    const salt = randomSalt();
    const result = roll(userId, salt);
    results.push({ salt, ...result });
  }
  return results;
}

export {
  ORIGINAL_SALT, SPECIES, EYES, HATS, STATS, RARITIES,
  RARITY_WEIGHTS, RARITY_STARS, RARITY_COLORS, STAT_FLOORS,
  fnv1a, mulberry32,
};
