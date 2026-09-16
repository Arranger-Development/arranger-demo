import { MELODY_NOTE_IDS as CONFIGURED_MELODY_NOTE_IDS } from '../data/melodyScales.js';

const APP_COMMAND_TYPES = Object.freeze({
  APP_REDO: 'app.redo',
  APP_UNDO: 'app.undo',
  TRANSPORT_TOGGLE_PLAY: 'transport.togglePlay',
  TRANSPORT_STOP: 'transport.stop',
  TRANSPORT_STOP_AND_REWIND: 'transport.stopAndRewind',
  TRANSPORT_SEEK: 'transport.seek',
  TRACK_TOGGLE_MUTE: 'track.toggleMute',
  CLIP_COPY_SELECTED: 'clip.copySelected',
  CLIP_DELETE_SELECTED: 'clip.deleteSelected',
  CLIP_PASTE: 'clip.paste',
  TUTORIAL_NEXT: 'tutorial.next',
  TUTORIAL_COMPLETE_TASK: 'tutorial.completeTask',
  DRUMS_PREVIEW: 'drums.preview',
  DRUMS_SELECT_CLIP: 'drums.selectClip',
  DRUMS_TOGGLE: 'drums.toggle',
  CHORD_SELECT_CLIP: 'chord.selectClip',
  CHORD_TOGGLE_RHYTHM: 'chord.toggleRhythm',
  CHORD_OPEN_HARMONY: 'chord.openHarmony',
  CHORD_CLOSE_HARMONY: 'chord.closeHarmony',
  CHORD_APPLY_HARMONY_OPTION: 'chord.applyHarmonyOption',
  CHORD_SELECT_HARMONY_OPTION: 'chord.selectHarmonyOption',
  CHORD_PREVIEW_HARMONY_OPTION: 'chord.previewHarmonyOption',
  CHORD_SELECT_OPTION: 'chord.selectOption',
  CHORD_CONFIRM: 'chord.confirm',
  CHORD_SET_CELL: 'chord.setCell',
  CHORD_CLEAR_CELL: 'chord.clearCell',
  MELODY_NOTE_ON: 'melody.noteOn',
  MELODY_NOTE_OFF: 'melody.noteOff',
  MELODY_SELECT_CLIP: 'melody.selectClip',
  MELODY_SELECT_STEP: 'melody.selectStep',
});

const CHORD_OPTION_COUNT = 8;
const MELODY_NOTE_IDS = CONFIGURED_MELODY_NOTE_IDS;

const COMMAND_GROUPS = Object.freeze({
  app: Object.freeze([
    APP_COMMAND_TYPES.APP_REDO,
    APP_COMMAND_TYPES.APP_UNDO,
  ]),
  transport: Object.freeze([
    APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY,
    APP_COMMAND_TYPES.TRANSPORT_STOP,
    APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND,
    APP_COMMAND_TYPES.TRANSPORT_SEEK,
  ]),
  track: Object.freeze([
    APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE,
  ]),
  clip: Object.freeze([
    APP_COMMAND_TYPES.CLIP_COPY_SELECTED,
    APP_COMMAND_TYPES.CLIP_DELETE_SELECTED,
    APP_COMMAND_TYPES.CLIP_PASTE,
  ]),
  tutorial: Object.freeze([
    APP_COMMAND_TYPES.TUTORIAL_NEXT,
    APP_COMMAND_TYPES.TUTORIAL_COMPLETE_TASK,
  ]),
  drums: Object.freeze([
    APP_COMMAND_TYPES.DRUMS_PREVIEW,
    APP_COMMAND_TYPES.DRUMS_SELECT_CLIP,
    APP_COMMAND_TYPES.DRUMS_TOGGLE,
  ]),
  chord: Object.freeze([
    APP_COMMAND_TYPES.CHORD_SELECT_CLIP,
    APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM,
    APP_COMMAND_TYPES.CHORD_OPEN_HARMONY,
    APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY,
    APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION,
    APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION,
    APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION,
    APP_COMMAND_TYPES.CHORD_SELECT_OPTION,
    APP_COMMAND_TYPES.CHORD_CONFIRM,
    APP_COMMAND_TYPES.CHORD_SET_CELL,
    APP_COMMAND_TYPES.CHORD_CLEAR_CELL,
  ]),
  melody: Object.freeze([
    APP_COMMAND_TYPES.MELODY_NOTE_ON,
    APP_COMMAND_TYPES.MELODY_NOTE_OFF,
    APP_COMMAND_TYPES.MELODY_SELECT_CLIP,
    APP_COMMAND_TYPES.MELODY_SELECT_STEP,
  ]),
});

/**
 * @typedef {{ type: 'app.undo' } | { type: 'app.redo' }} AppUiCommand
 * @typedef {{ type: 'transport.togglePlay', audibleTrackIds?: string[], maxPlaybackSteps?: number } | { type: 'transport.stop' } | { type: 'transport.stopAndRewind' } | { type: 'transport.seek', bar: number, step: number }} TransportCommand
 * @typedef {{ type: 'track.toggleMute', trackId: 'drums' | 'chord' | 'bass' | 'melody' }} TrackCommand
 * @typedef {{ type: 'clip.copySelected' } | { type: 'clip.deleteSelected' } | { type: 'clip.paste' }} ClipCommand
 * @typedef {{ type: 'tutorial.next' } | { type: 'tutorial.completeTask' }} TutorialCommand
 * @typedef {{ type: 'drums.preview', instrument: 'kick' | 'snare' | 'hihat', inputSource?: 'launchpad', inputTimestampMs?: number } | { type: 'drums.selectClip', bar: number } | { type: 'drums.toggle', bar: number, step: number, instrument: 'kick' | 'snare' | 'hihat', preview: boolean }} DrumsCommand
 * @typedef {{ type: 'chord.selectClip', bar: number } | { type: 'chord.toggleRhythm', bar: number, step: number } | { type: 'chord.openHarmony', bar: number, step: number } | { type: 'chord.closeHarmony' } | { type: 'chord.applyHarmonyOption' | 'chord.selectHarmonyOption' | 'chord.previewHarmonyOption', bar: number, step: number, mode: 'enrich' | 'passing', optionIndex: number } | { type: 'chord.selectOption', optionIndex: number } | { type: 'chord.confirm' } | { type: 'chord.setCell', bar: number, span: number, root: string } | { type: 'chord.clearCell', bar: number, span: number }} ChordCommand
 * @typedef {{ type: 'melody.noteOn', note: string, inputId: string, inputTimestampMs?: number, source: 'keyboard' | 'virtual' | 'launchpad' } | { type: 'melody.noteOff', inputId: string, note?: string } | { type: 'melody.selectClip', bar: number } | { type: 'melody.selectStep', bar: number, step: number }} MelodyCommand
 * @typedef {AppUiCommand | TransportCommand | TrackCommand | ClipCommand | TutorialCommand | DrumsCommand | ChordCommand | MelodyCommand} AppCommand
 */

export {
  APP_COMMAND_TYPES,
  CHORD_OPTION_COUNT,
  COMMAND_GROUPS,
  MELODY_NOTE_IDS,
};
