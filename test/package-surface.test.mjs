import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf-8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

test('package metadata reflects npm-first positioning', () => {
  assert.match(pkg.description, /npm/i);
  assert.ok(pkg.files.includes('README.md'));
  assert.ok(!pkg.files.includes('.claude-plugin/'));
  assert.ok(!pkg.files.includes('SKILL.md'));
});

test('README removes plugin marketplace emphasis and documents npm-first flow', () => {
  assert.doesNotMatch(readme, /plugin marketplace add/i);
  assert.match(readme, /npm i -g claude-buddy-reroll/i);
  assert.match(readme, /npm-only 제품 표면/i);
});
