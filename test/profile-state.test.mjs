import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

async function withTempProfileState(run) {
  const homeDir = mkdtempSync(join(tmpdir(), 'buddy-reroll-profile-'));
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;

  try {
    const module = await import(`../src/profile-state.mjs?test=${Date.now()}-${Math.random()}`);
    await run({ homeDir, module });
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    rmSync(homeDir, { recursive: true, force: true });
  }
}

test('legacy root state migrates into the requested profile', async () => {
  await withTempProfileState(async ({ module, homeDir }) => {
    const statePath = join(homeDir, '.claude', 'buddy-reroll-state.json');
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({
      rolls: [{ date: '2026-04-02', ts: 1 }],
      bestRarity: 'epic',
      eventUses: [{ id: 'event', ts: 1 }],
      collection: { duck: { count: 1, bestRarity: 'rare', shiny: false, variants: [] } },
      starred: true,
    }, null, 2), 'utf-8');

    const profile = module.loadProfileState('user-test');

    assert.equal(profile.bestRarity, 'epic');
    assert.equal(profile.rolls.length, 1);
    assert.equal(profile.starred, true);

    const persisted = JSON.parse(readFileSync(statePath, 'utf-8'));
    assert.deepEqual(Object.keys(persisted.profiles), ['user-test']);
    assert.equal(existsSync(statePath), true);
  });
});

test('resolveKnownProfile returns exact or unique prefix matches', async () => {
  await withTempProfileState(async ({ module }) => {
    module.saveProfileState('alpha-user', module.loadProfileState('alpha-user'));
    module.saveProfileState('beta-user', module.loadProfileState('beta-user'));

    assert.equal(module.resolveKnownProfile('alpha-user'), 'alpha-user');
    assert.equal(module.resolveKnownProfile('alpha'), 'alpha-user');
    assert.equal(module.resolveKnownProfile('missing'), null);
  });
});

test('listProfileChoices keeps detected account first and deduplicated', async () => {
  await withTempProfileState(async ({ module }) => {
    module.saveProfileState('beta-user', module.loadProfileState('beta-user'));
    module.saveProfileState('alpha-user', module.loadProfileState('alpha-user'));

    assert.deepEqual(module.listProfileChoices('alpha-user'), ['alpha-user', 'beta-user']);
    assert.deepEqual(module.describeProfileChoice('alpha-user', 'alpha-user'), {
      profileId: 'alpha-user',
      isCurrent: true,
      isSaved: true,
      label: 'detected Claude account',
      detail: 'active runtime account with saved history',
    });
  });
});
