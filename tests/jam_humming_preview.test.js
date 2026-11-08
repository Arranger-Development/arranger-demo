import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeHumMelody, cleanHumNotes, estimateHumBpm, makeHumMelody } from '../src/preview/humArrangement.js';
import { createJamTemplateProjects, jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { applyJamTrackParameter, blankJamDraft } from '../src/app/jamDraftActions.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { setJamPitchedNote } from '../src/app/jamNoteEditing.js';
import { usesNaturalSampleTail } from '../src/domain/notePerformances.js';

function makeStore() {
  const data = new Map();
  return createJamTemplateProjects({ getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }, 'pop', null, 88);
}

const event = (startTimeSeconds, pitchMidi, durationSeconds = 0.43, amplitude = 0.8) => ({ startTimeSeconds, pitchMidi, durationSeconds, amplitude });
const melody = (pitches, interval = 0.6) => makeHumMelody(cleanHumNotes(pitches.map((pitch, i) => event(i * interval, pitch, interval * 0.75)), 10), 100).bars;
const backingPhrases = bars => Object.entries(arrangeHumMelody(bars)).map(([trackId, bars]) => ({ trackId, bars }));

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

test('removes a short continuous tail while keeping a fresh attack on the same pitch', () => {
  const events = [event(0.1, 60, 0.4), event(0.5, 60, 0.12), event(0.9, 60, 0.36), event(1.26, 60, 0.16)];
  const samples = new Float32Array(2 * 22050);
  const tone = (start, end) => samples.fill(0.4, Math.round(start * 22050), Math.round(end * 22050));
  tone(0.1, 0.56);
  tone(0.9, 1.235);
  tone(1.26, 1.42);
  assert.deepEqual(cleanHumNotes(events, 2, samples).map(note => note.start), [0.1, 0.9, 1.26]);
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
