import test from 'node:test';
import assert from 'node:assert/strict';
import useMusicStore from '../src/store/useMusicStore.js';
import { createWorkspaceEntryState, createLegacyTutorialEntryState } from '../src/app/workspaceEntry.js';
import { createInitialRecommendationSelections } from '../src/app/multimodalRecommendation.js';
import { createJamTemplateProjects, applyUserTemplate } from '../src/app/jamTemplateProjects.js';
import { getDialDrumPreset } from '../src/data/dialDrumPresets.js';
import { createUndoSnapshot, restoreUndoSnapshot } from '../src/app/undoHistory.js';

const empty = state => {
  assert.deepEqual(state.clips,{ids:[],byId:{}});
  assert.equal(Object.values(state.matrix).every(bars=>bars.every(bar=>bar.every(cell=>cell===null))),true);
  assert.equal(state.selectedClipId,null);
};
test('home Creation and Jam entries begin blank with four core tracks and default music parameters',()=>{
  const initial=useMusicStore.getInitialState();
  for (const destination of ['creation','jam']) {
    const next=createWorkspaceEntryState(initial,{destination});empty(next);
    assert.equal(next.bpm,initial.bpm);assert.deepEqual(next.visibleTrackIds,['drums','chord','bass','melody']);
    assert.equal(next.matrix.drums.length,8);assert.equal(typeof next.createClip,'function');
    assert.notEqual(next.matrix,initial.matrix);
  }
});
test('AI direct Creation preserves recommendation; AI to Jam leaves composition blank',()=>{
  const recommendation={bpm:123,selections:createInitialRecommendationSelections()};
  const creation=createWorkspaceEntryState(useMusicStore.getInitialState(),{recommendation});
  assert.ok(creation.clips.ids.length>0);assert.ok(creation.matrix.drums.some(bar=>bar.some(Boolean)));assert.equal(creation.bpm,123);
  const jam=createWorkspaceEntryState(useMusicStore.getInitialState(),{destination:'jam',recommendation});empty(jam);assert.equal(jam.bpm,123);
});
test('tutorial explicitly seeds only its demonstration clip while ordinary initial state remains empty',()=>{
  const initial=useMusicStore.getInitialState(), tutorial=createLegacyTutorialEntryState(initial);
  assert.deepEqual(tutorial.clips.ids,['drums-bar-0']);assert.equal(tutorial.clips.byId['drums-bar-0'].name,'Drum 01');
  assert.equal(tutorial.matrix.drums.every(bar=>bar.every(cell=>cell===null)),true);empty(initial);
});
test('a saved Jam phrase applies to a blank timeline; New and undo leave the shared library intact',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const library=createJamTemplateProjects(storage,'pop',null,100);
  const saved=library.saveTemplate({trackId:'drums',timbreId:'soft-electronic-kit',bars:structuredClone(getDialDrumPreset(100,100).bars)},'My drum');
  const blank=createWorkspaceEntryState(useMusicStore.getInitialState());
  const composed={...blank,...applyUserTemplate(blank,saved,0)};
  assert.ok(composed.clips.ids.includes('drums-bar-0'));assert.ok(composed.matrix.drums[0].some(Boolean));
  const checkpoint=createUndoSnapshot({appState:composed});
  const reset=createWorkspaceEntryState(useMusicStore.getInitialState());empty(reset);
  let restored;
  assert.equal(restoreUndoSnapshot({snapshot:checkpoint,store:{setState:value=>{restored=value;}}}),true);
  assert.deepEqual(restored.matrix,composed.matrix);
  assert.deepEqual(library.current().workspace.templates.drums.map(t=>t.id),[saved.id]);
});
