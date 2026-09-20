import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepeatPadController } from '../src/app/repeatPadController.js';

function setup() {
  const events = [];
  const controller = createRepeatPadController((event) => events.push(event));
  return { controller, events };
}

test('each repeat pad sends its own division and current BPM', () => {
  const { controller, events } = setup();
  for (const division of [4, 8, 16]) {
    controller.press(`p${division}`, division, 120 + division);
    assert.equal(controller.getSnapshot(), division);
    controller.release(`p${division}`);
  }
  assert.deepEqual(events, [4, 8, 16].flatMap(division => [
    { held: true, division, bpm: 120 + division }, { held: false },
  ]));
});

test('latest pointer takes over; releasing old pointer cannot stop it', () => {
  const { controller, events } = setup();
  controller.press('pointer:1', 4, 120);
  controller.press('pointer:2', 16, 120);
  controller.release('pointer:1');
  controller.releaseDivision(4);
  assert.equal(controller.getSnapshot(), 16);
  assert.equal(events.length, 2);
  controller.release('pointer:2');
  assert.equal(controller.getSnapshot(), null);
  assert.deepEqual(events.at(-1), { held: false });
});

test('releasing latest owner does not resume an older held pad', () => {
  const { controller, events } = setup();
  controller.press('pointer:1', 4, 120);
  controller.press('key:8', 8, 120);
  controller.release('key:8');
  controller.release('pointer:1');
  assert.equal(controller.getSnapshot(), null);
  assert.equal(events.length, 3);
});

test('repeat keydown and duplicate pointer release are idempotent', () => {
  const { controller, events } = setup();
  controller.press('key:4', 4, 120);
  controller.press('key:4', 4, 120);
  controller.release('key:4');
  controller.release('key:4');
  assert.equal(events.length, 2);
});

test('blur, disable and unmount reset clear ownership; stale releases stay harmless', () => {
  const { controller, events } = setup();
  controller.press('pointer:1', 16, 120);
  controller.reset();
  controller.reset();
  controller.press('pointer:2', 8, 90);
  controller.release('pointer:1');
  assert.equal(controller.getSnapshot(), 8);
  assert.deepEqual(events, [{ held: true, division: 16, bpm: 120 }, { held: false }, { held: true, division: 8, bpm: 90 }]);
});

test('track controllers are isolated and subscribers observe only effective changes', () => {
  const a = setup(), b = setup();
  const snapshots = [];
  const unsubscribe = a.controller.subscribe(() => snapshots.push(a.controller.getSnapshot()));
  a.controller.press('p1', 4, 120);
  b.controller.press('p1', 16, 120);
  a.controller.reset();
  assert.equal(b.controller.getSnapshot(), 16);
  assert.deepEqual(snapshots, [4, null]);
  unsubscribe();
  a.controller.press('invalid', 3, 120);
  assert.equal(a.events.length, 2);
});
