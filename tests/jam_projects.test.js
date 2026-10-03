import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamProjects, jamProjectsKey } from '../src/app/jamProjects.js';
import { createSession, createSessionEditor, sessionKey, writeSession, NEW_COMBINATION_ID, sectionDraftChanged } from '../src/app/performanceSession.js';
import { performanceTemplates } from '../src/app/performanceModel.js';

const genre='chill', profile='ai-demo-1', catalog=performanceTemplates(genre,profile);
function fixture() {
  const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const editor=createSessionEditor(createSession(genre,profile,88),{catalog});
  editor.edit({selection:{drums:catalog.drums[0].id},timbres:{drums:'deep-autumn-drums',chord:'warm-electric-piano',bass:'round-electric-bass',melody:'airy-synth-lead'}});editor.save();
  writeSession(storage,genre,profile,editor.getSnapshot().session);data.set('creation-project','untouched');
  const projects=createJamProjects(storage,genre,profile);
  return {data,storage,editor,projects};
}
test('old Jam is migrated once to project 1 without changing the old save or creation data',()=>{
  const f=fixture(), old=f.data.get(sessionKey(genre,profile)), id=f.projects.current().id;
  assert.equal(f.projects.current().name,'项目 1');assert.equal(f.projects.current().workspace.session.sections.length,1);
  assert.equal(f.projects.current().workspace.session.bpm,88);assert.ok(f.projects.initialize());
  const reloaded=createJamProjects(f.storage,genre,profile);assert.equal(reloaded.current().id,id);
  const workspace=reloaded.current().workspace;
  for(const section of workspace.session.sections) assert.equal(sectionDraftChanged(workspace.drafts[section.id],section),false);
  assert.equal(f.data.get(sessionKey(genre,profile)),old);assert.equal(f.data.get('creation-project'),'untouched');
});
test('new projects are empty, originals keep stable loops, full drafts and arpeggio configuration',()=>{
  const {projects,editor}=fixture(), first=projects.current().id;
  editor.edit({selection:{melody:catalog.melody[0].id},effectAutomation:{version:1,cycleSteps:32,tracks:{melody:{pitch:{initial:0,points:[{step:2,value:7}]}}}}});
  const saved=structuredClone(editor.getSnapshot());
  assert.ok(projects.create(saved,['D4','F4','A4']));assert.equal(projects.current().name,'项目 2');
  assert.equal(projects.current().workspace.session.sections.length,0);
  assert.ok(Object.values(projects.current().workspace.drafts[NEW_COMBINATION_ID].selection).every(v=>!v));
  assert.ok(projects.switchTo(first,projects.current().workspace,projects.current().arpNotes));
  assert.deepEqual(projects.current().workspace,saved);assert.deepEqual(projects.current().arpNotes,['D4','F4','A4']);
});
test('save/reload restores project selection, drafts, recorded effects and blank arpeggio without cross-project contamination',()=>{
  const {projects,storage,editor}=fixture();projects.initialize();
  const loop=editor.getSnapshot().session.sections[0];editor.select(loop.id);
  editor.edit({selection:{bass:catalog.bass[1].id}});
  const before=editor.getSnapshot();assert.ok(projects.save(before,null));
  const reloaded=createJamProjects(storage,genre,profile);assert.equal(reloaded.current().workspace.editingId,loop.id);
  assert.equal(reloaded.current().workspace.drafts[loop.id].selection.bass,catalog.bass[1].id);
  assert.equal(reloaded.current().workspace.session.sections[0].selection.drums,loop.selection.drums);
  assert.equal(reloaded.current().arpNotes,null);
});
test('Loop save passes an atomic post-save workspace so reload cannot resurrect the cleared combination',()=>{
  const {projects,editor,storage}=fixture();editor.edit({selection:{melody:catalog.melody[0].id}});
  assert.ok(editor.save((session,snapshot)=>projects.save(snapshot,['C4','E4','G4'])));
  const restored=createJamProjects(storage,genre,profile).current().workspace;
  assert.equal(restored.session.sections.length,2);assert.equal(restored.editingId,NEW_COMBINATION_ID);
  assert.ok(Object.values(restored.drafts[NEW_COMBINATION_ID].selection).every(v=>!v));
});
test('storage failure cannot switch, create, rename or report a successful Loop save',()=>{
  const {projects,storage,editor}=fixture();projects.initialize();projects.create(editor.getSnapshot(),null);
  const before=structuredClone(projects.getSnapshot());storage.setItem=()=>{throw new Error('quota');};
  assert.equal(projects.create(editor.getSnapshot(),null),false);
  assert.equal(projects.switchTo(before.projects[0].id,editor.getSnapshot(),null),false);
  assert.equal(projects.rename('changed'),false);assert.deepEqual(projects.getSnapshot().projects,before.projects);assert.equal(projects.getSnapshot().activeId,before.activeId);assert.ok(projects.getSnapshot().error);
  editor.edit({selection:{bass:catalog.bass[0].id}});const draft=editor.getSnapshot();
  assert.equal(editor.save((s,next)=>projects.save(next,null)),false);assert.equal(editor.getSnapshot(),draft);
});
test('rename is persistent, empty names rejected, and next project numbering uses the highest default name',()=>{
  const {projects,editor,storage}=fixture();assert.equal(projects.rename('  '),false);
  projects.rename('  秋天现场  ');assert.equal(projects.current().name,'秋天现场');
  projects.create(editor.getSnapshot(),null);projects.rename('项目 9');projects.create(editor.getSnapshot(),null);
  assert.equal(projects.current().name,'项目 10');assert.equal(createJamProjects(storage,genre,profile).current().name,'项目 10');
});
test('malformed or future project libraries are preserved and block destructive fallback writes',()=>{
  for(const raw of ['bad json',JSON.stringify({version:2,projects:[]})]) {
    const {storage,data}=fixture();data.set(jamProjectsKey(genre,profile),raw);
    const projects=createJamProjects(storage,genre,profile);assert.equal(projects.current().workspace.session.sections.length,1);
    assert.equal(projects.initialize(),false);assert.equal(projects.create(projects.current().workspace,null),false);
    assert.equal(data.get(jamProjectsKey(genre,profile)),raw);
  }
});

test('draft comparison ignores key ordering from normalization but detects real unsaved notes',()=>{
  const saved={id:'a',selection:{drums:'d',bass:null},timbres:{drums:'kit',bass:'bass'}};
  const draft={timbres:{bass:'bass',drums:'kit'},selection:{bass:null,drums:'d'},id:'a',effectAutomation:undefined};
  assert.equal(sectionDraftChanged(draft,saved),false);
  draft.name='old metadata'; draft.repeat=3;
  assert.equal(sectionDraftChanged(draft,saved),false);
  draft.selection.bass='b';assert.equal(sectionDraftChanged(draft,saved),true);
});
