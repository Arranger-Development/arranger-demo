import test from 'node:test';
import assert from 'node:assert/strict';
import { JAM_PAD_LAYOUT } from '../src/input/jamPadLayout.js';
import { createPerformanceMidiInput, JAM_VOLUME_STEPS, JAM_FILTER_STEPS, JAM_REVERB_STEPS } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { createJamEffects } from '../src/app/jamEffects.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { toggleJamTemplate } from '../src/app/jamTemplateSelection.js';
import { jamTemplatePage } from '../src/app/jamTemplateSlots.js';

const positions = {
  drums: [81,82,83,84,85,86,87,88], chord: [71,72,73,74,75,76,77,78],
  bass: [61,62,63,64,65,66,67,68], melody: [51,52,53,54,55,56,57,58],
};
const templates = Object.fromEntries(Object.keys(positions).map(track => [track,
  Array.from({length: 8}, (_, i) => ({ id: `${track}-${i}` }))]));
const light = (frame, n, status = 0x90) => frame.find(m => m[0] === status && m[1] === n)?.[2];
const surface = { version: 5, templates, status: {mode:'jam'} };

test('fixed Jam layout covers all 64 pads once and all four phrase rows match input and LEDs', () => {
  assert.equal(JAM_PAD_LAYOUT.length, 64);
  assert.equal(new Set(JAM_PAD_LAYOUT.map(p => p.note)).size, 64);
  assert.deepEqual(JAM_PAD_LAYOUT.map(p=>p.note).sort((a,b)=>a-b),
    Array.from({length:8},(_,row)=>Array.from({length:8},(_,col)=>(row+1)*10+col+1)).flat());
  const input = createPerformanceMidiInput();
  for (const [trackId, notes] of Object.entries(positions)) for (const [index, note] of notes.entries()) {
    assert.deepEqual(input.handle([0x90,note,127], templates, surface), {type:'template',trackId,templateId:`${trackId}-${index}`});
    assert.equal(input.handle([0x90,note,60], templates, surface), null);
    assert.equal(input.handle([0x80,note,0], templates, surface), null);
    const idle = createLaunchpadXPerformanceLedFrame({...surface, status:{mode:'stopped'}});
    const selected = createLaunchpadXPerformanceLedFrame({...surface, status:{mode:'stopped'}, selection:{[trackId]:`${trackId}-${index}`}});
    const playing = createLaunchpadXPerformanceLedFrame({...surface, selection:{[trackId]:`${trackId}-${index}`}, beatPhase:.75});
    assert.notEqual(light(idle,note), 0);
    assert.notEqual(light(idle,note), light(selected,note));
    assert.equal(light(selected,note), light(playing,note), 'playing pads stay steady instead of flashing');
    assert.equal(selected.length,80);
  }
});

function livePadFixture() {
  const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=createJamTemplateProjects(storage,'pop',null,100), phrases={};
  for(const track of Object.keys(positions)) phrases[track]=[0,4,8,16,31].map(slot=>store.saveTemplate({trackId:track,targetSlot:slot,
    bars:[Array.from({length:16},(_,i)=>i===0?track==='drums'?{instruments:['kick']}:track==='bass'?{type:'bass',note:'C2'}:{type:'notes',notes:['C4']}:null)]},`${track}-${slot}`));
  let options, absolute=0, status, plays=0, bank=0;
  const playback=createSessionPlayback({async play(o){options=o;plays++;return true;},stop(){},stopAllVoices(){},setTempo(){},getAbsolutePlaybackStep:()=>absolute},next=>{status=next;});
  const input=createPerformanceMidiInput(), audition={getTrack:()=>null,release(){}};
  const visible=()=>Object.fromEntries(Object.keys(positions).map(t=>[t,jamTemplatePage(store.current().workspace.templates[t],bank)]));
  function command(note) {
    const result=input.handle([0x90,note,127],visible(),{version:5});
    input.handle([0x80,note,0],visible(),{version:5});return result;
  }
  return {store,phrases,playback,command,setBank:value=>{bank=value;},
    get status(){return status;},get plays(){return plays;},
    press(note){const cmd=command(note);if(cmd?.type==='template')toggleJamTemplate({projectStore:store,playback,audition,trackId:cmd.trackId,templateId:cmd.templateId});return cmd;},
    tick(step){absolute=step;const value=options.playbackSource(step,step*.15);value.onAudible?.();return value;},
    lights(phase){return createLaunchpadXPerformanceLedFrame({...surface,templates:visible(),status,beatPhase:phase});},
  };
}

test('four physical rows layer, pause and replace only their own track through the shared playback path',async()=>{
  const f=livePadFixture();f.press(81);await new Promise(resolve=>setImmediate(resolve));f.tick(0);f.tick(5);
  for(const note of [61,71,51])f.press(note);
  assert.equal(light(f.lights(.1),81),17,'the drum continues steadily while three other rows wait');
  for(const note of [61,71,51])assert.notEqual(light(f.lights(.1),note),light(f.lights(.8),note));
  f.tick(16);
  for(const [note,color] of [[81,17],[71,9],[61,41],[51,49]])assert.equal(light(f.lights(.1),note),color);
  f.press(61);assert.equal(f.status.playingPhraseIds.bass,f.phrases.bass[0].id);
  assert.deepEqual(f.tick(17).releaseTrackIds,['bass']);assert.equal(f.status.playingPhraseIds.bass,null);
  assert.equal(f.status.trackPositions.drums.startStep,0);assert.equal(f.status.trackPositions.chord.startStep,16);
  f.press(85);assert.equal(f.status.queuedPhraseIds.drums,f.phrases.drums[1].id);
  f.press(85);assert.equal(f.status.queuedPhraseIds,null,'repeating a waiting pad cancels without stopping the original');
  assert.equal(f.status.playingPhraseIds.drums,f.phrases.drums[0].id);
  f.press(85);f.tick(32);
  assert.equal(f.status.playingPhraseIds.drums,f.phrases.drums[1].id);
  assert.equal(f.status.trackPositions.drums.startStep,32);
  for(const track of ['chord','melody'])assert.equal(f.status.trackPositions[track].startStep,16);
  assert.equal(f.plays,1);
});

test('every row follows global slots through eight-column banks, whole-column ordering, deletion and holes',()=>{
  const f=livePadFixture();
  assert.equal(f.store.moveSlots({trackId:null,from:0,to:31}),true);
  f.setBank(1);
  for(const [track,notes] of Object.entries(positions)) {
    assert.equal(f.command(notes[0]),null,'empty global slot 8 stays inert');
    assert.equal(f.command(notes[7]).templateId,f.phrases[track][3].id,'global slot 15 contains the shifted phrase from slot 16');
  }
  f.setBank(3);
  for(const [track,notes] of Object.entries(positions)) {
    assert.equal(f.command(notes[7]).templateId,f.phrases[track][0].id);
    f.store.removeTemplate(track,f.phrases[track][4].id);
    assert.equal(f.command(notes[6]).templateId,f.phrases[track][0].id,'deleted slot compacts within this row');
    assert.equal(f.command(notes[7]),null);
  }
});

test('row layout retains bank, save and transport controls without assigning unused side keys',()=>{
  const input=createPerformanceMidiInput();
  for(const [cc,expected] of [[93,{type:'page',delta:-1}],[94,{type:'page',delta:1}],[97,{type:'save'}],[98,{type:'togglePlayback'}]]) {
    assert.deepEqual(input.handle([0xb0,cc,127],templates,surface),expected);
    assert.equal(input.handle([0xb0,cc,0],templates,surface),null);
  }
  input.reset();assert.deepEqual(input.handle([0xb0,98,127],templates,surface),{type:'togglePlayback'});
});

test('audible phrase LEDs stay steady while queued phrase LEDs pulse independently', () => {
  const bright={drums:17,chord:9,bass:41,melody:49};
  for(const [track,notes] of Object.entries(positions)) {
    const status={mode:'jam',playingPhraseIds:{[track]:`${track}-3`},queuedPhraseIds:{[track]:`${track}-4`}};
    const first=createLaunchpadXPerformanceLedFrame({...surface,status,beatPhase:.1});
    const second=createLaunchpadXPerformanceLedFrame({...surface,status,beatPhase:.8});
    assert.equal(light(first,notes[3]),bright[track]);
    assert.equal(light(first,notes[3]),light(second,notes[3]));
    assert.notEqual(light(first,notes[4]),light(second,notes[4]));
    const committed={...status,playingPhraseIds:status.queuedPhraseIds,queuedPhraseIds:null};
    assert.equal(light(createLaunchpadXPerformanceLedFrame({...surface,status:committed,beatPhase:.1}),notes[4]),bright[track]);
    assert.equal(light(createLaunchpadXPerformanceLedFrame({...surface,status:committed,beatPhase:.8}),notes[4]),bright[track]);
  }
});
test('eight fixed levels ignore onscreen effect page; old page CCs remain off and inert', () => {
  for (const effectPage of ['mix','expression','arp']) {
    const input = createPerformanceMidiInput(), s = {...surface,effectPage};
    for (const [type, first, values] of [['reverb',41,JAM_REVERB_STEPS], ['cutoff',31,JAM_FILTER_STEPS], ['volume',21,JAM_VOLUME_STEPS]]) {
      for (const [index,value] of values.entries()) {
        assert.deepEqual(input.handle([0x90,first+index,127],templates,s),{type,value});
        assert.equal(input.handle([0x80,first+index,0],templates,s),null);
      }
    }
    const frame = createLaunchpadXPerformanceLedFrame(s);
    for (const cc of [49,39,29,19]) {
      assert.equal(input.handle([0xb0,cc,127],templates,s),null);
      assert.equal(light(frame,cc,0xb0),0);
    }
    assert.deepEqual(frame, createLaunchpadXPerformanceLedFrame({...s,effectPage:'mix'}));
  }
});
test('paging, insertion and deletion follow the existing per-track array without sorting or filling holes', () => {
  const raw = Object.fromEntries(Object.keys(positions).map(t => [t,Array.from({length:11},(_,i)=>({id:`${t}-${i}`}))]));
  const before = structuredClone(raw), input=createPerformanceMidiInput();
  const page = Object.fromEntries(Object.entries(raw).map(([t,list])=>[t,list.slice(8,16)]));
  for (const [track,notes] of Object.entries(positions)) for (const [i,note] of notes.entries()) {
    assert.equal(input.handle([0x90,note,127],page,surface)?.templateId ?? null, i<3?`${track}-${i+8}`:null);
    input.handle([0x80,note,0],page,surface);
  }
  const emptyFrame = createLaunchpadXPerformanceLedFrame({...surface,templates:{}});
  for (const notes of Object.values(positions)) for (const note of notes) assert.notEqual(light(emptyFrame,note),0);
  assert.deepEqual(raw,before);
  page.drums.splice(0,1); page.drums.push({id:'new'});
  assert.equal(input.handle([0x90,81,127],page,surface).templateId,'drums-9');
  input.handle([0x80,81,0],page,surface);
  assert.equal(input.handle([0x90,83,127],page,surface).templateId,'new');
  assert.notEqual(light(createLaunchpadXPerformanceLedFrame({...surface,templates:page}),81),light(emptyFrame,81));
  assert.equal(light(createLaunchpadXPerformanceLedFrame({...surface,templates:page}),84),light(emptyFrame,84));
});
test('selected-track LEDs show parameter levels and bottom holds disable when stopped or without targets', () => {
  const s={...surface,selectedTrack:'bass',selectedTracks:['drums','bass'],volumes:{bass:-9},cutoffs:{bass:1000},reverbs:{bass:3/7},repeat:8,choppers:{bass:16},brakes:{bass:1}};
  const frame=createLaunchpadXPerformanceLedFrame(s);
  for (const note of [44,34,24]) assert.equal(light(frame,note),41);
  assert.equal(light(frame,12),41); assert.equal(light(frame,16),3); assert.equal(light(frame,18),3);
  for (const extra of [{status:{mode:'stopped'}},{status:{mode:'jam',loading:true}},{selectedTracks:[]}]) {
    const frame=createLaunchpadXPerformanceLedFrame({...s,...extra});
    for(let n=11;n<=18;n++) assert.equal(light(frame,n),0);
  }
});
test('hold commands retain ownership across simultaneous presses, page changes and release/reset', () => {
  const input=createPerformanceMidiInput(),fx=createJamEffects({setPerformanceEffect(){}});
  const dispatch = command => {
    if (!command) return;
    if (command.type==='selectTrack') fx.select(command.trackId,command.additive);
    else if (command.type==='toggleTrack') fx.toggleTrack(command.trackId);
    else if (command.type==='repeat') command.pressed ? fx.repeat.press(command.token,command.division,120) : fx.repeat.release(command.token);
    else if (command.type==='chopper'||command.type==='brake') command.pressed ? fx.press(command.type,command.token,command.value,120) : fx.release(command.type,command.token);
    else if (command.type==='reverb') fx.reverb(command.value);
    else if (command.type==='volume'||command.type==='cutoff') fx.getSnapshot().selectedTracks.forEach(t=>fx[command.type](t,command.value));
  };
  const send=(note,pressed=true,cc=false)=>dispatch(input.handle([cc?0xb0:pressed?0x90:0x80,note,pressed?127:0],templates,{...surface,effectPage:'arp'}));
  send(69,true,true);send(69,false,true);
  assert.deepEqual(fx.getSnapshot().selectedTracks,['drums','bass']);
  send(48);send(32);send(26);
  for(const track of ['drums','bass']) { assert.equal(fx.getSnapshot().reverbs[track],1);assert.equal(fx.getSnapshot().cutoffs[track],250);assert.equal(fx.getSnapshot().volumes[track],-3); }
  assert.equal(fx.getSnapshot().reverbs.melody,0);
  send(11);send(12);send(11,false);send(16);send(18);
  assert.equal(fx.getSnapshot().repeats.bass,8);assert.equal(fx.getSnapshot().choppers.drums,16);assert.equal(fx.getSnapshot().brakes.bass,1);
  send(12,false);send(16,false);send(18,false);
  assert.equal(fx.getSnapshot().repeats.bass,null);assert.equal(fx.getSnapshot().choppers.drums,null);assert.equal(fx.getSnapshot().brakes.bass,0);
  for (const reason of ['stop','disconnect','mode-change']) {
    send(13);send(17);send(18);fx.resetHolds();input.reset();
    assert.equal(fx.getSnapshot().repeats.drums,null,reason); assert.equal(fx.getSnapshot().choppers.bass,null,reason);assert.equal(fx.getSnapshot().brakes.drums,0,reason);
    send(13,false);send(17,false);send(18,false);
  }
});

test('current Jam track keys toggle independently on single presses and LEDs match every selected target', () => {
  const input = createPerformanceMidiInput(), fx = createJamEffects({ setPerformanceEffect() {} });
  const trackKeys = { drums: 89, chord: 79, bass: 69, melody: 59 };
  const brightness = { drums: [19,17], chord: [11,9], bass: [43,41], melody: [51,49] };
  const send = (cc, value) => {
    const command = input.handle([0xb0, cc, value], templates, surface);
    if (command) {
      assert.equal(command.type, 'toggleTrack');
      fx.toggleTrack(command.trackId);
    }
    return command;
  };
  const click = (track, expected) => {
    const cc = trackKeys[track];
    assert.deepEqual(send(cc, 127), { type: 'toggleTrack', trackId: track });
    assert.equal(send(cc, 100), null, 'held-key updates must not toggle repeatedly');
    assert.equal(send(cc, 0), null, 'release must not toggle');
    assert.deepEqual(fx.getSnapshot().selectedTracks, expected);
    const frame = createLaunchpadXPerformanceLedFrame({ ...surface, ...fx.getSnapshot() });
    for (const [t, key] of Object.entries(trackKeys)) {
      assert.equal(light(frame, key, 0xb0), brightness[t][Number(expected.includes(t))]);
    }
    if (!expected.length) for (let note = 21; note <= 48; note++) {
      if (note % 10 >= 1 && note % 10 <= 8) assert.equal(light(frame, note), 0);
    }
  };
  click('bass', ['drums','bass']);
  click('chord', ['drums','bass','chord']);
  click('melody', ['drums','bass','chord','melody']);
  click('bass', ['drums','chord','melody']);
  click('drums', ['chord','melody']);
  click('chord', ['melody']);
  click('melody', []);
  click('drums', ['drums']);
});

test('hardware toggles share screen target state and deselection releases held effects', () => {
  const input = createPerformanceMidiInput(), fx = createJamEffects({ setPerformanceEffect() {} });
  fx.toggleTrack('bass'); // The same action as the screen's track button.
  fx.press('pitch', 'screen:pitch', 7, 100);
  fx.repeat.press('midi:repeat', 8, 100);
  fx.press('chopper', 'midi:chopper', 16, 100);
  const command = input.handle([0xb0, 69, 127], templates, surface);
  assert.deepEqual(command, { type: 'toggleTrack', trackId: 'bass' });
  fx.toggleTrack(command.trackId);
  assert.deepEqual(fx.getSnapshot().selectedTracks, ['drums']);
  for (const track of ['drums','bass']) {
    assert.equal(fx.getSnapshot().pitches[track], 0);
    assert.equal(fx.getSnapshot().repeats[track], null);
    assert.equal(fx.getSnapshot().choppers[track], null);
  }
  fx.reverb(0.5);
  assert.equal(fx.getSnapshot().reverbs.drums, 0.5);
  assert.equal(fx.getSnapshot().reverbs.bass, 0);
});
