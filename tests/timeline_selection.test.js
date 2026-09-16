import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRulerTimelineSelection,
  createTimelineSelection,
  getTimelineCellFromPoint,
  getTimelineSelectionClipIds,
  getTimelineSelectionPlaybackOptions,
  isTimelineCellSelected,
  shouldStartTimelineMarquee,
} from '../src/app/timelineSelection.js';

const TRACK_IDS = ['drums', 'chord', 'bass', 'melody'];

test('track marquee starts only for an unlocked Shift + primary-button gesture', () => {
  assert.equal(shouldStartTimelineMarquee({
    button: 0,
    shiftKey: true,
    tutorialLocked: false,
  }), true);
  assert.equal(shouldStartTimelineMarquee({
    button: 0,
    shiftKey: false,
    tutorialLocked: false,
  }), false);
  assert.equal(shouldStartTimelineMarquee({
    button: 1,
    shiftKey: true,
    tutorialLocked: false,
  }), false);
  assert.equal(shouldStartTimelineMarquee({
    button: 0,
    shiftKey: true,
    tutorialLocked: true,
  }), false);
});

test('timeline pointer positions clamp to visible track and bar cells', () => {
  const rect = {
    bottom: 400,
    height: 400,
    left: 100,
    right: 900,
    top: 0,
    width: 800,
  };

  assert.deepEqual(getTimelineCellFromPoint({
    clientX: 251,
    clientY: 150,
    rect,
    trackIds: TRACK_IDS,
  }), {
    bar: 1,
    trackId: 'chord',
  });
  assert.deepEqual(getTimelineCellFromPoint({
    clientX: 1000,
    clientY: -20,
    rect,
    trackIds: TRACK_IDS,
  }), {
    bar: 7,
    trackId: 'drums',
  });
});

test('timeline selection normalizes reverse drags into a rectangular range', () => {
  const selection = createTimelineSelection(
    { bar: 5, trackId: 'melody' },
    { bar: 2, trackId: 'chord' },
    TRACK_IDS,
  );

  assert.deepEqual(selection, {
    startBar: 2,
    endBar: 5,
    trackIds: ['chord', 'bass', 'melody'],
  });
  assert.equal(isTimelineCellSelected(selection, 'bass', 4), true);
  assert.equal(isTimelineCellSelected(selection, 'drums', 4), false);
  assert.equal(isTimelineCellSelected(selection, 'melody', 6), false);
});

test('timeline selection treats a Shift click as a single track and bar cell', () => {
  assert.deepEqual(
    createTimelineSelection(
      { bar: 3, trackId: 'bass' },
      { bar: 3, trackId: 'bass' },
      TRACK_IDS,
    ),
    {
      startBar: 3,
      endBar: 3,
      trackIds: ['bass'],
    },
  );
});

test('ruler selection starts at the first visible track and follows the grid focus', () => {
  assert.deepEqual(
    createRulerTimelineSelection(
      5,
      { bar: 2, trackId: 'bass' },
      TRACK_IDS,
    ),
    {
      startBar: 2,
      endBar: 5,
      trackIds: ['drums', 'chord', 'bass'],
    },
  );
  assert.equal(createRulerTimelineSelection(2, null, TRACK_IDS), null);
  assert.equal(createRulerTimelineSelection(2, { bar: 3, trackId: 'pad' }, TRACK_IDS), null);
});

test('timeline selection finds clips and creates bounded playback options', () => {
  const selection = {
    startBar: 2,
    endBar: 4,
    trackIds: ['drums', 'chord'],
  };
  const clips = {
    ids: ['drums-bar-2', 'chord-bar-4', 'bass-bar-3', 'drums-bar-6'],
    byId: {
      'drums-bar-2': { id: 'drums-bar-2', trackId: 'drums', bar: 2 },
      'chord-bar-4': { id: 'chord-bar-4', trackId: 'chord', bar: 4 },
      'bass-bar-3': { id: 'bass-bar-3', trackId: 'bass', bar: 3 },
      'drums-bar-6': { id: 'drums-bar-6', trackId: 'drums', bar: 6 },
    },
  };

  assert.deepEqual(
    getTimelineSelectionClipIds(clips, selection),
    ['drums-bar-2', 'chord-bar-4'],
  );
  assert.deepEqual(getTimelineSelectionPlaybackOptions(selection), {
    audibleTrackIds: ['drums', 'chord'],
    bar: 2,
    maxPlaybackSteps: 48,
    step: 0,
  });
});
