import test from 'node:test';
import assert from 'node:assert/strict';
import { JAM_PAD_LAYOUT } from '../src/input/jamPadLayout.js';
import { createPerformanceMidiInput, JAM_VOLUME_STEPS, JAM_FILTER_STEPS, JAM_REVERB_STEPS } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { createJamEffects } from '../src/app/jamEffects.js';

const positions = {
  drums: [81,82,83,84,71,72,73,74], chord: [85,86,87,88,75,76,77,78],
  bass: [61,62,63,64,51,52,53,54], melody: [65,66,67,68,55,56,57,58],
};
const templates = Object.fromEntries(Object.keys(positions).map(track => [track,
  Array.from({length: 8}, (_, i) => ({ id: `${track}-${i}` }))]));
const light = (frame, n, status = 0x90) => frame.find(m => m[0] === status && m[1] === n)?.[2];
const surface = { version: 5, templates, status: {mode:'jam'} };

test('fixed Jam layout covers all 64 pads once and all 32 quadrant slots match input and LEDs', () => {
  assert.equal(JAM_PAD_LAYOUT.length, 64);
  assert.equal(new Set(JAM_PAD_LAYOUT.map(p => p.note)).size, 64);
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
    assert.notEqual(light(selected,note), light(playing,note));
    assert.equal(selected.length,80);
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
    else if (command.type==='repeat') command.pressed ? fx.repeat.press(command.token,command.division,120) : fx.repeat.release(command.token);
    else if (command.type==='chopper'||command.type==='brake') command.pressed ? fx.press(command.type,command.token,command.value,120) : fx.release(command.type,command.token);
    else if (command.type==='reverb') fx.reverb(command.value);
    else if (command.type==='volume'||command.type==='cutoff') fx.getSnapshot().selectedTracks.forEach(t=>fx[command.type](t,command.value));
  };
  const send=(note,pressed=true,cc=false)=>dispatch(input.handle([cc?0xb0:pressed?0x90:0x80,note,pressed?127:0],templates,{...surface,effectPage:'arp'}));
  send(89,true,true);send(69,true,true);
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
