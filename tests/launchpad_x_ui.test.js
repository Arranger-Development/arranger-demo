import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getMelodyInputContextKey } from '../src/input/useLaunchpadXCommands.js';

test('free Melody recording keeps held Launchpad notes across automatic bar selection', () => {
  const recordingState = { mode: 'free', phase: 'recording' };
  assert.equal(
    getMelodyInputContextKey({
      melodyActive: true,
      melodyRecordingState: recordingState,
      melodyScaleId: 'chinese',
      selectedBar: 2,
    }),
    getMelodyInputContextKey({
      melodyActive: true,
      melodyRecordingState: recordingState,
      melodyScaleId: 'chinese',
      selectedBar: 3,
    }),
  );
  assert.notEqual(
    getMelodyInputContextKey({
      melodyActive: true,
      melodyRecordingState: { mode: null, phase: 'idle' },
      melodyScaleId: 'chinese',
      selectedBar: 2,
    }),
    getMelodyInputContextKey({
      melodyActive: true,
      melodyRecordingState: { mode: null, phase: 'idle' },
      melodyScaleId: 'chinese',
      selectedBar: 3,
    }),
  );
});

test('App shares one UI-aware command entry point between keyboard and Launchpad X', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /import useLaunchpadXCommands from '\.\.\/input\/useLaunchpadXCommands\.js';/);
  assert.match(source, /const dispatchInputCommand = useCallback\(\(command\) => \{/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.TRACK_TOGGLE_MUTE[\s\S]*getTrackInstanceIdsByType\(state, command\.trackId\)[\s\S]*targetTrackId[\s\S]*state\.setActiveTrackId\(targetTrackId\)/);
  assert.match(source, /useKeyboardCommands\(\{[\s\S]*dispatch: dispatchInputCommand,[\s\S]*hasTimelineSelection: Boolean\(timelineSelection\),[\s\S]*\}\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.DRUMS_TOGGLE\) \{[\s\S]*getTrackType\(state, state\.activeTrackId\) !== 'drums'[\s\S]*activeClip\?\.trackId !== state\.activeTrackId[\s\S]*handleDrumsStepToggle\(command\.instrument, command\.step, command\.bar\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.DRUMS_SELECT_CLIP\) \{[\s\S]*handleLaunchpadDrumsClipSelect\(command\.bar\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_TOGGLE_RHYTHM\) \{[\s\S]*getTrackType\(state, state\.activeTrackId\) !== 'chord'[\s\S]*activeClip\?\.trackId !== state\.activeTrackId[\s\S]*handleChordRhythmStepToggle\(command\.step, command\.bar\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_SELECT_CLIP\) \{[\s\S]*handleLaunchpadChordClipSelect\(command\.bar\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_OPEN_HARMONY\) \{[\s\S]*handleLaunchpadChordHarmonyOpen\(command\.bar, command\.step\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_CLOSE_HARMONY\) \{[\s\S]*handleLaunchpadChordHarmonyClose\(\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_APPLY_HARMONY_OPTION\) \{[\s\S]*handleLaunchpadChordHarmonyOption\(command\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_SELECT_HARMONY_OPTION\) \{[\s\S]*handleLaunchpadChordHarmonySelect\(command\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.CHORD_PREVIEW_HARMONY_OPTION\) \{[\s\S]*handleLaunchpadChordHarmonyPreview\(command\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.MELODY_SELECT_CLIP\) \{[\s\S]*handleLaunchpadMelodyClipSelect\(command\.bar\);/);
  assert.doesNotMatch(source, /MELODY_RECORD_TOGGLE|requestRecordToggle/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.MELODY_NOTE_ON\) \{[\s\S]*melodyRecording\.handleNoteOn\(command\);/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.MELODY_NOTE_OFF\) \{[\s\S]*melodyRecording\.handleNoteOff\(command\);/);
  assert.match(source, /const handleChordStepHarmonyPreview = useCallback\(async \(\{[\s\S]*preserveTransport = false,[\s\S]*if \(!preserveTransport && useMusicStore\.getState\(\)\.isPlaying\)/);
  assert.match(source, /handleLaunchpadChordHarmonyPreview[\s\S]*preserveTransport: true/);
  assert.match(source, /const handleStopAndRewind = useCallback\(\(\) => \{[\s\S]*APP_COMMAND_TYPES\.TRANSPORT_STOP_AND_REWIND/);
  assert.match(source, /if \(command\?\.type === APP_COMMAND_TYPES\.TRANSPORT_STOP_AND_REWIND\) \{[\s\S]*handleStopAndRewind\(\);/);
  assert.match(source, /useLaunchpadXCommands\(\{[\s\S]*chordActive,[\s\S]*chordClipBars,[\s\S]*chordHarmonyState,[\s\S]*dispatch: dispatchInputCommand,[\s\S]*drumsActive,[\s\S]*drumsClipBars,[\s\S]*isPlaying,[\s\S]*matrix: editorMatrix,[\s\S]*mutedTracks: launchpadMutedTracks,[\s\S]*selectedBar,[\s\S]*\}\);/);
  assert.match(source, /melodyActive,[\s\S]*melodyClipBars,[\s\S]*melodyRecordingState: melodyRecording\.recordingState,[\s\S]*melodyScaleId/);
  assert.match(source, /activeInputNotes: melodyRecording\.activeInputNotes/);
  assert.match(source, /audioEngine\.setVolumeSource\?\.\(\(\) => \{[\s\S]*const state = useMusicStore\.getState\(\);[\s\S]*mutedTracks: state\.mutedTracks,[\s\S]*volumes: state\.volumes/);
  assert.match(source, /const handleLaunchpadConnect = useCallback\(\(\) => \{[\s\S]*audioEngine\.startAudio\(\);[\s\S]*connectLaunchpad\(\);/);
  assert.match(source, /hardwareInput:\s*\{[\s\S]*\.\.\.launchpadInput,[\s\S]*onConnect: handleLaunchpadConnect/);
  assert.match(source, /captureLabel: 'CAPTURE = PLAY'/);
  assert.doesNotMatch(source, /onMelodyAuditionToggle|toggleAudition/);
  assert.match(source, /onMelodyWriteToggle: melodyRecording\.requestWriteToggle/);
});

test('Launchpad X hook requests non-SysEx access, binds both ports, and redraws LEDs', async () => {
  const source = await readFile(
    new URL('../src/input/useLaunchpadXCommands.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /requestMIDIAccess\.call\(navigator, \{ sysex: false \}\)/);
  assert.match(source, /access\.onstatechange = handleStateChange/);
  assert.match(source, /input\.onmidimessage = handleMidiMessage/);
  assert.match(source, /findLaunchpadXMidiInput\(access\.inputs\.values\(\)\)/);
  assert.match(source, /findLaunchpadXMidiOutput\(access\.outputs\.values\(\)\)/);
  assert.match(source, /mapLaunchpadXMessageToCommand\(event\.data, contextRef\.current\)/);
  assert.match(source, /mappedCommand\?\.type === APP_COMMAND_TYPES\.MELODY_NOTE_ON[\s\S]*inputTimestampMs: midiTimestampMs/);
  assert.match(source, /createLaunchpadXChordGestureController/);
  assert.match(source, /chordGestureRef\.current\.handle\(event\.data\)/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.DRUMS_SELECT_CLIP[\s\S]*contextRef\.current = \{[\s\S]*selectedBar: command\.bar/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.CHORD_SELECT_CLIP/);
  assert.match(source, /command\?\.type === APP_COMMAND_TYPES\.MELODY_SELECT_CLIP/);
  assert.match(source, /createLaunchpadXDrumsLedFrame\(surfaceRef\.current\)/);
  assert.match(source, /createLaunchpadXChordLedFrame\(surfaceRef\.current\)/);
  assert.match(source, /createLaunchpadXMelodyLedFrame\(surfaceRef\.current\)/);
  assert.match(source, /activeInputNotes/);
  assert.match(source, /getLaunchpadMelodyInputId/);
  assert.match(source, /melodyNoteByPadRef\.current\.set\(message\.number, command\.note\)/);
  assert.match(source, /melodyNoteByPadRef\.current\.delete\(message\.number\)/);
  assert.match(source, /const releaseMelodyPads = useCallback/);
  assert.match(source, /window\.addEventListener\('blur', handleWindowBlur\)/);
  assert.match(source, /pressedMelodyPads\.add\(message\.number\)/);
  assert.match(source, /pressedMelodyPads\.delete\(message\.number\)/);
  assert.match(source, /output\.send\(message\)/);
});

test('Chord editor synchronizes its harmony popover to the Launchpad target', async () => {
  const source = await readFile(
    new URL('../src/app/components/ChordEditor.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /launchpadHarmonyTarget/);
  assert.match(source, /launchpadHarmonySelection/);
  assert.match(source, /is-launchpad-selected/);
  assert.match(source, /Capture MIDI 试听 · 再按已选 Pad 确认/);
  assert.match(source, /harmonyAnchorRefs/);
  assert.match(source, /source: 'launchpad'/);
  assert.match(source, /onLaunchpadHarmonyClose/);
});

test('top bar renders a visible Launchpad connection state and raw MIDI message', async () => {
  const topBarSource = await readFile(
    new URL('../src/app/components/TopBar.jsx', import.meta.url),
    'utf8',
  );
  const statusSource = await readFile(
    new URL('../src/app/components/HardwareInputStatus.jsx', import.meta.url),
    'utf8',
  );
  const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');

  assert.match(topBarSource, /createElement\(HardwareInputStatus, hardwareInput\)/);
  assert.match(statusSource, /连接 Launchpad/);
  assert.match(statusSource, /Launchpad 已连接/);
  assert.match(statusSource, /hardware-midi-message/);
  assert.match(statusSource, /LED 不可用/);
  assert.match(statusSource, /CAPTURE = PLAY/);
  assert.match(statusSource, /status === MIDI_CONNECTION_STATUS\.CONNECTED \? captureLabel : 'MIDI INPUT'/);
  assert.match(statusSource, /onClick=\{canConnect \? onConnect : undefined\}/);
  assert.match(css, /\.hardware-midi-control\s*\{[^}]*display:\s*grid;/s);
  assert.match(css, /\.hardware-midi-control\[data-status="connected"\]/);
});
