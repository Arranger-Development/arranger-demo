import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, createSection, createSessionEditor, inferSectionKind, NEW_COMBINATION_ID, readSession, sessionKey, snapshotSection } from '../src/app/performanceSession.js';
import { emptySelection, performanceTemplates, performanceStorageKey } from '../src/app/performanceModel.js';

const profile = 'ai-demo-1', genre = 'chill';
const catalog = performanceTemplates(genre, profile);
const main = catalog.drums.find(p => p.kind !== 'transition').id;
const fill = catalog.drums.find(p => p.kind === 'transition').id;
const chordFill = catalog.chord.find(p => p.kind === 'transition').id;
const selection = patch => ({ ...emptySelection(), ...patch });
const create = initial => createSessionEditor(initial ?? createSession(genre, profile), { catalog });
const current = editor => { const s = editor.getSnapshot(); return s.drafts[s.editingId]; };

test('fresh editor has no saved slots; blank save and failed persistence preserve state and draft', () => {
  const editor = create(); const initial = editor.getSnapshot();
  assert.deepEqual(initial.session.sections, []); assert.equal(initial.editingId, NEW_COMBINATION_ID);
  assert.equal(editor.save(), false); assert.equal(editor.getSnapshot(), initial);
  editor.edit({ selection: selection({ drums: main }), timbres: { ...current(editor).timbres, drums: 'deep-autumn-drums' } });
  const before = structuredClone(editor.getSnapshot());
  assert.equal(editor.save(() => false), false);
  assert.deepEqual(editor.getSnapshot(), before);
  let persisted; editor.save(s => { persisted = structuredClone(s); return true; });
  assert.equal(persisted.sections.length, 1); assert.equal(persisted.sections[0].name, '段落 1');
  assert.notEqual(persisted.sections[0].id, NEW_COMBINATION_ID);
  assert.deepEqual(current(editor).selection, emptySelection());
  assert.equal(current(editor).timbres.drums, 'deep-autumn-drums');
});

test('type follows selected material, ignoring silent tracks; mixed material stays main', () => {
  assert.equal(inferSectionKind(selection({ drums: fill }), catalog), 'transition');
  assert.equal(inferSectionKind(selection({ drums: fill, chord: chordFill }), catalog), 'transition');
  assert.equal(inferSectionKind(selection({ drums: main, chord: chordFill }), catalog), 'main');
  const editor = create(); editor.edit({ selection: selection({ drums: fill, chord: chordFill }) }); editor.save();
  const saved = editor.getSnapshot().session.sections[0];
  assert.equal(saved.kind, 'transition'); assert.equal(saved.name, '转场 1');
  assert.equal(snapshotSection(saved, genre, profile).totalBars, 1);
  editor.edit({ selection: selection({ drums: main, chord: chordFill }) }); editor.save();
  const mixed = editor.getSnapshot().session.sections[1];
  assert.equal(mixed.kind, 'main'); assert.equal(snapshotSection(mixed, genre, profile).totalBars, 2);
});

test('consecutive saves grow beyond five, number each type independently and use maximum existing number', () => {
  const editor = create();
  for (let i = 0; i < 7; i++) { editor.edit({ selection: selection({ drums: main }) }); editor.save(); }
  let list = editor.getSnapshot().session.sections;
  assert.equal(list.length, 7); assert.equal(new Set(list.map(s => s.id)).size, 7);
  editor.remove(list[1].id);
  editor.edit({ selection: selection({ drums: main }) }); editor.save();
  assert.equal(editor.getSnapshot().session.sections.at(-1).name, '段落 8');
  for (let i = 0; i < 2; i++) { editor.edit({ selection: selection({ drums: fill }) }); editor.save(); }
  list = editor.getSnapshot().session.sections;
  assert.deepEqual(list.slice(-2).map(s => s.name), ['转场 1', '转场 2']);
});

test('editing updates stable ID; inferred type renames automatic labels but preserves custom names', () => {
  const editor = create(); editor.edit({ selection: selection({ drums: main }) }); editor.save();
  const id = editor.getSnapshot().session.sections[0].id;
  editor.select(id); editor.edit({ selection: selection({ drums: fill }) }); editor.save();
  assert.equal(editor.getSnapshot().session.sections[0].id, id);
  assert.equal(editor.getSnapshot().session.sections[0].name, '转场 1');
  assert.equal(editor.getSnapshot().editingId, NEW_COMBINATION_ID);
  editor.rename(id, '桥段'); editor.select(id); editor.edit({ selection: selection({ drums: main }) }); editor.save();
  assert.equal(editor.getSnapshot().session.sections[0].name, '桥段');
  assert.equal(editor.getSnapshot().session.sections[0].kind, 'main');
});

test('switching drafts does not save them; rename does not save unfinished music; saved copies remain independent', () => {
  const editor = create(); editor.edit({ selection: selection({ drums: main }) }); editor.save();
  const saved = editor.getSnapshot().session.sections[0];
  const copy = snapshotSection(saved, genre, profile); editor.patch({ columns: [{ id: 'copy', snapshot: copy, repeat: 2 }] });
  editor.select(saved.id); editor.edit({ selection: selection({ drums: fill }) });
  editor.select(NEW_COMBINATION_ID); editor.edit({ selection: selection({ chord: chordFill }) });
  editor.select(saved.id); assert.equal(current(editor).selection.drums, fill);
  editor.rename(saved.id, '自定义'); assert.equal(editor.getSnapshot().session.sections[0].selection.drums, main);
  editor.select(NEW_COMBINATION_ID); assert.equal(current(editor).selection.chord, chordFill);
  editor.remove(saved.id); assert.deepEqual(editor.getSnapshot().session.sections, []);
  assert.deepEqual(editor.getSnapshot().session.columns[0].snapshot, copy);
  assert.equal(current(editor).selection.chord, chordFill);
});

test('deleting the last saved loop while editing returns to new draft without recreating a slot', () => {
  const editor = create(); editor.edit({ selection: selection({ drums: main }) }); editor.save();
  const id = editor.getSnapshot().session.sections[0].id; editor.select(id); editor.remove(id);
  assert.equal(editor.getSnapshot().editingId, NEW_COMBINATION_ID);
  assert.deepEqual(editor.getSnapshot().session.sections, []); assert.deepEqual(current(editor).selection, emptySelection());
});

test('v4 empty libraries restore BPM and Live columns instead of falling back; old empty slots are hidden', () => {
  const empty = createSession(genre, profile, 143); empty.columns[0].name = '保留曲式';
  const storage = { getItem: key => key === sessionKey(genre, profile) ? JSON.stringify(empty) : JSON.stringify({ version: 1, bpm: 90, saved: [] }) };
  const restored = readSession(storage, genre, profile); assert.equal(restored.bpm, 143);
  assert.equal(restored.columns[0].name, '保留曲式'); assert.deepEqual(restored.sections, []);
  const old = createSession(genre, profile); old.sections = Array.from({ length: 5 }, (_, i) => createSection('main', i + 1));
  old.sections[3].selection.drums = main; const id = old.sections[3].id;
  const result = readSession({ getItem: key => key === sessionKey(genre, profile) ? JSON.stringify(old) : null }, genre, profile);
  assert.equal(result.sections.length, 1); assert.equal(result.sections[0].id, id); assert.equal(result.sections[0].name, '段落 4');
  const editor = create(result); editor.edit({ selection: selection({ drums: main }) }); editor.save();
  assert.equal(editor.getSnapshot().session.sections[1].name, '段落 5');
});

test('v1 migration still imports actual saved material and leaves legacy bytes untouched', () => {
  const raw = JSON.stringify({ version: 1, bpm: 131, saved: [emptySelection(), selection({ drums: main })] });
  const restored = readSession({ getItem: key => key === performanceStorageKey(genre, profile) ? raw : null }, genre, profile);
  assert.equal(restored.sections.length, 1); assert.equal(restored.sections[0].name, '段落 2');
  assert.equal(restored.bpm, 131); assert.equal(restored.sections[0].selection.drums, main);
});
