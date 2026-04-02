import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTenPullGuarantee } from '../src/engine.mjs';

function makeResult(rarity, salt = `salt-${rarity}`) {
  return {
    salt,
    bones: {
      species: 'turtle',
      rarity,
      eye: '·',
      hat: 'none',
      shiny: false,
      stats: {},
    },
  };
}

test('applyTenPullGuarantee injects an epic when a full 10-pull batch lacks one', () => {
  const base = Array.from({ length: 10 }, (_, index) => makeResult(index % 2 === 0 ? 'common' : 'rare', `base-${index}`));
  const next = applyTenPullGuarantee(base, () => makeResult('epic', 'guaranteed-epic'), () => 0);

  assert.equal(next[0].salt, 'guaranteed-epic');
  assert.ok(next.some((result) => result.bones.rarity === 'epic'));
});

test('applyTenPullGuarantee leaves non-event partial batches untouched', () => {
  const base = Array.from({ length: 9 }, (_, index) => makeResult('common', `base-${index}`));
  const next = applyTenPullGuarantee(base, () => makeResult('epic', 'guaranteed-epic'), () => 0);

  assert.deepEqual(next, base);
});

test('applyTenPullGuarantee does not replace when batch already has epic or better', () => {
  const base = Array.from({ length: 10 }, (_, index) => makeResult(index === 4 ? 'legendary' : 'common', `base-${index}`));
  const next = applyTenPullGuarantee(base, () => makeResult('epic', 'guaranteed-epic'), () => 0);

  assert.equal(next[4].bones.rarity, 'legendary');
  assert.ok(!next.some((result) => result.salt === 'guaranteed-epic'));
});
