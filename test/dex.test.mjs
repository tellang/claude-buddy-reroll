import test from 'node:test';
import assert from 'node:assert/strict';
import { findDexBuddy } from '../src/dex.mjs';

test('findDexBuddy replays saved variant without reroll attempts', () => {
  const search = findDexBuddy({
    userId: 'user-1',
    targetSpecies: 'turtle',
    entry: {
      count: 1,
      bestRarity: 'rare',
      variants: [{
        salt: 'buddy-reroll-xy',
        bones: {
          species: 'turtle',
          rarity: 'rare',
          eye: '@',
          hat: 'halo',
          shiny: false,
          stats: { DEBUGGING: 80 },
        },
      }],
    },
    rollFn: (_userId, salt) => ({
      bones: {
        species: salt === 'buddy-reroll-xy' ? 'turtle' : 'cat',
        rarity: salt === 'buddy-reroll-xy' ? 'rare' : 'common',
        eye: '@',
        hat: 'halo',
        shiny: false,
        stats: {},
      },
    }),
  });

  assert.ok(search.found);
  assert.equal(search.found.salt, 'buddy-reroll-xy');
  assert.equal(search.attempts, 0);
  assert.equal(search.criteria.source, 'saved-variant');
});

test('findDexBuddy fallback requires rarity match, not just species', () => {
  const salts = ['buddy-reroll-a1', 'buddy-reroll-a2'];
  const search = findDexBuddy({
    userId: 'user-2',
    targetSpecies: 'turtle',
    entry: { count: 2, bestRarity: 'rare' },
    randomSaltFn: () => salts.shift(),
    rollFn: (_userId, salt) => ({
      bones: salt === 'buddy-reroll-a1'
        ? { species: 'turtle', rarity: 'common', eye: '·', hat: 'none', shiny: false, stats: {} }
        : { species: 'turtle', rarity: 'rare', eye: '·', hat: 'none', shiny: false, stats: {} },
    }),
  });

  assert.ok(search.found);
  assert.equal(search.found.salt, 'buddy-reroll-a2');
  assert.equal(search.attempts, 2);
  assert.equal(search.criteria.rarity, 'rare');
});

test('findDexBuddy matches the full stored form when replay salt no longer matches', () => {
  const salts = ['buddy-reroll-a1', 'buddy-reroll-a2'];
  const search = findDexBuddy({
    userId: 'user-2',
    targetSpecies: 'turtle',
    entry: {
      count: 2,
      bestRarity: 'rare',
      variants: [{
        salt: 'buddy-reroll-legacy',
        ownerId: 'user-2',
        bones: {
          species: 'turtle',
          rarity: 'rare',
          eye: '@',
          hat: 'halo',
          shiny: true,
          stats: {},
        },
    }],
    },
    randomSaltFn: () => salts.shift(),
    rollFn: (_userId, salt) => ({
      bones: salt === 'buddy-reroll-legacy'
        ? { species: 'cat', rarity: 'common', eye: '·', hat: 'none', shiny: false, stats: {} }
        : salt === 'buddy-reroll-a1'
          ? { species: 'turtle', rarity: 'rare', eye: '@', hat: 'halo', shiny: false, stats: {} }
          : { species: 'turtle', rarity: 'rare', eye: '@', hat: 'halo', shiny: true, stats: {} },
    }),
  });

  assert.ok(search.found);
  assert.equal(search.found.salt, 'buddy-reroll-a2');
  assert.equal(search.criteria.eye, '@');
  assert.equal(search.criteria.hat, 'halo');
  assert.equal(search.criteria.shiny, true);
});

test('findDexBuddy returns null result when criteria cannot be matched', () => {
  const search = findDexBuddy({
    userId: 'user-3',
    targetSpecies: 'turtle',
    entry: { count: 1, bestRarity: 'legendary' },
    maxAttempts: 2,
    randomSaltFn: () => 'buddy-reroll-qq',
    rollFn: () => ({
      bones: { species: 'turtle', rarity: 'common', eye: '·', hat: 'none', shiny: false, stats: {} },
    }),
  });

  assert.equal(search.found, null);
  assert.equal(search.attempts, 2);
  assert.equal(search.criteria.rarity, 'legendary');
});
