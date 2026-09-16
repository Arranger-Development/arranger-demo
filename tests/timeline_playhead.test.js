import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STEPS_PER_BAR } from '../src/domain/musicConstants.js';
import { getTimelinePlayheadSeekPosition } from '../src/app/timelinePlayhead.js';

test('getTimelinePlayheadSeekPosition snaps client x to a sixteenth-note step', () => {
  const rect = { left: 100, width: 800 };

  assert.deepEqual(getTimelinePlayheadSeekPosition(100, rect), { bar: 0, flatStep: 0, step: 0 });
  assert.deepEqual(getTimelinePlayheadSeekPosition(106.25, rect), { bar: 0, flatStep: 1, step: 1 });
  assert.deepEqual(getTimelinePlayheadSeekPosition(300, rect), { bar: 2, flatStep: 32, step: 0 });
  assert.deepEqual(getTimelinePlayheadSeekPosition(350, rect), { bar: 2, flatStep: 40, step: 8 });
});

test('getTimelinePlayheadSeekPosition clamps to the timeline bounds', () => {
  const rect = { left: 100, width: 800 };

  assert.deepEqual(getTimelinePlayheadSeekPosition(40, rect), { bar: 0, flatStep: 0, step: 0 });
  assert.deepEqual(
    getTimelinePlayheadSeekPosition(960, rect),
    { bar: 7, flatStep: 8 * STEPS_PER_BAR - 1, step: STEPS_PER_BAR - 1 },
  );
});

test('getTimelinePlayheadSeekPosition rejects unusable geometry', () => {
  assert.equal(getTimelinePlayheadSeekPosition(100, { left: 0, width: 0 }), null);
  assert.equal(getTimelinePlayheadSeekPosition(Number.NaN, { left: 0, width: 800 }), null);
});
