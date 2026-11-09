import { getDialDrumPreset } from '../data/dialDrumPresets.js';
import { createDrumsCell } from '../domain/drumsCells.js';
import { createMelodyCellFromNotes } from '../domain/melodyCells.js';
import { authoredChordAnchors, planHumHarmony } from './humHarmony.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';
import { correctHumPitch } from './humPitchCorrection.js';
import { recoverShortHumNotes } from './humShortNotes.js';

const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = midi => `${pitches[midi % 12]}${Math.floor(midi / 12) - 1}`;
const stepsPerBar = 16;
const minNoteSeconds = 0.065;
const preciseStep = value => Math.round(value * 1e6) / 1e6;
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const emptySteps = length => Array(length).fill(null);
const toBars = steps => Array.from({ length: steps.length / stepsPerBar }, (_, bar) => steps.slice(bar * stepsPerBar, (bar + 1) * stepsPerBar));

const envelopeWindow = 221;
const envelopeStep = envelopeWindow / 22050;
function humEnvelope(samples) {
  const window = envelopeWindow;
  return Array.from({ length: Math.ceil(samples.length / window) }, (_, frame) => {
    let sum = 0;
    for (let i = 0; i < window; i++) sum += (samples[frame * window + i] ?? 0) ** 2;
    return Math.sqrt(sum / window);
  });
}

function continuousHumEnd(envelope, previous, candidate) {
  if (!envelope || Math.abs(candidate.start - previous.end) > 0.12) return null;
  const frameAt = time => Math.round(time / envelopeStep);
  const split = frameAt(candidate.start), join = frameAt(previous.end);
  const nearby = envelope.slice(Math.max(0, split - 4), split + 4);
  const floor = Math.max(0.002, Math.max(...nearby) * 0.16);
  const bridge = envelope.slice(Math.max(0, Math.min(join, split) - 2), Math.max(join, split) + 2);
  if (bridge.filter(level => level < floor).length >= 2) return null;
  const before = Math.min(...envelope.slice(Math.max(0, split - 3), split));
  const after = Math.max(...envelope.slice(split, split + 3));
  if (after > before * 1.5 + 0.006) return null;
  // The decoder may pad a fragment into the following rest. Extend only through voiced audio.
  let endFrame = Math.min(envelope.length - 1, frameAt(candidate.end));
  for (let i = split; i < endFrame; i++) {
    if (envelope[i] < floor && envelope[i + 1] < floor) { endFrame = i; break; }
  }
  return Math.max(previous.end, Math.min(candidate.end, endFrame * envelopeStep));
}

function sharedHumPitchCenter(previous, candidate) {
  if (Math.abs(previous.pitch - candidate.pitch) !== 1
    || !(Math.abs(previous.pitchCenter - candidate.pitchCenter) <= 0.18)) return null;
  const center = (previous.pitchCenter + candidate.pitchCenter) / 2;
  const boundary = (previous.pitch + candidate.pitch) / 2;
  return Math.abs(center - boundary) <= 0.21 ? center : null;
}

export function cleanHumNotes(events, recordingSeconds, samples) {
  const candidates = events.flatMap(({ startTimeSeconds, durationSeconds, pitchMidi, amplitude, pitchCenter }) => {
    const start = Math.max(0, startTimeSeconds);
    const end = Math.min(recordingSeconds, startTimeSeconds + durationSeconds);
    if (!Number.isInteger(pitchMidi) || pitchMidi < 36 || pitchMidi > 88 || !(end - start >= minNoteSeconds) || !(amplitude > 0)) return [];
    return [{ start, end, pitch: pitchMidi, amplitude, ...(Number.isFinite(pitchCenter) && { pitchCenter }) }];
  }).sort((a, b) => a.start - b.start || b.amplitude - a.amplitude);
  const notes = [];
  const envelope = samples && humEnvelope(samples);
  for (const candidate of candidates) {
    const previous = notes.at(-1);
    const sharedCenter = previous && sharedHumPitchCenter(previous, candidate);
    const sustainedEnd = previous && (previous.pitch === candidate.pitch || sharedCenter != null)
      ? continuousHumEnd(envelope, previous, candidate) : null;
    if (sustainedEnd != null) {
      previous.end = sustainedEnd;
      if (sharedCenter != null) {
        previous.pitch = Math.round(sharedCenter);
        previous.pitchCenter = sharedCenter;
      }
      continue;
    }
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
  const valid = recoverShortHumNotes(notes.filter(note => note.end - note.start >= minNoteSeconds), samples);
  if (!valid.some(note => note.pitchCenter !== undefined)) return valid;
  const corrected = correctHumPitch(valid);
  const pitchChanged = valid.some((note, index) => note.pitchRevised || note.pitch !== corrected[index].pitch);
  const joined = [];
  let previousShortAttack = false;
  for (const { shortAttack, ...note } of corrected) {
    const previous = joined.at(-1);
    const end = pitchChanged && !shortAttack && !previousShortAttack && previous?.pitch === note.pitch
      ? continuousHumEnd(envelope, previous, note) : null;
    if (end != null) previous.end = end;
    else {
      joined.push(note);
      previousShortAttack = shortAttack;
    }
  }
  return joined;
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
    const measuredLength = (note.end - note.start) * stepRate;
    const gridLength = Math.floor(preciseStep(measuredLength));
    // A small detected tail should not light another grid cell or consume a rest.
    const length = gridLength >= 1 && measuredLength - gridLength <= 0.35 ? gridLength : measuredLength;
    return { start: preciseStep(start), end: preciseStep(start + length), pitch: note.pitch + shift, amplitude: note.amplitude };
  });
  for (let i = 1; i < events.length; i++) events[i - 1].end = Math.min(events[i - 1].end, events[i].start);
  const steps = emptySteps(Math.max(1, Math.ceil(events.at(-1).end / stepsPerBar)) * stepsPerBar);
  for (const event of events) {
    if (event.end <= event.start) continue;
    const step = Math.floor(event.start), note = noteName(event.pitch), cell = steps[step];
    const notePerformances = cell?.notePerformances ?? {};
    (notePerformances[note] ??= []).push({ offsetSteps: event.start - step,
      durationSteps: event.end - event.start, velocity: clamp(0.4 + event.amplitude * 0.45, 0.5, 0.86) });
    steps[step] = createMelodyCellFromNotes(Object.keys(notePerformances), { notePerformances });
  }
  return { bars: toBars(steps), shift };
}

function bassConnection(current, next, lead, step) {
  if (!current.active || !next.active || current.root === next.root || current.offset + current.duration < 4) return null;
  const from = 36 + current.root, to = 36 + next.root;
  if (Math.abs(from - to) <= 2) return null;
  const sounding = lead.filter(note => note.start < step + 1.8 && note.start + note.duration > step);
  const options = current.tones.filter(pitch => pitch !== current.root
    && sounding.every(note => ![1, 11].includes((note.pitch - pitch + 12) % 12)));
  // Use a tone from the departing chord only if it reaches the next root by step.
  return [to - 1, to + 1, to - 2, to + 2].find(note => options.includes(note % 12) && Math.abs(note - from) <= 5) ?? null;
}

const gcd = (a, b) => b ? gcd(b, a % b) : a;
export function arrangeHumMelody(bars, timbreId, anchors = {}) {
  const bassBarCount = anchors.bassBars?.length;
  const commonCycle = bassBarCount ? (bars.length * bassBarCount) / gcd(bars.length, bassBarCount) : bars.length;
  // When the full common cycle is too long for a Jam phrase, stay in phase with the fixed bass.
  const chordBarCount = commonCycle <= MAX_PROJECT_BARS ? commonCycle : bassBarCount;
  const { events, windows } = planHumHarmony(bars, timbreId, { ...anchors, chordBarCount });
  const length = bars.length * stepsPerBar;
  const bassLength = anchors.chordBars?.length ? anchors.chordBars.length * stepsPerBar : length;
  const chord = emptySteps(chordBarCount * stepsPerBar), drums = emptySteps(length), bass = emptySteps(bassLength);
  for (const [index, window] of windows.entries()) {
    if (!window.active) continue;
    const notes = window.voicing.map(noteName);
    const durationSteps = window.duration;
    const unchanged = window.root === windows[index - 1]?.root && windows[index - 1]?.active;
    const velocity = unchanged && index % 2 ? 0.38 : 0.48;
    chord[index * 8 + window.offset] = { type: 'notes', notes, label: notes.join('/'), durationSteps,
      notePerformances: Object.fromEntries(notes.map(note => [note, [{ offsetSteps: 0, durationSteps, velocity }]])) };
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
  const authored = authoredChordAnchors(anchors.chordBars, bassLength);
  const bassSteps = authored ? [...authored.keys()] : [];
  const links = new Map();
  if (!authored) for (let step = 0; step < length; step++) {
    const index = Math.floor(step / 8), current = windows[index];
    if (!current.active) continue;
    if (step % 8 === 6) {
      const next = windows[(index + 1) % (length / 8)];
      const link = bassConnection(current, next, events, step);
      if (link != null) links.set(step, link);
    }
    if (step % 8 === 0 || links.has(step) || (step % 4 === 2 && drums[step]?.instruments.includes('kick'))) bassSteps.push(step);
  }
  for (const [index, step] of bassSteps.entries()) {
    const boundary = (Math.floor(step / 8) + 1) * 8;
    const durationSteps = Math.min(bassSteps[index + 1] ?? bassLength, boundary, step + 7.8) - step - 0.2;
    const root = authored?.get(step) ?? windows[Math.floor(step / 8)].root;
    const note = noteName(links.get(step) ?? 36 + root), velocity = authored || step % 8 === 0 ? 0.68 : 0.48;
    bass[step] = { type: 'bass', note, durationSteps, velocity,
      ...(authored ? { harmonyAnchor: true } : {}), ...(links.has(step) ? { harmonyLink: true } : {}), notePerformances: { [note]: [{ offsetSteps: 0, durationSteps, velocity }] } };
  }
  return { chord: toBars(chord), bass: toBars(bass), drums: toBars(drums) };
}
