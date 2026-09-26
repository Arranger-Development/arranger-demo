import test from 'node:test';
import assert from 'node:assert/strict';
import { insertLiveColumn, liveKeyboardCommand } from '../src/app/liveInteraction.js';
import { createSession, createSessionEditor } from '../src/app/performanceSession.js';
const makeEditor=()=>createSessionEditor(createSession('chill',null,100));

test('column insertion respects either edge, stable snapshots, and no-op drops',()=>{
  const columns=['a','b','c','d'].map(id=>({id,snapshot:{id}}));
  const moved=insertLiveColumn(columns,'a','c','after');
  assert.deepEqual(moved.map(c=>c.id),['b','c','a','d']); assert.equal(moved[2],columns[0]);
  assert.deepEqual(insertLiveColumn(moved,'a','b','before'),columns);
  assert.equal(insertLiveColumn(columns,'b','b'),columns);
  assert.deepEqual(insertLiveColumn(columns,'b','a','after'),columns);
});

test('Live history groups edits, restores cursor and supports redo without reverting section saves',()=>{
  const editor=makeEditor(); const initial=editor.getSnapshot().session;
  const cursor={id:initial.columns[0].id,cycle:2,step:7};
  editor.beginLiveEdit(cursor);
  editor.columns(initial.columns.map((c,i)=>i===0?{...c,name:'新'}:c),cursor);
  editor.columns(editor.getSnapshot().session.columns.map((c,i)=>i===0?{...c,name:'新前奏'}:c),cursor);
  editor.commitLiveEdit(); assert.equal(editor.getSnapshot().liveUndo.length,1);
  editor.edit({name:'保留的素材名',selection:{drums:'fixture'}}); editor.save();
  editor.undoLive(cursor); assert.equal(editor.getSnapshot().session.columns[0].name,initial.columns[0].name);
  assert.deepEqual(editor.getSnapshot().livePosition,cursor);
  assert.equal(editor.getSnapshot().session.sections[0].name,'保留的素材名');
  editor.redoLive(cursor); assert.equal(editor.getSnapshot().session.columns[0].name,'新前奏');
  editor.undoLive(cursor); editor.editLive({bpm:120},cursor);
  assert.equal(editor.getSnapshot().liveRedo.length,0);
});

test('BPM, volume and structure edits undo together; no-ops do not consume history and history is bounded',()=>{
  const editor=makeEditor(); const s=editor.getSnapshot().session;
  editor.columns(structuredClone(s.columns)); assert.equal(editor.getSnapshot().liveUndo.length,0);
  editor.beginLiveEdit(null);
  for(const volume of [-1,-4,-8]) editor.editLive({volumes:{...s.volumes,drums:volume},mutedTracks:{...s.mutedTracks,drums:false}});
  editor.commitLiveEdit(); assert.equal(editor.getSnapshot().liveUndo.length,1);
  editor.editLive({bpm:140}); editor.columns([]);
  editor.undoLive(); assert.deepEqual(editor.getSnapshot().session.columns,s.columns);
  editor.undoLive(); assert.equal(editor.getSnapshot().session.bpm,100);
  editor.undoLive(); assert.deepEqual(editor.getSnapshot().session.volumes,s.volumes);
  for(let i=0;i<60;i++) editor.editLive({bpm:100+i});
  assert.equal(editor.getSnapshot().liveUndo.length,50);
  assert.equal(makeEditor().getSnapshot().liveUndo.length,0);
});

test('Live shortcuts protect inputs, consumed effect events, modifier combinations and repeat events',()=>{
  assert.equal(liveKeyboardCommand({key:' ',target:{tagName:'DIV'}}),'play');
  assert.equal(liveKeyboardCommand({key:'Escape'}),'stop');
  assert.equal(liveKeyboardCommand({key:'z',metaKey:true}),'undo');
  assert.equal(liveKeyboardCommand({key:'Z',ctrlKey:true,shiftKey:true}),'redo');
  for(const tagName of ['INPUT','TEXTAREA','SELECT']) assert.equal(liveKeyboardCommand({key:'z',metaKey:true,target:{tagName}}),null);
  assert.equal(liveKeyboardCommand({key:' ',defaultPrevented:true}),null);
  assert.equal(liveKeyboardCommand({key:' ',repeat:true}),null);
  assert.equal(liveKeyboardCommand({key:' ',ctrlKey:true}),null);
});

test('modal BPM survives Live undo and redo while saved sections, drafts and copies stay isolated', () => {
  const editor = makeEditor();
  const initial = editor.getSnapshot().session;
  const position = { id: initial.columns[0].id, cycle: 2, step: 7 };
  editor.columns(initial.columns.map((c, i) => i === 0 ? { ...c, name: '改名' } : c), position);
  editor.patch({ bpm: 140 });
  editor.edit({ name: '已保存素材', selection: {drums:'fixture'} }); editor.save();
  editor.edit({ name: '未保存草稿' });
  editor.undoLive(position);
  assert.equal(editor.getSnapshot().session.columns[0].name, initial.columns[0].name);
  assert.equal(editor.getSnapshot().session.bpm, 140);
  assert.deepEqual(editor.getSnapshot().livePosition, position);
  editor.redoLive(position);
  const state = editor.getSnapshot();
  assert.equal(state.session.columns[0].name, '改名');
  assert.equal(state.session.bpm, 140);
  assert.equal(state.session.sections[0].name, '已保存素材');
  assert.equal(state.drafts[state.editingId].name, '未保存草稿');
  assert.deepEqual(state.session.columns[0].snapshot, initial.columns[0].snapshot);
});

test('modal changes rebase the redo branch and prune obsolete BPM-only history', () => {
  const editor = makeEditor();
  const initial = editor.getSnapshot().session;
  editor.editLive({ bpm: 120 });
  editor.columns(initial.columns.map((c, i) => i === 0 ? { ...c, name: '改名' } : c));
  editor.undoLive();
  editor.patch({ bpm: 140 });
  assert.equal(editor.getSnapshot().liveUndo.length, 0);
  assert.equal(editor.getSnapshot().liveRedo.length, 1);
  editor.redoLive();
  assert.equal(editor.getSnapshot().session.bpm, 140);
  assert.equal(editor.getSnapshot().session.columns[0].name, '改名');
  editor.editLive({ bpm: 160 });
  editor.undoLive(); assert.equal(editor.getSnapshot().session.bpm, 140);
  editor.redoLive(); assert.equal(editor.getSnapshot().session.bpm, 160);
  editor.undoLive(); editor.editLive({ bpm: 150 });
  assert.equal(editor.getSnapshot().liveRedo.length, 0);
});

test('modal changes preserve unrelated mix history and finish pending Live transactions', () => {
  const editor = makeEditor();
  const initial = editor.getSnapshot().session;
  editor.beginLiveEdit();
  editor.columns(initial.columns.map((c, i) => i === 0 ? { ...c, name: '组合改动' } : c));
  editor.editLive({ bpm: 120, volumes: { ...initial.volumes, drums: -8 } });
  editor.patch({ bpm: 140, volumes: { ...editor.getSnapshot().session.volumes, bass: -6 } });
  assert.equal(editor.getSnapshot().liveUndo.length, 1);
  editor.undoLive();
  assert.equal(editor.getSnapshot().session.bpm, 140);
  assert.equal(editor.getSnapshot().session.volumes.bass, -6);
  assert.equal(editor.getSnapshot().session.volumes.drums, initial.volumes.drums);
  assert.equal(editor.getSnapshot().session.columns[0].name, initial.columns[0].name);
  editor.redoLive();
  assert.equal(editor.getSnapshot().session.volumes.drums, -8);
  assert.equal(editor.getSnapshot().session.volumes.bass, -6);
  assert.equal(editor.getSnapshot().session.bpm, 140);
  editor.patch({ bpm: 140 });
  assert.equal(editor.getSnapshot().liveUndo.length, 1);
});
