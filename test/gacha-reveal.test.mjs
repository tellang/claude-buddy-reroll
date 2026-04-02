import test from 'node:test';
import assert from 'node:assert/strict';
import { findNextHighlightIndex, getRevealAction } from '../src/gacha-reveal.mjs';

test('getRevealAction maps enter, s, and q', () => {
  assert.equal(getRevealAction('', { name: 'return', shift: false }), 'next');
  assert.equal(getRevealAction('S', { name: 's' }), 'skip');
  assert.equal(getRevealAction('q', { name: 'q' }), 'quit');
});

test('findNextHighlightIndex finds the next epic-or-better stop', () => {
  const results = [
    { bones: { rarity: 'common' } },
    { bones: { rarity: 'rare' } },
    { bones: { rarity: 'epic' } },
    { bones: { rarity: 'legendary' } },
  ];

  const index = findNextHighlightIndex(results, 1, (result) => ['epic', 'legendary'].includes(result.bones.rarity));
  assert.equal(index, 2);
});

test('findNextHighlightIndex returns -1 when nothing qualifies', () => {
  const results = [
    { bones: { rarity: 'common' } },
    { bones: { rarity: 'rare' } },
  ];

  const index = findNextHighlightIndex(results, 0, (result) => ['epic', 'legendary'].includes(result.bones.rarity));
  assert.equal(index, -1);
});
