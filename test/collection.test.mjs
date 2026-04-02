import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestCollectionResults, normalizeCollectionEntry, getPreferredVariant } from '../src/collection.mjs';

test('normalizeCollectionEntry preserves legacy count and rarity', () => {
  const normalized = normalizeCollectionEntry({
    count: 3,
    bestRarity: 'rare',
    firstSeen: 123,
    shiny: true,
  });

  assert.equal(normalized.count, 3);
  assert.equal(normalized.bestRarity, 'rare');
  assert.equal(normalized.firstSeen, 123);
  assert.equal(normalized.shiny, true);
  assert.deepEqual(normalized.variants, []);
});

test('ingestCollectionResults stores replayable variants with salt and bones', () => {
  const collection = ingestCollectionResults({}, [{
    salt: 'buddy-reroll-aa',
    bones: {
      species: 'turtle',
      rarity: 'rare',
      eye: '·',
      hat: 'halo',
      shiny: false,
      stats: { DEBUGGING: 10 },
    },
  }]);

  assert.equal(collection.turtle.count, 1);
  assert.equal(collection.turtle.bestRarity, 'rare');
  assert.equal(collection.turtle.variants.length, 1);
  assert.equal(collection.turtle.variants[0].salt, 'buddy-reroll-aa');
  assert.equal(collection.turtle.variants[0].bones.species, 'turtle');
});

test('getPreferredVariant returns highest rarity variant', () => {
  const entry = normalizeCollectionEntry({
    count: 2,
    bestRarity: 'common',
    variants: [
      {
        salt: 'buddy-reroll-ab',
        bones: {
          species: 'turtle',
          rarity: 'common',
          eye: '·',
          hat: 'none',
          shiny: false,
          stats: { DEBUGGING: 10 },
        },
      },
      {
        salt: 'buddy-reroll-ac',
        bones: {
          species: 'turtle',
          rarity: 'epic',
          eye: '@',
          hat: 'crown',
          shiny: false,
          stats: { DEBUGGING: 90 },
        },
      },
    ],
  });

  const preferred = getPreferredVariant(entry);
  assert.equal(preferred.salt, 'buddy-reroll-ac');
  assert.equal(preferred.bones.rarity, 'epic');
});

test('ingestCollectionResults keeps different eye and hat combinations as separate forms', () => {
  const collection = ingestCollectionResults({}, [
    {
      salt: 'buddy-reroll-aa',
      bones: {
        species: 'ghost',
        rarity: 'rare',
        eye: '·',
        hat: 'none',
        shiny: false,
        stats: { DEBUGGING: 10 },
      },
    },
    {
      salt: 'buddy-reroll-ab',
      bones: {
        species: 'ghost',
        rarity: 'rare',
        eye: '@',
        hat: 'tophat',
        shiny: false,
        stats: { DEBUGGING: 10 },
      },
    },
  ]);

  assert.equal(collection.ghost.variants.length, 2);
});

test('getCollection-style normalization can scope variants by owner', () => {
  const collection = ingestCollectionResults({}, [
    {
      salt: 'buddy-reroll-aa',
      bones: {
        species: 'ghost',
        rarity: 'rare',
        eye: '·',
        hat: 'none',
        shiny: false,
        stats: { DEBUGGING: 10 },
      },
    },
    {
      salt: 'buddy-reroll-ab',
      bones: {
        species: 'ghost',
        rarity: 'epic',
        eye: '@',
        hat: 'tophat',
        shiny: false,
        stats: { DEBUGGING: 10 },
      },
    },
  ], 'user-a');

  const mixed = ingestCollectionResults(collection, [{
    salt: 'buddy-reroll-ac',
    bones: {
      species: 'ghost',
      rarity: 'legendary',
      eye: '◉',
      hat: 'crown',
      shiny: true,
      stats: { DEBUGGING: 10 },
    },
  }], 'user-b');

  const scoped = normalizeCollectionEntry(mixed.ghost, 'user-a');
  assert.equal(scoped.variants.length, 2);
  assert.equal(scoped.bestRarity, 'epic');
});
