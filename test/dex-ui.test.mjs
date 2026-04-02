import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDexPreview, buildProfileLensItems, getDexPreviewState, handleDexFocusInput } from '../src/dex-ui.mjs';

function makeEntry() {
  return {
    count: 4,
    bestRarity: 'rare',
    variants: [
      {
        salt: 'buddy-reroll-aa',
        bones: {
          species: 'turtle',
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
          species: 'turtle',
          rarity: 'epic',
          eye: '@',
          hat: 'halo',
          shiny: false,
          stats: { DEBUGGING: 20 },
        },
      },
      {
        salt: 'buddy-reroll-ac',
        bones: {
          species: 'turtle',
          rarity: 'epic',
          eye: '◉',
          hat: 'cap',
          shiny: true,
          stats: { DEBUGGING: 30 },
        },
      },
    ],
  };
}

test('buildProfileLensItems distinguishes detected and saved profile data', () => {
  const items = buildProfileLensItems({
    detectedUserId: 'live-user',
    knownProfiles: ['saved-user', 'live-user'],
  });

  assert.equal(items[0].value, 'live-user');
  assert.match(items[0].description, /Detected Claude account/i);
  assert.equal(items[1].value, 'saved-user');
  assert.match(items[1].description, /saved profile data/i);
});

test('handleDexFocusInput supports manual slots and cycling', () => {
  const entry = makeEntry();

  assert.deepEqual(handleDexFocusInput(entry, null, '2'), { handled: true, focusIndex: 1 });
  assert.deepEqual(handleDexFocusInput(entry, 1, ']'), { handled: true, focusIndex: 2 });
  assert.deepEqual(handleDexFocusInput(entry, 0, '['), { handled: true, focusIndex: 2 });
  assert.deepEqual(handleDexFocusInput(entry, 2, '0'), { handled: true, focusIndex: null });
  assert.deepEqual(handleDexFocusInput(entry, 2, 'x'), { handled: false, focusIndex: 2 });
});

test('getDexPreviewState resolves preferred and focused variants', () => {
  const state = getDexPreviewState(makeEntry(), { focusIndex: 1 });

  assert.equal(state.orderedVariants.length, 3);
  assert.equal(state.focusedVariant.salt, 'buddy-reroll-aa');
  assert.equal(state.preferredVariant.salt, 'buddy-reroll-ac');
});

test('buildDexPreview shows viewed vs live profile distinction and gallery tags', () => {
  const preview = buildDexPreview('turtle', makeEntry(), {
    viewedProfileId: 'saved-user',
    detectedUserId: 'live-user',
    focusIndex: 1,
  });

  assert.match(preview, /Viewing saved-us\.\.\. -> Applying on live-use\.\.\./);
  assert.match(preview, /FORM GALLERY/);
  assert.match(preview, /source saved profile/);
  assert.match(preview, />2\./);
});
