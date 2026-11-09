import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeHumBacking, arrangeHumMelody, cleanHumNotes, estimateHumBpm, fitHumTiming, makeHumMelody } from '../src/preview/humArrangement.js';
import { planHumHarmony } from '../src/preview/humHarmony.js';
import { humPitchCenter } from '../src/preview/humPitchCorrection.js';
import { createJamTemplateProjects, jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { applyJamTrackParameter, blankJamDraft } from '../src/app/jamDraftActions.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { jamMelodyRenderState, resizeJamPitchedNote, resizeJamPitchedStart, setJamPitchedNote } from '../src/app/jamNoteEditing.js';
import { editJamSequencerStep, humPlaybackBars } from '../src/app/jamHumExpression.js';
import { toggleDrumsCellInstrument } from '../src/domain/drumsCells.js';
import { eventDuration, usesNaturalSampleTail } from '../src/domain/notePerformances.js';

function makeStore() {
  const data = new Map();
  return createJamTemplateProjects({ getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }, 'pop', null, 88);
}

const event = (startTimeSeconds, pitchMidi, durationSeconds = 0.43, amplitude = 0.8) => ({ startTimeSeconds, pitchMidi, durationSeconds, amplitude });
const melody = (pitches, interval = 0.6) => makeHumMelody(cleanHumNotes(pitches.map((pitch, i) => event(i * interval, pitch, interval * 0.75)), 10), 100).bars;
const backingPhrases = bars => arrangeHumBacking(bars);

test('cleans harmonics and noise without joining same-pitch attacks or removing a rest', () => {
  const events = [event(0.1, 60, 0.10), event(0.10, 72, 0.10, 0.3), event(0.21, 60, 0.09), event(0.38, 58, 0.015), event(0.68, 64)];
  const notes = cleanHumNotes(events, 2);
  assert.deepEqual(notes.map(note => note.pitch), [60, 60, 64]);
  const bars = makeHumMelody(notes, 88).bars;
  const repeats = bars[0][0].notePerformances.C4;
  assert.equal(repeats.length, 2);
  assert.ok(repeats[1].offsetSteps > repeats[0].durationSteps);
  assert.equal(bars[0][1], null);
  assert.equal(estimateHumBpm(cleanHumNotes([0, 0.6, 1.2, 1.8].map(start => event(start, 64)), 3)), 100);
});

const performanceOnsets = bars => bars.flatMap((bar, index) => bar.flatMap((cell, step) =>
  Object.values(cell?.notePerformances ?? {}).flat().map(hit => ({ at: index * 16 + step + hit.offsetSteps, length: hit.durationSteps }))));

test('fits a reliable 120 BPM pickup into the existing 88 BPM clock and falls back for an irregular rhythm', () => {
  const notes = cleanHumNotes([event(0.15, 60, 0.08, 0.32), event(0.40, 62, 0.30), event(0.90, 64, 0.28), event(1.40, 67, 0.32)], 2);
  const fit = fitHumTiming(notes, 88);
  assert.deepEqual(fit, { bpm: 88, sourceBpm: 120, pickupSteps: 2, quantize: true, trimLastBeat: true });
  assert.equal(fitHumTiming(notes, 88, { emptyProject: true }).bpm, 120);
  const { bars } = makeHumMelody(notes, fit.bpm, fit);
  const hits = performanceOnsets(bars);
  assert.equal(bars.length, 1);
  assert.deepEqual(hits.map(hit => hit.at), [2, 4, 8, 12]);
  assert.ok(Math.abs(hits[1].length * 15 / 88 - 0.30 * 120 / 88) < 1e-8);
  assert.ok(Math.abs((hits[2].at - hits[1].at - hits[1].length) * 15 / 88 - 0.20 * 120 / 88) < 1e-8);
  assert.equal(fitHumTiming(notes, 118).sourceBpm, 120);

  const irregular = cleanHumNotes([0, 0.19, 0.47, 0.61, 1.06, 1.89, 2.02, 2.4, 3.16].map((start, i) => event(start, 60 + i, 0.07)), 4);
  const fallback = fitHumTiming(irregular, 88, { emptyProject: true });
  assert.deepEqual(fallback, { bpm: 88, sourceBpm: 88, pickupSteps: 0, quantize: false });
  assert.ok(Math.abs(performanceOnsets(makeHumMelody(irregular, 88, fallback).bars)[1].at * 15 / 88 - 0.19) < 1e-6);
  assert.equal(estimateHumBpm(notes.slice(0, 3)), null);
});

test('light quantization caps onset movement and trims only a small tail across the bar line', () => {
  const notes = cleanHumNotes([event(0, 60, 0.3), event(0.736, 64, 0.18), event(2.4, 67, 0.38)], 3);
  const { bars } = makeHumMelody(notes, 88, { sourceBpm: 88 });
  const [first, nudged] = performanceOnsets(bars);
  assert.equal(first.at, 0);
  assert.ok(Math.abs(nudged.at * 15 / 88 - 0.711) < 1e-6);
  assert.equal(bars.length, 1);
  assert.equal(performanceOnsets(bars).at(-1).at + performanceOnsets(bars).at(-1).length, 16);
  const continued = cleanHumNotes([...notes.map(note => event(note.start, note.pitch, note.end - note.start)), event(2.75, 65, 0.18)], 3);
  assert.equal(makeHumMelody(continued, 88).bars.length, 2);
});

function starTake(gaps, lastDuration, extraStart) {
  const pitches = [60, 60, 67, 67, 69, 69, 67];
  let start = 0.15;
  const events = pitches.map((pitch, index) => {
    const gap = gaps[index];
    const note = event(start, pitch, gap ? gap * 0.8 : lastDuration);
    start += gap ?? 0;
    return note;
  });
  if (extraStart !== undefined) events.push(event(extraStart, 65, 0.16));
  return cleanHumNotes(events, 10);
}

test('a one-bar melody lands on seven grid onsets and all four tracks repeat after sixteen steps', () => {
  const even = Array(6).fill(0.25);
  const loose = [0.39, 0.40, 0.43, 0.41, 0.39, 0.40];
  const slightlyLoose = [0.32, 0.33, 0.30, 0.33, 0.31, 0.33];
  const expectedOnsets = [0, 2, 4, 6, 8, 10, 12];
  for (const [gaps, lastDuration, sourceBpm] of [
    [even, 0.50, 120], [loose, 0.80, 75], [slightlyLoose, 0.24, 94], [slightlyLoose, 0.85, 94],
  ]) {
    const notes = starTake(gaps, lastDuration);
    const fit = fitHumTiming(notes, 88);
    const { bars } = makeHumMelody(notes, fit.bpm, fit);
    const hits = performanceOnsets(bars);
    assert.equal(fit.bpm, 88);
    assert.equal(fit.sourceBpm, sourceBpm);
    assert.equal(fitHumTiming(notes, 88, { emptyProject: true }).bpm, sourceBpm);
    assert.deepEqual(hits.map(hit => hit.at), expectedOnsets);
    assert.equal(bars.length, 1);
    const expectedLength = lastDuration === 0.24 ? 1.504 : 4;
    assert.ok(Math.abs(hits.at(-1).length - expectedLength) < 1e-6);

    const store = makeStore();
    const projectId = store.current().id;
    const [lead] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId, bpm: fit.bpm });
    const backing = store.insertHumPhrases(backingPhrases(lead.bars), { projectId, melodyId: lead.id });
    const tracks = [lead, ...backing];
    assert.equal(tracks.length, 4);
    assert.ok(tracks.every(phrase => phrase.bars.length === 1));
    const selection = Object.fromEntries(tracks.map(phrase => [phrase.trackId, phrase.id]));
    const snapshot = jamCombinationSnapshot({ ...store.current().workspace, selection });
    const adapter = createMatrixPlaybackAdapter(snapshot, { totalBars: snapshot.totalBars });
    assert.equal(adapter.totalSteps, 16);
    const opening = adapter.getEventsForFlatStep(0);
    assert.deepEqual(new Set(opening.map(hit => hit.type)), new Set(['melody', 'chord', 'bass', 'drums']));
    assert.ok(opening.every(hit => !hit.timingOffset));
    for (let step = 0; step < 16; step++) {
      assert.deepEqual(adapter.getEventsForFlatStep(step + 16), adapter.getEventsForFlatStep(step));
    }
    assert.ok(adapter.getEventsForFlatStep(12).find(hit => hit.type === 'melody')?.humMelodyTail);
  }

  const ambiguous = starTake(loose, 0.80);
  assert.equal(estimateHumBpm(ambiguous), null);
  assert.equal(fitHumTiming(ambiguous, 145).sourceBpm, 150);
});

test('a two-bar rhythm, a real next-bar attack and a long sustained note keep the second bar', () => {
  const even = Array(6).fill(0.25);
  for (const [notes, expectedOnsets, lastDuration] of [
    [starTake([0.49, 0.51, 0.48, 0.50, 0.53, 0.49], 1), [0, 4, 8, 12, 16, 20, 24], 8],
    [starTake(even, 0.40, 2.16), [0, 2, 4, 6, 8, 10, 12, 16.04], 1.28],
    [starTake(even, 0.76), [0, 2, 4, 6, 8, 10, 12], 6.08],
  ]) {
    const fit = fitHumTiming(notes, 88);
    const { bars } = makeHumMelody(notes, fit.bpm, fit);
    const hits = performanceOnsets(bars);
    assert.equal(bars.length, 2);
    assert.deepEqual(hits.map(hit => hit.at), expectedOnsets);
    assert.ok(Math.abs(hits.at(-1).length - lastDuration) < 1e-6);
    assert.ok(backingPhrases(bars).every(phrase => phrase.bars.length === 2));
  }
});

test('a breath cannot drag the tempo down, and a supported reentry keeps its local timing', () => {
  const take = later => cleanHumNotes([0, 0.5, 1, 1.5, ...later].map((start, index) => event(start, 60 + index, 0.18)), 10);
  const notes = take([4.13, 4.63, 5.13, 5.63]);
  const fit = fitHumTiming(notes, 88);
  assert.equal(estimateHumBpm(notes), 120);
  assert.equal(fit.bpm, 88);
  assert.equal(fitHumTiming(notes, 88, { emptyProject: true }).bpm, 120);
  const onsets = (notes, timing = fitHumTiming(notes, 88)) => performanceOnsets(makeHumMelody(notes, timing.bpm, timing).bars);
  const hits = onsets(notes, fit);
  assert.deepEqual(hits.map(hit => hit.at), [0, 4, 8, 12, 32, 36, 40, 44]);
  assert.ok(Math.abs(hits[4].length * 15 / 88 - 0.18 * 120 / 88) < 1e-6);

  const offbeat = take([4.26, 4.76, 5.385, 5.76]);
  assert.deepEqual(onsets(offbeat).slice(4).map(hit => hit.at), [34, 38, 43, 46]);
  assert.equal(onsets(take([4.13])).at(-1).at, 33.04);
  assert.deepEqual(onsets(take([2.49, 2.99, 3.49, 3.99])).slice(4).map(hit => hit.at), [20, 24, 28, 32]);
});

test('the last performed note sets the same loop boundary for all four tracks after a breath', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const notes = cleanHumNotes([0, 0.5, 1, 1.5, 4.13, 4.63, 5.13, 5.63].map((start, i) => event(start, 60 + i, 0.18)), 10);
  const fit = fitHumTiming(notes, 88);
  const { bars } = makeHumMelody(notes, fit.bpm, fit);
  assert.equal(bars.length, 3);
  const [lead] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId, bpm: fit.bpm });
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: lead.id });
  const tracks = [lead, ...backing];
  assert.ok(tracks.every(phrase => phrase.bars.length === 3 && phrase.bars[1].every(cell => cell === null)));
  const selection = Object.fromEntries(tracks.map(phrase => [phrase.trackId, phrase.id]));
  const snapshot = jamCombinationSnapshot({ ...store.current().workspace, selection });
  const adapter = createMatrixPlaybackAdapter(snapshot, { totalBars: snapshot.totalBars });
  assert.equal(adapter.totalSteps, 48);
  for (const reentry of [32, 80]) {
    const hits = adapter.getEventsForFlatStep(reentry);
    assert.deepEqual(new Set(hits.filter(hit => hit.type !== 'drums' || hit.instrument === 'kick').map(hit => hit.type)),
      new Set(['melody', 'chord', 'bass', 'drums']));
    assert.ok(hits.every(hit => !hit.timingOffset));
  }
  for (let step = 16; step < 32; step++) assert.deepEqual(adapter.getEventsForFlatStep(step), []);
  for (const [lastStart, lastEnd, barCount] of [[5.85, 6.04, 3], [6.01, 6.12, 4]]) {
    const withTail = [...notes.slice(0, -1), { ...notes.at(-1), start: lastStart, end: lastEnd }];
    const take = makeHumMelody(withTail, 120, { quantize: false });
    assert.equal(take.bars.length, barCount);
    assert.ok(backingPhrases(take.bars).every(phrase => phrase.bars.length === barCount));
    if (barCount === 3) {
      const tail = performanceOnsets(take.bars).at(-1);
      assert.equal(tail.at + tail.length, 48);
    } else assert.ok(take.bars[3][0]);
  }
});

test('removes a short continuous tail while keeping a fresh attack on the same pitch', () => {
  const events = [event(0.1, 60, 0.4), event(0.5, 60, 0.12), event(0.9, 60, 0.36), event(1.26, 60, 0.16)];
  const samples = new Float32Array(2 * 22050);
  const tone = (start, end) => samples.fill(0.4, Math.round(start * 22050), Math.round(end * 22050));
  tone(0.1, 0.56);
  tone(0.9, 1.235);
  tone(1.26, 1.42);
  assert.deepEqual(cleanHumNotes(events, 2, samples).map(note => note.start), [0.1, 0.9, 1.26]);
});

test('humming correction uses steady pitch evidence without changing deliberate chromatic notes', () => {
  const contour = Array(264).fill(0);
  const detected = { startFrame: 0, durationFrames: 10, pitchMidi: 63 };
  const base = (detected.pitchMidi - 21) * 3 + 1;
  contour[base] = 0.4;
  contour[base + 1] = 0.9;
  contour[base + 2] = 0.6;
  const center = humPitchCenter(Array(10).fill(contour), detected);
  assert.ok(center > 63.33 && center < 63.5);

  const anchors = [60, 62, 67, 64, 60].map((pitch, i) => ({
    ...event(i * 0.5 + (i >= 2 ? 0.5 : 0), pitch, 0.3), pitchCenter: pitch,
  }));
  const fragment = { ...event(1, 63, 0.18), pitchCenter: center };
  const continuation = { ...event(1.18, 64, 0.2), pitchCenter: 64 };
  const sustain = new Float32Array(3 * 22050);
  sustain.fill(0.2, 22050, Math.round(1.38 * 22050));
  const corrected = cleanHumNotes([...anchors, fragment, continuation], 3, sustain);
  assert.deepEqual(corrected.map(note => note.pitch), [60, 62, 64, 67, 64, 60]);
  assert.ok(corrected[2].end > 1.35);

  const deliberate = cleanHumNotes([...anchors, { ...fragment, pitchCenter: 63.03 }, continuation], 3, sustain);
  assert.deepEqual(deliberate.map(note => note.pitch), [60, 62, 63, 64, 67, 64, 60]);
  const separate = new Float32Array(sustain);
  separate.fill(0, Math.round(1.14 * 22050), Math.round(1.18 * 22050));
  const repeated = cleanHumNotes([...anchors, fragment, continuation], 3, separate);
  assert.deepEqual(repeated.map(note => note.pitch), [60, 62, 64, 64, 67, 64, 60]);
  assert.equal(cleanHumNotes([fragment], 3)[0].pitch, 63);
  const splitNearBoundary = [fragment, { ...continuation, pitchCenter: 63.4 }];
  assert.deepEqual(cleanHumNotes(splitNearBoundary, 3, sustain).map(note => note.pitch), [63]);
  assert.deepEqual(cleanHumNotes(splitNearBoundary, 3, separate).map(note => note.pitch), [63, 64]);
});

test('pitch changes harmony and bass, and dense starts thin the drums', () => {
  const first = arrangeHumMelody(melody([60, 64, 67, 60]));
  const shifted = arrangeHumMelody(melody([62, 66, 69, 62]));
  assert.notDeepEqual(first.chord[0][0].notes, shifted.chord[0][0].notes);
  assert.notEqual(first.bass[0][0].note, shifted.bass[0][0].note);
  const dense = arrangeHumMelody(melody([60, 64, 67, 60, 64, 67, 64, 60], 0.24));
  const countHats = result => result.drums[0].flatMap(cell => cell?.drumHits ?? []).filter(hit => hit.instrument === 'hihat').length;
  assert.ok(countHats(dense) < countHats(first));
});

function shortNoteAudio(pitches, duration, interval, { scoop = 0, scoopTime = 0.027, tail, legato = false } = {}) {
  const rate = 22050, samples = new Float32Array(rate * 2);
  let phase = 0;
  pitches.forEach((pitch, index) => {
    const start = 0.12 + index * interval;
    const end = start + (index === pitches.length - 1 ? tail ?? duration : duration);
    for (let i = Math.ceil(start * rate); i < Math.ceil(end * rate); i++) {
      const time = i / rate;
      const bend = (Array.isArray(scoop) ? scoop[index] : scoop) * Math.max(0, 1 - (time - start) / scoopTime);
      phase += 2 * Math.PI * 440 * 2 ** ((pitch - bend - 69) / 12) / rate;
      const level = legato ? 1 : Math.min(1, (time - start) / 0.01, (end - time) / 0.015);
      samples[i] = level * (0.23 * Math.sin(phase) + 0.12 * Math.sin(2 * phase) + 0.04 * Math.sin(3 * phase));
    }
  });
  return samples;
}

test('short syllables recover a missed reattack and correct the pitch after a scooped onset', () => {
  const target = [60, 60, 61, 62, 63, 67];
  const samples = shortNoteAudio(target, 0.065, 0.103, { scoop: 2, tail: 0.42 });
  const model = [event(0.12, 60, 0.18), event(0.32, 62, 0.08), event(0.43, 62, 0.08),
    event(0.53, 63, 0.08), event(0.635, 67, 0.42)];
  const notes = cleanHumNotes(model, 2, samples);
  assert.deepEqual(notes.map(note => note.pitch), target);
  assert.ok(notes.slice(0, -1).every(note => note.end - note.start < 0.085));
  assert.ok(notes[1].start - notes[0].end > 0.025);
  assert.deepEqual(notes.at(-1), { start: 0.635, end: 1.055, pitch: 67, amplitude: 0.8 });
});

test('pitch wobbles on repeated short syllables keep each attack without flattening an intentional half step', () => {
  const takes = [
    { pitches: [60, 60.62, 60, 60], expected: [60, 60, 60, 60] },
    { pitches: [60, 60, 60, 59.37], expected: [60, 60, 60, 60] },
    { pitches: [60.43, 60.57, 60.42, 60.4], expected: [60, 60, 60, 60] },
    { pitches: [60, 60.96, 60, 60], expected: [60, 61, 60, 60] },
  ];
  for (const { pitches, expected } of takes) {
    const notes = cleanHumNotes([], 2, shortNoteAudio(pitches, 0.075, 0.105));
    assert.deepEqual(notes.map(note => note.pitch), expected);
    assert.ok(notes.slice(1).every((note, i) => note.start - notes[i].end > 0.02));
  }
});

test('connected short notes are repaired when the audio supports distinct pitches, but a steady glide is left alone', () => {
  const target = [60, 62, 64, 65, 67, 64];
  const legato = shortNoteAudio(target, 0.082, 0.082, { legato: true });
  const model = [event(0.116, 60, 0.081), event(0.197, 62, 0.081), event(0.278, 64, 0.16),
    event(0.441, 67, 0.081), event(0.522, 64, 0.081)];
  assert.deepEqual(cleanHumNotes(model, 2, legato).map(note => note.pitch), target);

  const glide = shortNoteAudio([60], 0.45, 0.5, { scoop: 6, scoopTime: 0.32 });
  const glideModel = [event(0.186, 56, 0.093), event(0.29, 58, 0.093), event(0.406, 60, 0.165)];
  assert.deepEqual(cleanHumNotes(glideModel, 2, glide), cleanHumNotes(glideModel, 2));
});

test('short transition notes are removed from a continuous slide between held pitches', () => {
  const model = [event(0.116, 60, 0.093), event(0.209, 61, 0.081), event(0.29, 63, 0.082), event(0.383, 65, 0.186)];
  const glide = shortNoteAudio([60, 65], 0.08, 0.08, { tail: 0.35, scoop: [0, 5], scoopTime: 0.22, legato: true });
  const notes = cleanHumNotes(model, 2, glide);
  assert.deepEqual(notes.map(note => note.pitch), [60, 65]);
  assert.equal(notes[0].end, notes[1].start);

  const withRest = glide.slice();
  withRest.fill(0, Math.round(0.275 * 22050), Math.round(0.32 * 22050));
  const separated = cleanHumNotes(model, 2, withRest);
  assert.ok(separated[0].end < separated.at(-1).start);
});

test('a steady short chromatic note in a longer voiced passage uses its measured pitch', () => {
  const samples = shortNoteAudio([60, 64, 65], 0.082, 0.082, { tail: 0.32, legato: true });
  const model = [event(0.12, 60, 0.082), event(0.202, 63, 0.082), event(0.284, 65, 0.32)];
  assert.deepEqual(cleanHumNotes(model, 2, samples).map(note => note.pitch), [60, 64, 65]);
});

test('several humming pitches in one Jam step keep their original order and do not overlap', () => {
  const store = makeStore(), projectId = store.current().id;
  const { bars } = makeHumMelody([
    { start: 0, end: 0.05, pitch: 60, amplitude: 0.8 },
    { start: 0.05, end: 0.10, pitch: 62, amplitude: 0.8 },
    { start: 0.10, end: 0.15, pitch: 60, amplitude: 0.8 },
  ], 88);
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId });
  const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
  const hits = adapter.getEventsForStep(0, 0).filter(hit => hit.type === 'melody');
  assert.deepEqual(hits.map(hit => hit.note), ['C4', 'D4', 'C4']);
  assert.ok(hits.slice(1).every((hit, i) => hit.timingOffset + 1e-9 >= hits[i].timingOffset + hits[i].durationSteps));
});

test('first empty column keeps existing selections and accompaniment publishes atomically', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const existing = store.commitPhraseEdit(blankJamDraft('bass'), { create: true, slotIndex: 0 });
  const draft = store.current().workspace.draft;
  const bars = melody([60, 64, 67, 60]);
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId, bpm: 110 });
  assert.equal(phrase.slotIndex, 1);
  assert.equal(store.current().workspace.bpm, 88);
  assert.deepEqual(store.current().workspace.draft, draft);
  assert.equal(store.current().workspace.templates.bass[0].id, existing.id);
  assert.equal(store.current().workspace.templates.chord.length, 0);

  const occupied = store.commitPhraseEdit(blankJamDraft('drums'), { create: true, slotIndex: 1 });
  assert.equal(store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: phrase.id }), null);
  assert.equal(store.current().workspace.templates.chord.length, 0);
  store.removeTemplate('drums', occupied.id);
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: phrase.id });
  assert.ok(backing.every(item => item.slotIndex === 1));
  assert.deepEqual(Object.values(store.current().workspace.selection), [null, null, null, null]);
  assert.equal(store.insertHumPhrases(backingPhrases(bars), { projectId: 'stale', melodyId: phrase.id }), null);
});

test('a recording fills the open empty melody slot and never overwrites an existing phrase', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const bars = melody([60, 64, 67, 60]);
  const empty = store.commitPhraseEdit(blankJamDraft('melody'), { create: true, slotIndex: 2 });
  const record = emptyMelodyId => store.insertHumPhrases([{ trackId: 'melody', name: '哼唱 1', bars }], { projectId, emptyMelodyId })[0];
  const recording = record(empty.id);
  assert.equal(recording.id, empty.id);
  assert.equal(recording.name, '哼唱 1');
  assert.equal(recording.slotIndex, 2);
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: recording.id });
  assert.deepEqual(backing.map(item => item.slotIndex), [2, 2, 2]);
  assert.equal(record(empty.id).slotIndex, 0);
  assert.deepEqual(store.current().workspace.templates.melody.find(phrase => phrase.id === recording.id), recording);
});

test('Jam snapshots play all four tracks, and rotating generated expression preserves edited pitches and onset', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const bars = melody([60, 64, 67, 60]);
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId, bpm: 100 });
  assert.equal(store.current().workspace.bpm, 100);
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: phrase.id });
  const editedBars = [setJamPitchedNote(phrase.bars[0], 0, 'D4', 2, false, 'melody')];
  const edited = store.commitPhraseEdit({ ...phrase, bars: editedBars });
  store.patch({ selection: Object.fromEntries([edited, ...backing].map(item => [item.trackId, item.id])) });
  const playbackAtStart = override => createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, override)).getEventsForStep(0, 0);
  const before = playbackAtStart(edited);
  assert.deepEqual(new Set(before.map(item => item.type)), new Set(['drums', 'chord', 'bass', 'melody']));
  const bass = backing.find(item => item.trackId === 'bass');
  const bassBefore = before.find(item => item.type === 'bass');
  const shortBass = playbackAtStart(applyJamTrackParameter(bass, 'groove', 0)).find(item => item.type === 'bass');
  assert.equal(usesNaturalSampleTail(bassBefore), false);
  assert.ok(shortBass.durationSteps < bassBefore.durationSteps);
  const turned = applyJamTrackParameter(edited, 'groove', 0);
  assert.equal(turned.bars, edited.bars);
  const after = playbackAtStart(turned).find(item => item.note === 'D4');
  const original = before.find(item => item.note === 'D4');
  assert.ok(after.velocity < original.velocity);
  assert.equal(after.timingOffset, original.timingOffset);
  assert.deepEqual(playbackAtStart(applyJamTrackParameter(turned, 'groove', 50)), before);
});

test('a fragmented sustained quarter note schedules once, but four articulated syllables stay four', () => {
  const sampleRate = 22050;
  const starts = [0.10, 0.25, 0.40, 0.55];
  const notes = starts.map((start, index) => event(start, 60, index === 1 ? 0.08 : 0.15));
  const samples = new Float32Array(sampleRate);
  const fill = (start, end) => samples.fill(0.4, Math.round(start * sampleRate), Math.round(end * sampleRate));
  fill(0.10, 0.70);
  const sustained = cleanHumNotes(notes, 1, samples);
  assert.equal(sustained.length, 1);
  assert.ok(Math.abs(sustained[0].end - sustained[0].start - 0.6) < 0.011);
  const store = makeStore();
  const bars = makeHumMelody(sustained, 100).bars;
  for (const [selected, bank] of [['deep-autumn-melody', 'deep-autumn-melody'], ['airy-synth-lead', 'piano']]) {
    assert.ok(store.setTimbre('melody', selected));
    const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId: store.current().id });
    assert.equal(phrase.timbreId, selected);
    const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
    const hits = Array.from({ length: 16 }, (_, step) => adapter.getEventsForStep(0, step)).flat();
    assert.equal(hits.length, 1);
    assert.equal(hits[0].timbreId, bank);
    assert.equal(hits[0].playbackMode, 'gated');
    assert.equal(eventDuration(hits[0], 100), 0.6);
    for (const step of [1, 2, 3]) assert.equal(jamMelodyRenderState(phrase.bars, 0, step, 'C4').start, false);
  }
  const slightlyLong = makeHumMelody([{ ...sustained[0], end: sustained[0].start + 0.65 }], 100).bars;
  assert.equal(jamMelodyRenderState(slightlyLong, 0, 3, 'C4').active, true);
  assert.equal(jamMelodyRenderState(slightlyLong, 0, 4, 'C4').active, true);
  assert.equal(jamMelodyRenderState(slightlyLong, 0, 4, 'C4').start, false);
  samples.fill(0);
  for (const start of starts) fill(start, start + 0.095);
  assert.equal(cleanHumNotes(notes, 1, samples).length, 4);
});

test('a sustained melody continues visibly across a bar with no attack until the next loop', () => {
  const bars = makeHumMelody([{ start: 0, end: 0.15, pitch: 62, amplitude: 1 },
    { start: 2.1, end: 2.7, pitch: 60, amplitude: 1 }], 100).bars;
  const continuation = jamMelodyRenderState(bars, 1, 0, 'C4');
  assert.deepEqual(continuation, { active: true, start: false, startBar: 0, startStep: 14, durationSteps: 4 });
  const store = makeStore();
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId: store.current().id });
  const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
  assert.equal(adapter.getEventsForStep(0, 14)[0].durationSteps, 4);
  assert.deepEqual(adapter.getEventsForStep(1, 0), []);
  assert.equal(adapter.getEventsForStep(2, 0, 32)[0].note, 'D4');
});

test('a humming tail follows the next actual attack within a cell and across the loop seam', () => {
  const notes = [{ start: 0, end: 0.07, pitch: 60, amplitude: 1 },
    { start: 0.08, end: 0.15, pitch: 60, amplitude: 1 },
    { start: 1.9, end: 2, pitch: 62, amplitude: 1 }];
  const { bars } = makeHumMelody(notes, 120, { quantize: false });
  const store = makeStore();
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId: store.current().id });
  const snapshot = jamCombinationSnapshot(store.current().workspace, phrase, true);
  const adapter = createMatrixPlaybackAdapter(snapshot, { totalBars: snapshot.totalBars });
  const [first, repeat] = adapter.getEventsForFlatStep(0);
  const [last] = adapter.getEventsForFlatStep(15);
  assert.deepEqual([first.note, repeat.note, last.note], ['C4', 'C4', 'D4']);
  assert.ok([first, repeat, last].every(hit => hit.humMelodyTail));
  assert.equal(first.nextAttackSteps, 0.64);
  assert.ok(Math.abs(repeat.nextAttackSteps - 14.56) < 1e-6);
  assert.ok(Math.abs(last.nextAttackSteps - 0.8) < 1e-6);
  assert.ok(Math.abs(eventDuration(last, 120) - 0.1) < 1e-6);
  assert.equal(phrase.bars[0][0].humMelodyTail, undefined);
});

test('resizing a recorded melody tail keeps its original attacks and velocity', () => {
  const store = makeStore();
  const notes = [
    { offsetSteps: 0.1, durationSteps: 0.35, velocity: 0.6 },
    { offsetSteps: 0.55, durationSteps: 1.15, velocity: 0.8 },
  ];
  const bar = Array(16).fill(null);
  bar[0] = { type: 'melody', note: 'C4', notePerformances: { C4: notes } };
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars: [resizeJamPitchedNote(bar, 0, 'C4', 4, 'melody', 16)] }], { projectId: store.current().id });
  const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
  const [first, second] = adapter.getEventsForStep(0, 0);
  assert.equal(first.durationSteps, notes[0].durationSteps);
  assert.equal(second.timingOffset, notes[1].offsetSteps);
  assert.equal(second.velocity, notes[1].velocity);
  assert.equal(second.timingOffset + second.durationSteps, 4);
  assert.equal(jamMelodyRenderState(phrase.bars, 0, 3, 'C4').active, true);
  assert.equal(jamMelodyRenderState(phrase.bars, 0, 4, 'C4').active, false);
});

test('resizing the front of a recorded note preserves its release and later reattacks', () => {
  const bar = Array(16).fill(null);
  const first = { offsetSteps: 0.2, durationSteps: 0.3, velocity: 0.6 };
  const repeat = { offsetSteps: 0.6, durationSteps: 2, velocity: 0.8 };
  bar[4] = { type: 'melody', note: 'C4', notePerformances: { C4: [first, repeat] } };
  const extended = resizeJamPitchedStart(bar, 4, 'C4', -2, 'melody', 12);
  assert.deepEqual(extended[2].notePerformances.C4, [{ ...first, durationSteps: 2.3 }]);
  assert.deepEqual(extended[4].notePerformances.C4, [repeat]);
  const shortened = resizeJamPitchedStart(extended, 2, 'C4', 2, 'melody', 14);
  assert.equal(shortened[2], null);
  assert.equal(shortened[3].notePerformances.C4[0].offsetSteps, first.offsetSteps);
  assert.ok(Math.abs(3 + 0.2 + shortened[3].notePerformances.C4[0].durationSteps - 4.5) < 1e-9);
  assert.deepEqual(shortened[4].notePerformances.C4, [repeat]);
});

test('dragging a generated chord start across halves keeps both edited positions through knob changes', () => {
  const bar = Array(16).fill(null);
  bar[8] = { type: 'notes', notes: ['C3', 'E3'], durationSteps: 4 };
  const phrase = { trackId: 'chord', sourcePresetId: 'hum-generated', bars: [bar], params: { strength: 100, groove: 60 } };
  const edited = editJamSequencerStep(phrase, 0, 8, cells => resizeJamPitchedStart(cells, 8, 'C3', -2, 'chord', 8));
  assert.deepEqual(edited.humEditedSteps, [8, 6]);
  const played = humPlaybackBars(applyJamTrackParameter(edited, 'strength', 0))[0];
  assert.equal(played[8], null);
  assert.deepEqual(played[6].notes, ['C3']);
  assert.equal(6 + played[6].notePerformances.C3[0].durationSteps, 10.6);
  assert.deepEqual(played[10].notes, ['E3']);
});

test('accompaniment knobs change playback onsets, respect manual edits and restore the middle setting', () => {
  const store = makeStore();
  const bars = melody([60, 64, 67, 60]);
  const projectId = store.current().id;
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId });
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: phrase.id });
  const events = phrase => {
    const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
    return Array.from({ length: 16 }, (_, step) => adapter.getEventsForStep(0, step)).flat();
  };
  for (const track of backing) {
    const parameter = track.trackId === 'drums' ? 'groove' : 'strength';
    const low = applyJamTrackParameter(track, parameter, 0), high = applyJamTrackParameter(track, parameter, 100);
    const rhythm = phrase => events(phrase).map(({ step, instrument, note, notes }) => [step, instrument, note, notes]);
    assert.notDeepEqual(rhythm(low), rhythm(high));
    assert.deepEqual(events(applyJamTrackParameter(high, parameter, 50)), events(track));
    if (track.trackId === 'drums') {
      const foundation = phrase => events(phrase).filter(hit => hit.instrument !== 'hihat').map(hit => [hit.instrument, hit.step]);
      assert.deepEqual(foundation(low), foundation(high));
      const authored = editJamSequencerStep(high, 0, 1, bar => {
        const edited = [...bar];
        edited[1] = toggleDrumsCellInstrument(bar[1], 'hihat');
        return edited;
      });
      const dense = events(applyJamTrackParameter(authored, parameter, 100));
      assert.ok(!dense.some(hit => hit.step === 1 && hit.instrument === 'hihat'));
      assert.ok(dense.some(hit => hit.step === 3 && hit.instrument === 'hihat'));
    } else if (track.trackId === 'chord') {
      const notesInWindow = phrase => events(phrase).filter(hit => hit.step < 8).flatMap(hit => hit.notes).sort();
      assert.deepEqual(notesInWindow(low), notesInWindow(high));
    } else {
      const pitches = phrase => new Set(events(phrase).filter(hit => hit.step < 8).map(hit => hit.note));
      assert.deepEqual(pitches(low), pitches(high));
    }
  }
});


test('every generated drum groove has distinct hat steps with sparse or dense melodies', () => {
  const store = makeStore();
  for (const starts of [[0, 4, 8], [0, 1, 2, 3, 4, 5, 6, 7]]) {
    const lead = [Array.from({ length: 16 }, (_, step) =>
      starts.includes(step) ? { type: 'melody', note: 'D4', durationSteps: 1 } : null)];
    const { drums: bars } = arrangeHumMelody(lead);
    const phrase = { trackId: 'drums', sourcePresetId: 'hum-generated', bars };
    const hatSteps = [0, 25, 50, 75, 100].map(groove => {
      const variant = applyJamTrackParameter(phrase, 'groove', groove);
      const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, variant, true));
      return Array.from({ length: 16 }, (_, step) => step)
        .filter(step => adapter.getEventsForStep(0, step).some(hit => hit.instrument === 'hihat'));
    });
    assert.equal(new Set(hatSteps.map(steps => steps.join(','))).size, 5);
    assert.deepEqual(hatSteps[0], [0, 8]);
    assert.deepEqual(hatSteps[1], [2, 6, 10, 14]);
    assert.deepEqual(hatSteps[2], bars[0].flatMap((cell, step) => cell?.instruments.includes('hihat') ? [step] : []));
  }
});

test('generated chord voicing changes octave and density without changing rhythm or hand-edited voices', () => {
  const store = makeStore();
  const bars = [Array(16).fill(null)];
  const notes = ['D3', 'F3', 'A3'];
  for (const step of [0, 8]) bars[0][step] = { type: 'notes', notes, durationSteps: 3.5,
    notePerformances: Object.fromEntries(notes.map(note => [note, [{ offsetSteps: 0, durationSteps: 3.5, velocity: 0.48 }]])) };
  const chord = { trackId: 'chord', sourcePresetId: 'hum-generated', bars, params: { strength: 50, groove: 60 } };
  const voicing = (phrase, level) => applyJamTrackParameter(phrase, 'groove', level);
  const events = phrase => {
    const adapter = createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
    return Array.from({ length: 16 }, (_, step) => adapter.getEventsForStep(0, step)).flat();
  };
  const notesAt = (phrase, step) => events(phrase).filter(hit => hit.step === step).flatMap(hit => hit.notes).sort();
  const low = voicing(chord, 0), layered = voicing(chord, 100);
  assert.deepEqual(notesAt(low, 0), ['A2', 'D2', 'F2']);
  assert.deepEqual(notesAt(layered, 0), ['A3', 'A4', 'D2', 'D3', 'F3']);
  assert.deepEqual(events(voicing(layered, 60)), events(chord));

  const broken = applyJamTrackParameter(chord, 'strength', 100);
  const timing = phrase => [...new Set(events(phrase).map(hit => [hit.step, hit.timingOffset, hit.durationSteps].join(':')))];
  assert.deepEqual(timing(voicing(broken, 100)), timing(broken));
  const edited = editJamSequencerStep(layered, 0, 0, bar => setJamPitchedNote(bar, 0, 'D2', 1, true));
  assert.deepEqual(notesAt(voicing(edited, 0), 0), ['A3', 'A4', 'D3', 'F3']);
  assert.deepEqual(notesAt(voicing(edited, 0), 8), notesAt(low, 8));
});

test('removing a rhythm-only hit records the edit even when the stored bar is unchanged', () => {
  const bars = [Array(16).fill(null)];
  const phrase = { sourcePresetId: 'hum-generated', trackId: 'drums', params: { strength: 50, groove: 100 }, bars };
  assert.deepEqual(humPlaybackBars(phrase)[0][1].instruments, ['hihat']);
  const edited = editJamSequencerStep(phrase, 0, 1, bar => bar.map((cell, step) => step === 1 ? toggleDrumsCellInstrument(cell, 'hihat') : cell));
  assert.deepEqual(edited.bars, bars);
  assert.deepEqual(edited.humEditedSteps, [1]);
  assert.equal(humPlaybackBars(edited)[0][1], null);
  assert.deepEqual(humPlaybackBars(edited)[0][3].instruments, ['hihat']);
});

test('editing a visible bass or chord variant keeps that half bar and its edited duration', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const bars = melody([60, 64, 67, 60]);
  const [lead] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId });
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: lead.id });
  for (const track of backing.filter(phrase => phrase.trackId !== 'drums')) {
    const high = applyJamTrackParameter(track, 'strength', 100);
    const highBar = humPlaybackBars(high)[0];
    const step = highBar.findIndex((cell, index) => index < 8 && cell && !track.bars[0][index]);
    const visible = highBar[step];
    const note = visible.note ?? visible.notes[0];
    const edited = editJamSequencerStep(high, 0, step, bar => setJamPitchedNote(bar, step, note, 2, false, track.trackId));
    const low = applyJamTrackParameter(edited, 'strength', 0);
    const lowBar = humPlaybackBars(low)[0];
    assert.equal(lowBar[step].notePerformances[note][0].durationSteps, 2);
    assert.deepEqual(lowBar.slice(0, 8).map(Boolean), highBar.slice(0, 8).map(Boolean));
    assert.notDeepEqual(lowBar.slice(8), highBar.slice(8));
    assert.deepEqual(edited.bars[0].slice(8), track.bars[0].slice(8));
  }
});


test('fills accompaniment for a hand-written melody using its actual pitches without replacing authored tracks', () => {
  const store = makeStore();
  const projectId = store.current().id, slotIndex = 4;
  const written = (notes, slotIndex) => {
    const bars = [Array(16).fill(null)];
    notes.forEach((note, index) => { bars[0][index * 4] = { type: 'melody', note, duration: '4n' }; });
    return store.commitPhraseEdit({ ...blankJamDraft('melody'), bars }, { create: true, slotIndex });
  };
  const melody = written(['C4', 'E4', 'G4', 'C4'], slotIndex);
  const transposed = written(['D4', 'F#4', 'A4', 'D4'], slotIndex + 1);
  const drumBars = [Array(16).fill(null)];
  drumBars[0][3] = { instruments: ['snare'] };
  const drums = store.commitPhraseEdit({ ...blankJamDraft('drums'), bars: drumBars }, { create: true, slotIndex });
  const emptyBass = store.commitPhraseEdit(blankJamDraft('bass'), { create: true, slotIndex });
  store.setDraft({ ...melody, editingTemplateId: melody.id });
  const fill = phrase => store.insertHumPhrases(backingPhrases(phrase.bars), { projectId, melodyId: phrase.id, fillEmpty: true });
  const first = fill(melody), second = fill(transposed);
  assert.deepEqual(first.map(item => item.trackId), ['chord', 'bass']);
  assert.ok(first.every(item => item.slotIndex === slotIndex));
  assert.equal(first[1].id, emptyBass.id);
  assert.notDeepEqual(first[0].bars[0][0].notes, second[0].bars[0][0].notes);
  assert.notEqual(first[1].bars[0][0].note, second[1].bars[0][0].note);
  assert.deepEqual(store.current().workspace.templates.drums[0], drums);
  assert.deepEqual(store.current().workspace.draft.bars, melody.bars);
  assert.deepEqual(fill(melody), []);
});


test('harmony avoids crowding an accented melody note and uses the selected timbre register', () => {
  const scored = notes => {
    const bar = Array(16).fill(null);
    notes.forEach((note, index) => { bar[index * 4] = { type: 'melody', note, duration: '4n' }; });
    return [bar];
  };
  const { chord } = arrangeHumMelody(scored(['C4', 'B3', 'C4', 'G4']), 'airy-synth-lead');
  assert.ok(!chord[0][0].notes.includes('C4'), 'a held C4 in the accompaniment crowds the B3 lead');
  const bars = scored(['C4', 'E4', 'D4', 'B3']);
  const airy = arrangeHumMelody(bars, 'airy-synth-lead'), sample = arrangeHumMelody(bars, 'deep-autumn-melody');
  const pitchClasses = notes => notes.map(note => note.slice(0, -1)).sort();
  assert.deepEqual(pitchClasses(airy.chord[0][0].notes), pitchClasses(sample.chord[0][0].notes));
  assert.notDeepEqual(airy.chord[0][0].notes, sample.chord[0][0].notes);
  assert.equal(sample.bass[0][8].note, 'G2');
  assert.ok(arrangeHumMelody(scored(['F4', 'E4', 'C4', 'E4'])).chord[0][0].notes.some(note => note.startsWith('F')));
});

test('refreshing legacy accompaniment updates bass and drums in place and preserves a hand-edited chord', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const [lead] = store.insertHumPhrases([{ trackId: 'melody', bars: melody([60, 64, 67, 60]) }], { projectId });
  const legacy = backingPhrases(lead.bars).map(({ trackId, bars }) => ({ trackId, bars }));
  const original = store.insertHumPhrases(legacy, { projectId, melodyId: lead.id });
  const chord = original.find(phrase => phrase.trackId === 'chord');
  const bass = original.find(phrase => phrase.trackId === 'bass');
  const drums = original.find(phrase => phrase.trackId === 'drums');
  const drumParams = store.commitPhraseEdit(applyJamTrackParameter(drums, 'groove', 75)).params;
  const editedChord = store.commitPhraseEdit(editJamSequencerStep(chord, 0, 3, bar => setJamPitchedNote(bar, 3, 'D4', 1)));
  const updatedLead = store.commitPhraseEdit({ ...lead, bars: melody([62, 66, 69, 62], 0.65) });
  const updated = store.insertHumPhrases(backingPhrases(updatedLead.bars), {
    projectId, melodyId: lead.id, fillEmpty: true, refreshHarmony: true,
  });
  assert.deepEqual(updated.map(phrase => phrase.id), [bass.id, drums.id]);
  assert.equal(updated[0].bars[0][0].note, 'D2');
  assert.ok(updated[0].humSoundingRanges.length);
  assert.ok(updated[1].humDrumQuietSteps.length);
  assert.notDeepEqual(updated[1].bars, drums.bars);
  assert.deepEqual(updated[1].params, drumParams);
  assert.deepEqual(store.current().workspace.templates.chord[0], editedChord);
});

test('backing follows hand-written sixteenth notes in the same slot and clears only unedited parts', () => {
  const store = makeStore(), projectId = store.current().id, slotIndex = 4;
  let lead = store.commitPhraseEdit(blankJamDraft('melody'), { create: true, slotIndex });
  const blankChord = store.commitPhraseEdit(blankJamDraft('chord'), { create: true, slotIndex });
  const update = (notes, steps = [0, 1, 2]) => {
    let bar = Array(16).fill(null);
    notes.forEach((note, i) => { bar = setJamPitchedNote(bar, steps[i], note, 1, false, 'melody'); });
    lead = store.commitPhraseEdit({ ...lead, bars: [bar] });
    return store.insertHumPhrases(notes.length ? backingPhrases(lead.bars) : [], {
      projectId, melodyId: lead.id, fillEmpty: true, refreshHarmony: true, followMelody: true,
    });
  };
  assert.deepEqual(update([]), []);
  const [dm, dBass, drums] = update(['D4', 'F4', 'A4']);
  assert.equal(dm.id, blankChord.id);
  assert.deepEqual(dm.bars[0][0].notes, ['D3', 'F3', 'A3']);
  assert.equal(dBass.bars[0][0].note, 'D2');
  assert.ok([dm, dBass, drums].every(phrase => phrase.slotIndex === slotIndex));
  const [c, cBass] = update(['C4', 'E4', 'G4'], [0, 4, 8]);
  assert.equal(c.id, dm.id);
  assert.deepEqual(c.bars[0][0].notes, ['C3', 'E3', 'G3']);
  assert.equal(cBass.id, dBass.id);
  assert.equal(cBass.bars[0][0].note, 'C2');
  const editedChord = store.commitPhraseEdit(editJamSequencerStep(c, 0, 3, bar => setJamPitchedNote(bar, 3, 'G4', 1)));
  const cleared = update([]);
  assert.deepEqual(cleared.map(phrase => phrase.id).sort(), [dBass.id, drums.id].sort());
  assert.ok(cleared.every(phrase => phrase.bars.every(bar => bar.every(cell => cell === null))));
  assert.deepEqual(store.current().workspace.templates.chord[0], editedChord);
});


const quarterNotes = line => {
  const notes = line.split(' ');
  return Array.from({ length: Math.ceil(notes.length / 4) }, (_, bar) => Array.from({ length: 16 }, (_, step) => {
    const note = step % 4 === 0 ? notes[bar * 4 + step / 4] : null;
    return note && note !== '_' ? { type: 'melody', note, duration: '4n' } : null;
  }));
};
const rooted = arrangement => arrangement.bass.map(bar => [bar[0]?.note, bar[8]?.note]);

test('the whole phrase guides the key and the cadence rather than reinterpreting each pair of notes', () => {
  const lead = quarterNotes('E4 D4 C4 D4 E4 E4 E4 _ D4 D4 D4 _ E4 G4 G4 _');
  const { key } = planHumHarmony(lead, 'deep-autumn-melody');
  assert.deepEqual(key, { tonic: 0, mode: 'major' });
  const backing = arrangeHumMelody(lead, 'deep-autumn-melody');
  assert.deepEqual(rooted(backing), [['C2', 'C2'], ['C2', 'C2'], ['G2', 'G2'], ['C2', 'C2']]);
  assert.deepEqual(backing.chord[0][0].notes, ['C3', 'E3', 'G3']);
  assert.deepEqual(backing.chord[0][8].notes, backing.chord[0][0].notes);
  assert.ok(backing.chord[0][8].notePerformances.C3[0].velocity < backing.chord[0][0].notePerformances.C3[0].velocity);
  const scale = quarterNotes('C4 D4 E4 F4 G4 A4 B4 C5');
  assert.equal(rooted(arrangeHumMelody(scale)).at(-1)[1], 'C2');
});

test('minor mode supports a raised leading tone and lets a long rest stay clear', () => {
  const lead = quarterNotes('A4 C5 E5 A4 F4 A4 C5 F4 D4 F4 A4 D4 E4 G#4 B4 A4 _ _ _ _');
  const { key } = planHumHarmony(lead);
  assert.deepEqual(key, { tonic: 9, mode: 'minor' });
  const backing = arrangeHumMelody(lead);
  assert.deepEqual(rooted(backing).slice(0, 4), [['A2', 'A2'], ['F2', 'F2'], ['D2', 'D2'], ['E2', 'A2']]);
  assert.ok(backing.chord[3][0].notes.some(note => note.startsWith('G#')));
  assert.ok(backing.chord[4].every(cell => cell === null) && backing.bass[4].every(cell => cell === null));
});

test('a written chord controls the generated bass at the actual change, even with the rhythm knob turned', () => {
  const written = Array(16).fill(null);
  written[0] = { type: 'notes', notes: ['A3', 'C4', 'F4'], durationSteps: 6 };
  written[6] = { type: 'notes', notes: ['A3', 'D4', 'F#4'], durationSteps: 10 };
  const chordsBefore = structuredClone(written);
  const backing = arrangeHumBacking(quarterNotes('C4 E4 G4 C4'), 'airy-synth-lead', { chordBars: [written] });
  const bass = backing.find(phrase => phrase.trackId === 'bass');
  assert.deepEqual(bass.bars[0].flatMap((cell, step) => cell ? [[step, cell.note]] : []), [[0, 'F2'], [4, 'F2'], [6, 'D2'], [8, 'D2']]);
  const playing = humPlaybackBars({ ...bass, sourcePresetId: 'hum-generated', params: { strength: 100, groove: 50 } });
  assert.equal(playing[0][6].note, 'D2');
  assert.ok(playing[0][0].durationSteps < 6);
  assert.deepEqual(written, chordsBefore);
});

test('new chords honor a manual bass even with chromatic roots and different loop lengths', () => {
  const bassBars = [Array(16).fill(null), Array(16).fill(null)];
  bassBars[0][0] = { type: 'bass', note: 'F#2', durationSteps: 10 };
  bassBars[1][0] = { type: 'bass', note: 'D#2', durationSteps: 8 };
  const { chord, drums } = arrangeHumMelody(quarterNotes('C4 E4 G4 C4'), 'airy-synth-lead', { bassBars });
  assert.equal(drums.length, 1);
  assert.equal(chord.length, 2);
  assert.ok(chord[0][0].notes.some(note => note.startsWith('F#')));
  assert.ok(chord[0][8].notes.some(note => note.startsWith('F#')));
  assert.ok(chord[1][0].notes.some(note => note.startsWith('D#')));
});

test('strong melody evidence colors a dominant before resolution and bass connects across roots', () => {
  const lead = quarterNotes('C4 E4 G4 E4 F4 A4 C5 A4 G4 B4 F4 B4 C5 G4 E4 C4');
  lead[0][8].durationSteps = 3;
  const { chord, bass } = arrangeHumMelody(lead);
  const classes = cell => cell.notes.map(note => note.slice(0, -1)).sort();
  assert.deepEqual(classes(chord[2][0]), ['B', 'D', 'G']);
  assert.deepEqual(classes(chord[2][8]), ['B', 'F', 'G']);
  assert.deepEqual(classes(chord[3][0]), ['C', 'E', 'G']);
  assert.equal(bass[0][12].note, 'E2');
  assert.equal(bass[0][14], null);
  assert.equal(bass[1][0].note, 'F2');
  const high = humPlaybackBars({ ...backingPhrases(lead).find(phrase => phrase.trackId === 'bass'),
    sourcePresetId: 'hum-generated', params: { strength: 100, groove: 50 } });
  assert.equal(high[0][12].note, 'E2');
});

test('the playback adapter shares fractional entrances with bass, chord and kick and leaves a long rest', () => {
  const store = makeStore(), projectId = store.current().id;
  const lead = makeHumMelody(cleanHumNotes([event(0, 60, 0.16), event(1.0125, 64, 0.34)], 2), 120,
    { pickupSteps: 2.2, quantize: false }).bars;
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars: lead }], { projectId });
  const tracks = store.insertHumPhrases(backingPhrases(lead), { projectId, melodyId: phrase.id });
  const workspace = store.current().workspace;
  for (const level of [0, 25, 50, 75, 100]) {
    const templates = { ...workspace.templates };
    for (const backing of tracks) templates[backing.trackId] = [applyJamTrackParameter(backing, backing.trackId === 'drums' ? 'groove' : 'strength', level)];
    const selection = Object.fromEntries([phrase, ...tracks].map(track => [track.trackId, track.id]));
    const snapshot = jamCombinationSnapshot({ ...workspace, templates, selection });
    const adapter = createMatrixPlaybackAdapter(snapshot);
    for (const [step, offset] of [[2, 0.2], [10, 0.3]]) {
      const hits = adapter.getEventsForStep(0, step);
      for (const type of ['melody', 'chord', 'bass', 'drums']) {
        const hit = hits.find(hit => hit.type === type && (type !== 'drums' || hit.instrument === 'kick'));
        assert.ok(hit, `${type} absent at level ${level}`);
        assert.ok(Math.abs(hit.timingOffset - offset) < 1e-6, `${type} timing differs at level ${level}`);
      }
    }
    for (const step of [4, 5, 6, 7, 8, 9]) assert.deepEqual(adapter.getEventsForStep(0, step), []);
  }
});

test('chord attacks follow delayed melody entries and rhythm knobs preserve the pickup position', () => {
  const lead = [Array(16).fill(null)];
  lead[0][4] = { type: 'melody', note: 'C4', durationSteps: 2 };
  lead[0][15] = { type: 'melody', note: 'E4', durationSteps: 1 };
  const chord = backingPhrases(lead).find(phrase => phrase.trackId === 'chord');
  const phrase = { ...chord, sourcePresetId: 'hum-generated', params: { strength: 50, groove: 60 } };
  const onsets = bar => bar.flatMap((cell, step) => cell ? [step] : []);
  assert.deepEqual(onsets(chord.bars[0]), [4, 15]);
  assert.ok(chord.bars[0][4].durationSteps < 3);
  const high = humPlaybackBars(applyJamTrackParameter(phrase, 'strength', 100))[0];
  assert.deepEqual(onsets(high), [4, 5, 15]);
  assert.deepEqual(high[15].notes, chord.bars[0][15].notes);
  assert.ok(15 + high[15].durationSteps <= 16);
});

test('shared rhythm answers a second entrance in the same half-bar and holds through the next bar', () => {
  const store = makeStore(), projectId = store.current().id;
  const notes = [[2.25, 0.75, 60, 0.45], [6.2, 3.2, 64, 0.85], [10.5, 9.8, 67, 0.9],
    [25, 2, 65, 0.8], [28.6, 1.6, 64, 0.8]];
  const origin = notes[0][0];
  const bars = makeHumMelody(notes.map(([step, length, pitch, amplitude]) => ({
    start: (step - origin) / 8, end: (step + length - origin) / 8, pitch, amplitude,
  })), 120, { pickupSteps: origin, quantize: false }).bars;
  const [lead] = store.insertHumPhrases([{ trackId: 'melody', bars }], { projectId });
  const backing = store.insertHumPhrases(backingPhrases(bars), { projectId, melodyId: lead.id });
  const workspace = store.current().workspace;
  const chord = backing.find(phrase => phrase.trackId === 'chord');
  const chordNote = chord.bars[0][10].notes[0];
  assert.deepEqual(jamMelodyRenderState(chord.bars, 1, 0, chordNote, 'chord'),
    { active: true, start: false, startBar: 0, startStep: 10, durationSteps: chord.bars[0][10].durationSteps + 0.5 });
  const selection = Object.fromEntries([lead, ...backing].map(track => [track.trackId, track.id]));
  for (const level of [0, 25, 50, 75, 100]) {
    const templates = { ...workspace.templates };
    for (const phrase of backing) {
      templates[phrase.trackId] = [applyJamTrackParameter(phrase, phrase.trackId === 'drums' ? 'groove' : 'strength', level)];
    }
    const snapshot = jamCombinationSnapshot({ ...workspace, templates, selection });
    assert.equal(snapshot.totalBars, 2);
    const adapter = createMatrixPlaybackAdapter(snapshot, { totalBars: snapshot.totalBars });
    const events = Array.from({ length: 64 }, (_, step) => adapter.getEventsForFlatStep(step).map(hit => ({
      ...hit, at: step + (hit.timingOffset ?? 0),
    }))).flat();
    const closeTo = (hit, time) => Math.abs(hit.at - time) < 1e-6;
    for (const step of [2.25, 6.2, 10.5, 25, 28.6, 34.25, 38.2]) {
      const hits = events.filter(hit => closeTo(hit, step));
      assert.ok(hits.some(hit => hit.type === 'melody'));
      assert.ok(hits.some(hit => hit.type === 'chord'));
      assert.ok(hits.some(hit => hit.type === 'bass'));
      assert.ok(hits.some(hit => hit.instrument === 'kick'));
    }
    const pitchedOrKick = hit => ['chord', 'bass'].includes(hit.type) || hit.instrument === 'kick';
    assert.ok(events.filter(pitchedOrKick).every(hit => ![8, 16, 24, 32].includes(hit.at)));
    assert.ok(events.every(hit => hit.at % 32 <= 20.3 || hit.at % 32 >= 25));
    assert.ok(events.filter(hit => ['snare', 'hihat'].includes(hit.instrument)).every(hit =>
      !events.some(kick => kick.instrument === 'kick' && Math.abs(kick.at - hit.at) < 0.5 - 1e-6)));
    assert.ok(events.filter(pitchedOrKick).every(hit => notes.some(([start, length]) => {
      const at = hit.at % 32;
      return at >= start - 1e-6 && at < start + length;
    })));
  }
});
