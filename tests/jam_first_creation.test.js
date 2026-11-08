import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamTemplateProjects, defaultJamTimbres } from '../src/app/jamTemplateProjects.js';
import { launchJamColumn } from '../src/app/jamTemplateSelection.js';
import { createJamAudition } from '../src/app/jamAudition.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { blankJamDraft, applyJamTrackParameter } from '../src/app/jamDraftActions.js';
import { getJamPitchedPreset } from '../src/app/jamPitchedPresets.js';

const ready=()=>new Promise(resolve=>setImmediate(resolve));
const tracks=['drums','chord','bass','melody'];
function fixture({deferred=false,fail=false}={}) {
  const values=new Map(),store=createJamTemplateProjects({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},'pop',null,120);
  store.enableLiveEditing();
  let options,state,absolute=0,plays=0,stops=0,resolveStart,editor;
  const pending=new Promise(resolve=>{resolveStart=resolve;});
  const playback=createSessionPlayback({
    async play(o){options=o;plays++;if(fail)throw new Error('samples failed');return deferred?pending:true;},
    stop(){stops++;},stopAllVoices(){},setTempo(){},getAbsolutePlaybackStep:()=>absolute,
  },next=>{state=next;if(next.error)editor.pause({stop:false});});
  editor=createJamAudition(playback,{readWorkspace:()=>store.current().workspace,readDraft:()=>store.current().workspace.draft,
    onMixChange({selection,trackId,restoreSound}){
      const w=store.current().workspace;
      store.patch({selection,...(restoreSound?{mutedTracks:{...w.mutedTracks,[trackId]:false},volumes:{...w.volumes,[trackId]:w.volumes[trackId]<=-24?0:w.volumes[trackId]}}:{})});
    },
  });
  return {store,playback,editor,resolveStart,get state(){return state;},get plays(){return plays;},get stops(){return stops;},
    open(track,slot=0,{editColumn=false,barCount=1}={}){
      let phrase=store.current().workspace.templates[track].find(p=>p.slotIndex===slot);
      if(!phrase)phrase=store.commitPhraseEdit(blankJamDraft(track,defaultJamTimbres()[track],slot,barCount),{create:true});
      else store.setDraft({...phrase,editingTemplateId:phrase.id});
      editor.open({...phrase,editingTemplateId:phrase.id},{mode:'mix',autoStart:!editColumn,editColumn});return phrase;
    },
    edit(method='knob',value=0){
      const draft=store.current().workspace.draft,track=draft.trackId;
      let next;
      if(method==='knob')next=applyJamTrackParameter(draft,'strength',value);
      else if(method==='source')next={...draft,bars:structuredClone(getJamPitchedPreset(track,50,track==='chord'?60:50).bars)};
      else {
        const bars=[Array(16).fill(null)];
        if(method!=='clear')bars[0][0]=track==='drums'?{instruments:['kick']}:track==='bass'?{type:'bass',note:'C2'}:{type:track==='chord'?'notes':'melody',notes:['C4']};
        next={...draft,bars};
      }
      const phrase=store.commitPhraseEdit(next);
      editor.update({...phrase,editingTemplateId:phrase.id},{restart:method==='source'});return phrase;
    },
    tick(step){absolute=step;const source=options.playbackSource(step,step*.125);source.onAudible?.();return source;},
  };
}

for(const [first,method] of [['drums','knob'],['chord','source'],['melody','manual']])test(`empty project: first ${first} via ${method} keeps looping while the other three tracks are created`,async()=>{
  const f=fixture();assert.ok(Object.values(f.store.current().workspace.templates).every(row=>row.length===0));
  const initial=f.open(first);await ready();assert.equal(f.plays,0);assert.equal(f.editor.getMode(),'mix');
  f.edit(method);await ready();f.tick(0);f.tick(5);
  assert.equal(f.playback.hasJamPlayback(),true);assert.equal(f.store.current().workspace.selection[first],initial.id);
  const origins={[first]:0};let at=5;
  for(const track of tracks.filter(t=>t!==first)){
    const stops=f.stops,created=f.open(track);const empty=f.tick(++at);
    assert.deepEqual(empty.releaseTrackIds,[]);assert.equal(f.stops,stops);assert.equal(f.plays,1);
    for(const [t,origin] of Object.entries(origins))assert.equal(f.state.trackPositions[t].startStep,origin);
    f.edit();const boundary=(Math.floor(at/16)+1)*16;
    f.tick(boundary-1);assert.equal(f.state.playingPhraseIds[track],null);
    f.tick(boundary);origins[track]=boundary;
    assert.equal(f.store.current().workspace.selection[track],created.id);
    for(const [t,origin] of Object.entries(origins))assert.equal(f.state.trackPositions[t].startStep,origin);
    at=boundary+5;f.tick(at);
  }
  f.editor.release();f.tick(at+1);assert.equal(f.playback.isActive(),true);assert.equal(f.plays,1);
  assert.ok(Object.values(f.state.playingPhraseIds).every(Boolean));
});

test('opening the first existing nonempty phrase starts a real track, but another nonempty editor does not join a running mix',async()=>{
  const f=fixture();f.open('drums');f.edit('manual');await ready();f.tick(0);f.editor.pause();f.editor.release();
  f.open('drums');await ready();f.tick(0);f.tick(5);const plays=f.plays;
  const chord=f.store.commitPhraseEdit({...blankJamDraft('chord',defaultJamTimbres().chord,0),bars:[[{type:'notes',notes:['E3']},...Array(15).fill(null)]]},{create:true});
  f.open('chord');f.tick(6);
  assert.equal(f.state.playingPhraseIds.drums,f.store.current().workspace.templates.drums[0].id);
  assert.equal(f.state.playingPhraseIds.chord,null);assert.notEqual(f.store.current().workspace.selection.chord,chord.id);assert.equal(f.plays,plays);
});

test('a new phrase on the first track keeps the original until its replacement boundary',async()=>{
  const f=fixture();const old=f.open('drums');f.edit();await ready();f.tick(0);f.tick(5);
  const next=f.open('drums',1);f.tick(6);assert.equal(f.state.playingPhraseIds.drums,old.id);
  f.edit('manual');f.tick(15);assert.equal(f.state.playingPhraseIds.drums,old.id);
  f.tick(16);assert.equal(f.state.playingPhraseIds.drums,next.id);assert.equal(f.state.trackPositions.drums.startStep,16);assert.equal(f.plays,1);
});

test('clearing a new track leaves the first track playing and restoring notes rejoins at the next bar',async()=>{
  const f=fixture();f.open('drums');f.edit();await ready();f.tick(0);f.tick(5);
  f.open('chord');f.edit();f.tick(16);f.edit('clear');f.tick(17);
  assert.equal(f.state.playingPhraseIds.chord,null);assert.equal(f.state.trackPositions.drums.startStep,0);
  f.edit('manual');f.tick(31);assert.equal(f.state.playingPhraseIds.chord,null);
  f.tick(32);assert.ok(f.state.playingPhraseIds.chord);assert.equal(f.state.trackPositions.drums.startStep,0);assert.equal(f.plays,1);
});

test('manual pause survives ordinary edits and switching to another new track',async()=>{
  const f=fixture();f.open('drums');f.edit();await ready();f.tick(0);f.tick(5);f.editor.pause();
  f.edit('knob',100);f.open('chord');f.edit();await ready();
  assert.equal(f.plays,1);assert.equal(f.playback.isActive(),false);assert.equal(f.state.mode,'stopped');
});

test('creation during the first sample load shares one startup and preserves both selected tracks',async()=>{
  const f=fixture({deferred:true});const drums=f.open('drums');f.edit();await ready();
  const chord=f.open('chord');f.edit();assert.equal(f.plays,1);
  f.resolveStart(true);await ready();f.tick(0);
  assert.equal(f.state.playingPhraseIds.drums,drums.id);assert.equal(f.state.playingPhraseIds.chord,chord.id);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.equal(f.plays,1);
});

test('failed first startup leaves subsequent editing paused until an explicit playback action',async()=>{
  const f=fixture({fail:true});f.open('drums');f.edit();await ready();
  assert.equal(f.state.error,'samples failed');f.edit('knob',100);f.open('chord');f.edit();await ready();
  assert.equal(f.plays,1);assert.equal(f.playback.isActive(),false);
});


test('manual column edit stays paused until audition and adds a new track at the melody phase', async () => {
  const f = fixture();
  const slot = 9;
  const melody = f.open('melody', slot, { editColumn: true, barCount: 2 });
  const melodyBars = structuredClone(melody.bars);
  melodyBars[0][0] = { type: 'melody', note: 'C4' };
  melodyBars[1][0] = { type: 'melody', note: 'G4' };
  f.store.commitPhraseEdit({ ...melody, bars: melodyBars });
  const drums = f.open('drums', slot, { editColumn: true, barCount: 2 });
  const drumBars = structuredClone(drums.bars);
  drumBars[0][0] = { instruments: ['kick'] };
  drumBars[1][0] = { instruments: ['snare'] };
  assert.equal(f.plays, 0);
  launchJamColumn({ projectStore: f.store, playback: f.playback, audition: f.editor, slotIndex: slot, toggle: true });
  f.editor.resumeColumn(slot);
  await ready();
  f.tick(0);
  f.tick(5);
  const edited = f.store.commitPhraseEdit({ ...drums, bars: drumBars });
  f.editor.update(edited);
  f.tick(15);
  assert.equal(f.state.playingPhraseIds.drums, null);
  f.tick(16);
  assert.equal(f.state.trackPositions.drums.startStep, f.state.trackPositions.melody.startStep);
  assert.equal(f.state.trackPositions.drums.bar, 1);
  assert.equal(f.state.playingPhraseIds.drums, drums.id);
  assert.equal(f.plays, 1);
});
