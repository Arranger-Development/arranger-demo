import test from 'node:test';
import assert from 'node:assert/strict';
import { livePhraseProgress, liveProgressPath } from '../src/app/liveCellProgress.js';

test('different phrase lengths complete independent circuits on the same audio clock', () => {
  const progress = { id: 'verse', localStep: 24, fraction: 24 / 64 };
  assert.equal(livePhraseProgress(progress, 'verse', 1), .5);
  assert.equal(livePhraseProgress(progress, 'verse', 2), .75);
  assert.equal(livePhraseProgress(progress, 'verse', 4), .375);
});

test('each loop resets exactly at the boundary and accepts fractional audio positions', () => {
  assert.equal(livePhraseProgress({ id: 'a', localStep: 31.5 }, 'a', 2), 31.5 / 32);
  assert.equal(livePhraseProgress({ id: 'a', localStep: 32 }, 'a', 2), 0);
  assert.equal(livePhraseProgress({ id: 'a', localStep: 64.25 }, 'a', 2), .25 / 32);
});

test('null audible position and switching columns clear the old progress', () => {
  assert.equal(livePhraseProgress(null, 'a', 2), 0);
  assert.equal(livePhraseProgress({ id: 'b', localStep: 20 }, 'a', 2), 0);
  assert.equal(livePhraseProgress({ id: 'a', localStep: 0 }, 'a', 2), 0);
});

test('resuming uses the supplied audio position without wall-clock accumulation', () => {
  assert.equal(livePhraseProgress({ id: 'a', localStep: 19.5 }, 'a', 2), 19.5 / 32);
  assert.equal(livePhraseProgress({ id: 'a', localStep: 8 }, 'a', 2), .25);
  assert.equal(livePhraseProgress({ id: 'a', localStep: 19.5 }, 'a', 2), 19.5 / 32);
});

test('older snapshots without phrase length use bounded section progress', () => {
  assert.equal(livePhraseProgress({ id: 'a', fraction: .3 }, 'a'), .3);
  assert.equal(livePhraseProgress({ id: 'a', fraction: Infinity }, 'a'), 0);
  assert.equal(livePhraseProgress({ id: 'a', fraction: 2 }, 'a'), 1);
  assert.equal(livePhraseProgress({ id: 'a', localStep: NaN }, 'a', 2), 0);
});

test('hidden or undersized cells do not produce invalid geometry', () => {
  assert.equal(liveProgressPath(0, 0), '');
  assert.equal(liveProgressPath(6, 60), '');
  for (const height of [58, 70]) {
    const path = liveProgressPath(76, height);
    assert.ok(path.startsWith('M 38 3 H 69'));
    assert.equal((path.match(/ A /g) ?? []).length, 4);
    assert.ok(path.endsWith('H 38 Z'));
  }
});
