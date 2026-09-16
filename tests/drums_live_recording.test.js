import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  createDrumsLiveRecordPatch,
  createDrumsLiveRecordSession,
  createDrumsRecordingState,
  DRUMS_RECORDING_PHASES,
  getDrumsRecordingContextTrackId,
  getDrumsWriteBarRange,
  hasDrumsBarHits,
  hasDrumsHitsInRange,
} from '../src/app/drumsLiveRecording.js';

function createEmptyTrack() {
  return Array.from(
    { length: 8 },
    () => Array.from({ length: 16 }, () => null),
  );
}

test('drums write range starts at the selected bar and ends at bar eight', () => {
  assert.deepEqual(getDrumsWriteBarRange(0), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(getDrumsWriteBarRange(4), [4, 5, 6, 7]);
  assert.deepEqual(getDrumsWriteBarRange(7), [7]);
  assert.deepEqual(getDrumsWriteBarRange(-1), []);
  assert.deepEqual(getDrumsWriteBarRange(7, 6), []);
});

test('drums overwrite confirmation only considers actual hits in the target range', () => {
  const drums = createEmptyTrack();
  drums[2][3] = { instruments: ['kick'] };
  const matrix = { drums };

  assert.equal(hasDrumsBarHits(matrix, 1), false);
  assert.equal(hasDrumsBarHits(matrix, 2), true);
  assert.equal(hasDrumsHitsInRange(matrix, 0, 1), false);
  assert.equal(hasDrumsHitsInRange(matrix, 2, 7), true);
});

test('live drum input only records in the explicit recording phase', () => {
  const baseInput = {
    activeTrackId: 'drums',
    bar: 3,
    currentCell: { instruments: ['kick'] },
    hasClip: true,
    instrument: 'snare',
    isPlaying: true,
    phase: DRUMS_RECORDING_PHASES.RECORDING,
    step: 6,
  };

  assert.deepEqual(createDrumsLiveRecordPatch(baseInput), {
    bar: 3,
    instrument: 'snare',
    nextCell: { instruments: ['kick', 'snare'] },
    shouldCreateClip: false,
    shouldWriteCell: true,
    step: 6,
  });
  [
    DRUMS_RECORDING_PHASES.IDLE,
    DRUMS_RECORDING_PHASES.CONFIRM,
    DRUMS_RECORDING_PHASES.COUNT_IN,
  ].forEach((phase) => {
    assert.equal(createDrumsLiveRecordPatch({ ...baseInput, phase }), null);
  });
  assert.equal(createDrumsLiveRecordPatch({ ...baseInput, isPlaying: false }), null);
});

test('live drum input adds instruments and creates a missing clip on first hit', () => {
  assert.equal(createDrumsLiveRecordPatch({
    activeTrackId: 'drums',
    bar: 3,
    currentCell: { instruments: ['kick', 'snare'] },
    hasClip: true,
    instrument: 'snare',
    isPlaying: true,
    phase: DRUMS_RECORDING_PHASES.RECORDING,
    step: 6,
  }), null);

  assert.deepEqual(createDrumsLiveRecordPatch({
    activeTrackId: 'drums',
    bar: 5,
    currentCell: null,
    hasClip: false,
    instrument: 'hihat',
    isPlaying: true,
    phase: DRUMS_RECORDING_PHASES.RECORDING,
    step: 12,
  }), {
    bar: 5,
    instrument: 'hihat',
    nextCell: { instruments: ['hihat'] },
    shouldCreateClip: true,
    shouldWriteCell: true,
    step: 12,
  });
});

test('one drums write session records through one undo checkpoint', () => {
  const session = createDrumsLiveRecordSession();
  const calls = [];
  const checkpoint = (action, options) => {
    calls.push(['checkpoint', options]);
    action();
  };

  assert.equal(session.record(() => calls.push(['clear']), checkpoint), true);
  assert.equal(session.record(() => calls.push(['kick']), checkpoint), true);
  assert.deepEqual(calls, [
    ['checkpoint', { force: true }],
    ['clear'],
    ['kick'],
  ]);

  session.end();
  session.record(() => calls.push(['snare']), checkpoint);
  assert.deepEqual(calls.slice(-2), [
    ['checkpoint', { force: true }],
    ['snare'],
  ]);
});

test('drums recording state keeps independent progress arrays', () => {
  const first = createDrumsRecordingState(DRUMS_RECORDING_PHASES.RECORDING, {
    completedBars: [3],
    currentBar: 4,
    startBar: 3,
    endBar: 7,
    totalBars: 5,
  });
  const second = createDrumsRecordingState(DRUMS_RECORDING_PHASES.RECORDING, {
    completedBars: first.completedBars,
  });

  second.completedBars.push(4);
  assert.deepEqual(first.completedBars, [3]);
});

test('recording context follows the pending session through confirmation and count-in', () => {
  const pendingSession = { trackId: 'drums-2' };
  const session = { trackId: 'drums-2' };

  assert.equal(getDrumsRecordingContextTrackId({
    pendingSession,
    phase: DRUMS_RECORDING_PHASES.CONFIRM,
  }), 'drums-2');
  assert.equal(getDrumsRecordingContextTrackId({
    pendingSession,
    phase: DRUMS_RECORDING_PHASES.COUNT_IN,
  }), 'drums-2');
  assert.equal(getDrumsRecordingContextTrackId({
    phase: DRUMS_RECORDING_PHASES.RECORDING,
    session,
  }), 'drums-2');
  assert.equal(getDrumsRecordingContextTrackId({
    pendingSession,
    phase: DRUMS_RECORDING_PHASES.IDLE,
    session,
  }), null);
});

test('controller uses count-in, delayed bar clearing, full-track playback, and bounded duration', async () => {
  const [source, melodyControllerSource] = await Promise.all([
    readFile(
      new URL('../src/app/useDrumsRecordingController.js', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL('../src/app/useMelodyRecordingController.js', import.meta.url),
      'utf8',
    ),
  ]);

  assert.match(source, /tick\(4\)/);
  assert.doesNotMatch(source, /pendingSessionRef\.current = null;\n {4}void beginCountIn/);
  assert.match(
    source,
    /sessionRef\.current = session;\n {4}pendingSessionRef\.current = null;/,
  );
  assert.match(source, /getDrumsRecordingContextTrackId\(\{/);
  assert.match(
    source,
    /const handlePadInput = useCallback\(\(instrument, inputTimestampMs, inputSource\) => \{[\s\S]*audioEngine\.getLiveInputPosition\?\.\(inputTimestampMs, \{[\s\S]*source: inputSource,[\s\S]*const \{ bar, step \} = position;/,
  );
  assert.doesNotMatch(source, /const bar = state\.currentBar;/);
  assert.doesNotMatch(source, /const step = state\.currentStep;/);
  assert.match(source, /prepareRecordingBar\(session, pendingSession\.startBar\)/);
  assert.match(source, /step !== 0/);
  assert.match(
    source,
    /clearDrumsBar\(\{[\s\S]*drums: latestState\.matrix\[session\.trackId\],[\s\S]*\}, bar\)/,
  );
  assert.match(
    source,
    /TRANSPORT_TOGGLE_PLAY,[\s\S]*maxPlaybackSteps: pendingSession\.targetBars\.length \* STEPS_PER_BAR/,
  );
  assert.doesNotMatch(source, /audibleTrackIds/);
  assert.match(
    source,
    /patch\.shouldCreateClip[\s\S]*latestState\.createClip\(session\.trackId, patch\.bar\)/,
  );
  assert.match(source, /session\.mutations\.record\(action, withUndoCheckpoint\)/);
  assert.match(
    melodyControllerSource,
    /currentPhase === MELODY_RECORDING_PHASES\.IDLE[\s\S]*!pendingSessionRef\.current[\s\S]*return false/,
  );
});

test('App gates preview recording through the controller and ends sessions on navigation', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /useDrumsRecordingController\(\{/);
  assert.match(source, /audioEngine\.onScheduledPositionChange = \(bar, step\) => \{/);
  assert.match(source, /handleDrumsRecordingTransportPosition\(bar, step\)/);
  assert.match(
    source,
    /command\?\.type === APP_COMMAND_TYPES\.DRUMS_PREVIEW[\s\S]*drumsRecording\.handlePadInput\([\s\S]*command\.instrument,[\s\S]*command\.inputTimestampMs,[\s\S]*command\.inputSource,[\s\S]*dispatchAppCommand\(\{ \.\.\.command, trackId \}\)/,
  );
  assert.match(source, /const handleDrumsWriteToggle = useCallback/);
  assert.match(source, /stopDrumsRecording\(\{ stopTransport: false \}\)/);
  assert.match(source, /if \(drumsRecording\.workflowLocked\) return false/);
  assert.match(source, /drumsRecordingState: drumsRecording\.recordingState/);
});

test('Drums editor exposes the dedicated write workflow and keeps no-clip recording visible', async () => {
  const [drumSource, bottomEditorSource] = await Promise.all([
    readFile(new URL('../src/app/components/DrumSequencer.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/BottomEditor.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(drumSource, /'drums-record-button'/);
  assert.match(drumSource, /开始打击乐写入/);
  assert.match(drumSource, /`预拍 \$\{drumsRecordingState\.countInBeat\}`/);
  assert.match(drumSource, /`写入中 \$\{writeBarProgress\}\/\$\{drumsRecordingState\?\.totalBars \?\? 0\}`/);
  assert.match(drumSource, /覆盖并开始写入/);
  assert.match(drumSource, /播放到每个小节时才会清空/);
  assert.match(drumSource, /event\.key !== 'Escape'/);
  assert.match(drumSource, /等待首次击打创建 Clip/);
  assert.match(drumSource, /DRUM_INPUT_CELLS\.map/);
  assert.match(drumSource, /onPointerDown=\{\(event\) => \{/);
  assert.match(drumSource, /onPadInput\(pad\.instrument, event\.timeStamp\)/);
  assert.match(drumSource, /if \(event\.detail === 0\)/);
  assert.match(bottomEditorSource, /selectedClipId \|\| drumsWriting/);
  assert.match(bottomEditorSource, /hasClip: Boolean\(selectedClipId\)/);
  assert.match(bottomEditorSource, /onPadInput: onDrumsPadInput/);
});

test('Launchpad drum previews use dispatch time with a source-specific recording bias', async () => {
  const source = await readFile(
    new URL('../src/input/useLaunchpadXCommands.js', import.meta.url),
    'utf8',
  );

  assert.match(
    source,
    /const mappedCommand = mapLaunchpadXMessageToCommand\(event\.data, contextRef\.current\)[\s\S]*inputSource: 'launchpad'/,
  );
  assert.doesNotMatch(source, /inputTimestampMs: event\.timeStamp/);
});
