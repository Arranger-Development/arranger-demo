import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamAudition } from '../src/app/jamAudition.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { toggleJamTemplate, launchJamColumn, deleteJamTemplate } from '../src/app/jamTemplateSelection.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';

const ready=()=>new Promise(resolve=>setImmediate(resolve));
const tracks=['drums','chord','bass','melody'];
const cell=(t,note=t==='bass'?'C2':'C3')=>t==='drums'?{instruments:['kick']}:t==='chord'?{type:'notes',notes:[note]}:{type:t,note};
function fixture() {
  const w={bpm:100,templates:Object.fromEntries(tracks.map(t=>[t,[{id:`${t}-old`,slotIndex:0,trackId:t,
    bars:Array.from({length:t==='drums'?4:2},()=>Array.from({length:16},()=>cell(t)))}]])),
    selection:Object.fromEntries(tracks.map(t=>[t,null])),mutedTracks:Object.fromEntries(tracks.map(t=>[t,false])),volumes:Object.fromEntries(tracks.map(t=>[t,0])),draft:null,liveEditingVersion:1};
  let options,absolute=0,plays=0,stops=0,clears=0,solo=false,state;
  const changes=[],audio={async play(o){options=o;plays++;return true;},stop(){stops++;},stopAllVoices(){clears++;},setTempo(){},getAbsolutePlaybackStep:()=>absolute};
  const playback=createSessionPlayback(audio,next=>{state=next;});
  const store={current:()=>({workspace:w}),patch(value){Object.assign(w,value);return true;}};
  const editor=createJamAudition(playback,{readWorkspace:()=>w,readDraft:()=>w.draft,onSoloChange:v=>{solo=v;},onMixChange:change=>{
    changes.push(change);w.selection=change.selection;
    if(change.restoreSound){w.mutedTracks[change.trackId]=false;if(w.volumes[change.trackId]<=-24)w.volumes[change.trackId]=0;}
  }});
  const read=step=>{absolute=step;return options.playbackSource(step,step*.15);};
  return {w,playback,editor,audio,changes,store,read,get state(){return state;},get plays(){return plays;},get solo(){return solo;},
    counts:()=>({plays,stops,clears}),tick(step){const s=read(step);s.onAudible?.();return s;},
    events(source,step){return createMatrixPlaybackAdapter(source,{totalBars:source.totalBars}).getEventsForFlatStep(step);},
    start(t){playback.toggleTrack(jamCombinationSnapshot({...w,selection:{[t]:`${t}-old`}}),t,w.bpm);w.selection=playback.getDesiredPhraseIds();},
    blank(t){w.draft={id:`${t}-new`,editingTemplateId:`${t}-new`,trackId:t,slotIndex:1,bars:[Array(16).fill(null)]};
      w.templates[t].push(structuredClone(w.draft));editor.open(w.draft,{mode:'mix'});return w.draft;},
    existing(t){w.draft={...structuredClone(w.templates[t][0]),editingTemplateId:w.templates[t][0].id};editor.open(w.draft,{mode:'mix'});},
    edit(note,options={}){w.draft={...w.draft,bars:[[note?cell(w.draft.trackId,note):null,...Array(15).fill(null)]]};
      w.templates[w.draft.trackId]=w.templates[w.draft.trackId].map(p=>p.id===w.draft.id?structuredClone(w.draft):p);editor.update(w.draft,options);},
    trigger(t,id){return toggleJamTemplate({projectStore:store,playback,audition:editor,trackId:t,templateId:id});},
    column(slotIndex){return launchJamColumn({projectStore:store,playback,audition:editor,slotIndex,toggle:true});},
  };
}

test('opening and repeatedly opening a blank mix editor leaves audible tracks, origins, tails and the transport untouched',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.start('bass');f.tick(16);f.tick(20);
  const before=f.counts(),selection={...f.w.selection};
  f.blank('chord');f.editor.open(f.w.draft);const source=f.tick(21);
  assert.equal(f.editor.getMode(),'mix');assert.equal(f.solo,false);assert.equal(f.editor.isPlaying(),false);
  assert.deepEqual(f.w.selection,selection);assert.deepEqual(f.counts(),before);assert.deepEqual(source.releaseTrackIds,[]);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.equal(f.state.trackPositions.bass.startStep,16);
  assert.deepEqual(new Set(f.events(source,21).map(e=>e.trackId)),new Set(['drums','bass']));
  f.editor.release();const closed=f.tick(22);assert.deepEqual(closed.releaseTrackIds,[]);assert.deepEqual(f.counts(),before);
});

test('first note joins at the next bar and repeated edits keep the original waiting boundary and unrelated origins',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.start('bass');f.tick(16);f.tick(20);
  f.w.mutedTracks.chord=true;f.w.volumes.chord=-24;
  f.blank('chord');f.edit('D3');assert.equal(f.state.queuedPhraseIds.chord,'chord-new');assert.equal(f.editor.isPlaying(),false);
  assert.equal(f.w.selection.chord,'chord-new');assert.equal(f.w.mutedTracks.chord,false);assert.equal(f.w.volumes.chord,0);
  f.tick(23);f.edit('E3');f.tick(31);assert.equal(f.state.playingPhraseIds.chord,null);
  const joined=f.tick(32);assert.equal(f.editor.isPlaying(),true);assert.equal(f.state.trackPositions.chord.startStep,32);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.equal(f.state.trackPositions.bass.startStep,16);
  assert.deepEqual(joined.releaseTrackIds,[]);assert.equal(f.events(joined,32).find(e=>e.trackId==='chord').notes[0],'E3');
  f.edit('F3');const edited=f.tick(33);assert.deepEqual(edited.releaseTrackIds,['chord']);assert.equal(f.state.trackPositions.chord.startStep,32);
  assert.equal(f.changes.length,1);assert.equal(f.plays,1);
});

test('same-track creation keeps the old phrase until the first note reaches the bar boundary',async()=>{
  const f=fixture();f.start('bass');await ready();f.tick(0);f.tick(5);f.start('drums');f.tick(16);f.tick(20);
  f.blank('bass');const blank=f.tick(21);assert.equal(f.state.playingPhraseIds.bass,'bass-old');assert.deepEqual(blank.releaseTrackIds,[]);
  f.edit('D2');f.tick(31);assert.equal(f.state.playingPhraseIds.bass,'bass-old');
  const joined=f.tick(32);assert.deepEqual(joined.releaseTrackIds,['bass']);assert.equal(f.state.trackPositions.bass.startStep,32);
  assert.equal(f.state.trackPositions.drums.startStep,16);assert.equal(f.state.playingPhraseIds.bass,'bass-new');
});

test('clearing before entry restores the old selection, including an already prepared replacement and stale callback',async()=>{
  for(const prepare of [false,true]) {
    const f=fixture();f.start('bass');await ready();f.tick(0);f.tick(5);f.blank('bass');f.edit('D2');
    const prepared=prepare?f.read(16):null;f.edit(null);prepared?.onAudible();
    assert.equal(f.w.selection.bass,'bass-old');assert.equal(f.state.playingPhraseIds.bass,'bass-old');
    const source=f.tick(prepare?17:16);assert.equal(f.state.trackPositions.bass.startStep,0);assert.equal(f.state.queuedPhraseIds,null);
    assert.equal(f.events(source,prepare?17:16).find(e=>e.trackId==='bass').note,'C2');
    f.edit('E2');f.tick(32);assert.equal(f.state.playingPhraseIds.bass,'bass-new');
  }
});

test('clearing after entry stops only the new track and restoring notes rejoins without manual pause',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('D3');f.tick(16);f.tick(20);
  f.edit(null);const cleared=f.tick(21);assert.equal(f.state.playingPhraseIds.chord,null);assert.deepEqual(cleared.releaseTrackIds,['chord']);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.equal(f.playback.isActive(),true);assert.equal(f.w.templates.chord.at(-1).id,'chord-new');
  f.edit('D3');f.tick(32);assert.equal(f.state.trackPositions.chord.startStep,32);assert.equal(f.plays,1);
});

test('a full pattern change restarts only its track at the next bar and queued edits do not rewrite the old audible pattern',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('C3');f.tick(16);f.tick(20);
  f.edit('D3',{restart:true});const old=f.tick(21);
  assert.equal(old.matrix.chord[0][0].notes[0],'C3');
  assert.equal(f.events(old,21).filter(e=>e.trackId==='chord').length,0,'the old one-note pattern still has its original rest at step 5');
  f.edit('E3',{restart:true});const wrapped=f.tick(31);assert.deepEqual(wrapped.releaseTrackIds,[]);assert.equal(wrapped.matrix.chord[0][0].notes[0],'C3');
  const start=f.tick(32);assert.equal(f.events(start,32).find(e=>e.trackId==='chord').notes[0],'E3');
  assert.equal(f.state.trackPositions.chord.startStep,32);assert.equal(f.state.trackPositions.drums.startStep,0);assert.deepEqual(start.releaseTrackIds,['chord']);
});

test('manual cancellation and per-track pause disarm automatic rejoining while updates and undo stay retained',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('D3');
  f.trigger('chord','chord-new');assert.equal(f.editor.getMode(),'mix');f.edit('E3');f.tick(16);
  assert.equal(f.state.playingPhraseIds.chord,null);assert.equal(f.state.playingPhraseIds.drums,'drums-old');
  f.trigger('chord','chord-new');f.tick(32);f.edit('F3');f.tick(33);assert.equal(f.state.trackPositions.chord.startStep,32);
  f.trigger('chord','chord-new');f.tick(34);f.edit('G3');f.tick(48);assert.equal(f.state.playingPhraseIds.chord,null);
  assert.equal(f.w.draft.bars[0][0].notes[0],'G3');assert.equal(f.plays,1);
});

test('master controls stop and restart the whole selected mix, with edits kept silent during the manual pause',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('D3');f.tick(16);
  f.editor.toggleEditor(f.w.draft);assert.equal(f.playback.isActive(),false);f.edit('E3');assert.equal(f.plays,1);
  f.editor.toggleEditor(f.w.draft);await ready();f.tick(0);
  assert.deepEqual(f.state.playingPhraseIds,{drums:'drums-old',chord:'chord-new',bass:null,melody:null});
  f.editor.pause();f.editor.release();assert.equal(f.playback.isActive(),false);
});

test('switching blank mix editors preserves prior queues and closing does not requeue them',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('D3');
  f.blank('melody');f.tick(8);f.edit('E4');const versions=f.state.requestVersion;f.editor.release();
  assert.equal(f.state.queuedPhraseIds.chord,'chord-new');assert.equal(f.state.queuedPhraseIds.melody,'melody-new');
  const joined=f.tick(16);assert.equal(f.state.trackPositions.drums.startStep,0);assert.equal(f.state.trackPositions.chord.startStep,16);
  assert.equal(f.state.trackPositions.melody.startStep,16);assert.equal(f.state.requestVersion,versions);assert.deepEqual(joined.releaseTrackIds,[]);
});

test('mix editing during sample preparation retains the original startup and both pending track requests',async()=>{
  const f=fixture();let finish;f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  f.start('drums');const before=f.counts();f.blank('chord');f.edit('D3');f.editor.release();
  assert.deepEqual(f.counts(),before);finish();await ready();const joined=f.tick(0);
  assert.equal(f.state.playingPhraseIds.drums,'drums-old');assert.equal(f.state.playingPhraseIds.chord,'chord-new');
  assert.deepEqual(joined.releaseTrackIds,[]);assert.equal(f.plays,1);
});

test('deleting a mix-edited phrase or another track cannot stop unrelated sounding tracks',async()=>{
  for(const target of ['chord','bass']) {
    const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.start('bass');f.tick(16);
    f.blank('chord');f.edit('D3');f.tick(32);f.tick(35);
    const id=target==='chord'?'chord-new':'bass-old';
    assert.equal(deleteJamTemplate({projectStore:f.store,playback:f.playback,audition:f.editor,trackId:target,templateId:id}),true);
    const next=f.tick(36);assert.equal(f.state.playingPhraseIds.drums,'drums-old');assert.equal(f.state.trackPositions.drums.startStep,0);
    assert.deepEqual(next.releaseTrackIds,[target]);assert.equal(f.plays,1);
  }
});

test('column buttons keep their atomic play/pause behavior while a mix editor is open',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('D3');f.tick(16);
  f.column(0);f.tick(32);assert.deepEqual(f.state.playingPhraseIds,Object.fromEntries(tracks.map(t=>[t,`${t}-old`])));
  f.column(0);assert.equal(f.playback.isActive(),false);f.edit('E3');assert.equal(f.plays,1);
  f.column(0);await ready();f.tick(0);assert.equal(f.state.playingPhraseIds.chord,'chord-old');
});

test('another track waiting to enter keeps its boundary when creating, editing and closing a new phrase',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.start('bass');
  f.blank('chord');f.edit('D3');f.tick(10);f.edit('E3');f.editor.release();
  assert.equal(f.state.queuedPhraseIds.bass,'bass-old');f.tick(15);assert.equal(f.state.playingPhraseIds.bass,null);
  const joined=f.tick(16);assert.equal(f.state.trackPositions.bass.startStep,16);assert.equal(f.state.trackPositions.chord.startStep,16);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.deepEqual(joined.releaseTrackIds,[]);assert.equal(f.plays,1);
});

test('loading failure and explicit stop prevent mix edits or stale callbacks from starting playback again',async()=>{
  const f=fixture();f.audio.play=async()=>{throw new Error('sample failed');};
  f.start('drums');f.blank('chord');f.edit('D3');await ready();assert.equal(f.state.mode,'stopped');
  f.editor.pause({stop:false});f.edit('E3');assert.equal(f.playback.isActive(),false);
  const g=fixture();g.start('drums');await ready();g.tick(0);g.tick(5);g.blank('chord');g.edit('D3');const prepared=g.read(16);
  g.editor.pause();g.edit('E3');prepared.onAudible();assert.equal(g.state.mode,'stopped');assert.equal(g.plays,1);
});

test('updates to an already prepared same-ID pattern restart preserve the old pattern until the newest request is audible',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('C3');f.tick(16);f.tick(20);
  f.edit('D3',{restart:true});const prepared=f.read(32);f.edit('E3',{restart:true});prepared.onAudible();
  assert.equal(f.playback.getProgress().snapshot.matrix.chord[0][0].notes[0],'C3');
  const latest=f.tick(33);assert.equal(latest.matrix.chord[0][0].notes[0],'E3');assert.equal(f.state.trackPositions.chord.startStep,32);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.deepEqual(latest.releaseTrackIds,['chord']);
});

test('pausing the last other track explicitly also prevents a blank editor from starting a new clock on subsequent edits',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');
  f.trigger('drums','drums-old');f.tick(6);assert.equal(f.playback.isActive(),false);
  f.edit('D3');assert.equal(f.playback.isActive(),false);assert.equal(f.plays,1);assert.equal(f.w.selection.chord,null);
});

test('an explicit internal solo request still restores a manually restarted mix',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('D3');
  f.trigger('chord','chord-new');f.editor.open(f.w.templates.bass[0],{mode:'solo'});const solo=f.tick(6);
  assert.equal(f.editor.getMode(),'solo');assert.equal(f.solo,true);assert.ok(f.events(solo,6).every(e=>e.trackId==='bass'));
  f.editor.release();f.tick(7);assert.equal(f.state.playingPhraseIds.drums,'drums-old');
  f.blank('melody');f.editor.toggleEditor(f.w.draft);f.editor.toggleEditor(f.w.draft);await ready();f.tick(0);
  f.editor.open(f.w.templates.bass[0],{mode:'solo'});f.tick(1);f.editor.release();f.tick(2);
  assert.equal(f.state.playingPhraseIds.drums,'drums-old');assert.equal(f.playback.isActive(),true);
});

test('pausing a sounding gem with its same-ID pattern restart pending stops both instead of merely cancelling the restart',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.blank('chord');f.edit('C3');f.tick(16);f.tick(20);
  f.edit('D3',{restart:true});const prepared=f.read(32);f.trigger('chord','chord-new');prepared.onAudible();
  const paused=f.tick(33);assert.equal(f.state.playingPhraseIds.chord,null);assert.equal(f.state.queuedPhraseIds,null);
  assert.deepEqual(paused.releaseTrackIds,['chord']);assert.equal(f.state.trackPositions.drums.startStep,0);
  f.edit('E3');f.tick(48);assert.equal(f.state.playingPhraseIds.chord,null);assert.equal(f.plays,1);
});

test('editing a sounding existing phrase leaves the full mix playing and knob changes restart only that track at the bar',async()=>{
  const f=fixture();f.start('bass');await ready();f.tick(0);f.tick(5);f.start('drums');f.tick(16);f.tick(20);
  const before=f.counts(),selection={...f.w.selection};f.existing('bass');const opened=f.tick(21);
  assert.equal(f.editor.getMode(),'mix');assert.equal(f.editor.isPlaying(),true);assert.equal(f.solo,false);
  assert.deepEqual(f.counts(),before);assert.deepEqual(f.w.selection,selection);assert.deepEqual(opened.releaseTrackIds,[]);
  assert.equal(f.state.trackPositions.bass.startStep,0);assert.equal(f.state.trackPositions.drums.startStep,16);
  f.edit('D2',{restart:true});f.tick(31);assert.equal(f.state.trackPositions.bass.startStep,0);
  const changed=f.tick(32);assert.equal(f.state.trackPositions.bass.startStep,32);assert.equal(f.state.trackPositions.drums.startStep,16);
  assert.deepEqual(changed.releaseTrackIds,['bass']);assert.equal(f.events(changed,32).find(e=>e.trackId==='bass').note,'D2');
  f.editor.release();assert.equal(f.playback.isActive(),true);assert.deepEqual(f.tick(33).releaseTrackIds,[]);assert.deepEqual(f.counts(),before);
});

test('editing an existing inactive phrase does not change the mix until a musical edit queues its own track',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.start('bass');f.tick(16);f.tick(20);
  const before={...f.w.selection};f.existing('chord');const opened=f.tick(21);
  assert.equal(f.editor.isPlaying(),false);assert.equal(f.state.queuedPhraseIds,null);assert.deepEqual(f.w.selection,before);
  assert.deepEqual(opened.releaseTrackIds,[]);assert.equal(f.state.playingPhraseIds.drums,'drums-old');assert.equal(f.state.playingPhraseIds.bass,'bass-old');
  f.edit('E3',{restart:true});assert.equal(f.state.queuedPhraseIds.chord,'chord-old');assert.equal(f.w.selection.chord,'chord-old');
  const joined=f.tick(32);assert.equal(f.state.trackPositions.chord.startStep,32);assert.equal(f.state.trackPositions.bass.startStep,16);
  assert.equal(f.state.trackPositions.drums.startStep,0);assert.deepEqual(joined.releaseTrackIds,[]);assert.equal(f.plays,1);
});

test('switching between existing phrase editors preserves the mix and both independently pending knob changes',async()=>{
  const f=fixture();f.start('drums');await ready();f.tick(0);f.tick(5);f.start('bass');f.tick(16);f.tick(20);
  f.existing('bass');f.edit('D2',{restart:true});f.existing('drums');const switched=f.tick(21);
  assert.equal(f.solo,false);assert.deepEqual(switched.releaseTrackIds,[]);assert.equal(f.state.queuedPhraseIds.bass,'bass-old');
  f.edit('C3',{restart:true});f.editor.release();const at32=f.tick(32);
  assert.equal(f.state.trackPositions.drums.startStep,32);assert.equal(f.state.trackPositions.bass.startStep,32);
  assert.equal(f.state.playingPhraseIds.drums,'drums-old');assert.equal(f.state.playingPhraseIds.bass,'bass-old');assert.equal(f.plays,1);
  assert.deepEqual(new Set(at32.releaseTrackIds),new Set(['drums','bass']));
});
