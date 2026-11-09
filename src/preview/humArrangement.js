import { getDialDrumPreset } from '../data/dialDrumPresets.js';
import { createDrumsCell } from '../domain/drumsCells.js';
import { createMelodyCellFromNotes } from '../domain/melodyCells.js';
import { authoredChordAnchors, planHumHarmony } from './humHarmony.js';
import { planHumPhraseRhythm } from './humPhraseRhythm.js';
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
  const gaps = notes.slice(1).map((note, i) => note.start - notes[i].start).filter(gap => gap > 0);
  if (gaps.length < 3) return null;
  const subdivisions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const candidates = [];
  const typicalGap = median(gaps);
  for (let bpm = 65; bpm <= 155; bpm++) {
    const beat = 60 / bpm;
    const distances = gaps.map(gap => Math.min(...subdivisions.map(beats => Math.abs(gap / beat - beats))));
    const coverage = distances.filter(distance => distance <= 0.06).length / gaps.length;
    const pulseCoverage = gaps.filter(gap => Math.abs(gap / beat * 2 - Math.round(gap / beat * 2)) <= 0.12).length / gaps.length;
    const phaseCoverage = notes.filter(note => {
      const steps = (note.start - notes[0].start) * bpm / 15;
      return Math.abs(steps - Math.round(steps)) <= 0.25;
    }).length / notes.length;
    const meanError = distances.reduce((sum, distance) => sum + distance, 0) / gaps.length;
    const score = coverage * 0.7 + phaseCoverage * 0.3 + pulseCoverage * 0.12 - meanError
      - 0.12 * Math.abs(Math.log2(typicalGap / beat));
    candidates.push({ bpm, score, coverage, phaseCoverage, meanError });
  }
  candidates.sort((a, b) => b.score - a.score);
  const [best] = candidates;
  const alternative = candidates.find(candidate => Math.abs(candidate.bpm - best.bpm) >= 0.08 * best.bpm);
  if (best.coverage < 0.75 || best.phaseCoverage < 0.75 || best.meanError > 0.05
    || best.score < 0.62 || alternative && best.score - alternative.score < 0.045) return null;
  return best.bpm;
}

function pickupStepsFor(notes, bpm) {
  const stepRate = bpm / 15;
  const accents = notes.map(note => ({
    step: (note.start - notes[0].start) * stepRate,
    weight: Math.min(4, (note.end - note.start) * stepRate) * clamp(note.amplitude, 0.25, 1),
  }));
  const weight = accents.reduce((sum, accent) => sum + accent.weight, 0);
  if (accents[0].weight >= 0.8 * (weight - accents[0].weight) / (accents.length - 1)) return 0;
  const phases = [0, 1, 2, 3].map(offset => {
    const beats = new Set();
    const score = accents.reduce((sum, accent) => {
      const step = accent.step + offset, beat = Math.round(step / 4);
      const fit = Math.max(0, 1 - Math.abs(step - beat * 4) / 0.75);
      if (fit > 0.5) beats.add(beat);
      return sum + accent.weight * fit * (beat % 4 === 0 ? 1 : beat % 2 === 0 ? 0.9 : 0.75);
    }, 0);
    return { offset, score, beats: beats.size };
  });
  const best = phases.toSorted((a, b) => b.score - a.score)[0];
  return best.beats >= 2 && best.score > phases[0].score + 0.15 * weight ? best.offset : 0;
}

export function fitHumTiming(notes, projectBpm, { emptyProject = false } = {}) {
  const estimate = estimateHumBpm(notes);
  const bpm = emptyProject && estimate ? estimate : projectBpm;
  return {
    bpm,
    sourceBpm: estimate && Math.abs(estimate - bpm) >= 0.05 * bpm ? estimate : bpm,
    pickupSteps: estimate ? pickupStepsFor(notes, estimate) : 0,
    quantize: estimate !== null,
  };
}

export function makeHumMelody(notes, bpm, { sourceBpm = bpm, pickupSteps = 0, quantize = true } = {}) {
  if (!notes.length) return null;
  // The existing Jam editor supports C3–B5. Move the whole phrase by an octave if needed.
  const shift = [0, 12, -12, 24, -24].find(offset => notes.every(note => note.pitch + offset >= 48 && note.pitch + offset <= 83));
  if (shift === undefined) return null;
  const origin = notes[0].start;
  // At playback the project BPM converts these source-beat positions back to
  // seconds. This scales onsets, rests and lengths together.
  const stepRate = sourceBpm / 15;
  const maxNudgeSteps = 0.025 * bpm / 15;
  const events = notes.map(note => {
    const rawStart = (note.start - origin) * stepRate + pickupSteps;
    const distance = Math.round(rawStart) - rawStart;
    const nudge = quantize && Math.abs(distance) <= 0.35 ? clamp(distance / 2, -maxNudgeSteps, maxNudgeSteps) : 0;
    const start = rawStart + nudge;
    const length = (note.end - note.start) * stepRate;
    return { start: preciseStep(start), end: preciseStep(start + length), pitch: note.pitch + shift, amplitude: note.amplitude };
  });
  for (let i = 1; i < events.length; i++) events[i - 1].end = Math.min(events[i - 1].end, events[i].start);
  const last = events.at(-1);
  const lastBarEnd = (Math.floor(last.start / stepsPerBar) + 1) * stepsPerBar;
  if (last.end > lastBarEnd && last.end - lastBarEnd < 0.5) last.end = lastBarEnd;
  const steps = emptySteps(Math.max(1, Math.ceil(last.end / stepsPerBar)) * stepsPerBar);
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
  if (!next || current.root === next.root) return null;
  const from = 36 + current.root, to = 36 + next.root;
  if (Math.abs(from - to) <= 2) return null;
  const sounding = lead.filter(note => note.start < step + 1.8 && note.start + note.duration > step);
  const options = current.tones.filter(pitch => pitch !== current.root
    && sounding.every(note => ![1, 11].includes((note.pitch - pitch + 12) % 12)));
  // Use a tone from the departing chord only if it reaches the next root by step.
  return [to - 1, to + 1, to - 2, to + 2].find(note => options.includes(note % 12) && Math.abs(note - from) <= 5) ?? null;
}

function arrangeHumDrums(events, { anchors, sounding }, length) {
  const preset = getDialDrumPreset(50, 50).bars;
  const onsetCounts = Array(length / stepsPerBar).fill(0);
  for (const event of events) onsetCounts[Math.floor(event.start / stepsPerBar)]++;

  const rests = [[0, sounding[0][0]]];
  for (let index = 0; index < sounding.length; index++) {
    const end = sounding[index][1], next = sounding[index + 1]?.[0] ?? length;
    if (next - end >= 4 - 1e-6) rests.push([end, next]);
  }
  const kicks = new Map(anchors.map(({ start, required, entrance }) => {
    const step = Math.floor(start);
    return [step, { instrument: 'kick', offsetSteps: start - step, durationSteps: 1,
      velocity: required ? (entrance ? 0.76 : 0.66) : 0.48 }];
  }));
  const isQuiet = time => {
    if (rests.some(([from, to]) => time >= from && time < to)) return true;
    for (let step = Math.floor(time - 0.5); step <= Math.floor(time + 0.5); step++) {
      const kick = kicks.get((step + length) % length);
      if (kick && Math.abs(time - step - kick.offsetSteps) < 0.5) return true;
    }
    return false;
  };
  const humDrumQuietSteps = [];
  const drums = Array.from({ length }, (_, step) => {
    const bar = Math.floor(step / stepsPerBar), position = step % stepsPerBar;
    const cell = preset[bar % preset.length][position];
    const quiet = isQuiet(step);
    if (quiet) humDrumQuietSteps.push(step);
    const hits = (cell?.drumHits ?? []).filter(hit => hit.instrument === 'hihat'
      && !isQuiet(step + hit.offsetSteps) && (onsetCounts[bar] < 6 || position % 4 === 0 && hit.offsetSteps === 0));
    if ((position === 4 || position === 12) && !quiet) {
      const snare = cell?.drumHits?.find(hit => hit.instrument === 'snare');
      hits.push(snare ? { ...snare, offsetSteps: 0 } : { instrument: 'snare', offsetSteps: 0, durationSteps: 1, velocity: 0.74 });
    }
    if (kicks.has(step)) hits.push(kicks.get(step));
    return createDrumsCell(hits.map(hit => hit.instrument), { drumHits: hits });
  });
  return { drums: toBars(drums), humDrumQuietSteps };
}

const gcd = (a, b) => b ? gcd(b, a % b) : a;
function repeatHumRhythm({ anchors, sounding }, steps, length) {
  const repeated = { anchors: [], sounding: [] };
  for (let offset = 0; offset < length; offset += steps) {
    repeated.anchors.push(...anchors.map(hit => ({ ...hit, start: hit.start + offset, end: hit.end + offset })));
    repeated.sounding.push(...sounding.map(([start, end]) => [start + offset, end + offset]));
  }
  return repeated;
}

export function arrangeHumMelody(bars, timbreId, anchors = {}) {
  const bassBarCount = anchors.bassBars?.length;
  const commonCycle = bassBarCount ? (bars.length * bassBarCount) / gcd(bars.length, bassBarCount) : bars.length;
  // When the full common cycle is too long for a Jam phrase, stay in phase with the fixed bass.
  const chordBarCount = commonCycle <= MAX_PROJECT_BARS ? commonCycle : bassBarCount;
  const { events, lead, windows } = planHumHarmony(bars, timbreId, { ...anchors, chordBarCount });
  const length = bars.length * stepsPerBar;
  const fixedChordBars = anchors.chordBars?.length || bars.length;
  const bassCycle = bars.length * fixedChordBars / gcd(bars.length, fixedChordBars);
  const bassLength = (bassCycle <= MAX_PROJECT_BARS ? bassCycle : bars.length) * stepsPerBar;
  const chord = emptySteps(chordBarCount * stepsPerBar), bass = emptySteps(bassLength);
  const chordRhythm = planHumPhraseRhythm(lead, windows);
  const rhythm = lead === events ? chordRhythm : planHumPhraseRhythm(events, windows);
  for (const { start, end, harmony, entrance, required } of chordRhythm.anchors) {
    const notes = harmony.voicing.map(noteName);
    const durationSteps = end - start, step = Math.floor(start);
    const velocity = required ? (entrance ? 0.48 : 0.42) : 0.31;
    chord[step] = { type: 'notes', notes, label: notes.join('/'), durationSteps,
      notePerformances: Object.fromEntries(notes.map(note => [note, [{ offsetSteps: start - step, durationSteps, velocity }]])) };
  }
  const authored = authoredChordAnchors(anchors.chordBars, bassLength);
  const bassRhythm = bassLength === length ? rhythm : repeatHumRhythm(rhythm, length, bassLength);
  function addBass(start, end, pitch, velocity, markers) {
    if (end <= start) return;
    const step = Math.floor(start);
    const durationSteps = end - start - Math.min(0.2, (end - start) * 0.15);
    const note = noteName(pitch);
    bass[step] = { type: 'bass', note, durationSteps, velocity,
      ...markers, notePerformances: { [note]: [{ offsetSteps: start - step, durationSteps, velocity }] } };
  }
  const bassHits = [...bassRhythm.anchors];
  const authoredChanges = [...(authored ?? [])].filter(([, root], index, changes) => changes[index - 1]?.[1] !== root);
  for (const [start] of authoredChanges) {
    if (bassHits.some(hit => Math.floor(hit.start) === start)) continue;
    const range = bassRhythm.sounding.find(([from, to]) => start >= from && start < to);
    if (range) bassHits.push({ start, end: range[1], required: true });
  }
  bassHits.sort((a, b) => a.start - b.start);
  let rootChange = -1;
  for (const [index, hit] of bassHits.entries()) {
    while (authoredChanges[rootChange + 1]?.[0] <= hit.start) rootChange++;
    const root = authoredChanges[rootChange]?.[1] ?? hit.harmony.root;
    const next = bassHits[index + 1];
    const link = !authored && !hit.required && next && next.start - hit.start <= 4.5
      ? bassConnection(hit.harmony, next.harmony, events, hit.start) : null;
    addBass(hit.start, Math.min(hit.end, next?.start ?? Infinity), link ?? 36 + root, hit.required ? 0.68 : 0.48,
      link != null ? { harmonyLink: true } : {});
  }
  return { chord: toBars(chord), bass: toBars(bass), ...arrangeHumDrums(events, rhythm, length),
    chordSounding: chordRhythm.sounding, bassSounding: bassRhythm.sounding };
}

export function arrangeHumBacking(bars, timbreId, anchors) {
  const { chord, bass, drums, humDrumQuietSteps, chordSounding, bassSounding } = arrangeHumMelody(bars, timbreId, anchors);
  return [{ trackId: 'chord', bars: chord, humSoundingRanges: chordSounding },
    { trackId: 'bass', bars: bass, humSoundingRanges: bassSounding },
    { trackId: 'drums', bars: drums, humDrumQuietSteps }];
}
