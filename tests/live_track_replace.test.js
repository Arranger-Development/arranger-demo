import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFORMANCE_TRACKS as tracks, performanceTemplates } from '../src/app/performanceModel.js';
import { AI_PERFORMANCE_PROFILE_ID as profile } from '../src/data/aiPerformanceTemplates.js';
import { createSession, createSessionEditor, snapshotSection, replaceLiveColumnTrack, createLiveImport, readSession, writeSession } from '../src/app/performanceSession.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';

const genre = 'chill';
const catalog = performanceTemplates(genre, profile);
function populated() {
  const session = createSession(genre, profile, 119);
  const section = session.sections[0];
  section.selection = Object.fromEntries(tracks.map((track) => [track, catalog[track][0].id]));
  section.timbres.bass = 'soft-sub-bass';
  session.columns = [{ id: 'verse', name: '主歌', repeat: 2, snapshot: snapshotSection(section, genre, profile) }];
  return session;
}

test('each Live track replacement preserves other stored notes and leaves the source section and sibling copies alone', () => {
  const session = populated();
  session.sections[0].selection.chord = catalog.chord[1].id;
  const column = { ...session.columns[0], snapshot: snapshotSection(session.sections[0], genre, profile) };
  const before = structuredClone(column);
  const saved = structuredClone(session.sections);
  for (const track of tracks) {
    const phrase = catalog[track][track === 'chord' ? 2 : 1];
    const replaced = replaceLiveColumnTrack(column, track, phrase.id, genre, profile);
    assert.equal(replaced.id, column.id);
    assert.equal(replaced.repeat, 2);
    assert.equal(replaced.snapshot.totalBars, 4);
    assert.equal(replaced.snapshot.phraseNames[track], phrase.name);
    assert.notDeepEqual(replaced.snapshot.matrix[track], before.snapshot.matrix[track]);
    for (const other of tracks.filter((t) => t !== track)) {
      assert.deepEqual(replaced.snapshot.matrix[other], before.snapshot.matrix[other]);
      assert.equal(replaced.snapshot.phraseNames[other], before.snapshot.phraseNames[other]);
      assert.equal(replaced.snapshot.timbres[other], before.snapshot.timbres[other]);
    }
    replaced.snapshot.matrix.drums[0].fill(null);
    assert.deepEqual(column, before);
    assert.deepEqual(session.sections, saved);
  }
});

test('longer and shorter replacements resize the column cycle and repeat the original short phrases without losing rests or timbres', () => {
  const column = populated().columns[0];
  const longer = replaceLiveColumnTrack(column, 'chord', catalog.chord[1].id, genre, profile);
  assert.equal(longer.snapshot.totalBars, 4);
  for (const track of ['drums', 'bass', 'melody']) for (let bar = 0; bar < 4; bar++) {
    assert.deepEqual(longer.snapshot.matrix[track][bar], column.snapshot.matrix[track][bar % column.snapshot.phraseBars[track]]);
  }
  const shorter = replaceLiveColumnTrack(longer, 'chord', catalog.chord[0].id, genre, profile);
  assert.equal(shorter.snapshot.totalBars, 2);
  assert.deepEqual(shorter, column);
  const changedBass = replaceLiveColumnTrack(longer, 'bass', catalog.bass[1].id, genre, profile);
  assert.equal(changedBass.snapshot.timbres.bass, 'soft-sub-bass');
  assert.ok(changedBass.snapshot.matrix.bass.flat().filter(Boolean).every((c) => c.requestedTimbreId === 'soft-sub-bass'));
  assert.equal(changedBass.snapshot.matrix.bass[0][1], null);
});

test('empty columns can start with one track; transitions retain their kind and actual phrase length', () => {
  const empty = { id: 'empty', name: '前奏', repeat: 3, snapshot: null };
  const first = replaceLiveColumnTrack(empty, 'drums', catalog.drums[0].id, genre, profile);
  assert.equal(first.snapshot.id, 'empty');
  assert.equal(first.snapshot.totalBars, 2);
  assert.equal(first.snapshot.kind, 'main');
  for (const other of ['chord', 'bass', 'melody']) assert.ok(first.snapshot.matrix[other].flat().every((c) => c === null));
  const session = populated();
  const transition = { ...session.sections[0], kind: 'transition', selection: { drums: catalog.drums[0].id } };
  const single = { ...empty, snapshot: snapshotSection(transition, genre, profile) };
  const replaced = replaceLiveColumnTrack(single, 'bass', catalog.bass[1].id, genre, profile);
  assert.equal(replaced.snapshot.kind, 'transition');
  assert.equal(replaced.snapshot.totalBars, 1);
  assert.deepEqual(replaced.snapshot.matrix.drums, single.snapshot.matrix.drums);
});

test('missing, placeholder and wrong-track templates are no-ops; choosing the existing phrase consumes no history', () => {
  const initial = populated();
  const column = initial.columns[0];
  for (const id of ['', 'missing', 'placeholder-1', catalog.chord[0].id]) {
    assert.equal(replaceLiveColumnTrack(column, 'drums', id, genre, profile), column);
  }
  assert.equal(replaceLiveColumnTrack(column, 'unknown', catalog.drums[0].id, genre, profile), column);
  const same = replaceLiveColumnTrack(column, 'bass', catalog.bass[0].id, genre, profile);
  assert.equal(same, column);
  const editor = createSessionEditor(initial);
  editor.columns([same]);
  assert.equal(editor.getSnapshot().liveUndo.length, 0);
});

test('one replacement is one undo step and survives redo, refresh, playback and creation export', () => {
  const session = populated();
  session.columns[0].repeat = null;
  session.volumes.bass = -8;
  const editor = createSessionEditor(session);
  const position = { id: 'verse', cycle: 2, step: 8 };
  const replacement = replaceLiveColumnTrack(session.columns[0], 'bass', catalog.bass[1].id, genre, profile);
  editor.columns([replacement], position);
  assert.equal(editor.getSnapshot().liveUndo.length, 1);
  editor.undoLive(position);
  assert.deepEqual(editor.getSnapshot().session.columns, session.columns);
  editor.redoLive(position);
  assert.deepEqual(editor.getSnapshot().session.columns, [replacement]);
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeSession(storage, genre, profile, editor.getSnapshot().session);
  const restored = readSession(storage, genre, profile, 100);
  assert.deepEqual(restored.columns, [replacement]);
  const playback = createMatrixPlaybackAdapter(replacement.snapshot.matrix, { totalBars: replacement.snapshot.totalBars });
  assert.equal(playback.getEventsForStep(0, 0).find((e) => e.type === 'bass').note, 'G#0');
  const exported = createLiveImport(restored, { verse: 3 });
  assert.equal(exported.totalBars, 6);
  assert.equal(exported.matrix.bass[0][0].note, 'G#0');
  assert.equal(exported.matrix.bass[0][0].requestedTimbreId, 'soft-sub-bass');
  assert.equal(exported.volumes.bass, -8);
  assert.equal(exported.bpm, 119);
  assert.equal(restored.columns[0].repeat, null);
  assert.deepEqual(restored.sections, session.sections);
});

test('legacy genre templates remain replaceable independently of the other three tracks', () => {
  const s = createSession('pop', null, 100);
  const templates = performanceTemplates('pop');
  s.sections[0].selection = Object.fromEntries(tracks.map((t) => [t, templates[t][0].id]));
  const column = { ...s.columns[0], snapshot: snapshotSection(s.sections[0], 'pop') };
  const next = replaceLiveColumnTrack(column, 'chord', templates.chord[1].id, 'pop');
  assert.notDeepEqual(next.snapshot.matrix.chord, column.snapshot.matrix.chord);
  assert.deepEqual(next.snapshot.matrix.bass, column.snapshot.matrix.bass);
});
