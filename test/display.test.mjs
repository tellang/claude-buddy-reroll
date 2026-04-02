import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCard } from '../src/display.mjs';

test('renderCard includes sprite output and ASCII-safe glyphs in ASCII mode', () => {
  const previous = process.env.BDY_FORCE_ASCII;
  process.env.BDY_FORCE_ASCII = '1';

  try {
    const rendered = renderCard({
      salt: 'buddy-reroll-aa',
      bones: {
        species: 'turtle',
        rarity: 'epic',
        eye: '✦',
        hat: 'halo',
        shiny: true,
        stats: {
          DEBUGGING: 88,
          PATIENCE: 41,
          CHAOS: 22,
          WISDOM: 77,
          SNARK: 35,
        },
      },
    }, { showSalt: true });

    assert.match(rendered, /TURTLE/);
    assert.match(rendered, /\(\s*o\s*\)/);
    assert.match(rendered, /\/\.\s*\.\s*\.\s*\\/);
    assert.doesNotMatch(rendered, /✨|✦|★|╬/);
  } finally {
    if (previous === undefined) delete process.env.BDY_FORCE_ASCII;
    else process.env.BDY_FORCE_ASCII = previous;
  }
});
