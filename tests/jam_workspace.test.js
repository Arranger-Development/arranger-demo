import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, createSessionEditor, createExportEntry, createArrangementImport, readSession, writeSession, sessionKey } from '../src/app/performanceSession.js';
import { performanceTemplates } from '../src/app/performanceModel.js';
const genre='chill', profile='ai-demo-1';
const catalog=performanceTemplates(genre,profile);
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
function saved(){const editor=createSessionEditor(createSession(genre,profile),{catalog});editor.edit({selection:{drums:catalog.drums[0].id,chord:null,bass:null,melody:null}});editor.save();return editor;}
test('v4 reads without columns, discards legacy Live copies and history but preserves Jam and unrelated storage',()=>{
 const store=memory(),session=saved().getSnapshot().session;session.columns=[{id:'old',snapshot:{private:'old'}}];session.liveUndo=[session.columns];session.bpm=137;session.volumes.bass=-9;
 store.setItem(sessionKey(genre,profile),JSON.stringify(session));store.setItem('creation','preserve');
 const result=readSession(store,genre,profile);assert.equal(result.columns,undefined);assert.equal(result.liveUndo,undefined);assert.deepEqual(result.sections,session.sections);assert.equal(result.bpm,137);assert.equal(result.volumes.bass,-9);
 writeSession(store,genre,profile,result);assert.equal(store.getItem('creation'),'preserve');assert.equal(JSON.parse(store.getItem(sessionKey(genre,profile))).columns,undefined);assert.deepEqual(readSession(store,genre,profile),result);
});
test('export list uses independent saved snapshots, permits duplicates and requires finite infinity conversion',()=>{
 const editor=saved(),session=editor.getSnapshot().session,section=session.sections[0];const first=createExportEntry(section,genre,profile),second=createExportEntry(section,genre,profile);assert.notEqual(first.id,second.id);
 editor.select(section.id);editor.edit({selection:{drums:null}});assert.ok(first.snapshot.matrix.drums.flat().some(Boolean));
 assert.throws(()=>createArrangementImport(session,[first]),/有限/);
 const project=createArrangementImport(session,[first,second],{[first.id]:2,[second.id]:1});assert.equal(project.totalBars,first.snapshot.totalBars*3);assert.equal(first.repeat,null);assert.ok(project.matrix.drums.flat().some(Boolean));
 assert.throws(()=>createArrangementImport(session,[]),/Loop/);
});
