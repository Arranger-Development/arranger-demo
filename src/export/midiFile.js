import { getTotalBars } from '../domain/projectLength.js';
import { getTrackOutputVolume } from '../domain/trackVolume.js';
import { createMatrixPlaybackAdapter } from '../audio/matrixPlaybackAdapter.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { getTrackType } from '../domain/trackInstances.js';

const MIDI_TICKS_PER_BEAT = 480;
const MIDI_TICKS_PER_STEP = MIDI_TICKS_PER_BEAT / 4;
const DRUM_MIDI_NOTES = Object.freeze({
  hihat: 42,
  kick: 36,
  snare: 38,
});
const MELODIC_CHANNELS = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15,
]);

function clampMidiByte(value) {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function encodeVariableLength(value) {
  let remaining = Math.max(0, Math.floor(value));
  const bytes = [remaining & 0x7f];
  while ((remaining >>= 7) > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
  }
  return bytes;
}

function encodeUint16(value) {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function encodeUint32(value) {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ];
}

function encodeText(value) {
  return [...new TextEncoder().encode(String(value ?? ''))];
}

function createMetaEvent(type, data, tick = 0) {
  return { bytes: [0xff, type, ...encodeVariableLength(data.length), ...data], tick };
}

function createTrackNameEvent(name) {
  return createMetaEvent(0x03, encodeText(name));
}

function createTempoTrack(bpm, endTick) {
  const normalizedBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
  const microsecondsPerBeat = Math.round(60_000_000 / normalizedBpm);
  const tempoData = [
    (microsecondsPerBeat >>> 16) & 0xff,
    (microsecondsPerBeat >>> 8) & 0xff,
    microsecondsPerBeat & 0xff,
  ];

  return encodeTrack([
    createTrackNameEvent('Project Arranger'),
    createMetaEvent(0x51, tempoData),
    createMetaEvent(0x58, [4, 2, 24, 8]),
  ], endTick);
}

function durationToTicks(event) {
  if (Number.isInteger(event.durationSteps) && event.durationSteps > 0) {
    return event.durationSteps * MIDI_TICKS_PER_STEP;
  }

  const duration = event.duration ?? '16n';
  if (duration === '1n') return MIDI_TICKS_PER_BEAT * 4;
  if (duration === '2n') return MIDI_TICKS_PER_BEAT * 2;
  if (duration === '4n') return MIDI_TICKS_PER_BEAT;
  if (duration === '8n') return MIDI_TICKS_PER_BEAT / 2;
  return MIDI_TICKS_PER_STEP;
}

function noteNameToMidi(note) {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note ?? '');
  if (!match) return null;

  const pitchClasses = {
    A: 9,
    B: 11,
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
  };
  const pitchClass = pitchClasses[match[1]] + (match[2] === '#' ? 1 : 0);
  const midiNote = (Number(match[3]) + 1) * 12 + pitchClass;
  return midiNote >= 0 && midiNote <= 127 ? midiNote : null;
}

function createNoteEvents({ channel, event, velocity = 100 }) {
  const timingOffset = Number.isFinite(event.timingOffset) ? event.timingOffset : 0;
  const tick = Math.max(0, Math.round(
    (event.bar * STEPS_PER_BAR + event.step + timingOffset) * MIDI_TICKS_PER_STEP,
  ));
  const duration = Math.max(1, durationToTicks(event));
  const noteVelocity = ['chord', 'drums', 'melody', 'bass'].includes(event.type) && Number.isFinite(event.velocity)
    ? event.velocity * 127
    : velocity;
  const notes = event.type === 'drums'
    ? [DRUM_MIDI_NOTES[event.instrument]].filter(Number.isInteger)
    : (event.type === 'chord' ? event.notes : [event.note])
      .map(noteNameToMidi)
      .filter(Number.isInteger);

  return notes.flatMap((note) => [
    { bytes: [0x90 | channel, note, clampMidiByte(noteVelocity)], priority: 1, tick },
    { bytes: [0x80 | channel, note, 0], priority: 0, tick: tick + duration },
  ]);
}

function encodeTrack(events, endTick = 0) {
  const sorted = [...events].sort((a, b) => (
    a.tick - b.tick || (a.priority ?? 0) - (b.priority ?? 0)
  ));
  let previousTick = 0;
  const bytes = [];
  sorted.forEach((event) => {
    bytes.push(...encodeVariableLength(event.tick - previousTick), ...event.bytes);
    previousTick = event.tick;
  });
  bytes.push(...encodeVariableLength(Math.max(0, endTick - previousTick)), 0xff, 0x2f, 0x00);
  return [
    ...encodeText('MTrk'),
    ...encodeUint32(bytes.length),
    ...bytes,
  ];
}

function getTrackName(state, trackId) {
  return state.trackInstancesById?.[trackId]?.name ?? trackId;
}

function getExportTrackIds(state) {
  return (state.trackOrder ?? [])
    .filter((trackId) => Boolean(getTrackType(state, trackId)));
}

function createMidiFile(state) {
  if (!state?.matrix) throw new TypeError('A project matrix is required to export MIDI.');

  const trackIds = getExportTrackIds(state);
  const eventsByTrack = Object.fromEntries(trackIds.map((trackId) => [trackId, []]));
  const adapter = createMatrixPlaybackAdapter({
    matrix: state.matrix,
    trackInstancesById: state.trackInstancesById,
    trackOrder: trackIds,
  }, { totalBars: getTotalBars(state) });

  for (let bar = 0; bar < getTotalBars(state); bar += 1) {
    for (let step = 0; step < STEPS_PER_BAR; step += 1) {
      adapter.getEventsForStep(bar, step).forEach((event) => {
        if (getTrackOutputVolume(state.volumes?.[event.trackId], state.mutedTracks?.[event.trackId]) === -Infinity) return;
        eventsByTrack[event.trackId]?.push(event);
      });
    }
  }

  const endTick = getTotalBars(state) * STEPS_PER_BAR * MIDI_TICKS_PER_STEP;
  const tracks = [createTempoTrack(state.bpm, endTick)];
  trackIds.forEach((trackId, index) => {
    const trackType = getTrackType(state, trackId);
    const channel = trackType === 'drums' ? 9 : MELODIC_CHANNELS[index % MELODIC_CHANNELS.length];
    const noteEvents = eventsByTrack[trackId].flatMap((event) => createNoteEvents({
      channel,
      event,
    }));
    tracks.push(encodeTrack([
      createTrackNameEvent(getTrackName(state, trackId)),
      ...noteEvents,
    ], endTick));
  });

  const header = [
    ...encodeText('MThd'),
    ...encodeUint32(6),
    ...encodeUint16(1),
    ...encodeUint16(tracks.length),
    ...encodeUint16(MIDI_TICKS_PER_BEAT),
  ];
  return new Uint8Array([...header, ...tracks.flat()]);
}

function createMidiFileBlob(state) {
  return new Blob([createMidiFile(state)], { type: 'audio/midi' });
}

export {
  DRUM_MIDI_NOTES,
  MIDI_TICKS_PER_BEAT,
  MIDI_TICKS_PER_STEP,
  createMidiFile,
  createMidiFileBlob,
  createNoteEvents,
  durationToTicks,
  noteNameToMidi,
};
