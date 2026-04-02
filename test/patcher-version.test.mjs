import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../src/patcher.mjs';

test('compareVersions handles the minimum supported Claude version gate', () => {
  assert.equal(compareVersions('2.1.89', '2.1.89'), 0);
  assert.equal(compareVersions('2.1.90', '2.1.89'), 1);
  assert.equal(compareVersions('2.1.88', '2.1.89'), -1);
});
