import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { blankJamDraft } from '../src/app/jamDraftActions.js';

const memory=()=>{const data=new Map();return{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const create=storage=>createJamTemplateProjects(storage,'pop',null,100);

test('removing each unsaved track draft persists without compacting saved gems or clearing another editor',()=>{
  const storage=memory(),store=create(storage);
  const saved=store.saveTemplate({...blankJamDraft('drums','deep-autumn-drums',5),bars:[[{instruments:['kick']},...Array(15).fill(null)]]},'Saved');
  store.patch({selection:{...store.current().workspace.selection,drums:saved.id}});
  for(const track of ['drums','chord','bass','melody'])store.setDraft(blankJamDraft(track,`deep-autumn-${track}`,2));
  const before=structuredClone(store.current().workspace);
  for(const track of ['drums','chord','bass','melody']) {
    const w=store.current().workspace,expected=w.draftsByTrack[track],active=w.draft;
    assert.equal(store.discardDraft(track,{projectId:store.current().id,targetSlot:2,expectedDraft:expected}),true);
    const after=store.current().workspace;
    assert.equal(after.draftsByTrack[track],undefined);
    assert.deepEqual(after.draft,track==='melody'?null:active);
    assert.deepEqual(after.templates,before.templates);
    assert.deepEqual(after.selection,before.selection);
    assert.deepEqual(after.timbres,before.timbres);
    assert.deepEqual(after.volumes,before.volumes);
    assert.equal(create(storage).current().workspace.draftsByTrack[track],undefined);
  }
  assert.equal(store.current().workspace.templates.drums[0].slotIndex,5);
  assert.equal(create(storage).current().workspace.draft,null);
});

test('draft removal rejects changed drafts, wrong slots/projects and saved phrase editors',()=>{
  const store=create(memory());
  store.setDraft(blankJamDraft('drums','deep-autumn-drums',2));
  const target={projectId:store.current().id,targetSlot:2,expectedDraft:store.current().workspace.draftsByTrack.drums};
  store.setDraft({...target.expectedDraft,name:'New edits',dirty:true});
  assert.equal(store.discardDraft('drums',target),false);
  assert.equal(store.discardDraft('drums',{targetSlot:3}),false);
  assert.equal(store.discardDraft('drums',{projectId:'another-project'}),false);
  assert.equal(store.discardDraft('invalid'),false);
  const saved=store.saveTemplate({...store.current().workspace.draft,bars:[[{instruments:['kick']},...Array(15).fill(null)]]},'Saved');
  store.setDraft({...saved,editingTemplateId:saved.id,dirty:true});
  const before=store.current().workspace;
  assert.equal(store.discardDraft('drums'),false);
  assert.equal(store.current().workspace,before);
  assert.equal(store.current().workspace.templates.drums[0].id,saved.id);
});

test('failed draft removal retains its content and disk copy, and can retry the same target',()=>{
  const storage=memory(),store=create(storage);
  store.setDraft({...blankJamDraft('drums','deep-autumn-drums',2),bars:[[{instruments:['kick']},...Array(15).fill(null)]],dirty:true});
  const before=store.current().workspace,target={expectedDraft:before.draftsByTrack.drums};
  const write=storage.setItem;
  storage.setItem=()=>{throw new Error('quota');};
  assert.equal(store.discardDraft('drums',target),false);
  assert.equal(store.current().workspace,before);
  assert.ok(store.getSnapshot().error);
  assert.deepEqual(create(storage).current().workspace.draft,before.draft);
  storage.setItem=write;
  assert.equal(store.discardDraft('drums',target),true);
  assert.equal(create(storage).current().workspace.draft,null);
});
