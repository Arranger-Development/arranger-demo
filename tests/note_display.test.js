import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNoteLabel } from '../src/app/noteDisplay.js';
import { getDialPitchedPreset } from '../src/data/dialPitchedPresets.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';

test('Ableton labels cover middle C, sharps, flats and negative octaves without changing chord names', () => {
  for (const [stored, displayed] of [['C4','C3'],['C#2','C#1'],['A1','A0'],['F#2','F#1'],['G#1','G#0'],['C0','C-1'],['C-1','C-2'],['Bb3','Bb2'],['Cmaj7','Cmaj7'],['','']]) {
    assert.equal(formatNoteLabel(stored),displayed);
  }
});

test('Bass 0/0 displays the Ableton progression while playback retains source MIDI pitches and precise timings', () => {
  const preset=getDialPitchedPreset('bass',0,0),before=structuredClone(preset);
  assert.deepEqual(preset.bars.map(bar=>formatNoteLabel(bar[0].note)),['C#1','A0','F#1','G#0']);
  const adapter=createMatrixPlaybackAdapter({bass:preset.bars},{totalBars:preset.barCount});
  assert.deepEqual(preset.bars.map((_,bar)=>adapter.getEventsForStep(bar,0).map(e=>[e.note,e.durationSteps,e.timingOffset??0])),[
    [['C#2',10.4,0]],[['A1',10.4,0]],[['F#2',10.4,0]],[['G#1',10.4,0]],
  ]);
  assert.deepEqual(preset,before);
});
