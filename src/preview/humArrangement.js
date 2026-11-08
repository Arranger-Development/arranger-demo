import { getDialDrumPreset } from '../data/dialDrumPresets.js';
import { createDrumsCell } from '../domain/drumsCells.js';
import { createMelodyCellFromNotes } from '../domain/melodyCells.js';

const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = midi => `${pitches[midi % 12]}${Math.floor(midi / 12) - 1}`;
const stepsPerBar = 16;
const minNoteSeconds = 0.065;
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const emptySteps = length => Array(length).fill(null);
const toBars = steps => Array.from({ length: steps.length / stepsPerBar }, (_, bar) => steps.slice(bar * stepsPerBar, (bar + 1) * stepsPerBar));

function hasNewAttack(samples, time) {
  const index = Math.round(time * 22050), window = 330;
  const energy = offset => {
    let sum = 0;
    for (let i = 0; i < window; i++) sum += (samples[index + offset + i] ?? 0) ** 2;
    return Math.sqrt(sum / window);
  };
  const before = Math.min(energy(-2 * window), energy(-window));
  const after = Math.max(energy(0), energy(window));
  return after > before * 1.2 + 0.004;
}

export function cleanHumNotes(events, recordingSeconds, samples) {
  const candidates = events.flatMap(({ startTimeSeconds, durationSeconds, pitchMidi, amplitude }) => {
    const start = Math.max(0, startTimeSeconds);
    const end = Math.min(recordingSeconds, startTimeSeconds + durationSeconds);
    if (!Number.isInteger(pitchMidi) || pitchMidi < 36 || pitchMidi > 88 || !(end - start >= minNoteSeconds) || !(amplitude > 0)) return [];
    return [{ start, end, pitch: pitchMidi, amplitude }];
  }).sort((a, b) => a.start - b.start || b.amplitude - a.amplitude);
  const notes = [];
  for (const candidate of candidates) {
    const previous = notes.at(-1);
    if (samples && previous?.pitch === candidate.pitch && Math.abs(candidate.start - previous.end) < 0.032
      && candidate.end - candidate.start < 0.65 * (previous.end - previous.start) && !hasNewAttack(samples, candidate.start)) continue;
    if (previous && candidate.start < previous.end) {
      // A competing pitch over most of the same note is usually an overtone.
      const overlap = Math.min(previous.end, candidate.end) - candidate.start;
      if (overlap >= 0.55 * Math.min(previous.end - previous.start, candidate.end - candidate.start)) {
        if (candidate.amplitude * Math.sqrt(candidate.end - candidate.start) > previous.amplitude * Math.sqrt(previous.end - previous.start) * 1.15) notes.pop();
        else continue;
      } else if (candidate.start - previous.start >= minNoteSeconds) previous.end = candidate.start;
      else continue;
    }
    const last = notes.at(-1);
    if (last && last.end > candidate.start) last.end = candidate.start;
    notes.push(candidate);
  }
  return notes.filter(note => note.end - note.start >= minNoteSeconds);
}

export function estimateHumBpm(notes) {
  const gaps = notes.slice(1).map((note, i) => note.start - notes[i].start).filter(gap => gap >= 0.18 && gap <= 1.8);
  if (gaps.length < 3) return null;
  let best = { score: -Infinity, bpm: null, coverage: 0 };
  const typicalGap = median(gaps);
  for (let bpm = 65; bpm <= 155; bpm++) {
    const beat = 60 / bpm;
    const distances = gaps.map(gap => Math.min(...[0.5, 1, 1.5, 2, 3].map(beats => Math.abs(gap / beat - beats))));
    const coverage = distances.filter(distance => distance <= 0.12).length / gaps.length;
    const score = coverage - distances.reduce((sum, distance) => sum + distance, 0) / gaps.length
      - 0.12 * Math.abs(Math.log2(typicalGap / beat));
    if (score > best.score) best = { bpm, score, coverage };
  }
  return best.coverage >= 0.75 && best.score >= 0.62 ? best.bpm : null;
}

export function makeHumMelody(notes, bpm) {
  if (!notes.length) return null;
  // The existing Jam editor supports C3–B5. Move the whole phrase by an octave if needed.
  const shift = [0, 12, -12, 24, -24].find(offset => notes.every(note => note.pitch + offset >= 48 && note.pitch + offset <= 83));
  if (shift === undefined) return null;
  const origin = notes[0].start;
  const stepRate = bpm / 15;
  const events = notes.map(note => {
    const rawStart = (note.start - origin) * stepRate;
    const closest = Math.round(rawStart);
    const start = Math.abs(closest - rawStart) <= 0.35 ? rawStart + (closest - rawStart) * 0.25 : rawStart;
    return { start, end: start + (note.end - note.start) * stepRate, pitch: note.pitch + shift, amplitude: note.amplitude };
  });
  for (let i = 1; i < events.length; i++) events[i - 1].end = Math.min(events[i - 1].end, events[i].start);
  const steps = emptySteps(Math.max(1, Math.ceil(events.at(-1).end / stepsPerBar)) * stepsPerBar);
  for (const event of events) {
    const step = Math.floor(event.start), note = noteName(event.pitch), cell = steps[step];
    const notePerformances = cell?.notePerformances ?? {};
    (notePerformances[note] ??= []).push({ offsetSteps: event.start - step,
      durationSteps: Math.max(0.05, event.end - event.start), velocity: clamp(0.4 + event.amplitude * 0.45, 0.5, 0.86) });
    steps[step] = createMelodyCellFromNotes(Object.keys(notePerformances), { notePerformances });
  }
  return { bars: toBars(steps), shift };
}

const scaleModes = [[0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]];
const keys = scaleModes.flatMap(scale => pitches.map((_, tonic) => {
  const tones = scale.map(interval => (interval + tonic) % 12);
  return { tonic, tones, chords: tones.map((root, index) => ({ root, tones: [root, tones[(index + 2) % 7], tones[(index + 4) % 7]] })) };
}));

function melodyEvents(bars) {
  return bars.flatMap((bar, i) => bar.flatMap((cell, step) => Object.entries(cell?.notePerformances ?? {}).flatMap(([note, hits]) => {
    const pitch = pitches.indexOf(note.slice(0, -1));
    return hits.map(hit => ({ pitch, start: i * stepsPerBar + step + hit.offsetSteps, duration: hit.durationSteps }));
  })));
}

function fitHarmony(events, halfBars) {
  const windows = Array.from({ length: halfBars }, (_, index) => {
    const start = index * 8;
    return events.flatMap(event => {
      const length = Math.min(event.start + event.duration, start + 8) - Math.max(start, event.start);
      if (length <= 0) return [];
      const beat = Math.round(event.start);
      return [{ pitch: event.pitch, weight: length * (beat % 8 === 0 ? 1.4 : beat % 4 === 0 ? 1.2 : 1) }];
    });
  });
  const lastPitch = events.at(-1).pitch;
  let best = { score: -Infinity, path: [] };
  for (const key of keys) {
    const keyScore = events.reduce((sum, event) => sum + event.duration * (key.tones.includes(event.pitch) ? 0.12 : -0.35), 0);
    let paths = key.chords.map((chord, index) => ({ score: index === 0 ? 0.9 : 0, path: [] }));
    for (const window of windows) {
      paths = key.chords.map((chord, index) => {
        const fit = window.reduce((sum, event) => sum + event.weight * (chord.tones.includes(event.pitch) ? 1 : key.tones.includes(event.pitch) ? -0.3 : -0.55), 0);
        return paths.reduce((winner, previous, from) => {
          if (!window.length && from !== index) return winner;
          const common = chord.tones.filter(pitch => key.chords[from].tones.includes(pitch)).length;
          const score = previous.score + fit + (from === index ? 0 : -1.6 + common * 0.24);
          return score > winner.score ? { score, path: [...previous.path, chord] } : winner;
        }, { score: -Infinity, path: [] });
      });
    }
    for (const path of paths) {
      const score = path.score + keyScore + (key.tonic === lastPitch ? 0.7 : 0) + (path.path.at(-1)?.root === key.tonic ? 0.35 : 0);
      if (score > best.score) best = { score, path: path.path };
    }
  }
  return best.path;
}

function closestVoicing(chord, previous) {
  const starting = chord.tones.map(pitch => 48 + pitch);
  const rootPosition = starting.map((pitch, i) => i && pitch <= starting[0] ? pitch + 12 : pitch);
  const inversions = rootPosition.map((_, i) => [...rootPosition.slice(i), ...rootPosition.slice(0, i).map(pitch => pitch + 12)]);
  const options = inversions.flatMap(notes => [-12, 0, 12].map(offset => notes.map(note => note + offset)))
    .filter(notes => notes[0] >= 48 && notes.at(-1) <= 72);
  const reference = previous ?? [52, 55, 59];
  const distance = notes => notes.reduce((sum, note, index) => sum + Math.abs(note - reference[index]), 0);
  return options.reduce((best, notes) => distance(notes) < distance(best) ? notes : best);
}

export function arrangeHumMelody(bars) {
  const events = melodyEvents(bars);
  if (!events.length) throw new Error('旋律没有可配轨的音符');
  const length = bars.length * stepsPerBar;
  const harmony = fitHarmony(events, length / 8);
  const chord = emptySteps(length), drums = emptySteps(length), bass = emptySteps(length);
  let previousVoicing;
  for (const [index, harmonyChord] of harmony.entries()) {
    const voicing = closestVoicing(harmonyChord, previousVoicing);
    const notes = voicing.map(noteName);
    previousVoicing = voicing;
    chord[index * 8] = { type: 'notes', notes, label: notes.join('/'), durationSteps: 7.5,
      notePerformances: Object.fromEntries(notes.map(note => [note, [{ offsetSteps: 0, durationSteps: 7.5, velocity: 0.57 }]])) };
  }
  const drumPreset = getDialDrumPreset(50, 50).bars;
  const onsetCounts = Array(bars.length).fill(0);
  for (const event of events) onsetCounts[Math.floor(event.start / stepsPerBar)]++;
  for (let step = 0; step < length; step++) {
    const bar = Math.floor(step / stepsPerBar), position = step % stepsPerBar;
    const cell = drumPreset[bar % drumPreset.length][position];
    let hits = (cell?.drumHits ?? []).filter(hit => onsetCounts[bar] < 6 ||
      (hit.instrument === 'hihat' ? position % 4 === 0 && hit.offsetSteps === 0 : position % 2 === 0));
    // Keep a pulse and backbeat even when a dense vocal thins the source groove.
    const anchor = position === 0 ? 'kick' : position === 4 || position === 12 ? 'snare' : null;
    if (anchor && !hits.some(hit => hit.instrument === anchor)) hits = [...hits, { instrument: anchor, offsetSteps: 0, durationSteps: 1, velocity: 0.74 }];
    if (step === length - 2 && events.every(event => event.start + event.duration <= length - 4) && !hits.some(hit => hit.instrument === 'snare')) {
      hits = [...hits, { instrument: 'snare', offsetSteps: 0, durationSteps: 1, velocity: 0.45 }];
    }
    drums[step] = createDrumsCell(hits.map(hit => hit.instrument), { drumHits: hits });
  }
  const bassSteps = [];
  for (let step = 0; step < length; step++) {
    if (step % 8 === 0 || (step % 4 === 2 && drums[step]?.instruments.includes('kick'))) bassSteps.push(step);
  }
  for (const [index, step] of bassSteps.entries()) {
    const durationSteps = Math.min(bassSteps[index + 1] ?? length, (Math.floor(step / 8) + 1) * 8) - step - 0.2;
    const note = noteName(36 + harmony[Math.floor(step / 8)].root), velocity = step % 8 === 0 ? 0.75 : 0.55;
    bass[step] = { type: 'bass', note, durationSteps, velocity, notePerformances: { [note]: [{ offsetSteps: 0, durationSteps, velocity }] } };
  }
  return { chord: toBars(chord), bass: toBars(bass), drums: toBars(drums) };
}
