import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_COMMAND_TYPES,
  CHORD_OPTION_COUNT,
  COMMAND_GROUPS,
  MELODY_NOTE_IDS,
} from '../src/input/appCommands.js';
import { isValidAppCommand } from '../src/input/commandGuards.js';
import { CORE_TRACK_IDS, STEPS_PER_BAR, TOTAL_BARS } from '../src/domain/musicConstants.js';

test('app command constants use drums naming', () => {
  assert.equal(APP_COMMAND_TYPES.APP_UNDO, 'app.undo');
  assert.equal(APP_COMMAND_TYPES.APP_REDO, 'app.redo');
  assert.equal(APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND, 'transport.stopAndRewind');
  assert.equal(APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE, 'track.toggleMute');
  assert.equal(APP_COMMAND_TYPES.DRUMS_TOGGLE, 'drums.toggle');
  assert.equal(APP_COMMAND_TYPES.DRUMS_PREVIEW, 'drums.preview');
  assert.equal(APP_COMMAND_TYPES.DRUMS_SELECT_CLIP, 'drums.selectClip');
  assert.equal(APP_COMMAND_TYPES.CHORD_SELECT_CLIP, 'chord.selectClip');
  assert.equal(APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM, 'chord.toggleRhythm');
  assert.equal(APP_COMMAND_TYPES.CHORD_OPEN_HARMONY, 'chord.openHarmony');
  assert.equal(APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY, 'chord.closeHarmony');
  assert.equal(APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION, 'chord.applyHarmonyOption');
  assert.equal(APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION, 'chord.selectHarmonyOption');
  assert.equal(APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION, 'chord.previewHarmonyOption');
  assert.equal(APP_COMMAND_TYPES.CHORD_SET_CELL, 'chord.setCell');
  assert.equal(APP_COMMAND_TYPES.CHORD_CLEAR_CELL, 'chord.clearCell');
  assert.equal(APP_COMMAND_TYPES.MELODY_SELECT_CLIP, 'melody.selectClip');
  assert.equal(APP_COMMAND_TYPES.MELODY_SELECT_STEP, 'melody.selectStep');
  assert.equal(APP_COMMAND_TYPES.CLIP_COPY_SELECTED, 'clip.copySelected');
  assert.equal(APP_COMMAND_TYPES.CLIP_DELETE_SELECTED, 'clip.deleteSelected');
  assert.equal(APP_COMMAND_TYPES.CLIP_PASTE, 'clip.paste');
  assert.equal(Object.values(APP_COMMAND_TYPES).includes('unknown.toggle'), false);
  assert.equal(COMMAND_GROUPS.app.includes(APP_COMMAND_TYPES.APP_UNDO), true);
  assert.equal(COMMAND_GROUPS.app.includes(APP_COMMAND_TYPES.APP_REDO), true);
  assert.equal(
    COMMAND_GROUPS.transport.includes(APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND),
    true,
  );
  assert.equal(COMMAND_GROUPS.track.includes(APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE), true);
  assert.equal(COMMAND_GROUPS.clip.includes(APP_COMMAND_TYPES.CLIP_COPY_SELECTED), true);
  assert.equal(COMMAND_GROUPS.clip.includes(APP_COMMAND_TYPES.CLIP_DELETE_SELECTED), true);
  assert.equal(COMMAND_GROUPS.clip.includes(APP_COMMAND_TYPES.CLIP_PASTE), true);
  assert.equal(COMMAND_GROUPS.drums.includes(APP_COMMAND_TYPES.DRUMS_TOGGLE), true);
  assert.equal(COMMAND_GROUPS.drums.includes(APP_COMMAND_TYPES.DRUMS_PREVIEW), true);
  assert.equal(COMMAND_GROUPS.drums.includes(APP_COMMAND_TYPES.DRUMS_SELECT_CLIP), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_SET_CELL), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_CLEAR_CELL), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_SELECT_CLIP), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_OPEN_HARMONY), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION), true);
  assert.equal(COMMAND_GROUPS.chord.includes(APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION), true);
  assert.equal(COMMAND_GROUPS.melody.includes(APP_COMMAND_TYPES.MELODY_SELECT_CLIP), true);
  assert.equal(CHORD_OPTION_COUNT, 8);
  assert.equal(MELODY_NOTE_IDS.length, 36);
  assert.equal(MELODY_NOTE_IDS.at(0), 'B5');
  assert.equal(MELODY_NOTE_IDS.includes('C#4'), true);
  assert.equal(MELODY_NOTE_IDS.includes('A4'), true);
  assert.equal(MELODY_NOTE_IDS.includes('C5'), true);
  assert.equal(MELODY_NOTE_IDS.includes('G5'), true);
  assert.equal(MELODY_NOTE_IDS.includes('B3'), true);
  assert.equal(MELODY_NOTE_IDS.includes('A5'), true);
  assert.equal(MELODY_NOTE_IDS.includes('C6'), false);
  assert.equal(MELODY_NOTE_IDS.at(-1), 'C3');
});

test('transport commands validate exact payloads', () => {
  assert.equal(isValidAppCommand({ type: 'transport.togglePlay' }), true);
  assert.equal(isValidAppCommand({
    type: 'transport.togglePlay',
    audibleTrackIds: ['melody'],
    maxPlaybackSteps: 64,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'transport.togglePlay',
    audibleTrackIds: ['melody', 'melody'],
  }), false);
  assert.equal(isValidAppCommand({
    type: 'transport.togglePlay',
    audibleTrackIds: ['unknown'],
  }), false);
  assert.equal(isValidAppCommand({ type: 'transport.togglePlay', maxPlaybackSteps: 0 }), false);
  assert.equal(isValidAppCommand({ type: 'transport.stop' }), true);
  assert.equal(isValidAppCommand({ type: 'transport.stopAndRewind' }), true);
  assert.equal(isValidAppCommand({ type: 'transport.stopAndRewind', bar: 0 }), false);
  assert.equal(isValidAppCommand({ type: 'transport.togglePlay', extra: true }), false);
  assert.equal(isValidAppCommand({ type: 'transport.seek', bar: 0, step: 0 }), true);
  assert.equal(isValidAppCommand({ type: 'transport.seek', bar: TOTAL_BARS - 1, step: STEPS_PER_BAR - 1 }), true);
  assert.equal(isValidAppCommand({ type: 'transport.seek', bar: TOTAL_BARS, step: 0 }), false);
  assert.equal(isValidAppCommand({ type: 'transport.seek', bar: 0, step: STEPS_PER_BAR }), false);
});

test('track mute commands accept only the four arranger tracks', () => {
  CORE_TRACK_IDS.forEach((trackId) => {
    assert.equal(isValidAppCommand({ type: 'track.toggleMute', trackId }), true);
  });
  assert.equal(isValidAppCommand({ type: 'track.toggleMute', trackId: 'vocal' }), false);
  assert.equal(isValidAppCommand({ type: 'track.toggleMute', trackId: 'drums', muted: true }), false);
});

test('app commands validate exact payloads', () => {
  assert.equal(isValidAppCommand({ type: 'app.undo' }), true);
  assert.equal(isValidAppCommand({ type: 'app.redo' }), true);
  assert.equal(isValidAppCommand({ type: 'app.undo', steps: 2 }), false);
  assert.equal(isValidAppCommand({ type: 'app.redo', steps: 2 }), false);
});

test('tutorial and chord commands validate exact payloads', () => {
  assert.equal(isValidAppCommand({ type: 'tutorial.next' }), true);
  assert.equal(isValidAppCommand({ type: 'tutorial.completeTask' }), true);
  assert.equal(isValidAppCommand({ type: 'tutorial.next', id: 'intro' }), false);
  assert.equal(isValidAppCommand({ type: 'chord.selectOption', optionIndex: 0 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.selectOption', optionIndex: 7 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.selectOption', optionIndex: 8 }), false);
  assert.equal(isValidAppCommand({ type: 'chord.confirm' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.confirm', optionIndex: 0 }), false);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'C' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'Cmaj7' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'Am9' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'Amadd9' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'Fmaj9' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'bA' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 7, span: 3, root: 'A#' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 4, root: 'C' }), false);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'H' }), false);
  assert.equal(isValidAppCommand({ type: 'chord.setCell', bar: 0, span: 0, root: 'C', extra: true }), false);
  assert.equal(isValidAppCommand({ type: 'chord.clearCell', bar: 0, span: 0 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.clearCell', bar: 7, span: 3 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.clearCell', bar: 8, span: 0 }), false);
  assert.equal(isValidAppCommand({ type: 'chord.clearCell', bar: 0, span: 4 }), false);
  assert.equal(isValidAppCommand({ type: 'chord.clearCell', bar: 0, span: 0, root: 'C' }), false);
  assert.equal(isValidAppCommand({ type: 'chord.selectClip', bar: 0 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.selectClip', bar: TOTAL_BARS - 1 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.selectClip', bar: TOTAL_BARS }), false);
  assert.equal(isValidAppCommand({ type: 'chord.selectClip', bar: 0, extra: true }), false);
  assert.equal(isValidAppCommand({ type: 'chord.toggleRhythm', bar: 0, step: 0 }), true);
  assert.equal(isValidAppCommand({
    type: 'chord.toggleRhythm',
    bar: TOTAL_BARS - 1,
    step: STEPS_PER_BAR - 1,
  }), true);
  assert.equal(isValidAppCommand({ type: 'chord.toggleRhythm', bar: 0, step: STEPS_PER_BAR }), false);
  assert.equal(isValidAppCommand({ type: 'chord.toggleRhythm', bar: 0, step: 0, root: 'C' }), false);
  assert.equal(isValidAppCommand({ type: 'chord.openHarmony', bar: 0, step: 14 }), true);
  assert.equal(isValidAppCommand({ type: 'chord.openHarmony', bar: 0, step: 16 }), false);
  assert.equal(isValidAppCommand({ type: 'chord.closeHarmony' }), true);
  assert.equal(isValidAppCommand({ type: 'chord.closeHarmony', step: 0 }), false);
  assert.equal(isValidAppCommand({
    type: 'chord.applyHarmonyOption',
    bar: 0,
    step: 14,
    mode: 'passing',
    optionIndex: 1,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'chord.applyHarmonyOption',
    bar: 0,
    step: 0,
    mode: 'enrich',
    optionIndex: 4,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'chord.applyHarmonyOption',
    bar: 0,
    step: 0,
    mode: 'preview',
    optionIndex: 0,
  }), false);
  assert.equal(isValidAppCommand({
    type: 'chord.applyHarmonyOption',
    bar: 0,
    step: 0,
    mode: 'enrich',
    optionIndex: 8,
  }), false);
  assert.equal(isValidAppCommand({
    type: 'chord.selectHarmonyOption',
    bar: 0,
    step: 14,
    mode: 'passing',
    optionIndex: 1,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'chord.previewHarmonyOption',
    bar: 0,
    step: 0,
    mode: 'enrich',
    optionIndex: 4,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'chord.previewHarmonyOption',
    bar: 0,
    step: 0,
    mode: 'enrich',
    optionIndex: 8,
  }), false);
});

test('clip commands validate exact payloads', () => {
  assert.equal(isValidAppCommand({ type: 'clip.copySelected' }), true);
  assert.equal(isValidAppCommand({ type: 'clip.deleteSelected' }), true);
  assert.equal(isValidAppCommand({ type: 'clip.paste' }), true);
  assert.equal(isValidAppCommand({ type: 'clip.copySelected', clipId: 'drums-bar-0' }), false);
  assert.equal(isValidAppCommand({ type: 'clip.deleteSelected', clipId: 'drums-bar-0' }), false);
  assert.equal(isValidAppCommand({ type: 'clip.paste', targetBar: 1 }), false);
});

test('drums commands validate toggle, audio-only preview, and clip selection payloads', () => {
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'kick',
    preview: true,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'kick',
    preview: false,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'snare',
    preview: true,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'hihat',
    preview: true,
  }), true);
  assert.equal(isValidAppCommand({
    type: 'unknown.toggle',
    bar: 0,
    step: 0,
    instrument: 'kick',
    preview: true,
  }), false);
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'tom',
    preview: true,
  }), false);
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'kick',
  }), false);
  assert.equal(isValidAppCommand({ type: 'drums.preview', instrument: 'kick' }), true);
  assert.equal(isValidAppCommand({ type: 'drums.preview', instrument: 'snare' }), true);
  assert.equal(isValidAppCommand({ type: 'drums.preview', instrument: 'hihat' }), true);
  assert.equal(isValidAppCommand({ type: 'drums.selectClip', bar: 0 }), true);
  assert.equal(isValidAppCommand({ type: 'drums.selectClip', bar: TOTAL_BARS - 1 }), true);
  assert.equal(isValidAppCommand({ type: 'drums.selectClip', bar: TOTAL_BARS }), false);
  assert.equal(isValidAppCommand({ type: 'drums.selectClip', bar: 0, direction: 'next' }), false);
  assert.equal(isValidAppCommand({ type: 'drums.preview', instrument: 'tom' }), false);
  assert.equal(isValidAppCommand({ type: 'drums.preview', instrument: 'kick', step: 0 }), false);
  assert.equal(isValidAppCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'kick',
    preview: 'yes',
  }), false);
});

test('melody note commands only accept configured melody notes', () => {
  const noteOn = (note, overrides = {}) => ({
    type: 'melody.noteOn',
    inputId: 'keyboard:KeyA',
    note,
    source: 'keyboard',
    ...overrides,
  });
  assert.equal(isValidAppCommand(noteOn('D4')), true);
  assert.equal(isValidAppCommand(noteOn('D4', { inputTimestampMs: 321.5 })), true);
  assert.equal(isValidAppCommand({ type: 'melody.noteOff', inputId: 'keyboard:KeyA' }), true);
  assert.equal(isValidAppCommand({ type: 'melody.noteOff', inputId: 'virtual:1:0:4', note: 'E4' }), true);
  assert.equal(isValidAppCommand(noteOn('C#4')), true);
  assert.equal(isValidAppCommand(noteOn('G5', { source: 'launchpad', inputId: 'launchpad:54' })), true);
  assert.equal(isValidAppCommand(noteOn('B3', { source: 'virtual' })), true);
  assert.equal(isValidAppCommand(noteOn('B2')), false);
  assert.equal(isValidAppCommand(noteOn('C6')), false);
  assert.equal(isValidAppCommand(noteOn('C4', { source: 'mouse' })), false);
  assert.equal(isValidAppCommand(noteOn('C4', { inputTimestampMs: -1 })), false);
  assert.equal(isValidAppCommand({ type: 'melody.noteOn', note: 'C4' }), false);
  assert.equal(isValidAppCommand({ type: 'melody.noteOff', inputId: '', note: 'D4' }), false);
  assert.equal(isValidAppCommand({ type: 'melody.noteOff', inputId: 'keyboard:KeyA', velocity: 100 }), false);
  assert.equal(isValidAppCommand({ type: 'melody.recordToggle' }), false);
  assert.equal(isValidAppCommand({ type: 'melody.selectClip', bar: 0 }), true);
  assert.equal(isValidAppCommand({ type: 'melody.selectClip', bar: TOTAL_BARS - 1 }), true);
  assert.equal(isValidAppCommand({ type: 'melody.selectClip', bar: TOTAL_BARS }), false);
  assert.equal(isValidAppCommand({ type: 'melody.selectStep', bar: 0, step: 0 }), true);
  assert.equal(isValidAppCommand({
    type: 'melody.selectStep',
    bar: TOTAL_BARS - 1,
    step: STEPS_PER_BAR - 1,
  }), true);
  assert.equal(isValidAppCommand({ type: 'melody.selectStep', bar: 0, step: STEPS_PER_BAR }), false);
});

test('unknown or malformed commands are invalid', () => {
  assert.equal(isValidAppCommand(null), false);
  assert.equal(isValidAppCommand([]), false);
  assert.equal(isValidAppCommand({}), false);
  assert.equal(isValidAppCommand({ type: 'unknown' }), false);
});
