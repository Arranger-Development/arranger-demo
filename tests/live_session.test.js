import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession, fixedPerformancePads, EXTRA_PHRASE_PLACEHOLDERS, createSessionEditor, readSession, writeSession, sessionKey, snapshotSection, createForm} from '../src/app/performanceSession.js';
import { performanceStorageKey, performanceTemplates } from '../src/app/performanceModel.js';
import { AI_PERFORMANCE_PROFILE_ID as profile } from '../src/data/aiPerformanceTemplates.js';
const genre = 'chill';
function populated() {
  const s = createSession(genre,profile,100);
  s.sections[0].selection = Object.fromEntries(Object.entries(performanceTemplates(genre,profile)).map(([t,ps]) => [t,ps[0].id]));
  return s;
}
const memory = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k,v) => m.set(k,v) }; };
test('session starts with five independent main sections, fourteen visible slots, and no invented transitions', () => {
  const s = createSession(genre,profile,100);
  assert.equal(s.sections.length,5); assert.equal(new Set(s.sections.map(x=>x.id)).size,5);
  for(const pads of Object.values(s.pads)) { assert.equal(pads.length,14); assert.deepEqual(pads.slice(10),[null,null,null,null]); }
  assert.deepEqual(s.columns.map(c=>c.repeat),[2,2,2,1,2,1,null,4]);
  assert.ok(s.columns.every(c=>!c.snapshot)); assert.deepEqual(createForm('blank'),[]);
});
test('legacy save migration preserves old bytes and exact phrase choices', () => {
  const store = memory(); const selection = populated().sections[0].selection;
  const old = JSON.stringify({version:1,bpm:132,saved:Array(5).fill(selection)});
  store.setItem(performanceStorageKey(genre,profile),old);
  const restored = readSession(store,genre,profile,100);
  assert.equal(restored.bpm,132); assert.deepEqual(restored.sections[0].selection,selection);
  assert.equal(writeSession(store,genre,profile,restored),true);
  assert.equal(store.getItem(performanceStorageKey(genre,profile)),old);
  assert.deepEqual(readSession(store,genre,profile,100).sections,restored.sections);
  store.setItem(sessionKey(genre,profile),'broken');
  const fallback = readSession(store,genre,profile,100);
  assert.equal(fallback.bpm,132); assert.deepEqual(fallback.sections[0].selection,selection);
});
test('draft edits, slot bindings, saved sections and Live snapshots never alias', () => {
  const initial = populated(); const editor = createSessionEditor(initial); const id = initial.sections[0].id;
  const copy = snapshotSection(initial.sections[0],genre,profile);
  editor.columns([{id:'column',name:'主歌',repeat:2,snapshot:copy}]);
  editor.edit({name:'改名',selection:{...initial.sections[0].selection,drums:null}});
  assert.notEqual(editor.getSnapshot().session.sections[0].name,'改名'); editor.save();
  editor.patch({pads:{...initial.pads,drums:Array(7).fill(null)}}); editor.remove(id);
  assert.deepEqual(editor.getSnapshot().session.columns[0].snapshot,copy);
  assert.ok(copy.matrix.drums.flat().some(Boolean)); assert.ok(initial.sections[0].selection.drums);
});
test('form edits undo and restored copies remain independent of mutated source', () => {
  const editor = createSessionEditor(populated()); const before = structuredClone(editor.getSnapshot().session.columns);
  editor.columns([]); assert.equal(editor.getSnapshot().session.columns.length,0); editor.undoLive();
  assert.deepEqual(editor.getSnapshot().session.columns,before);
  editor.add('transition'); const state = editor.getSnapshot(); assert.equal(state.drafts[state.editingId].kind,'transition');
});
test('explicitly emptied pad bindings survive refresh independently of saved sections', () => {
  const store = memory(); const session = populated();
  session.pads.drums[0] = null; writeSession(store,genre,profile,session);
  const restored = readSession(store,genre,profile,100);
  assert.equal(restored.pads.drums[0],null);
  assert.equal(restored.sections[0].selection.drums,session.sections[0].selection.drums);
});


test('sections grow beyond five and main/transition numbering remains separate after deletion', () => {
  const editor = createSessionEditor(populated());
  editor.add('main');
  assert.equal(editor.getSnapshot().drafts[editor.getSnapshot().editingId].name, '段落 6');
  editor.remove(editor.getSnapshot().session.sections[1].id);
  editor.add('main');
  assert.equal(editor.getSnapshot().drafts[editor.getSnapshot().editingId].name, '段落 7');
  editor.add('transition');
  assert.equal(editor.getSnapshot().drafts[editor.getSnapshot().editingId].name, '转场 1');
  editor.add('transition');
  assert.equal(editor.getSnapshot().drafts[editor.getSnapshot().editingId].name, '转场 2');
  assert.equal(editor.getSnapshot().session.sections.length, 8);
});


test('visible pads retain supplied catalog order and extra choices are ten non-musical placeholders', () => {
  const catalog = performanceTemplates(genre,profile);
  const before = structuredClone(catalog);
  const pads = fixedPerformancePads(catalog);
  assert.deepEqual(pads.drums.slice(0,5).map(p=>p.name), ['悸动节奏','摇摆行进','街头舞步','放慢脚步','凝神屏气']);
  for (const track of Object.keys(catalog)) {
    assert.deepEqual(pads[track].slice(0,10).filter(Boolean),catalog[track].slice(0,10));
    assert.deepEqual(pads[track].slice(10),[null,null,null,null]);
  }
  assert.equal(EXTRA_PHRASE_PLACEHOLDERS.length,10);
  assert.equal(new Set(EXTRA_PHRASE_PLACEHOLDERS.map(p=>p.id)).size,10);
  assert.ok(EXTRA_PHRASE_PLACEHOLDERS.every(p=>p.bars===undefined));
  assert.deepEqual(catalog,before);
});
