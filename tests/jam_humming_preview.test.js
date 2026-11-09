import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeHumMelody, cleanHumNotes, estimateHumBpm, makeHumMelody } from '../src/preview/humArrangement.js';
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
  const [phrase] = store.insertHumPhrases([{ trackId: 'melody', bars: makeHumMelody(sustained, 100).bars }], { projectId: store.current().id });
  const adapter = () => createMatrixPlaybackAdapter(jamCombinationSnapshot(store.current().workspace, phrase, true));
  const [attack] = adapter().getEventsForStep(0, 0);
  assert.equal(attack.timbreId, 'hum-sustain');
  assert.equal(attack.playbackMode, 'gated');
  assert.equal(eventDuration(attack, 100), 0.6);
  const slightlyLong = makeHumMelody([{ ...sustained[0], end: sustained[0].start + 0.65 }], 100).bars;
  assert.equal(jamMelodyRenderState(slightlyLong, 0, 3, 'C4').active, true);
  assert.equal(jamMelodyRenderState(slightlyLong, 0, 4, 'C4').active, false);
  for (const step of [1, 2, 3]) {
    assert.deepEqual(adapter().getEventsForStep(0, step), []);
    assert.equal(jamMelodyRenderState(phrase.bars, 0, step, 'C4').start, false);
  }
  store.setTimbre('melody', 'deep-autumn-melody');
  const [sampleAttack] = adapter().getEventsForStep(0, 0);
  assert.equal(sampleAttack.timbreId, 'deep-autumn-melody');
  assert.equal(sampleAttack.playbackMode, 'gated');
  assert.equal(eventDuration(sampleAttack, 100), eventDuration(attack, 100));
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
    const step = track.trackId === 'bass' ? 3 : 2;
    const visible = humPlaybackBars(high)[0][step];
    const note = visible.note ?? visible.notes[0];
    const edited = editJamSequencerStep(high, 0, step, bar => setJamPitchedNote(bar, step, note, 2, false, track.trackId));
    const low = applyJamTrackParameter(edited, 'strength', 0);
    const lowBar = humPlaybackBars(low)[0];
    assert.equal(lowBar[step].notePerformances[note][0].durationSteps, 2);
    assert.ok(lowBar[track.trackId === 'bass' ? 6 : 4]);
    assert.notDeepEqual(lowBar.slice(8), humPlaybackBars(high)[0].slice(8));
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
  const { chord } = arrangeHumMelody(scored(['C4', 'B3', 'C4', 'G4']), 'hum-sustain');
  assert.ok(!chord[0][0].notes.includes('C4'), 'a held C4 in the accompaniment crowds the B3 lead');
  const bars = scored(['C4', 'E4', 'D4', 'B3']);
  const synth = arrangeHumMelody(bars, 'hum-sustain'), sample = arrangeHumMelody(bars, 'deep-autumn-melody');
  const pitchClasses = notes => notes.map(note => note.slice(0, -1)).sort();
  assert.deepEqual(pitchClasses(synth.chord[0][0].notes), pitchClasses(sample.chord[0][0].notes));
  assert.notDeepEqual(synth.chord[0][0].notes, sample.chord[0][0].notes);
  assert.equal(sample.bass[0][8].note, 'G2');
  assert.ok(arrangeHumMelody(scored(['F4', 'E4', 'C4', 'E4'])).chord[0][0].notes.some(note => note.startsWith('F')));
});

test('refreshing harmony updates the generated bass in place and preserves a hand-edited chord', () => {
  const store = makeStore();
  const projectId = store.current().id;
  const [lead] = store.insertHumPhrases([{ trackId: 'melody', bars: melody([60, 64, 67, 60]) }], { projectId });
  const original = store.insertHumPhrases(backingPhrases(lead.bars), { projectId, melodyId: lead.id });
  const chord = original.find(phrase => phrase.trackId === 'chord');
  const bass = original.find(phrase => phrase.trackId === 'bass');
  const editedChord = store.commitPhraseEdit(editJamSequencerStep(chord, 0, 3, bar => setJamPitchedNote(bar, 3, 'D4', 1)));
  const updatedLead = store.commitPhraseEdit({ ...lead, bars: melody([62, 66, 69, 62]) });
  const updated = store.insertHumPhrases(backingPhrases(updatedLead.bars), {
    projectId, melodyId: lead.id, fillEmpty: true, refreshHarmony: true,
  });
  assert.deepEqual(updated.map(phrase => phrase.id), [bass.id]);
  assert.equal(updated[0].bars[0][0].note, 'D2');
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
  const { bass } = arrangeHumMelody(quarterNotes('C4 E4 G4 C4'), 'hum-sustain', { chordBars: [written] });
  assert.deepEqual(bass[0].flatMap((cell, step) => cell ? [[step, cell.note]] : []), [[0, 'F2'], [6, 'D2'], [8, 'D2']]);
  const playing = humPlaybackBars({ trackId: 'bass', sourcePresetId: 'hum-generated', bars: bass, params: { strength: 100, groove: 50 } });
  assert.equal(playing[0][6].note, 'D2');
  assert.ok(playing[0][0].durationSteps < 6);
  assert.deepEqual(written, chordsBefore);
});

test('new chords honor a manual bass even with chromatic roots and different loop lengths', () => {
  const bassBars = [Array(16).fill(null), Array(16).fill(null)];
  bassBars[0][0] = { type: 'bass', note: 'F#2', durationSteps: 10 };
  bassBars[1][0] = { type: 'bass', note: 'D#2', durationSteps: 8 };
  const { chord, drums } = arrangeHumMelody(quarterNotes('C4 E4 G4 C4'), 'hum-sustain', { bassBars });
  assert.equal(drums.length, 1);
  assert.equal(chord.length, 2);
  assert.ok(chord[0][0].notes.some(note => note.startsWith('F#')));
  assert.ok(chord[0][8].notes.some(note => note.startsWith('F#')));
  assert.ok(chord[1][0].notes.some(note => note.startsWith('D#')));
});

test('strong melody evidence colors a dominant before resolution and bass connects across roots', () => {
  const lead = quarterNotes('C4 E4 G4 E4 F4 A4 C5 A4 G4 B4 F4 B4 C5 G4 E4 C4');
  const { chord, bass } = arrangeHumMelody(lead);
  const classes = cell => cell.notes.map(note => note.slice(0, -1)).sort();
  assert.deepEqual(classes(chord[2][0]), ['B', 'D', 'G']);
  assert.deepEqual(classes(chord[2][8]), ['B', 'F', 'G']);
  assert.deepEqual(classes(chord[3][0]), ['C', 'E', 'G']);
  assert.equal(bass[0][14].note, 'E2');
  assert.equal(bass[1][0].note, 'F2');
  const high = humPlaybackBars({ trackId: 'bass', sourcePresetId: 'hum-generated', bars: bass, params: { strength: 100, groove: 50 } });
  assert.equal(high[0][14].note, 'E2');
});

test('chord attacks follow delayed melody entries and rhythm knobs preserve the pickup position', () => {
  const lead = [Array(16).fill(null)];
  lead[0][4] = { type: 'melody', note: 'C4', durationSteps: 2 };
  lead[0][15] = { type: 'melody', note: 'E4', durationSteps: 1 };
  const { chord } = arrangeHumMelody(lead);
  const phrase = { trackId: 'chord', sourcePresetId: 'hum-generated', bars: chord, params: { strength: 50, groove: 60 } };
  const onsets = bar => bar.flatMap((cell, step) => cell ? [step] : []);
  assert.deepEqual(onsets(chord[0]), [4, 15]);
  assert.ok(chord[0][4].durationSteps < 3);
  const high = humPlaybackBars(applyJamTrackParameter(phrase, 'strength', 100))[0];
  assert.deepEqual(onsets(high), [4, 5, 6, 15]);
  assert.deepEqual(high[15].notes, chord[0][15].notes);
  assert.ok(15 + high[15].durationSteps <= 16);
});
