import { DEEP_AUTUMN_MELODY } from '../data/performanceTimbres.js';
import { extractChordEvent, extractMelodyEvents } from '../audio/matrixPlaybackAdapter.js';
import { expandNotePerformances, noteDurationSteps } from '../domain/notePerformances.js';

const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const stepsPerBar = 16;

const modes = [
  { scale: [0, 2, 4, 5, 7, 9, 11], stability: [1, 0.26, 0.72, 0.46, 0.87, 0.45, 0.18], degrees: [0, 3, 4, 5, 1] },
  { scale: [0, 2, 3, 5, 7, 8, 10], stability: [1, 0.25, 0.72, 0.48, 0.87, 0.41, 0.24], degrees: [0, 3, 4, 5, 2, 6] },
];
const keys = modes.flatMap(({ scale, stability, degrees }, mode) => pitches.map((_, tonic) => {
  const tones = scale.map(interval => (interval + tonic) % 12);
  const chords = degrees.map(degree => ({
    degree, root: tones[degree], tones: [tones[degree], tones[(degree + 2) % 7], tones[(degree + 4) % 7]],
  }));
  if (mode === 1) {
    chords.push({ degree: 4, root: tones[4], tones: [tones[4], (tonic + 11) % 12, tones[1]], raisedDominant: true });
  }
  return { tonic, mode, tones, stability, chords };
}));

const isBeat = event => Math.abs(event.start - Math.round(event.start / 4) * 4) <= 0.35;
const stepDistance = (a, b) => Math.abs(a.midi - b.midi);

function keyEvidence(key, events) {
  const first = events[0], last = events.at(-1);
  const stable = pitch => key.stability[key.tones.indexOf(pitch)] ?? -1.15;
  const leadingTone = (key.tonic + 11) % 12;
  const profile = events.reduce((sum, event, i) => {
    const next = events[i + 1];
    const minorResolution = key.mode === 1 && event.pitch === leadingTone && next?.pitch === key.tonic && stepDistance(event, next) === 1;
    const degree = minorResolution ? 0.30 : stable(event.pitch);
    return sum + degree * Math.min(event.duration, 8) * (event.passing ? 0.65 : isBeat(event) ? 1.2 : 0.85);
  }, 0);
  const evidence = new Set(events.map(event => event.pitch));
  const tonicTriad = key.chords[0].tones.every(pitch => evidence.has(pitch));
  return profile + (tonicTriad ? 5 : 0) + 1.6 * stable(first.pitch) + 2.4 * stable(last.pitch)
    + (first.pitch === key.tonic ? 0.8 : 0) + (last.pitch === key.tonic ? 1.4 : 0)
    + (events.some(event => event.pitch === key.tones[2]) ? 0.65 : key.mode === 1 ? -0.35 : 0);
}

function melodyEvents(bars, timbreId) {
  // The original Deep Autumn melody roots intentionally bind an octave above
  // their sounding pitches. Note names in Jam stay as authored.
  const octaveOffset = timbreId === DEEP_AUTUMN_MELODY ? -12 : 0;
  const length = bars.length * stepsPerBar;
  const events = bars.flatMap((bar, index) => bar.flatMap((cell, step) => (
    expandNotePerformances(extractMelodyEvents(cell, index, step), cell).flatMap(event => {
      const pitch = pitches.indexOf(event.note.slice(0, -1));
      const midi = (Number(event.note.at(-1)) + 1) * 12 + pitch + octaveOffset;
      const start = Math.max(0, index * stepsPerBar + step + (event.timingOffset ?? 0));
      const duration = Math.min(noteDurationSteps(event), length - start);
      return pitch < 0 || duration <= 0 ? [] : [{ pitch, midi, start, duration, velocity: event.velocity ?? 0.6 }];
    })
  ))).sort((a, b) => a.start - b.start);
  return events.map((event, i) => {
    const previous = events[i - 1], next = events[i + 1];
    const before = previous && event.start - previous.start - previous.duration;
    const after = next && next.start - event.start - event.duration;
    const passing = previous && next && previous.start < event.start && next.start > event.start && event.duration <= 4
      && before >= -0.35 && before <= 1 && after >= -0.35 && after <= 1
      && [previous, next].every(other => stepDistance(event, other) > 0 && stepDistance(event, other) <= 2);
    return { ...event, passing: Boolean(passing) };
  });
}

function melodyWindows(events, halfBars) {
  const windows = Array.from({ length: halfBars }, () => []);
  for (const event of events) {
    const end = event.start + event.duration;
    for (let index = Math.floor(event.start / 8); index < halfBars && index * 8 < end; index++) {
      const start = index * 8;
      const length = Math.min(end, start + 8) - Math.max(start, event.start);
      const strong = isBeat(event) || length >= 2;
      const onDownbeat = Math.abs(event.start - start) <= 0.35;
      const accent = onDownbeat ? (index % 2 ? 1.35 : 1.65) : isBeat(event) ? 1.15 : 1;
      const weight = length * accent * (event.passing ? 0.25 : strong ? 1 : 0.4);
      windows[index].push({ ...event, weight, from: Math.max(start, event.start), to: Math.min(end, start + 8) });
    }
  }
  return windows;
}

function scoreMelodyNote(chord, event) {
  if (chord.tones.includes(event.pitch)) return event.weight * 0.75;
  const rub = chord.tones.some(tone => [1, 11].includes((event.pitch - tone + 12) % 12));
  return -event.weight * (rub ? 0.68 : 0.22);
}

const chordCosts = [0, 0.55, 0.9, 0.12, 0.2, 0.48, 0.72];

// Maximize unary fit and transition quality over a loop. Conditioning on the
// first state lets the last -> first transition use the same search.
function bestLoopPath(rows, transition, seam) {
  let best = { score: -Infinity, path: [] };
  for (let first = 0; first < rows[0].length; first++) {
    let scores = rows[0].map(({ score }, index) => index === first ? score : -Infinity);
    const parents = [];
    for (let step = 1; step < rows.length; step++) {
      const previous = scores;
      parents[step] = [];
      scores = rows[step].map(({ value, score }, to) => {
        let fit = -Infinity;
        for (const [from, prior] of rows[step - 1].entries()) {
          if (!Number.isFinite(previous[from])) continue;
          const candidate = previous[from] + score + transition(prior.value, value, step);
          if (candidate > fit) { fit = candidate; parents[step][to] = from; }
        }
        return fit;
      });
    }
    for (const [last, score] of scores.entries()) {
      const total = score + seam(rows.at(-1)[last].value, rows[0][first].value);
      if (total <= best.score) continue;
      const path = Array(rows.length);
      let state = last;
      for (let step = rows.length - 1; step >= 0; step--) {
        path[step] = rows[step][state].value;
        state = parents[step]?.[state];
      }
      best = { score: total, path };
    }
  }
  return best;
}

const sameHarmony = (a, b) => a?.root === b.root && a.tones.every((tone, index) => tone === b.tones[index]);

function chordMovement(from, to, cost) {
  if (sameHarmony(from, to)) return 0;
  const preparesDominant = [1, 3].includes(from.degree) && to.degree === 4;
  const resolvesTonic = from.degree === 4 && to.degree === 0;
  const connection = resolvesTonic ? 0.8 : preparesDominant ? 0.4 : 0;
  return connection - cost - (from.raisedDominant && to.degree !== 0 ? 0.75 : 0);
}

function fitHarmony(events, windows, bassHints) {
  const ranked = keys.map(key => ({ key, score: keyEvidence(key, events) })).sort((a, b) => b.score - a.score);
  const first = events[0], last = events.at(-1);
  const firstWindow = Math.floor(first.start / 8), lastWindow = Math.floor(last.start / 8);
  const uncertainty = Math.max(2.5, ranked[0].score * 0.10);
  const hasBass = bassHints.some(hint => hint != null);
  const heard = new Set(events.map(note => note.pitch));
  let best = { score: -Infinity, path: [] };
  for (const { key, score: keyScore } of ranked) {
    // Local note matches may break a tie between plausible keys only. A user
    // authored bass can reopen the key shortlist when it supplies new evidence.
    if (!hasBass && keyScore < ranked[0].score - uncertainty) break;
    const { chords, tonic } = key;
    const rows = windows.map((window, i) => {
      const bass = bassHints[i];
      const compatible = bass == null ? chords : chords.filter(chord => chord.tones.includes(bass));
      // A chromatic bass is a user constraint. Allow a local triad on it when
      // the inferred key has none, rather than writing a conflicting chord.
      const choices = compatible.length ? compatible : [4, 3].map(third => ({
        degree: -1, root: bass, tones: [bass, (bass + third) % 12, (bass + 7) % 12],
      }));
      return choices.map(chord => {
        const { degree, raisedDominant } = chord;
        const supportedDominant = window.some(note => note.pitch === chord.tones[1]);
        const fit = window.reduce((sum, event) => sum + scoreMelodyNote(chord, event), 0);
        const bassFit = bass === chord.root ? 3 : 0;
        const cost = window.length ? (chordCosts[degree] ?? 2.8) + chord.tones.filter(pitch => !heard.has(pitch)).length * 0.45
          + (raisedDominant && !supportedDominant ? 2 : 0) : 0;
        const opening = i !== firstWindow ? 0
          : chord.tones.includes(first.pitch) ? (degree === 0 ? 2.2 : 0) : -Math.min(first.duration, 4) * 0.40;
        const finish = i === lastWindow && degree === 0 && chord.tones.includes(last.pitch)
          ? (last.pitch === tonic ? 4.2 : 3.1) : 0;
        return { value: chord, score: fit + bassFit + opening + finish - cost };
      });
    });
    const { score, path } = bestLoopPath(rows, (from, to, step) => {
      if (!windows[step].length && bassHints[step] == null) return 0;
      return chordMovement(from, to, step % 2 ? 2.4 : 1.6);
    }, (from, to) => chordMovement(from, to, 1.2) * 0.35);
    const total = score + keyScore * 0.8;
    if (total > best.score) best = { score: total, path, key };
  }
  return best;
}

const semitoneApart = (a, b) => [1, 11].includes((a - b + 12) % 12);

function colorHarmony(path, windows, key, bassHints) {
  return path.map((chord, index) => {
    const { root, degree, tones } = chord;
    if (degree < 0 || bassHints[index] != null) return chord;
    const window = windows[index];
    const minor = (tones[1] - root + 12) % 12 === 3;
    const resolves = degree === 4 && path[index + 1]?.degree === 0 && windows[index + 1].length;
    const extensions = [resolves || minor ? 10 : 11, 2];
    for (const interval of extensions) {
      const color = (root + interval) % 12;
      if (!key.tones.includes(color) || tones.includes(color)) continue;
      // Keep the root and third, and let a strong melody note justify the color.
      if (!window.some(note => !note.passing && note.weight >= 3.5 && note.pitch === color)) continue;
      if (window.some(note => !note.passing && note.weight >= 1.5 && semitoneApart(note.pitch, color))) continue;
      if (window.some(note => !note.passing && note.weight >= 3.5 && note.pitch === tones[2])) continue;
      return { ...chord, tones: [root, tones[1], color] };
    }
    return chord;
  });
}

function chordTiming(window, index) {
  const base = index * 8;
  if (!window.length) return { offset: 0, duration: 6.8 };
  const first = window[0].from;
  let end = window[0].to;
  let accent = null, best = 0;
  for (const note of window.slice(1)) {
    if (note.from - end >= 2.5) break;
    end = Math.max(end, note.to);
    if (note.start - first < 2 || note.from !== note.start || note.to - note.start < 0.4
      || (note.duration < 1.25 && note.velocity < 0.72)) continue;
    const score = Math.min(note.duration, 4) + note.velocity + (isBeat(note) ? 0.3 : 0);
    if (score > best) { accent = note.start - base; best = score; }
  }
  return { offset: first - base, duration: Math.min(6.8, end - first), accent };
}

function voicingOptions(chord) {
  const rootPosition = chord.tones.map(pitch => 48 + chord.root + (pitch - chord.root + 12) % 12).sort((a, b) => a - b);
  const inversions = rootPosition.map((_, i) => [...rootPosition.slice(i), ...rootPosition.slice(0, i).map(pitch => pitch + 12)]);
  return inversions.flatMap(([low, mid, high]) => [[low, mid, high], [low, high, mid + 12]])
    .flatMap(notes => [-12, 0, 12].map(offset => notes.map(note => note + offset)))
    .filter(notes => notes[0] >= 43 && notes.at(-1) <= 72);
}

function scoreVoicing(notes, chord, window, isPhraseEdge) {
  const crowding = window.reduce((sum, melody) => sum + melody.weight * notes.reduce((total, note) => {
    const interval = Math.abs(note - melody.midi);
    return total + (interval === 1 ? 4 : interval === 2 ? 1.4 : interval === 0 ? 0.22 : 0);
  }, 0), 0);
  const aboveLead = window.reduce((sum, melody) => sum + melody.weight * Math.max(0, notes.at(-1) - melody.midi - 3), 0);
  const lowThird = notes[0] < 48 && notes[1] - notes[0] < 5 ? 2.8 : 0;
  const inversion = notes[0] % 12 === chord.root ? 0 : isPhraseEdge ? 9 : 3;
  const register = Math.abs(notes[1] - 52) * 0.35;
  return -(crowding + aboveLead * 0.13 + lowThird + inversion + register);
}

function fitVoicings(harmony, windows) {
  // Keep the same inversion through a run of the same harmony. Consider all
  // the melody notes over that run, plus the voice motion on either side.
  const runs = [];
  for (const [i, chord] of harmony.entries()) {
    if (sameHarmony(runs.at(-1)?.chord, chord)) {
      runs.at(-1).count++;
      runs.at(-1).window.push(...windows[i]);
    } else runs.push({ chord, window: [...windows[i]], count: 1 });
  }
  const rows = runs.map(({ chord, window }, i) => voicingOptions(chord).map(notes => ({
    value: notes, score: scoreVoicing(notes, chord, window, i === 0 || i === runs.length - 1),
  })));
  const voiceMotion = (from, to) => to.reduce((score, note, i) => {
    const move = Math.abs(note - from[i]);
    return score - move * 0.45 - Math.max(0, move - 5) * 0.5;
  }, 0);
  const { path } = bestLoopPath(rows, voiceMotion, (from, to) => voiceMotion(from, to) * 0.6);
  return runs.flatMap(({ count }, index) => Array(count).fill(path[index]));
}

function pitchIndex(note) {
  const match = typeof note === 'string' && note.match(/^([A-G])([#b]?)(?:-?\d+)?$/);
  if (!match) return -1;
  return (pitches.indexOf(match[1]) + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0) + 12) % 12;
}

const cellAt = (bars, step) => bars?.length ? bars[Math.floor(step / 16) % bars.length]?.[step % 16] : null;

function bassWindowHints(bars, count) {
  return Array.from({ length: count }, (_, index) => {
    let strongest = null, strength = -Infinity;
    for (let offset = -Math.min(index * 8, 16); offset < 8; offset++) {
      const cell = cellAt(bars, index * 8 + offset), pitch = pitchIndex(cell?.note);
      if (pitch < 0) continue;
      const duration = Math.min(offset + noteDurationSteps(cell), 8) - Math.max(0, offset);
      if (duration <= 0) continue;
      const weight = duration + (offset >= 0 && offset % 4 === 0 ? 2 : 0) - Math.abs(offset) * 0.25;
      if (weight > strength) { strongest = pitch; strength = weight; }
    }
    return strongest;
  });
}

function chordRoot(notes, explicitRoot) {
  if (explicitRoot >= 0) return explicitRoot;
  const lowest = notes[0]?.pitch;
  const heard = new Set(notes.map(({ pitch }) => pitch));
  // An inversion can still be identified from all three pitch classes.
  const roots = [...heard].filter(root => [3, 4].some(third => heard.has((root + third) % 12)) && heard.has((root + 7) % 12));
  return roots.includes(lowest) ? lowest : roots[0] ?? lowest;
}

export function authoredChordAnchors(bars, length) {
  if (!bars?.length) return null;
  const anchors = new Map();
  let carry;
  for (let window = 0; window < length; window += 8) {
    const hits = [];
    for (let offset = 0; offset < 8; offset++) {
      const step = window + offset, cell = cellAt(bars, step);
      const event = extractChordEvent(cell, Math.floor(step / 16), step % 16);
      if (!event?.notes?.length) continue;
      const notes = event.notes.map(note => ({ pitch: pitchIndex(note), midi: (Number(note.at(-1)) + 1) * 12 + pitchIndex(note) }))
        .filter(({ pitch }) => pitch >= 0).sort((a, b) => a.midi - b.midi);
      const performanceEnd = Object.values(cell.notePerformances ?? {}).flat().map(hit => hit.offsetSteps + hit.durationSteps);
      const end = step + Math.max(noteDurationSteps(event), ...Object.values(cell.noteDurationSteps ?? {}), ...performanceEnd);
      if (notes.length) hits.push({ step, end, notes, root: pitchIndex(event.root) });
    }
    const blocks = hits.filter(hit => hit.notes.length > 1 || hit.root >= 0);
    if (carry?.end > window && hits[0]?.step !== window) anchors.set(window, carry.root);
    if (blocks.length) {
      let previousRoot;
      for (const hit of blocks) {
        const root = chordRoot(hit.notes, hit.root);
        if (root !== previousRoot) anchors.set(hit.step, root);
        previousRoot = root;
        carry = { root, end: Math.max(carry?.root === root ? carry.end : 0, hit.end) };
      }
    } else if (hits.length) {
      const notes = hits.flatMap(hit => hit.notes).sort((a, b) => a.midi - b.midi);
      const root = chordRoot(notes, -1);
      anchors.set(hits[0].step, root);
      carry = { root, end: Math.max(...hits.map(hit => hit.end)) };
    }
  }
  return anchors;
}

function matchCycle(events, sourceBars, chordBarCount) {
  if (chordBarCount === sourceBars) return events;
  const sourceSteps = sourceBars * stepsPerBar, targetSteps = chordBarCount * stepsPerBar;
  if (targetSteps < sourceSteps) {
    // Unusually long, coprime loops cannot share a stored phrase. Fold the
    // melody evidence onto the fixed bass cycle without changing its pitches.
    return events.map(event => {
      const start = event.start % targetSteps;
      return { ...event, start, duration: Math.min(event.duration, targetSteps - start) };
    }).sort((a, b) => a.start - b.start);
  }
  return Array.from({ length: Math.ceil(targetSteps / sourceSteps) }, (_, repeat) => events.flatMap(event => {
    const start = event.start + repeat * sourceSteps;
    return start < targetSteps ? [{ ...event, start, duration: Math.min(event.duration, targetSteps - start) }] : [];
  })).flat();
}

export function planHumHarmony(bars, timbreId, { bassBars, chordBarCount = bars.length } = {}) {
  const events = melodyEvents(bars, timbreId);
  if (!events.length) throw new Error('旋律没有可配轨的音符');
  const lead = matchCycle(events, bars.length, chordBarCount);
  const count = chordBarCount * 2;
  const windows = melodyWindows(lead, count);
  const bassHints = bassWindowHints(bassBars, count);
  const { path, key } = fitHarmony(lead, windows, bassHints);
  const colored = colorHarmony(path, windows, key, bassHints);
  const voicings = fitVoicings(colored, windows);
  return {
    key: { tonic: key.tonic, mode: key.mode === 0 ? 'major' : 'minor' },
    events,
    windows: colored.map((chord, index) => ({
      ...chord, voicing: voicings[index], ...chordTiming(windows[index], index),
      // In a long rest leave room. Bass supplied by the player can also cue an entrance.
      active: Boolean(windows[index].length || bassHints[index] != null),
    })),
  };
}
