import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamAudition } from '../src/app/jamAudition.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { getJamPitchedPreset } from '../src/app/jamPitchedPresets.js';

const ready = () => new Promise(resolve => setImmediate(resolve));
const tracks = ['drums','chord','bass','melody'];
function phrase(track, bars = 4) {
  return { id: `${track}-saved`, trackId: track,
    bars: Array.from({length:bars}, (_, bar) => Array.from({length:16}, (_, step) => step !== 0 ? null
      : track === 'drums' ? {instruments:['kick']} : {type:'notes',notes:[['C3','D3','E3','F3'][bar%4]],noteDurationSteps:{[['C3','D3','E3','F3'][bar%4]]:1}})) };
}
function fixture() {
  const drafts = Object.fromEntries(tracks.map(t => [t,phrase(t)]));
  const w = {bpm:100,templates:Object.fromEntries(tracks.map(t=>[t,[drafts[t]]])),selection:Object.fromEntries(tracks.map(t=>[t,null]))};
  const notices=[]; let options, absolute=0, plays=0, solo=false;
  const audio={async play(value){options=value;plays++;return true;},stop(){},stopAllVoices(){},setTempo(){},resetPerformanceEffects(){},getAbsolutePlaybackStep:()=>absolute};
  const playback=createSessionPlayback(audio,value=>notices.push(value));
  const editor=createJamAudition(playback,{readWorkspace:()=>w,readDraft:()=>drafts.drums,onSoloChange:value=>{solo=value;}});
  const read=step=>{absolute=step;return options.playbackSource(step,step*.15);};
  return {w,drafts,playback,editor,audio,read,get plays(){return plays;},get solo(){return solo;},get state(){return notices.at(-1);},
    tick(step){const source=read(step);source.onAudible?.();return source;},
    events(source,step){return createMatrixPlaybackAdapter(source,{totalBars:source.totalBars}).getEventsForFlatStep(step);}};
}

for (const track of tracks) test(`${track}: opening the editor starts only its full phrase and closing restores stopped transport`,async()=>{
  const f=fixture();f.editor.open(f.drafts[track]);await ready();
  const first=f.tick(0);assert.equal(f.editor.isPlaying(),true);assert.equal(f.plays,1);
  assert.ok(f.events(first,0).every(event=>event.trackId===track));
  assert.equal(f.state.trackPositions[track].localStep,0);
  f.tick(63);f.tick(64);assert.equal(f.state.trackPositions[track].bar,0);
  assert.equal(f.state.trackPositions[track].editorRevision,f.editor.getRevision());
  f.editor.release();assert.equal(f.playback.isActive(),false);
});

test('a blank editor is silent, first note starts it, deleting all notes silences it, and new notes restart it',async()=>{
  const f=fixture(), blank={trackId:'bass',bars:[Array(16).fill(null)]};
  f.editor.open(blank);await ready();assert.equal(f.plays,0);assert.equal(f.editor.isPlaying(),false);
  const note={...blank,bars:[[{type:'bass',note:'C2'},...Array(15).fill(null)]]};
  f.editor.update(note);await ready();assert.equal(f.events(f.tick(0),0).length,1);
  f.tick(5);f.editor.update(blank);const silent=f.tick(6);
  assert.equal(f.events(silent,6).length,0);assert.equal(f.editor.isPlaying(),false);
  assert.deepEqual(silent.releaseTrackIds,['bass']);
  f.editor.update(note);const restarted=f.tick(7);
  assert.equal(f.state.trackPositions.bass.localStep,0);assert.equal(f.events(restarted,7).length,1);
  assert.equal(f.plays,1);
});

test('manual edits and undo preserve phase, full template changes restart even with the same phrase ID',async()=>{
  const f=fixture(), original=f.drafts.chord;f.editor.open(original);await ready();f.tick(0);f.tick(23);
  const manual=structuredClone(original);manual.bars[1][8]={type:'notes',notes:['G3']};
  f.editor.update(manual);const edited=f.tick(24);
  assert.equal(f.state.trackPositions.chord.localStep,24);assert.equal(f.events(edited,24)[0].notes[0],'G3');
  f.editor.update(original);f.tick(25);assert.equal(f.state.trackPositions.chord.localStep,25);
  f.editor.update(original,{restart:true});f.tick(26);
  assert.equal(f.state.trackPositions.chord.localStep,0);assert.equal(f.state.trackPositions.chord.bar,0);
});

for(const track of tracks)test(`${track}: solo macro updates preserve the audible loop origin and local step`,async()=>{
  const f=fixture();f.editor.open(f.drafts[track]);await ready();f.tick(0);f.tick(23);
  const changed=structuredClone(f.drafts[track]);changed.bars=changed.bars.slice(0,1);
  f.editor.update(changed);f.tick(24);
  assert.equal(f.state.trackPositions[track].startStep,0);
  assert.equal(f.state.trackPositions[track].localStep,24);
  assert.equal(f.state.trackPositions[track].step,8);assert.equal(f.plays,1);
});

test('real imported chord variants are heard from their first bar after a same-ID template switch',async()=>{
  for(const [strength,groove] of [[0,20],[25,0]]) {
    const f=fixture();f.editor.open(f.drafts.chord);await ready();f.tick(0);f.tick(23);
    const draft={...f.drafts.chord,...getJamPitchedPreset('chord',strength,groove),id:'chord-saved',trackId:'chord'};
    const before=structuredClone(draft);f.editor.update(draft,{restart:true});
    const actual=f.events(f.tick(24),24);
    const expectedSnapshot=jamCombinationSnapshot(f.w,draft,true);
    const expected=createMatrixPlaybackAdapter(expectedSnapshot,{totalBars:expectedSnapshot.totalBars}).getEventsForFlatStep(0);
    const musicalEvents = events => events.map(({bar,step,...event}) => { void [bar,step]; return event; });
    assert.deepEqual(musicalEvents(actual),musicalEvents(expected));assert.equal(f.state.trackPositions.chord.localStep,0);
    assert.deepEqual(draft,before,'playing a template cannot rewrite its notes or metadata');
  }
});

test('pause survives edits, undo, track switches and closing; explicit play restarts at the beginning',async()=>{
  const f=fixture();f.w.selection.bass=f.drafts.bass.id;f.playback.launch(jamCombinationSnapshot(f.w),100);await ready();f.tick(0);
  f.editor.open(f.drafts.chord);f.tick(1);f.editor.pause();
  const plays=f.plays;f.editor.update(f.drafts.chord,{restart:true});f.editor.open(f.drafts.melody);await ready();
  assert.equal(f.plays,plays);assert.equal(f.playback.isActive(),false);assert.equal(f.editor.isPlaying(),false);
  f.editor.toggleEditor(f.drafts.melody);await ready();f.tick(0);
  assert.equal(f.editor.isPlaying(),true);assert.equal(f.state.trackPositions.melody.localStep,0);
  f.editor.pause();f.editor.release();assert.equal(f.playback.isActive(),false,'closing cannot restore a mix explicitly paused by the user');
});

test('switching editor tracks never briefly restores the background mix and preserves its underlying origins',async()=>{
  const f=fixture();f.w.selection.bass=f.drafts.bass.id;f.playback.launch(jamCombinationSnapshot(f.w),100);await ready();f.tick(0);f.tick(5);
  f.editor.open(f.drafts.chord);f.tick(6);f.editor.open(f.drafts.melody);const switched=f.tick(7);
  assert.ok(f.events(switched,7).every(event=>event.trackId==='melody'));
  assert.equal(f.state.trackPositions.melody.localStep,0);assert.equal(f.state.trackPositions.bass,undefined);
  f.editor.release();f.tick(8);
  assert.equal(f.state.trackPositions.bass.localStep,8);assert.equal(f.plays,1);
});

test('background queued launches cannot block edits or truncate an editor tail, and resume at their own elapsed positions',async()=>{
  const f=fixture();f.w.selection.bass=f.drafts.bass.id;f.playback.launch(jamCombinationSnapshot(f.w),100);await ready();f.tick(0);f.tick(5);
  f.playback.toggleTrack(jamCombinationSnapshot({...f.w,selection:{chord:f.drafts.chord.id}}),'chord',100);
  f.editor.open(f.drafts.chord);f.tick(6);f.tick(15);
  const boundary=f.tick(16);assert.deepEqual(boundary.releaseTrackIds,[]);
  assert.equal(f.state.queuedPhraseIds.chord,'chord-saved');
  const changed=structuredClone(f.drafts.chord);changed.bars[0][0]={type:'notes',notes:['A3']};
  f.editor.update(changed,{restart:true});const updated=f.tick(17);
  assert.equal(f.events(updated,17)[0].notes[0],'A3');
  assert.equal(f.state.trackPositions.chord.localStep,0);
  f.editor.release();f.tick(18);
  assert.equal(f.state.trackPositions.bass.localStep,18);assert.equal(f.state.trackPositions.chord.localStep,2);
  assert.equal(f.state.queuedPhraseIds,null);assert.equal(f.plays,1);
});

test('late overlay callbacks cannot replace a newer edit or revive a paused editor',async()=>{
  const f=fixture();f.editor.open(f.drafts.chord);await ready();f.tick(0);
  const old=f.read(4);f.editor.update(f.drafts.chord,{restart:true});old.onAudible();
  assert.notEqual(f.state.trackPositions?.chord?.editorRevision,f.editor.getRevision());
  const current=f.tick(5);assert.equal(f.state.trackPositions.chord.editorRevision,f.editor.getRevision());
  old.onAudible();assert.equal(f.state.trackPositions.chord.localStep,0);
  f.editor.pause();current.onAudible();assert.equal(f.state.mode,'stopped');assert.equal(f.editor.isPlaying(),false);
});

test('cancelling while preparing audio invalidates startup; loading errors leave editing paused until explicit play',async()=>{
  const f=fixture();let finish;f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  f.editor.open(f.drafts.chord);f.editor.release();finish();await ready();assert.equal(f.plays,0);
  const g=fixture();g.audio.play=async()=>{throw new Error('samples unavailable');};g.editor.open(g.drafts.chord);await ready();
  assert.equal(g.state.error,'samples unavailable');g.editor.pause({stop:false});g.editor.update(g.drafts.chord);
  assert.equal(g.playback.isActive(),false);assert.equal(g.state.error,'samples unavailable');
});
