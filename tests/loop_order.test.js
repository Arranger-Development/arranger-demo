import test from 'node:test';
import assert from 'node:assert/strict';
import { insertLoop, loopRepeat } from '../src/app/loopOrder.js';
import { createSession, createSessionEditor, readSession, writeSession } from '../src/app/performanceSession.js';
import { performanceTemplates } from '../src/app/performanceModel.js';
const catalog=performanceTemplates('chill','ai-demo-1');
test('loop movement uses stable IDs, supports both edges and rejects absent targets',()=>{
 const list=['a','b','c','d'].map(id=>({id}));assert.deepEqual(insertLoop(list,'a','c','after').map(s=>s.id),['b','c','a','d']);assert.deepEqual(insertLoop(list,'d','b').map(s=>s.id),['a','d','b','c']);assert.equal(insertLoop(list,'a','missing'),list);assert.equal(insertLoop(list,'a','b'),list);
});
test('repeat defaults, ordering and persisted edits preserve independent unfinished music drafts',()=>{
 const editor=createSessionEditor(createSession('chill','ai-demo-1'),{catalog});
 for(let i=0;i<9;i++){editor.edit({selection:{drums:catalog.drums[0].id}});editor.save();}
 const list=editor.getSnapshot().session.sections;assert.equal(loopRepeat(list[0]),null);assert.equal(loopRepeat({kind:'transition'}),1);
 editor.select(list[0].id);editor.edit({selection:{drums:catalog.drums[1].id}});editor.setRepeat(list[0].id,3);editor.reorder(list[0].id,list[8].id,'after');
 let state=editor.getSnapshot();assert.equal(state.session.sections.at(-1).id,list[0].id);assert.equal(state.session.sections.at(-1).selection.drums,catalog.drums[0].id);assert.equal(state.drafts[list[0].id].selection.drums,catalog.drums[1].id);assert.equal(state.drafts[list[0].id].repeat,3);
 for(const invalid of [0,-1,1.2,NaN]){editor.setRepeat(list[0].id,invalid);assert.equal(editor.getSnapshot(),state);}
 editor.save();state=editor.getSnapshot();assert.equal(state.session.sections.at(-1).repeat,3);
 let raw;const store={getItem:()=>raw,setItem:(key,value)=>raw=value};writeSession(store,'chill','ai-demo-1',state.session);assert.deepEqual(readSession(store,'chill','ai-demo-1').sections.map(s=>[s.id,s.repeat]),state.session.sections.map(s=>[s.id,s.repeat]));
});
