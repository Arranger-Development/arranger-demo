import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  areSameDrumsInstruments,
  createDrumsCell,
  getDrumsCellInstruments,
  getDrumsCellTimingOffset,
  getDrumsCellVelocity,
  mergeDrumsCellInstrument,
  toggleDrumsCellInstrument,
} from '../src/domain/drumsCells.js';

test('getDrumsCellInstruments supports current and legacy drums cell shapes', () => {
  assert.deepEqual(getDrumsCellInstruments(null), []);
  assert.deepEqual(getDrumsCellInstruments({ instruments: ['kick', 'tom', 'hihat'] }), ['kick', 'hihat']);
  assert.deepEqual(getDrumsCellInstruments({ instrument: 'snare' }), ['snare']);
});

test('createDrumsCell filters instruments and preserves drums order', () => {
  assert.deepEqual(createDrumsCell(['hihat', 'kick', 'tom', 'snare']), {
    instruments: ['kick', 'snare', 'hihat'],
  });
  assert.equal(createDrumsCell(['tom']), null);
  assert.deepEqual(createDrumsCell(['hihat', 'kick'], {
    timingOffsets: { hihat: 0.8, kick: -0.4, snare: 0.1 },
    velocities: { hihat: 0.1, kick: 0.7, snare: 0.8 },
  }), {
    instruments: ['kick', 'hihat'],
    timingOffsets: { hihat: 0.45, kick: -0.25 },
    velocities: { hihat: 0.2, kick: 0.7 },
  });
});

test('drums cell feel helpers preserve legacy defaults and normalize styled hits', () => {
  const cell = createDrumsCell(['kick', 'snare'], {
    timingOffsets: { snare: 0.16 },
    velocities: { snare: 0.72 },
  });

  assert.equal(getDrumsCellVelocity(cell, 'kick'), 1);
  assert.equal(getDrumsCellVelocity(cell, 'snare'), 0.72);
  assert.equal(getDrumsCellTimingOffset(cell, 'kick'), 0);
  assert.equal(getDrumsCellTimingOffset(cell, 'snare'), 0.16);
  assert.equal(getDrumsCellVelocity(cell, 'tom'), 1);
});

test('mergeDrumsCellInstrument and toggleDrumsCellInstrument keep cells normalized', () => {
  assert.deepEqual(mergeDrumsCellInstrument(null, 'kick'), { instruments: ['kick'] });
  assert.deepEqual(
    mergeDrumsCellInstrument({ instruments: ['kick'] }, 'hihat'),
    { instruments: ['kick', 'hihat'] },
  );
  assert.deepEqual(
    toggleDrumsCellInstrument({
      instruments: ['kick', 'hihat'],
      timingOffsets: { hihat: 0.12, kick: 0 },
      velocities: { hihat: 0.4, kick: 1 },
    }, 'kick'),
    {
      instruments: ['hihat'],
      timingOffsets: { hihat: 0.12 },
      velocities: { hihat: 0.4 },
    },
  );
  assert.equal(toggleDrumsCellInstrument({ instruments: ['snare'] }, 'snare'), null);
  assert.deepEqual(toggleDrumsCellInstrument({ instruments: ['snare'] }, 'tom'), { instruments: ['snare'] });
});

test('areSameDrumsInstruments compares ordered normalized arrays', () => {
  assert.equal(areSameDrumsInstruments(['kick', 'hihat'], ['kick', 'hihat']), true);
  assert.equal(areSameDrumsInstruments(['hihat', 'kick'], ['kick', 'hihat']), false);
  assert.equal(areSameDrumsInstruments(['kick'], ['kick', 'hihat']), false);
});
