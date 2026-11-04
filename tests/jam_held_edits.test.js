import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamTemplateProjects, defaultJamTimbres, jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { blankJamDraft, applyJamTrackParameter } from '../src/app/jamDraftActions.js';
import { createJamAudition, applyJamMixEdit } from '../src/app/jamAudition.js';
import { createJamEffects } from '../src/app/jamEffects.js';
import { createJamHeldEdits } from '../src/app/jamHeldEdits.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { toggleJamTemplate, deleteJamTemplate } from '../src/app/jamTemplateSelection.js';

const tracks=['drums','chord','bass','melody'];
const ready=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t, selected=tracks) {
  const values=new Map(),store=createJamTemplateProjects({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},'pop',null,120);
  store.enableLiveEditing();
  const phrases=Object.fromEntries(tracks.map(track=>{
    const draft=applyJamTrackParameter(blankJamDraft(track,defaultJamTimbres()[track],0),'strength',25);
    return [track,store.commitPhraseEdit(draft,{create:true})];
  }));
  let options,state,absolute=0,plays=0;
  const calls=[],cancels=[];
  const audio={async play(o){plays++;options=o;return true;},stop(){},stopAllVoices(){},setTempo(){},getAbsolutePlaybackStep:()=>absolute,
    setPerformanceEffect:(track,values,time)=>calls.push({track,values,time}),
    cancelPerformanceEffect:(track,parameter)=>cancels.push({track,parameter})};
  const playback=createSessionPlayback(audio,next=>{state=next;});
  const effects=createJamEffects(audio);
  const onMixChange=({selection,trackId,restoreSound})=>{
    const w=store.current().workspace;
    store.patch({selection,...(restoreSound?{mutedTracks:{...w.mutedTracks,[trackId]:false},volumes:{...w.volumes,[trackId]:w.volumes[trackId]<=-24?0:w.volumes[trackId]}}:{})});
  };
  const editor=createJamAudition(playback,{readWorkspace:()=>store.current().workspace,readDraft:()=>store.current().workspace.draft,onMixChange});
  const held=createJamHeldEdits({playback,effects,audio,readProject:store.current,onMixChange});
  t.after(held.connect());
  const selection=Object.fromEntries(selected.map(track=>[track,phrases[track].id]));
  store.patch({selection});playback.launch(jamCombinationSnapshot(store.current().workspace),120);await ready();
  const f={store,audio,effects,playback,editor,held,phrases,calls,cancels,get plays(){return plays;},get state(){return state;},
    tick(step){absolute=step;const s=options.playbackSource(step,step*.125);s.onAudible?.();return s;},
    open(track,phrase=phrases[track]){store.setDraft({...phrase,editingTemplateId:phrase.id});editor.open({...phrase,editingTemplateId:phrase.id},{mode:'mix',autoStart:true});},
    knob(value,parameter='strength'){
      const p=store.commitPhraseEdit(applyJamTrackParameter(store.current().workspace.draft,parameter,value));
      if(!held.defer(p,{canJoin:editor.canJoin()})){
        held.cancel(p.trackId,p.id);editor.update({...p,editingTemplateId:p.id},{preserveEffects:true});
      }else editor.update({...p,editingTemplateId:p.id},{updateAudio:false});
      return p;
    },
    press(parameter,value,token='old'){
      if(parameter==='repeat')effects.repeat.press(token,value,120);else effects.press(parameter,token,value,120);
    },
    release(parameter,token='old'){
      if(parameter==='repeat')effects.repeat.release(token);else effects.release(parameter,token);
    },
  };
  f.tick(0);f.tick(5);f.open('drums');return f;
}

for(const track of tracks)for(const [effect,divisions] of [['repeat',[4,8,16]],['chopper',[4,8,16,32]],['brake',[1]]])for(const division of divisions){
  test(`${track} ${effect} ${division}: saved knobs wait for release and resume at the same phase`,async t=>{
    const f=await fixture(t);f.effects.select(track);f.open(track);f.press(effect,division);
    const before=f.tick(6),origin=before.trackPositions[track].startStep;
    f.knob(100);f.knob(0);const latest=f.knob(100,'groove');
    for(const step of [7,12,15]){
      const s=f.tick(step);assert.deepEqual(s.matrix[track],before.matrix[track]);
      assert.deepEqual(s.releaseTrackIds,[]);assert.equal(f.effects.isHeld(track,effect),true);
    }
    assert.deepEqual(f.store.current().workspace.templates[track][0].bars,latest.bars);
    const callCount=f.calls.length;f.release(effect);
    assert.equal(f.calls.length,callCount,'last effect is not released early into old dry audio');
    const resumed=f.tick(16);
    assert.deepEqual(resumed.matrix[track].slice(0,latest.bars.length),jamCombinationSnapshot(f.store.current().workspace).matrix[track].slice(0,latest.bars.length));
    assert.deepEqual(resumed.releaseTrackIds,[track]);assert.deepEqual(resumed.preserveEffectTrackIds,[track]);
    assert.equal(f.state.trackPositions[track].startStep,origin);assert.equal(f.plays,1);
    assert.equal(f.calls.at(-1).time,2,'effect release shares the phrase-edit audio clock');
    for(const other of tracks.filter(t=>t!==track))assert.equal(f.state.trackPositions[other].startStep,0);
  });
}

test('overlapping effects wait for the last protected release; pitch alone does not defer',async t=>{
  const f=await fixture(t);f.press('repeat',8);f.press('chopper',16);f.press('brake',1);
  const old=f.tick(6);f.knob(100);f.release('repeat');f.release('brake');
  assert.deepEqual(f.tick(7).matrix.drums,old.matrix.drums);
  f.release('chopper');assert.deepEqual(f.tick(8).releaseTrackIds,['drums']);
  f.press('pitch',5);f.knob(0);assert.deepEqual(f.tick(9).releaseTrackIds,['drums']);
});

test('multi-track targets defer independently, while an untargeted editor updates normally',async t=>{
  const f=await fixture(t);f.effects.select('bass',true);f.press('repeat',8);const old=f.tick(6);
  f.knob(100);f.open('bass');f.knob(100);f.open('chord');f.knob(100);
  const s=f.tick(7);assert.deepEqual(s.releaseTrackIds,['chord']);
  for(const track of ['drums','bass'])assert.deepEqual(s.matrix[track],old.matrix[track]);
  f.release('repeat');const after=f.tick(8);assert.deepEqual(new Set(after.releaseTrackIds),new Set(['drums','bass']));
  assert.equal(f.state.trackPositions.chord.startStep,0);assert.equal(f.plays,1);
});

test('re-pressing before the boundary cancels an old release; stale tokens cannot flush the new hold',async t=>{
  const f=await fixture(t);f.press('repeat',8,'A');const old=f.tick(6);f.knob(100);f.release('repeat','A');
  f.press('repeat',16,'B');f.release('repeat','A');assert.deepEqual(f.tick(7).matrix.drums,old.matrix.drums);
  f.knob(0);f.release('repeat','B');const s=f.tick(8);assert.deepEqual(s.releaseTrackIds,['drums']);
  assert.equal(f.calls.at(-1).values.held,false);assert.equal(f.calls.at(-1).time,1);
  assert.ok(f.cancels.some(c=>c.track==='drums'&&c.parameter==='repeat'));
});

test('collapsing and switching editors retains the original phrase ID instead of updating the new editor',async t=>{
  const f=await fixture(t);f.press('brake',1);const before=f.tick(6);const latest=f.knob(100);
  f.open('melody');f.editor.release();f.release('brake');const after=f.tick(7);
  assert.deepEqual(after.releaseTrackIds,['drums']);assert.notDeepEqual(after.matrix.drums,before.matrix.drums);
  assert.deepEqual(after.matrix.melody,before.matrix.melody);
  assert.equal(f.store.current().workspace.templates.drums[0].id,latest.id);assert.equal(f.plays,1);
});

test('an explicit phrase launch wins over the old deferred knob edit and keeps its bar boundary',async t=>{
  const f=await fixture(t);const second=f.store.commitPhraseEdit({...blankJamDraft('drums',defaultJamTimbres().drums,1),bars:[[{instruments:['snare']},...Array(15).fill(null)]]},{create:true});
  f.open('drums');f.press('repeat',8);f.knob(100);f.tick(6);f.held.cancel('drums');
  toggleJamTemplate({projectStore:f.store,playback:f.playback,audition:f.editor,trackId:'drums',templateId:second.id});
  f.release('repeat');assert.deepEqual(f.tick(7).releaseTrackIds,[]);f.tick(16);
  assert.equal(f.state.playingPhraseIds.drums,second.id);assert.equal(f.state.trackPositions.drums.startStep,16);
});

test('an explicit note edit replaces deferred content; release never writes an older knob snapshot back',async t=>{
  const f=await fixture(t);f.press('chopper',16);f.knob(100);f.tick(6);
  const p=f.store.commitPhraseEdit({...f.store.current().workspace.draft,bars:[[{instruments:['snare']},...Array(15).fill(null)]]});
  f.held.cancel('drums',p.id);applyJamMixEdit(f.playback,f.store.current().workspace,p);
  assert.deepEqual(f.tick(7).releaseTrackIds,['drums']);f.release('chopper');assert.deepEqual(f.tick(8).releaseTrackIds,[]);
  assert.deepEqual(f.store.current().workspace.templates.drums[0].bars,p.bars);
});

test('a previously silent track still joins at the next bar after its protected knob edit is released',async t=>{
  const f=await fixture(t,['drums']);f.effects.select('bass');f.open('bass');f.press('brake',1);f.knob(100);f.tick(6);f.release('brake');
  f.tick(7);assert.equal(f.state.playingPhraseIds.bass,null);assert.equal(f.state.queuedPhraseIds.bass,f.phrases.bass.id);
  f.tick(16);assert.equal(f.state.trackPositions.bass.startStep,16);assert.equal(f.state.trackPositions.drums.startStep,0);
  assert.equal(f.store.current().workspace.selection.bass,f.phrases.bass.id);assert.equal(f.plays,1);
});

test('a queued phrase retains its entry boundary when edited under a held effect',async t=>{
  const f=await fixture(t,['drums']);f.effects.select('bass');f.open('bass');
  toggleJamTemplate({projectStore:f.store,playback:f.playback,audition:f.editor,trackId:'bass',templateId:f.phrases.bass.id});
  f.editor.follow({...f.phrases.bass,editingTemplateId:f.phrases.bass.id});f.press('repeat',8);f.knob(100);f.tick(6);f.release('repeat');f.tick(7);
  f.tick(15);assert.equal(f.state.playingPhraseIds.bass,null);f.tick(16);assert.equal(f.state.trackPositions.bass.startStep,16);
});

test('a blank editor populated under a hold reports actual playback after joining',async t=>{
  const f=await fixture(t,['drums']);
  const blank=f.store.commitPhraseEdit(blankJamDraft('bass',defaultJamTimbres().bass,1),{create:true});
  f.effects.select('bass');f.open('bass',blank);f.press('repeat',8);f.knob(100);
  assert.equal(f.editor.isPlaying(),false);f.tick(6);f.release('repeat');f.tick(7);f.tick(16);
  assert.equal(f.state.playingPhraseIds.bass,blank.id);assert.equal(f.editor.isPlaying(),true);
});

for(const action of ['stop','delete','project'])test(`${action} invalidates a held edit and its late release without restarting audio`,async t=>{
  const f=await fixture(t);f.press('repeat',8);f.knob(100);f.tick(6);f.release('repeat');
  if(action==='stop'){f.editor.pause();f.effects.resetHolds();}
  else if(action==='delete'){
    f.held.cancel('drums',f.phrases.drums.id);
    deleteJamTemplate({projectStore:f.store,playback:f.playback,audition:f.editor,trackId:'drums',templateId:f.phrases.drums.id});
  } else {f.store.create();f.editor.stop();f.effects.resetHolds();}
  const s=f.tick(7);assert.ok(!s.preserveEffectTrackIds?.includes('drums'));assert.equal(f.plays,1);
  if(action!=='delete')assert.equal(f.playback.isActive(),false);
});

test('an unannounced project mismatch cannot apply a stale deferred edit',async t=>{
  const f=await fixture(t);f.press('repeat',8);const before=f.tick(6);f.knob(100);f.store.create();f.release('repeat');
  assert.deepEqual(f.tick(7).matrix.drums,before.matrix.drums);assert.equal(f.plays,1);
});

test('shorter knob loops keep the original origin across several cycles',async t=>{
  const f=await fixture(t);f.tick(38);f.press('repeat',8);f.knob(0);f.tick(40);f.release('repeat');f.tick(41);
  const position=f.state.trackPositions.drums;
  assert.equal(position.startStep,0);assert.equal(position.localStep,41);
  assert.equal(position.fraction,(41%position.totalSteps)/position.totalSteps);
});

test('changing effect targets releases and flushes the old target without editing the new target',async t=>{
  const f=await fixture(t);f.press('brake',1);const before=f.tick(6);f.knob(100);f.effects.select('melody');
  const after=f.tick(7);assert.deepEqual(after.releaseTrackIds,['drums']);
  assert.deepEqual(after.matrix.melody,before.matrix.melody);assert.equal(f.effects.isHeld('drums','brake'),false);
});

test('a failed sample startup clears a previous deferred edit and cannot be revived by a late release',async t=>{
  const f=await fixture(t);f.press('repeat',8);f.knob(100);f.tick(6);f.release('repeat');f.playback.stop();
  f.audio.play=async()=>{throw new Error('samples failed');};
  f.playback.launch(jamCombinationSnapshot(f.store.current().workspace),120);await ready();
  assert.equal(f.state.error,'samples failed');f.release('repeat');
  assert.equal(f.playback.isActive(),false);assert.ok(f.calls.every(call=>call.time===undefined));
});
