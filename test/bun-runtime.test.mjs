import test from 'node:test';
import assert from 'node:assert/strict';
import { getBunCandidates } from '../src/bun-runtime.mjs';

test('getBunCandidates prefers standard Windows bun install locations', () => {
  const env = {
    USERPROFILE: 'C:\\Users\\tester',
    LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local',
    BUN_INSTALL: 'C:\\Users\\tester\\.bun',
  };

  const candidates = getBunCandidates(env);
  assert.ok(candidates.includes('C:\\Users\\tester\\.bun\\bin\\bun.exe'));
  assert.ok(candidates.includes('C:\\Users\\tester\\AppData\\Local\\Programs\\Bun\\bun.exe'));
});

test('getBunCandidates honors BUN_EXE when provided', () => {
  const env = {
    USERPROFILE: '/home/tester',
    HOME: '/home/tester',
    BUN_EXE: '/custom/bun',
  };

  const candidates = getBunCandidates(env);
  assert.equal(candidates[0], '/custom/bun');
});
