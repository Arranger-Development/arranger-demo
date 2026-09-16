import { test } from 'node:test';
import assert from 'node:assert/strict';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import { APP_COMMAND_TYPES } from '../src/input/appCommands.js';
import {
  createLaunchpadXChordGestureController,
  LAUNCHPAD_X_CHORD_LONG_PRESS_MS,
} from '../src/input/launchpadXChordGesture.js';

function createScheduler() {
  let elapsed = 0;
  let nextId = 1;
  const tasks = new Map();

  return {
    advance(milliseconds) {
      elapsed += milliseconds;
      [...tasks.entries()]
        .filter(([, task]) => task.deadline <= elapsed)
        .sort(([, left], [, right]) => left.deadline - right.deadline)
        .forEach(([id, task]) => {
          tasks.delete(id);
          task.callback();
        });
    },
    cancel(id) {
      tasks.delete(id);
    },
    schedule(callback, delay) {
      const id = nextId;
      nextId += 1;
      tasks.set(id, { callback, deadline: elapsed + delay });
      return id;
    },
  };
}

function createHarness() {
  const commands = [];
  const matrix = createInitialMatrix();
  matrix.chord[2][0] = {
    type: 'chord',
    label: 'C',
    sourceChordLabel: 'C',
  };
  let context = {
    chordActive: true,
    chordHarmonyState: null,
    matrix,
    selectedBar: 2,
  };
  const scheduler = createScheduler();
  const controller = createLaunchpadXChordGestureController({
    cancelSchedule: scheduler.cancel,
    dispatch: (command) => commands.push(command),
    getContext: () => context,
    schedule: scheduler.schedule,
  });

  return {
    commands,
    controller,
    scheduler,
    setContext: (nextContext) => {
      context = { ...context, ...nextContext };
    },
  };
}

test('Chord long-press threshold is 300ms', () => {
  assert.equal(LAUNCHPAD_X_CHORD_LONG_PRESS_MS, 300);
});

test('existing Chord steps delete once when released before the long-press threshold', () => {
  const { commands, controller, scheduler } = createHarness();

  assert.equal(controller.handle([0x90, 81, 127]), true);
  scheduler.advance(299);
  assert.deepEqual(commands, []);
  assert.equal(controller.handle([0x90, 81, 0]), true);
  assert.deepEqual(commands, [{
    type: APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM,
    bar: 2,
    step: 0,
  }]);

  scheduler.advance(1);
  assert.equal(controller.handle([0x80, 81, 64]), false);
  assert.equal(commands.length, 1);
});

test('holding an existing Chord step for 300ms opens Harmony Edit without deleting', () => {
  const { commands, controller, scheduler } = createHarness();

  assert.equal(controller.handle([0x90, 81, 127]), true);
  scheduler.advance(300);
  assert.deepEqual(commands, [{
    type: APP_COMMAND_TYPES.CHORD_OPEN_HARMONY,
    bar: 2,
    step: 0,
  }]);

  assert.equal(controller.handle([0x80, 81, 10]), true);
  assert.equal(commands.length, 1);
});

test('empty Chord steps and Harmony-layer presses bypass the hold gesture', () => {
  const { commands, controller, setContext } = createHarness();

  assert.equal(controller.handle([0x90, 82, 127]), false);
  setContext({
    chordHarmonyState: {
      bar: 2,
      step: 0,
      enrichOptions: [{ name: 'C' }],
      passingOptions: [],
    },
  });
  assert.equal(controller.handle([0x90, 81, 127]), false);
  assert.deepEqual(commands, []);
});

test('duplicate Note On does not restart a pending hold and context changes cancel it', () => {
  const { commands, controller, scheduler, setContext } = createHarness();

  assert.equal(controller.handle([0x90, 81, 127]), true);
  scheduler.advance(200);
  assert.equal(controller.handle([0x90, 81, 100]), true);
  setContext({ chordActive: false });
  scheduler.advance(100);
  assert.deepEqual(commands, []);
  assert.equal(controller.handle([0x90, 81, 0]), false);
});

test('cancelling a pending gesture prevents later delete or Harmony commands', () => {
  const { commands, controller, scheduler } = createHarness();

  controller.handle([0x90, 81, 127]);
  controller.cancel();
  scheduler.advance(300);
  assert.equal(controller.handle([0x90, 81, 0]), false);
  assert.deepEqual(commands, []);
});
