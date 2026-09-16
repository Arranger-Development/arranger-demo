import { test } from 'node:test';
import assert from 'node:assert/strict';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import { APP_COMMAND_TYPES } from '../src/input/appCommands.js';
import {
  LAUNCHPAD_X_CAPTURE_MIDI_CC,
  LAUNCHPAD_X_NEXT_CLIP_CC,
  LAUNCHPAD_X_PREVIOUS_CLIP_CC,
  LAUNCHPAD_X_STOP_CLIP_CC,
  LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK,
  mapLaunchpadXMessageToCommand,
} from '../src/input/launchpadXMap.js';
import {
  findLaunchpadXMidiInput,
  findLaunchpadXMidiOutput,
} from '../src/input/launchpadXPorts.js';
import {
  createLaunchpadXDrumsLedFrame,
  LAUNCHPAD_X_LED_COLORS,
  LAUNCHPAD_X_TRACK_MUTE_LED_COLORS,
} from '../src/input/launchpadXDrumsSurface.js';
import {
  createLaunchpadXChordLedFrame,
  LAUNCHPAD_X_CHORD_LED_COLORS,
} from '../src/input/launchpadXChordSurface.js';
import {
  createLaunchpadXMelodyLedFrame,
  getLaunchpadXMelodyNote,
  LAUNCHPAD_X_MELODY_LED_COLORS,
  LAUNCHPAD_X_MELODY_ROWS,
} from '../src/input/launchpadXMelodySurface.js';
import {
  formatMidiMessage,
  parseLaunchpadXMessage,
} from '../src/input/launchpadXProtocol.js';

const ACTIVE_DRUMS = Object.freeze({
  drumsActive: true,
  drumsClipBars: Object.freeze([0, 2, 3, 5]),
  selectedBar: 3,
});

const ACTIVE_CHORD = Object.freeze({
  chordActive: true,
  chordClipBars: Object.freeze([0, 2, 3, 5]),
  selectedBar: 3,
});

const ACTIVE_MELODY = Object.freeze({
  melodyActive: true,
  melodyClipBars: Object.freeze([0, 2, 3, 5]),
  melodyRecordingState: Object.freeze({ phase: 'overview' }),
  melodyScaleId: 'chinese',
  melodyTemplateSteps: Object.freeze([2, 4, 8, 12, 14]),
  selectedBar: 3,
});

function createHarmonyContext({ selectedOption, step = 0 } = {}) {
  const matrix = createInitialMatrix();
  matrix.chord[3][step] = {
    type: 'chord',
    label: step === 14 ? 'E7' : 'Cmaj7',
    sourceChordLabel: 'C',
    grooveTemplateId: step === 14 ? 'passing-shortcut' : 'custom-rhythm',
  };
  matrix.chord[3][1] = {
    type: 'chord',
    label: 'C',
    sourceChordLabel: 'C',
    grooveTemplateId: 'custom-rhythm',
  };

  return {
    ...ACTIVE_CHORD,
    chordHarmonyState: {
      bar: 3,
      canApplyPassing: step === 14,
      currentLabel: step === 14 ? 'E7' : 'Cmaj7',
      enrichOptions: [{ name: 'C' }, { name: 'Cmaj7' }, { name: 'Csus2' }],
      passingOptions: step === 14 ? [{ name: 'E7' }, { name: 'Bø' }] : [],
      selectedOption: selectedOption ?? (step === 14
        ? { mode: 'passing', name: 'E7', optionIndex: 0 }
        : { mode: 'enrich', name: 'Cmaj7', optionIndex: 1 }),
      sourceChordLabel: 'C',
      step,
      targetChordLabel: 'Am',
    },
    matrix,
  };
}

function findMessage(frame, status, number) {
  return frame.find((message) => message[0] === status && message[1] === number);
}

test('Launchpad X protocol normalizes note presses and both release forms', () => {
  assert.deepEqual(parseLaunchpadXMessage([0x90, 11, 127]), {
    channel: 1,
    kind: 'note',
    number: 11,
    pressed: true,
    value: 127,
  });
  assert.deepEqual(parseLaunchpadXMessage([0x90, 11, 0]), {
    channel: 1,
    kind: 'note',
    number: 11,
    pressed: false,
    value: 0,
  });
  assert.deepEqual(parseLaunchpadXMessage([0x80, 11, 64]), {
    channel: 1,
    kind: 'note',
    number: 11,
    pressed: false,
    value: 64,
  });
});

test('Launchpad X protocol parses control changes and ignores aftertouch or malformed data', () => {
  assert.deepEqual(parseLaunchpadXMessage([0xb0, 98, 127]), {
    channel: 1,
    kind: 'control-change',
    number: 98,
    pressed: true,
    value: 127,
  });
  assert.deepEqual(parseLaunchpadXMessage([0xb0, 98, 0]), {
    channel: 1,
    kind: 'control-change',
    number: 98,
    pressed: false,
    value: 0,
  });
  assert.equal(parseLaunchpadXMessage([0xa0, 11, 63]), null);
  assert.equal(parseLaunchpadXMessage([0x90, 11]), null);
  assert.equal(parseLaunchpadXMessage(null), null);
});

test('Launchpad X raw messages format as fixed-width hexadecimal bytes', () => {
  assert.equal(formatMidiMessage([0x90, 11, 127]), '90 0B 7F');
  assert.equal(formatMidiMessage(new Uint8Array([0xb0, 98, 0])), 'B0 62 00');
  assert.equal(formatMidiMessage(null), '');
});

test('six drum rows map both 8-step halves to the selected bar', () => {
  const cases = [
    [81, 'kick', 0],
    [88, 'kick', 7],
    [71, 'snare', 0],
    [78, 'snare', 7],
    [61, 'hihat', 0],
    [68, 'hihat', 7],
    [51, 'kick', 8],
    [58, 'kick', 15],
    [41, 'snare', 8],
    [48, 'snare', 15],
    [31, 'hihat', 8],
    [38, 'hihat', 15],
  ];

  cases.forEach(([note, instrument, step]) => {
    assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, note, 127], ACTIVE_DRUMS), {
      type: APP_COMMAND_TYPES.DRUMS_TOGGLE,
      bar: 3,
      step,
      instrument,
      preview: true,
    });
  });
});

test('seventh-row left pads preview drums without creating toggle commands', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 21, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_PREVIEW,
    instrument: 'kick',
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 22, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_PREVIEW,
    instrument: 'snare',
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 23, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_PREVIEW,
    instrument: 'hihat',
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 24, 127], ACTIVE_DRUMS), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 28, 127], ACTIVE_DRUMS), null);
});

test('bottom row selects Drums clip bars one through eight', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 11, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    bar: 0,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 18, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    bar: 7,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 11, 0], ACTIVE_DRUMS), null);
});

test('drum grid and previews require an open Drums context and ignore releases or other channels', () => {
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 81, 127], { drumsActive: false, selectedBar: 3 }), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 21, 127], { drumsActive: false, selectedBar: 3 }), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 11, 127], { drumsActive: false, selectedBar: 3 }), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 81, 0], ACTIVE_DRUMS), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x80, 81, 127], ACTIVE_DRUMS), null);
  assert.equal(mapLaunchpadXMessageToCommand([0xa0, 81, 127], ACTIVE_DRUMS), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x91, 81, 127], ACTIVE_DRUMS), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 81, 127], { drumsActive: true, selectedBar: -1 }), null);
});

test('top left and right buttons cycle through existing Drums clips', () => {
  assert.equal(LAUNCHPAD_X_PREVIOUS_CLIP_CC, 93);
  assert.equal(LAUNCHPAD_X_NEXT_CLIP_CC, 94);
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 93, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    bar: 2,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 94, 127], ACTIVE_DRUMS), {
    type: APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    bar: 5,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 93, 127], {
    ...ACTIVE_DRUMS,
    selectedBar: 0,
  }), {
    type: APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    bar: 5,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 94, 127], {
    ...ACTIVE_DRUMS,
    selectedBar: 5,
  }), {
    type: APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    bar: 0,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 94, 127], {
    ...ACTIVE_DRUMS,
    drumsClipBars: [3],
  }), null);
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 94, 0], ACTIVE_DRUMS), null);
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 94, 127], {
    ...ACTIVE_DRUMS,
    drumsActive: false,
  }), null);
});

test('top two rows map all sixteen Chord rhythm steps', () => {
  const cases = [
    [81, 0],
    [88, 7],
    [71, 8],
    [78, 15],
  ];

  cases.forEach(([note, step]) => {
    assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, note, 127], ACTIVE_CHORD), {
      type: APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM,
      bar: 3,
      step,
    });
  });
});

test('Chord rows three through seven stay unused and bottom row selects bars', () => {
  [61, 58, 41, 38, 21, 28].forEach((note) => {
    assert.equal(mapLaunchpadXMessageToCommand([0x90, note, 127], ACTIVE_CHORD), null);
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 11, 127], ACTIVE_CHORD), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_CLIP,
    bar: 0,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 18, 127], ACTIVE_CHORD), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_CLIP,
    bar: 7,
  });
});

test('Chord clip buttons wrap sparse existing clips and require an active Chord editor', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 93, 127], ACTIVE_CHORD), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_CLIP,
    bar: 2,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 94, 127], {
    ...ACTIVE_CHORD,
    selectedBar: 5,
  }), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_CLIP,
    bar: 0,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 94, 127], {
    ...ACTIVE_CHORD,
    chordClipBars: [3],
  }), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 81, 0], ACTIVE_CHORD), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 81, 127], {
    ...ACTIVE_CHORD,
    chordActive: false,
  }), null);
});

test('Melody rows three through five map the selected scale across C3 to C5', () => {
  assert.deepEqual(LAUNCHPAD_X_MELODY_ROWS, [
    { noteStart: 31, octave: 3 },
    { noteStart: 41, octave: 4 },
    { noteStart: 51, octave: 5 },
  ]);
  assert.equal(getLaunchpadXMelodyNote(31, 'chinese'), 'C3');
  assert.equal(getLaunchpadXMelodyNote(35, 'chinese'), 'A3');
  assert.equal(getLaunchpadXMelodyNote(36, 'chinese'), null);
  assert.equal(getLaunchpadXMelodyNote(41, 'chinese'), 'C4');
  assert.equal(getLaunchpadXMelodyNote(45, 'chinese'), 'A4');
  assert.equal(getLaunchpadXMelodyNote(51, 'chinese'), 'C5');
  assert.equal(getLaunchpadXMelodyNote(55, 'chinese'), 'A5');

  assert.equal(getLaunchpadXMelodyNote(31, 'blues'), 'C3');
  assert.equal(getLaunchpadXMelodyNote(33, 'blues'), 'D#3');
  assert.equal(getLaunchpadXMelodyNote(36, 'blues'), 'A3');
  assert.equal(getLaunchpadXMelodyNote(37, 'blues'), null);
});

test('Melody pads emit note-on and note-off while unused pads stay dark and silent', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 31, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.MELODY_NOTE_ON,
    inputId: 'launchpad:31',
    note: 'C3',
    source: 'launchpad',
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 37, 0], {
    ...ACTIVE_MELODY,
    activeMelodyNotes: new Map([[37, 'B3']]),
  }), {
    type: APP_COMMAND_TYPES.MELODY_NOTE_OFF,
    inputId: 'launchpad:37',
    note: 'B3',
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x80, 51, 64], {
    ...ACTIVE_MELODY,
    activeMelodyNotes: new Map([[51, 'C5']]),
  }), {
    type: APP_COMMAND_TYPES.MELODY_NOTE_OFF,
    inputId: 'launchpad:51',
    note: 'C5',
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 38, 127], ACTIVE_MELODY), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 61, 127], ACTIVE_MELODY), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x91, 31, 127], ACTIVE_MELODY), null);
});

test('Melody step rows select template steps while overview keeps the note area playable', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 83, 127], {
    ...ACTIVE_MELODY,
    melodyRecordingState: { phase: 'overview' },
  }), {
    type: APP_COMMAND_TYPES.MELODY_SELECT_STEP,
    bar: 3,
    step: 2,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 75, 127], {
    ...ACTIVE_MELODY,
    melodyRecordingState: { phase: 'overview' },
  }), {
    type: APP_COMMAND_TYPES.MELODY_SELECT_STEP,
    bar: 3,
    step: 12,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 82, 127], ACTIVE_MELODY), null);
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 31, 127], {
    ...ACTIVE_MELODY,
    melodyRecordingState: { phase: 'overview' },
  }), {
    type: APP_COMMAND_TYPES.MELODY_NOTE_ON,
    inputId: 'launchpad:31',
    note: 'C3',
    source: 'launchpad',
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 61, 127], ACTIVE_MELODY), null);
});

test('Melody note-off uses the note-on scale mapping after the note area hides', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 31, 0], {
    ...ACTIVE_MELODY,
    activeMelodyNotes: new Map([[31, 'C3']]),
    melodyRecordingState: { phase: 'overview' },
    melodyScaleId: 'pentatonic',
  }), {
    type: APP_COMMAND_TYPES.MELODY_NOTE_OFF,
    inputId: 'launchpad:31',
    note: 'C3',
  });
});

test('Melody bottom row selects bars and page buttons cycle existing clips', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 11, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.MELODY_SELECT_CLIP,
    bar: 0,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 18, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.MELODY_SELECT_CLIP,
    bar: 7,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 93, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.MELODY_SELECT_CLIP,
    bar: 2,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 94, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.MELODY_SELECT_CLIP,
    bar: 5,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 11, 0], ACTIVE_MELODY), null);
});

test('Capture controls transport in every Melody phase', () => {
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 98, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 98, 127], {
    ...ACTIVE_MELODY,
    melodyRecordingState: { phase: 'sequence-capture' },
  }), { type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY });
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 98, 0], ACTIVE_MELODY), null);
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 49, 127], ACTIVE_MELODY), {
    type: APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND,
  });
});

test('Harmony Edit selects a new enriched option, confirms the selected option, and retargets', () => {
  const context = createHarmonyContext();

  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 61, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION,
    bar: 3,
    step: 0,
    mode: 'enrich',
    optionIndex: 0,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 63, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION,
    bar: 3,
    step: 0,
    mode: 'enrich',
    optionIndex: 2,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 62, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION,
    bar: 3,
    step: 0,
    mode: 'enrich',
    optionIndex: 1,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 64, 127], context), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 51, 127], context), null);
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 81, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 82, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_OPEN_HARMONY,
    bar: 3,
    step: 1,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 83, 127], context), null);
});

test('Harmony Edit exposes passing choices only for step fifteen', () => {
  const context = createHarmonyContext({ step: 14 });

  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 51, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION,
    bar: 3,
    step: 14,
    mode: 'passing',
    optionIndex: 0,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0x90, 52, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION,
    bar: 3,
    step: 14,
    mode: 'passing',
    optionIndex: 1,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 53, 127], context), null);
  assert.equal(mapLaunchpadXMessageToCommand([0x90, 51, 0], context), null);
});

test('Harmony Edit reuses Capture MIDI to preview the live selected candidate', () => {
  const context = createHarmonyContext({
    selectedOption: { mode: 'enrich', name: 'Csus2', optionIndex: 2 },
  });

  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 98, 127], context), {
    type: APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION,
    bar: 3,
    step: 0,
    mode: 'enrich',
    optionIndex: 2,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 98, 0], context), null);
});

test('Capture MIDI toggles play and Stop Clip stops then rewinds globally on press only', () => {
  assert.equal(LAUNCHPAD_X_CAPTURE_MIDI_CC, 98);
  assert.equal(LAUNCHPAD_X_STOP_CLIP_CC, 49);
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 98, 127]), {
    type: APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
  });
  assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, 49, 127]), {
    type: APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND,
  });
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 98, 0]), null);
  assert.equal(mapLaunchpadXMessageToCommand([0xb0, 49, 0]), null);
  assert.equal(mapLaunchpadXMessageToCommand([0xb1, 98, 127]), null);
});

test('right-side CC buttons toggle Drums, Chord, Bass, and Melody mute globally', () => {
  const cases = [
    [89, 'drums'],
    [79, 'chord'],
    [69, 'bass'],
    [59, 'melody'],
  ];

  assert.deepEqual(LAUNCHPAD_X_TRACK_MUTE_CC_BY_TRACK, {
    drums: 89,
    chord: 79,
    bass: 69,
    melody: 59,
  });
  cases.forEach(([cc, trackId]) => {
    assert.deepEqual(mapLaunchpadXMessageToCommand([0xb0, cc, 127]), {
      type: APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE,
      trackId,
    });
    assert.equal(mapLaunchpadXMessageToCommand([0xb0, cc, 0]), null);
    assert.equal(mapLaunchpadXMessageToCommand([0xb1, cc, 127]), null);
  });
});

test('all surface frames keep global track mute LEDs visible in every editor context', () => {
  assert.deepEqual(LAUNCHPAD_X_TRACK_MUTE_LED_COLORS, {
    drums: { unmuted: 17, muted: 19 },
    chord: { unmuted: 9, muted: 11 },
    bass: { unmuted: 41, muted: 43 },
    melody: { unmuted: 49, muted: 51 },
  });

  const mutedTracks = {
    drums: true,
    chord: false,
    bass: true,
    melody: false,
  };
  const frames = [
    createLaunchpadXDrumsLedFrame({ drumsActive: false, mutedTracks }),
    createLaunchpadXChordLedFrame({ chordActive: false, mutedTracks }),
    createLaunchpadXMelodyLedFrame({ melodyActive: false, mutedTracks }),
  ];

  frames.forEach((frame) => {
    assert.deepEqual(findMessage(frame, 0xb0, 89), [
      0xb0, 89, LAUNCHPAD_X_TRACK_MUTE_LED_COLORS.drums.muted,
    ]);
    assert.deepEqual(findMessage(frame, 0xb0, 79), [
      0xb0, 79, LAUNCHPAD_X_TRACK_MUTE_LED_COLORS.chord.unmuted,
    ]);
    assert.deepEqual(findMessage(frame, 0xb0, 69), [
      0xb0, 69, LAUNCHPAD_X_TRACK_MUTE_LED_COLORS.bass.muted,
    ]);
    assert.deepEqual(findMessage(frame, 0xb0, 59), [
      0xb0, 59, LAUNCHPAD_X_TRACK_MUTE_LED_COLORS.melody.unmuted,
    ]);
    assert.equal(frame.length, 72);
  });
});

test('Melody LED frame lights three scale rows, pressed pads, clips, and transport state', () => {
  const frame = createLaunchpadXMelodyLedFrame({
    activeInputNotes: new Set(['C5']),
    isPlaying: true,
    melodyActive: true,
    melodyClipBars: [0, 2, 5],
    melodyRecordingState: { phase: 'recording' },
    melodyScaleId: 'blues',
    mutedTracks: { melody: false },
    pressedMelodyPads: new Set([31, 46]),
    selectedBar: 2,
  });

  assert.equal(frame.length, 72);
  assert.deepEqual(findMessage(frame, 0x90, 31), [
    0x90, 31, LAUNCHPAD_X_MELODY_LED_COLORS.note.pressed,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 32), [
    0x90, 32, LAUNCHPAD_X_MELODY_LED_COLORS.note.inactive,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 46), [
    0x90, 46, LAUNCHPAD_X_MELODY_LED_COLORS.note.pressed,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 51), [
    0x90, 51, LAUNCHPAD_X_MELODY_LED_COLORS.note.pressed,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 38), [0x90, 38, 0]);
  assert.deepEqual(findMessage(frame, 0x90, 61), [0x90, 61, 0]);
  assert.deepEqual(findMessage(frame, 0x90, 21), [0x90, 21, 0]);
  assert.deepEqual(findMessage(frame, 0x90, 11), [
    0x90, 11, LAUNCHPAD_X_LED_COLORS.clip.inactive,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 13), [
    0x90, 13, LAUNCHPAD_X_LED_COLORS.clip.active,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 12), [0x90, 12, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 93), [
    0xb0, 93, LAUNCHPAD_X_LED_COLORS.clip.inactive,
  ]);
  assert.deepEqual(findMessage(frame, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.playing,
  ]);
});

test('Melody LED palette separates purple steps from blue performance pads', () => {
  assert.deepEqual(LAUNCHPAD_X_MELODY_LED_COLORS, {
    note: { inactive: 43, pressed: 41 },
    step: {
      empty: 55,
      filled: 49,
      playhead: 21,
      target: 3,
      template: 51,
    },
  });
});

test('Melody LED frame gives every empty step a dark purple background', () => {
  const activeFrame = createLaunchpadXMelodyLedFrame({
    melodyActive: true,
    melodyRecordingState: { phase: 'overview' },
  });
  const inactiveFrame = createLaunchpadXMelodyLedFrame({
    melodyActive: false,
    melodyRecordingState: { phase: 'overview' },
  });

  for (const note of [
    81, 82, 83, 84, 85, 86, 87, 88,
    71, 72, 73, 74, 75, 76, 77, 78,
  ]) {
    assert.deepEqual(findMessage(activeFrame, 0x90, note), [
      0x90, note, LAUNCHPAD_X_MELODY_LED_COLORS.step.empty,
    ]);
    assert.deepEqual(findMessage(inactiveFrame, 0x90, note), [0x90, note, 0]);
  }
});

test('Melody LED frame clears unused pentatonic pads and keeps notes visible during confirm', () => {
  const countInFrame = createLaunchpadXMelodyLedFrame({
    melodyActive: true,
    melodyRecordingState: { phase: 'count-in' },
    melodyScaleId: 'pentatonic',
  });
  const confirmFrame = createLaunchpadXMelodyLedFrame({
    melodyActive: true,
    melodyRecordingState: { phase: 'confirm' },
    melodyScaleId: 'pentatonic',
  });

  assert.deepEqual(findMessage(countInFrame, 0x90, 35), [
    0x90, 35, LAUNCHPAD_X_MELODY_LED_COLORS.note.inactive,
  ]);
  assert.deepEqual(findMessage(countInFrame, 0x90, 36), [0x90, 36, 0]);
  assert.deepEqual(findMessage(countInFrame, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.stopped,
  ]);
  assert.deepEqual(findMessage(confirmFrame, 0x90, 31), [
    0x90, 31, LAUNCHPAD_X_MELODY_LED_COLORS.note.inactive,
  ]);
  assert.deepEqual(findMessage(confirmFrame, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.stopped,
  ]);
});

test('Melody LED frame renders purple template, capture, filled, and empty step levels', () => {
  const matrix = createInitialMatrix();
  matrix.melody[2][0] = { type: 'melody', note: 'C4' };
  matrix.melody[2][5] = { type: 'melody', note: 'E4' };
  const frame = createLaunchpadXMelodyLedFrame({
    currentBar: 2,
    currentStep: 6,
    isPlaying: false,
    matrix,
    melodyActive: true,
    melodyClipBars: [2],
    melodyRecordingState: {
      barRecordedNotes: 1,
      phase: 'sequence-capture',
      recordedNotes: 1,
      sequenceNotes: ['G4'],
    },
    melodyScaleId: 'major',
    melodyTemplateSteps: [0, 6, 12],
    selectedBar: 2,
  });

  assert.deepEqual(findMessage(frame, 0x90, 81), [
    0x90, 81, LAUNCHPAD_X_MELODY_LED_COLORS.step.filled,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 87), [
    0x90, 87, LAUNCHPAD_X_MELODY_LED_COLORS.step.target,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 86), [
    0x90, 86, LAUNCHPAD_X_MELODY_LED_COLORS.step.filled,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 75), [
    0x90, 75, LAUNCHPAD_X_MELODY_LED_COLORS.step.template,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 82), [
    0x90, 82, LAUNCHPAD_X_MELODY_LED_COLORS.step.empty,
  ]);

  const overview = createLaunchpadXMelodyLedFrame({
    matrix,
    melodyActive: true,
    melodyRecordingState: { phase: 'overview' },
    melodyTemplateSteps: [0, 6, 12],
    selectedBar: 2,
  });
  assert.deepEqual(findMessage(overview, 0x90, 31), [
    0x90, 31, LAUNCHPAD_X_MELODY_LED_COLORS.note.inactive,
  ]);
  assert.deepEqual(findMessage(overview, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.stopped,
  ]);

  const playing = createLaunchpadXMelodyLedFrame({
    currentBar: 2,
    currentStep: 6,
    isPlaying: true,
    matrix,
    melodyActive: true,
    melodyRecordingState: { phase: 'overview' },
    melodyTemplateSteps: [0, 6, 12],
    selectedBar: 2,
  });
  assert.deepEqual(findMessage(playing, 0x90, 87), [
    0x90, 87, LAUNCHPAD_X_MELODY_LED_COLORS.step.playhead,
  ]);
  assert.deepEqual(findMessage(playing, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.playing,
  ]);
});

test('Melody sequence capture resets its white target for every new bar', () => {
  const melodyTemplateSteps = [0, 6, 12];

  for (let selectedBar = 1; selectedBar < 8; selectedBar += 1) {
    const frame = createLaunchpadXMelodyLedFrame({
      melodyActive: true,
      melodyRecordingState: {
        barRecordedNotes: 0,
        currentBar: selectedBar,
        phase: 'sequence-capture',
        recordedNotes: selectedBar * melodyTemplateSteps.length,
      },
      melodyTemplateSteps,
      selectedBar,
    });

    assert.deepEqual(findMessage(frame, 0x90, 81), [
      0x90, 81, LAUNCHPAD_X_MELODY_LED_COLORS.step.target,
    ]);
    assert.deepEqual(findMessage(frame, 0x90, 87), [
      0x90, 87, LAUNCHPAD_X_MELODY_LED_COLORS.step.template,
    ]);
  }
});

test('Melody sequence capture uses per-bar progress for filled and next steps', () => {
  const frame = createLaunchpadXMelodyLedFrame({
    melodyActive: true,
    melodyRecordingState: {
      barRecordedNotes: 2,
      currentBar: 1,
      phase: 'sequence-capture',
      recordedNotes: 5,
    },
    melodyTemplateSteps: [0, 6, 12],
    selectedBar: 1,
  });

  assert.deepEqual(findMessage(frame, 0x90, 81), [
    0x90, 81, LAUNCHPAD_X_MELODY_LED_COLORS.step.filled,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 87), [
    0x90, 87, LAUNCHPAD_X_MELODY_LED_COLORS.step.filled,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 75), [
    0x90, 75, LAUNCHPAD_X_MELODY_LED_COLORS.step.target,
  ]);
});

test('Drums LED frame contains dim empty steps, bright hits, previews, transport, and cleared unused pads', () => {
  const matrix = createInitialMatrix();
  matrix.drums[2][0] = { instruments: ['kick', 'hihat'] };
  matrix.drums[2][8] = { instruments: ['snare'] };
  matrix.drums[2][15] = { instruments: ['hihat'] };

  const frame = createLaunchpadXDrumsLedFrame({
    drumsActive: true,
    drumsClipBars: [0, 2, 5],
    isPlaying: false,
    matrix,
    selectedBar: 2,
  });

  assert.equal(frame.length, 72);
  assert.deepEqual(findMessage(frame, 0x90, 81), [0x90, 81, LAUNCHPAD_X_LED_COLORS.kick.active]);
  assert.deepEqual(findMessage(frame, 0x90, 82), [0x90, 82, LAUNCHPAD_X_LED_COLORS.kick.inactive]);
  assert.deepEqual(findMessage(frame, 0x90, 41), [0x90, 41, LAUNCHPAD_X_LED_COLORS.snare.active]);
  assert.deepEqual(findMessage(frame, 0x90, 38), [0x90, 38, LAUNCHPAD_X_LED_COLORS.hihat.active]);
  assert.deepEqual(findMessage(frame, 0x90, 21), [0x90, 21, LAUNCHPAD_X_LED_COLORS.kick.active]);
  assert.deepEqual(findMessage(frame, 0x90, 22), [0x90, 22, LAUNCHPAD_X_LED_COLORS.snare.active]);
  assert.deepEqual(findMessage(frame, 0x90, 23), [0x90, 23, LAUNCHPAD_X_LED_COLORS.hihat.active]);
  assert.deepEqual(findMessage(frame, 0x90, 24), [0x90, 24, 0]);
  assert.deepEqual(findMessage(frame, 0x90, 11), [0x90, 11, LAUNCHPAD_X_LED_COLORS.clip.inactive]);
  assert.deepEqual(findMessage(frame, 0x90, 12), [0x90, 12, 0]);
  assert.deepEqual(findMessage(frame, 0x90, 13), [0x90, 13, LAUNCHPAD_X_LED_COLORS.clip.active]);
  assert.deepEqual(findMessage(frame, 0x90, 16), [0x90, 16, LAUNCHPAD_X_LED_COLORS.clip.inactive]);
  assert.deepEqual(findMessage(frame, 0xb0, 93), [0xb0, 93, LAUNCHPAD_X_LED_COLORS.clip.inactive]);
  assert.deepEqual(findMessage(frame, 0xb0, 94), [0xb0, 94, LAUNCHPAD_X_LED_COLORS.clip.inactive]);
  assert.deepEqual(findMessage(frame, 0xb0, 98), [0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.stopped]);
  assert.deepEqual(findMessage(frame, 0xb0, 49), [0xb0, 49, LAUNCHPAD_X_LED_COLORS.transport.stop]);
});

test('LED frame clears the entire grid outside Drums but preserves transport lights', () => {
  const frame = createLaunchpadXDrumsLedFrame({
    drumsActive: false,
    isPlaying: true,
    matrix: createInitialMatrix(),
    selectedBar: 0,
  });
  const gridMessages = frame.filter(([status]) => status === 0x90);

  assert.equal(gridMessages.length, 64);
  assert.equal(gridMessages.every(([, , value]) => value === 0), true);
  assert.deepEqual(findMessage(frame, 0xb0, 93), [0xb0, 93, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 94), [0xb0, 94, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 98), [0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.playing]);
  assert.deepEqual(findMessage(frame, 0xb0, 49), [0xb0, 49, LAUNCHPAD_X_LED_COLORS.transport.stop]);
});

test('clip navigation LEDs stay off until at least two Drums clips exist', () => {
  const frame = createLaunchpadXDrumsLedFrame({
    drumsActive: true,
    drumsClipBars: [0],
    matrix: createInitialMatrix(),
    selectedBar: 0,
  });

  assert.deepEqual(findMessage(frame, 0xb0, 93), [0xb0, 93, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 94), [0xb0, 94, 0]);
});

test('Chord LED frame uses amber-family rhythm states and clears rows three through seven', () => {
  const matrix = createInitialMatrix();
  matrix.chord[2][0] = {
    type: 'chord',
    label: 'C',
    sourceChordLabel: 'C',
    grooveTemplateId: 'custom-rhythm',
  };
  matrix.chord[2][1] = {
    type: 'chord',
    label: 'Cmaj7',
    sourceChordLabel: 'C',
    grooveTemplateId: 'custom-rhythm',
  };
  matrix.chord[2][14] = {
    type: 'chord',
    label: 'E7',
    sourceChordLabel: 'C',
    grooveTemplateId: 'passing-shortcut',
  };

  const frame = createLaunchpadXChordLedFrame({
    chordActive: true,
    chordClipBars: [0, 2, 5],
    isPlaying: false,
    matrix,
    selectedBar: 2,
  });

  assert.equal(frame.length, 72);
  assert.deepEqual(findMessage(frame, 0x90, 81), [
    0x90, 81, LAUNCHPAD_X_CHORD_LED_COLORS.step.active,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 82), [
    0x90, 82, LAUNCHPAD_X_CHORD_LED_COLORS.step.enriched,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 83), [
    0x90, 83, LAUNCHPAD_X_CHORD_LED_COLORS.step.inactive,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 77), [
    0x90, 77, LAUNCHPAD_X_CHORD_LED_COLORS.step.passing,
  ]);
  [61, 58, 41, 38, 21, 28].forEach((note) => {
    assert.deepEqual(findMessage(frame, 0x90, note), [0x90, note, 0]);
  });
  assert.deepEqual(findMessage(frame, 0x90, 11), [
    0x90, 11, LAUNCHPAD_X_LED_COLORS.clip.inactive,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 13), [
    0x90, 13, LAUNCHPAD_X_LED_COLORS.clip.active,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 12), [0x90, 12, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 93), [
    0xb0, 93, LAUNCHPAD_X_LED_COLORS.clip.inactive,
  ]);
});

test('Chord LED frame clears its grid outside Chord while preserving transport', () => {
  const frame = createLaunchpadXChordLedFrame({
    chordActive: false,
    isPlaying: true,
    matrix: createInitialMatrix(),
  });
  const gridMessages = frame.filter(([status]) => status === 0x90);

  assert.equal(gridMessages.every(([, , value]) => value === 0), true);
  assert.deepEqual(findMessage(frame, 0xb0, 93), [0xb0, 93, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_LED_COLORS.transport.playing,
  ]);
});

test('Chord Harmony LED layer lights the target and enriched option row', () => {
  const context = createHarmonyContext();
  const frame = createLaunchpadXChordLedFrame({
    ...context,
    chordClipBars: [0, 3],
  });

  assert.deepEqual(findMessage(frame, 0x90, 81), [
    0x90, 81, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.target,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 61), [
    0x90, 61, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.enrich,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 62), [
    0x90, 62, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.selected,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 63), [
    0x90, 63, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.enrich,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 64), [0x90, 64, 0]);
  assert.deepEqual(findMessage(frame, 0x90, 51), [0x90, 51, 0]);
  assert.deepEqual(findMessage(frame, 0xb0, 98), [
    0xb0, 98, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.capture,
  ]);
});

test('Chord Harmony LED layer distinguishes a pending candidate from the applied chord', () => {
  const context = createHarmonyContext({
    selectedOption: { mode: 'enrich', name: 'Csus2', optionIndex: 2 },
  });
  const frame = createLaunchpadXChordLedFrame(context);

  assert.deepEqual(findMessage(frame, 0x90, 62), [
    0x90, 62, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.enrichCurrent,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 63), [
    0x90, 63, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.selected,
  ]);
});

test('Chord Harmony LED layer lights contextual passing options on step fifteen', () => {
  const context = createHarmonyContext({ step: 14 });
  const frame = createLaunchpadXChordLedFrame(context);

  assert.deepEqual(findMessage(frame, 0x90, 77), [
    0x90, 77, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.target,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 51), [
    0x90, 51, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.selected,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 52), [
    0x90, 52, LAUNCHPAD_X_CHORD_LED_COLORS.harmony.passing,
  ]);
  assert.deepEqual(findMessage(frame, 0x90, 53), [0x90, 53, 0]);
});

test('Launchpad X input and output selection prefer MIDI ports and exclude DAW', () => {
  const dawInput = {
    id: 'daw-in', manufacturer: 'Novation', name: 'LPX DAW In', state: 'connected', type: 'input',
  };
  const midiInput = {
    id: 'midi-in', manufacturer: 'Novation', name: 'LPX MIDI In', state: 'connected', type: 'input',
  };
  const dawOutput = {
    id: 'daw-out', manufacturer: 'Novation', name: 'LPX DAW Out', state: 'connected', type: 'output',
  };
  const midiOutput = {
    id: 'midi-out', manufacturer: 'Novation', name: 'LPX MIDI Out', state: 'connected', type: 'output',
  };

  assert.equal(findLaunchpadXMidiInput([dawInput, midiInput]), midiInput);
  assert.equal(findLaunchpadXMidiOutput([dawOutput, midiOutput]), midiOutput);
});

test('Launchpad X port selection accepts Windows second-interface names and hot-plug state', () => {
  const disconnectedInput = {
    id: 'old-in', manufacturer: 'Novation', name: 'MIDIIN2 (LPX)', state: 'disconnected', type: 'input',
  };
  const connectedInput = {
    id: 'new-in', manufacturer: 'Novation', name: 'MIDIIN2 (Launchpad X)', state: 'connected', type: 'input',
  };
  const disconnectedOutput = {
    id: 'old-out', manufacturer: 'Novation', name: 'MIDIOUT2 (LPX)', state: 'disconnected', type: 'output',
  };
  const connectedOutput = {
    id: 'new-out', manufacturer: 'Novation', name: 'MIDIOUT2 (Launchpad X)', state: 'connected', type: 'output',
  };

  assert.equal(findLaunchpadXMidiInput(new Map([
    ['old', disconnectedInput], ['new', connectedInput],
  ]).values()), connectedInput);
  assert.equal(findLaunchpadXMidiOutput(new Map([
    ['old', disconnectedOutput], ['new', connectedOutput],
  ]).values()), connectedOutput);
  assert.equal(findLaunchpadXMidiInput([disconnectedInput]), null);
  assert.equal(findLaunchpadXMidiOutput([disconnectedOutput]), null);
  assert.equal(findLaunchpadXMidiInput([{ name: 'Other Controller', state: 'connected', type: 'input' }]), null);
  assert.equal(findLaunchpadXMidiOutput([{ name: 'Other Controller', state: 'connected', type: 'output' }]), null);
});
