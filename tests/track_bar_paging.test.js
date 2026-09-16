import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canPageTrackClipBars,
  getAdjacentTrackClipBar,
  getSortedTrackClipBars,
} from '../src/app/trackBarPaging.js';

function createClips(entries) {
  return {
    ids: entries.map(({ id }) => id),
    byId: Object.fromEntries(entries.map((clip) => [clip.id, clip])),
  };
}

test('getAdjacentTrackClipBar cycles through existing clips for one track only', () => {
  const clips = createClips([
    { id: 'drums-bar-0', trackId: 'drums', bar: 0 },
    { id: 'bass-bar-1', trackId: 'bass', bar: 1 },
    { id: 'drums-bar-2', trackId: 'drums', bar: 2 },
    { id: 'drums-bar-5', trackId: 'drums', bar: 5 },
  ]);

  assert.deepEqual(getSortedTrackClipBars(clips, 'drums'), [0, 2, 5]);
  assert.equal(getAdjacentTrackClipBar(clips, 'drums', 0, 'next'), 2);
  assert.equal(getAdjacentTrackClipBar(clips, 'drums', 2, 'next'), 5);
  assert.equal(getAdjacentTrackClipBar(clips, 'drums', 5, 'next'), 0);
  assert.equal(getAdjacentTrackClipBar(clips, 'drums', 0, 'previous'), 5);
  assert.equal(getAdjacentTrackClipBar(clips, 'drums', 2, 'previous'), 0);
});

test('getAdjacentTrackClipBar returns null when the active track cannot page', () => {
  const oneTrackClip = createClips([
    { id: 'chord-bar-3', trackId: 'chord', bar: 3 },
    { id: 'bass-bar-4', trackId: 'bass', bar: 4 },
  ]);
  const noTrackClips = createClips([
    { id: 'bass-bar-4', trackId: 'bass', bar: 4 },
  ]);

  assert.equal(canPageTrackClipBars(oneTrackClip, 'chord'), false);
  assert.equal(getAdjacentTrackClipBar(oneTrackClip, 'chord', 3, 'next'), null);
  assert.equal(getAdjacentTrackClipBar(oneTrackClip, 'chord', 3, 'previous'), null);
  assert.equal(canPageTrackClipBars(noTrackClips, 'chord'), false);
  assert.equal(getAdjacentTrackClipBar(noTrackClips, 'chord', 3, 'next'), null);
  assert.equal(getAdjacentTrackClipBar(oneTrackClip, 'chord', 0, 'next'), null);
});

test('canPageTrackClipBars requires at least two clips on the same track', () => {
  const clips = createClips([
    { id: 'melody-bar-0', trackId: 'melody', bar: 0 },
    { id: 'melody-bar-7', trackId: 'melody', bar: 7 },
    { id: 'pad-bar-3', trackId: 'pad', bar: 3 },
  ]);

  assert.equal(canPageTrackClipBars(clips, 'melody'), true);
  assert.equal(canPageTrackClipBars(clips, 'pad'), false);
});

test('track paging covers optional visible tracks', () => {
  const clips = createClips([
    { id: 'pad-bar-1', trackId: 'pad', bar: 1 },
    { id: 'pad-bar-6', trackId: 'pad', bar: 6 },
    { id: 'sample-bar-2', trackId: 'sample', bar: 2 },
    { id: 'sample-bar-4', trackId: 'sample', bar: 4 },
    { id: 'vocal-bar-0', trackId: 'vocal', bar: 0 },
    { id: 'vocal-bar-5', trackId: 'vocal', bar: 5 },
  ]);

  assert.equal(getAdjacentTrackClipBar(clips, 'pad', 1, 'next'), 6);
  assert.equal(getAdjacentTrackClipBar(clips, 'sample', 4, 'next'), 2);
  assert.equal(getAdjacentTrackClipBar(clips, 'vocal', 0, 'previous'), 5);
});
