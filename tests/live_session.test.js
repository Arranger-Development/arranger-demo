import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession, createSessionEditor, readSession, writeSession, sessionKey} from '../src/app/performanceSession.js';
import {performanceStorageKey, performanceTemplates} from '../src/app/performanceModel.js';
import {AI_PERFORMANCE_PROFILE_ID as profile} from '../src/data/aiPerformanceTemplates.js';
const genre = 'chill';
function populated() {
  const s = createSession(genre,profile,100);
  s.sections[0].selection = Object.fromEntries(Object.entries(performanceTemplates(genre,profile)).map(([t,ps]) => [t,ps[0].id]));
  return s;
}
const memory = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k,v) => m.set(k,v) }; };
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



test('session drafts are isolated until an explicit save and stable IDs survive storage', () => {
  const initial=populated(); const editor=createSessionEditor(initial); const id=initial.sections[0].id;
  editor.edit({selection:{...initial.sections[0].selection,drums:null}});
  assert.ok(editor.getSnapshot().session.sections[0].selection.drums);
  editor.save(); assert.equal(editor.getSnapshot().session.sections[0].selection.drums,null);
  assert.equal(editor.getSnapshot().session.sections[0].id,id);
});
