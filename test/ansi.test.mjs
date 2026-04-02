import test from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi, visibleLength, padAnsiEnd } from '../src/ansi.mjs';

test('stripAnsi removes ANSI escape sequences', () => {
  assert.equal(stripAnsi('\x1b[31mhello\x1b[0m'), 'hello');
});

test('visibleLength ignores ANSI escape sequences', () => {
  assert.equal(visibleLength('\x1b[31mhello\x1b[0m'), 5);
});

test('padAnsiEnd pads by visible width', () => {
  const padded = padAnsiEnd('\x1b[31mred\x1b[0m', 6, '.');
  assert.equal(stripAnsi(padded), 'red...');
  assert.equal(visibleLength(padded), 6);
});
