import test from 'node:test';
import assert from 'node:assert/strict';
import { isAsciiOnlyTerminal, toTerminalSafeText } from '../src/terminal.mjs';

test('toTerminalSafeText converts Unicode glyphs in ASCII mode', () => {
  const previous = process.env.BDY_FORCE_ASCII;
  process.env.BDY_FORCE_ASCII = '1';

  try {
    assert.equal(toTerminalSafeText('✦ turtle ★ ✨'), '* turtle * *');
    assert.equal(isAsciiOnlyTerminal(), true);
  } finally {
    if (previous === undefined) delete process.env.BDY_FORCE_ASCII;
    else process.env.BDY_FORCE_ASCII = previous;
  }
});

test('toTerminalSafeText preserves Unicode glyphs when ASCII mode is disabled', () => {
  const previous = process.env.BDY_FORCE_ASCII;
  process.env.BDY_FORCE_ASCII = '0';

  try {
    assert.equal(toTerminalSafeText('✦ turtle ★ ✨'), '✦ turtle ★ ✨');
    assert.equal(isAsciiOnlyTerminal(), false);
  } finally {
    if (previous === undefined) delete process.env.BDY_FORCE_ASCII;
    else process.env.BDY_FORCE_ASCII = previous;
  }
});
