import { extractChordEvent } from '../audio/matrixPlaybackAdapter.js';
import { MELODY_NOTE_IDS, MELODY_PITCH_CLASSES } from '../data/melodyScales.js';
import { DEEP_AUTUMN_MELODY } from '../data/performanceTimbres.js';
import { createMelodyCellFromNotes } from '../domain/melodyCells.js';
import { expandNotePerformances, noteDurationSteps } from '../domain/notePerformances.js';
import { melodyEvents, planHumHarmonyFromEvents } from '../preview/humHarmony.js';
import { planHumPhraseRhythm } from '../preview/humPhraseRhythm.js';

const epsilon = 1e-6;
const pitchClass = note => MELODY_PITCH_CLASSES.indexOf(note.slice(0, -1));
const noteName = midi => `${MELODY_PITCH_CLASSES[midi % 12]}${Math.floor(midi / 12) - 1}`;

function authoredHarmony(bars) {
  const period = bars.length * 16;
  const attacks = bars.flatMap((bar, index) => bar.flatMap((cell, step) => {
    const chord = extractChordEvent(cell, index, step);
    return chord ? expandNotePerformances([chord], cell).flatMap(event => {
      const start = index * 16 + step + (event.timingOffset ?? 0);
      const tones = event.notes.map(pitchClass).filter(pitch => pitch >= 0);
      return tones.length ? [{ start, end: start + noteDurationSteps(event), tones }] : [];
    }) : [];
  })).sort((a, b) => a.start - b.start);
  if (!attacks.length) return null;
  return start => {
    const phase = start % period;
    const sounding = attacks.filter(hit => (phase >= hit.start - epsilon && phase < hit.end - epsilon)
      || phase + period < hit.end - epsilon);
    return [...new Set(sounding.flatMap(hit => hit.tones))];
  };
}

function varyOnsets(events, level, rhythm, harmonyAt) {
  if (level === 50) return events;
  const protectedStarts = new Set(rhythm.anchors.filter(hit => hit.required).map(hit => hit.start));
  if (harmonyAt) {
    let previous = '';
    for (const event of events) {
      const chord = harmonyAt(event.start).toSorted().join(',');
      if (chord && previous !== chord) protectedStarts.add(event.start);
      if (chord) previous = chord;
    }
  }
  const first = events[0].start, last = events.at(-1).start;
  const movable = event => event.duration <= 2 + epsilon && event.start !== first && event.start !== last
    && !protectedStarts.has(event.start);
  if (level === 0 || level === 100) {
    const options = events.filter(event => movable(event) && (level === 0 ? event.passing : event.duration >= 1 - epsilon));
    const choices = new Map();
    for (const event of options.toSorted((a, b) => level === 0 ? a.duration - b.duration : b.duration - a.duration)) {
      const half = Math.floor(event.start / 8);
      if (!choices.has(half)) choices.set(half, event);
    }
    return events.flatMap(event => {
      if (choices.get(Math.floor(event.start / 8)) !== event) return [event];
      if (level === 0) return [];
      const duration = event.duration / 2;
      return [{ ...event, duration }, { ...event, start: event.start + duration, duration }];
    });
  }

  const rests = rhythm.sounding.slice(1).flatMap(([start], index) => {
    const end = rhythm.sounding[index][1];
    return start - end >= 2.5 - epsilon ? [[end, start]] : [];
  });
  const result = [...events];
  for (const [index, event] of events.entries()) {
    if (!movable(event)) continue;
    const gridPhase = level === 75 ? 2 : 0;
    const target = Math.round((event.start - gridPhase) / 4) * 4 + gridPhase;
    if (Math.abs(target - event.start) > 1 + epsilon || target < 0
      || rests.some(([from, to]) => target < to - epsilon && target + event.duration > from + epsilon)) continue;
    // Keep the movement inside the original phrase, between its neighbouring notes.
    if (target < result[index - 1].start + result[index - 1].duration - epsilon
      || target + event.duration > events[index + 1].start + epsilon) continue;
    result[index] = { ...event, start: target };
  }
  return result;
}

function addVoice(events, level, harmonyAt, octaveOffset) {
  const direction = level < 50 ? -1 : 1;
  const extraVoices = [];
  return events.flatMap(event => {
    const midi = event.midi - octaveOffset;
    let added;
    if (level === 0 || level === 100) {
      added = midi + 12 * direction;
    } else if (event.duration >= 2 - epsilon || Math.abs(event.start - Math.round(event.start / 8) * 8) <= 0.35) {
      const tones = harmonyAt(event.start);
      for (let interval = 3; interval < 12; interval++) {
        const candidate = midi + interval * direction;
        if (MELODY_NOTE_IDS.includes(noteName(candidate)) && tones.includes(candidate % 12)) {
          added = candidate;
          break;
        }
      }
    }
    if (added === undefined || !MELODY_NOTE_IDS.includes(noteName(added))) return [event];
    const overlapsVoice = other => other.midi === added + octaveOffset
      && other.start < event.start + event.duration - epsilon && other.start + other.duration > event.start + epsilon;
    if (events.some(overlapsVoice) || extraVoices.some(overlapsVoice)) return [event];
    const voice = { ...event, midi: added + octaveOffset, velocity: event.velocity * 0.65 };
    extraVoices.push(voice);
    return [event, voice];
  });
}

export function jamMelodyVariation(bars, timbreId, { groove, strength }, chordBars) {
  if (groove === 50 && strength === 50) return bars;
  const events = melodyEvents(bars, timbreId);
  if (!events.length) return bars;
  const needsHarmony = strength !== 50 || [25, 75].includes(groove);
  const voicedHarmony = needsHarmony && chordBars?.length ? authoredHarmony(chordBars) : null;
  const windows = needsHarmony ? planHumHarmonyFromEvents(events, bars.length).windows : null;
  const rhythm = strength !== 50 ? planHumPhraseRhythm(events, windows) : null;
  const harmonyAt = start => voicedHarmony ? voicedHarmony(start) : windows[Math.floor(start / 8)].tones;
  const offset = timbreId === DEEP_AUTUMN_MELODY ? -12 : 0;
  const varied = varyOnsets(events, strength, rhythm, voicedHarmony);
  const played = groove === 50 ? varied : addVoice(varied, groove, harmonyAt, offset);
  const steps = Array(bars.length * 16).fill(null);
  for (const event of played) {
    const step = Math.floor(event.start);
    const note = noteName(event.midi - offset);
    const performances = steps[step] ??= {};
    (performances[note] ??= []).push({
      offsetSteps: event.start - step, durationSteps: event.duration, velocity: event.velocity,
    });
  }
  return bars.map((_, index) => steps.slice(index * 16, index * 16 + 16)
    .map(notes => notes && createMelodyCellFromNotes(Object.keys(notes), { notePerformances: notes })));
}
