import test from 'node:test';
import assert from 'node:assert/strict';
import { jamChordNotes, jamChordRenderState, setJamChordNote } from '../src/app/jamChordEditing.js';
import { createChordCell } from '../src/domain/chordCells.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { jamTrackParameters, jamTemplateState, jamColumnState } from '../src/app/jamPerformanceState.js';

test('legacy harmony resolves all audible notes without mutating its original cell',()=>{
  const bar=Array(16).fill(null);bar[0]=createChordCell('C');const before=structuredClone(bar);
  const actual=createMatrixPlaybackAdapter({chord:[bar]},{totalBars:1}).getEventsForStep(0,0).flatMap(e=>e.notes);
  assert.deepEqual(jamChordNotes(bar[0],0).map(hit=>hit.note),actual);
  assert.equal(actual.length,3);assert.equal(jamChordRenderState(bar,3,actual[0]).active,true);
  assert.deepEqual(bar,before);
  const edited=setJamChordNote(bar,0,'D4',2);
  assert.equal(edited[0].notes.length,4);assert.equal(edited[0].noteDurationSteps[actual[0]],4);
  assert.deepEqual(bar,before);
});

test('polyphonic independent lengths, arpeggios and offset entries render and play identically',()=>{
  let bar=Array(16).fill(null);
  for(const [step,note,len] of [[0,'C4',4],[0,'E4',2],[0,'G4',3],[5,'C4',1],[6,'E4',1],[7,'G4',1],[10,'G4',5]]) bar=setJamChordNote(bar,step,note,len);
  assert.equal(jamChordRenderState(bar,3,'C4').startStep,0);
  assert.equal(jamChordRenderState(bar,3,'E4').active,false);
  assert.equal(jamChordRenderState(bar,14,'G4').active,true);
  const adapter=createMatrixPlaybackAdapter({chord:[bar]},{totalBars:1});
  const events=adapter.getEventsForStep(0,0);
  assert.deepEqual(events.map(e=>[e.notes,e.durationSteps]),[[['C4'],4],[['E4'],2],[['G4'],3]]);
  const resized=setJamChordNote(bar,0,'C4',16);
  assert.equal(resized[0].noteDurationSteps.E4,2);assert.equal(resized[0].noteDurationSteps.C4,16);
  const deleted=setJamChordNote(resized,0,'E4',1,true);assert.deepEqual(deleted[0].notes,['G4','C4']);
  assert.equal(setJamChordNote(bar,15,'C4',16)[15].noteDurationSteps.C4,1);
  assert.equal(setJamChordNote(bar,-1,'C4'),bar);
  assert.deepEqual(setJamChordNote(bar,4,'B2',2)[4].notes,['B2'],'low chord voicings stay editable');
});

test('manual chord notes, feel and UI-only macro parameters persist without regenerating audio content',()=>{
  const data=new Map(),store=createJamTemplateProjects({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},'pop',null,100);
  let bar=Array(16).fill(null);bar[0]={type:'notes',notes:['C4'],velocity:.72,timingOffset:.12};
  bar=setJamChordNote(bar,0,'E4',5);
  const original=structuredClone(bar);
  const template=store.saveTemplate({trackId:'chord',bars:[bar],params:jamTrackParameters({strength:75,groove:25})},'分解');
  const reloaded=createJamTemplateProjects({getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},'pop',null,100);
  const saved=reloaded.current().workspace.templates.chord[0];
  assert.equal(saved.id,template.id);assert.deepEqual(saved.bars,[original]);assert.deepEqual(saved.params,{strength:75,groove:25});
  assert.equal(saved.bars[0][0].velocity,.72);assert.equal(saved.bars[0][0].timingOffset,.12);
  assert.deepEqual(jamTrackParameters(),{strength:50,groove:50});
});

test('playing stays stable while another phrase/column queues, and empty tracks match a column',()=>{
  const templates={drums:[{id:'a'},{id:'b'}],bass:[{id:'bass'}],chord:[],melody:[]};
  const status={mode:'jam',playingPhraseIds:{drums:'a',bass:'bass'},queuedPhraseIds:{drums:'b',bass:null}};
  assert.equal(jamTemplateState(status,'drums','a'),'playing');assert.equal(jamTemplateState(status,'drums','b'),'queued');
  assert.equal(jamColumnState(status,templates,0),'playing');assert.equal(jamColumnState(status,templates,1),'queued');
  assert.equal(jamTemplateState({...status,mode:'stopped'},'drums','b'),'idle');
  assert.equal(jamColumnState(status,templates,7),'idle');
});
