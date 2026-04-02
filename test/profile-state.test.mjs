import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const statePath = `${process.env.USERPROFILE || process.env.HOME}\\.claude\\buddy-reroll-state.json`;

test('legacy root state migrates into the requested profile', async () => {
  mkdirSync(dirname(statePath), { recursive: true });
  const original = (() => {
    try { return readFileSync(statePath, 'utf-8'); } catch { return null; }
  })();

  writeFileSync(statePath, JSON.stringify({
    rolls: [{ date: '2026-04-02', ts: 1 }],
    bestRarity: 'epic',
    eventUses: [{ id: 'event', ts: 1 }],
    collection: { duck: { count: 1, bestRarity: 'rare', shiny: false, variants: [] } },
    starred: true,
  }, null, 2), 'utf-8');

  const { loadProfileState } = await import('../src/profile-state.mjs');
  const profile = loadProfileState('user-test');

  assert.equal(profile.bestRarity, 'epic');
  assert.equal(profile.rolls.length, 1);
  assert.equal(profile.starred, true);

  if (original && typeof original === 'string') {
    writeFileSync(statePath, original, 'utf-8');
  } else {
    rmSync(statePath, { force: true });
  }
});
