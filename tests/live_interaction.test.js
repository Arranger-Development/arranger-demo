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
  editor.edit({name:'保留的素材名'}); editor.save();
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
