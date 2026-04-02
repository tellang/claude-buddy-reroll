import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldGuaranteeEventRun } from '../src/event-state.mjs';

function makeResult(rarity) {
  return { bones: { rarity } };
}

test('shouldGuaranteeEventRun only triggers on the final event run when no prior epic exists', () => {
  const shouldGuarantee = shouldGuaranteeEventRun({
    state: {
      eventUses: [
        { id: 'event-1', hadEpic: false },
        { id: 'event-1', hadEpic: false },
      ],
    },
    eventId: 'event-1',
    mode: 'event',
    eventRemaining: 1,
    results: [makeResult('common'), makeResult('rare')],
    isEpicResult: (result) => result.bones.rarity === 'epic' || result.bones.rarity === 'legendary',
  });

  assert.equal(shouldGuarantee, true);
});

test('shouldGuaranteeEventRun does not trigger when a prior event run already had an epic', () => {
  const shouldGuarantee = shouldGuaranteeEventRun({
    state: {
      eventUses: [
        { id: 'event-1', hadEpic: true },
        { id: 'event-1', hadEpic: false },
      ],
    },
    eventId: 'event-1',
    mode: 'event',
    eventRemaining: 1,
    results: [makeResult('common')],
    isEpicResult: (result) => result.bones.rarity === 'epic' || result.bones.rarity === 'legendary',
  });

  assert.equal(shouldGuarantee, false);
});

test('shouldGuaranteeEventRun does not trigger on non-final or non-event runs', () => {
  assert.equal(shouldGuaranteeEventRun({
    state: { eventUses: [] },
    eventId: 'event-1',
    mode: 'event',
    eventRemaining: 2,
    results: [makeResult('common')],
    isEpicResult: () => false,
  }), false);

  assert.equal(shouldGuaranteeEventRun({
    state: { eventUses: [] },
    eventId: 'event-1',
    mode: 'daily',
    eventRemaining: 1,
    results: [makeResult('common')],
    isEpicResult: () => false,
  }), false);
});
