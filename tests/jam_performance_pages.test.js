import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createPerformanceMidiInput } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { createJamEffects } from '../src/app/jamEffects.js';
import { createJamArpeggiator, parseArpNotes } from '../src/app/jamArpeggiator.js';
import { normalizeEffectAutomation, mergeEffectTake, effectLaneEvents } from '../src/app/effectAutomation.js';

const templates={drums:[{id:'d'}],melody:[{id:'m'}]};
test('only the middle two rows change pages and releases retain the pressed function',()=>{
  const input=createPerformanceMidiInput();
  for(const [cc,page] of [[49,'mix'],[39,'expression'],[29,'arp']]) assert.deepEqual(input.handle([0xb0,cc,127],templates),{type:'effectPage',page});
  const press=input.handle([0x90,41,127],templates,{effectPage:'expression'});
  assert.deepEqual(press,{type:'pitch',value:-12,token:'midi:note:41',pressed:true});
  assert.deepEqual(input.handle([0x80,41,0],templates,{effectPage:'arp'}),{...press,pressed:false});
  assert.equal(input.handle([0x90,41,127],templates,{effectPage:'arp'}).type,'arp');
  for(const page of ['mix','expression','arp']) {
    input.reset(); assert.equal(input.handle([0x90,81,127],templates,{effectPage:page}).type,'template');
    assert.equal(input.handle([0x90,11,127],templates,{effectPage:page}).type,'loop');
    assert.equal(input.handle([0x90,24,127],templates,{effectPage:page}).value,4);
    assert.equal(input.handle([0x90,28,127],templates,{effectPage:page}).type,'brake');
  }
  assert.equal(input.handle([0xb0,19,127],templates).type,'recordEffects');
});
test('track chord adds targets but the next ordinary track press returns to single selection',()=>{
  const input=createPerformanceMidiInput();
  assert.equal(input.handle([0xb0,89,127]).additive,false);
  assert.equal(input.handle([0xb0,69,127]).additive,true);
  input.handle([0xb0,89,0]);input.handle([0xb0,69,0]);
  assert.equal(input.handle([0xb0,59,127]).additive,false);
});
test('group effects target exactly selected tracks, old releases cannot stop newer presses, page changes release only pitch',()=>{
  const calls=[],fx=createJamEffects({setPerformanceEffect:(track,values)=>calls.push({track,values})});
  fx.select('bass',true); fx.setPage('expression');fx.press('pitch','old',-3,120);fx.press('pitch','new',7,120);
  fx.release('pitch','old');assert.equal(fx.getSnapshot().pitches.bass,7);assert.equal(fx.getSnapshot().pitches.melody,0);
  fx.press('chopper','chop',16,120);fx.repeat.press('repeat',8,120);fx.setPage('arp');
  assert.equal(fx.getSnapshot().pitches.bass,0);assert.equal(fx.getSnapshot().choppers.bass,16);assert.equal(fx.getSnapshot().repeats.drums,8);
  fx.select('melody');assert.equal(fx.getSnapshot().choppers.bass,null);assert.equal(fx.getSnapshot().repeats.drums,null);
  fx.press('brake','brake',1);fx.reset();assert.equal(fx.getSnapshot().brakes.melody,0);
  assert.ok(calls.every(c=>['bass','drums','melody'].includes(c.track)));
});
test('reverb is independent per track and mixed-target selection never changes stored values',()=>{
  const fx=createJamEffects({setPerformanceEffect(){}});fx.reverb(.5);fx.select('bass');fx.reverb(.8);fx.select('drums',true);
  assert.equal(fx.getSnapshot().reverbs.drums,.5);assert.equal(fx.getSnapshot().reverbs.bass,.8);
  fx.reverb(.3);assert.equal(fx.getSnapshot().reverbs.drums,.3);assert.equal(fx.getSnapshot().reverbs.bass,.3);
  fx.reset(true);assert.ok(Object.values(fx.getSnapshot().reverbs).every(v=>v===0));
});
test('LED pages retain templates and loops; unset arp pads are dark and record state is visible',()=>{
  const base={templates,sections:[{id:'loop'}],drafts:{draft:{selection:{}}},editingId:'draft',selectedTracks:['drums','bass'],selectedTrack:'bass',status:{mode:'jam'},arp:{presets:[['C4'],null],index:0,rate:16,order:'up',octave:0}};
  const frames=['mix','expression','arp'].map(effectPage=>createLaunchpadXPerformanceLedFrame({...base,effectPage}));
  const light=(f,type,n)=>f.find(m=>m[0]===type&&m[1]===n)[2];
  for(const f of frames) { assert.equal(light(f,0x90,81),light(frames[0],0x90,81));assert.equal(light(f,0x90,11),light(frames[0],0x90,11));assert.equal(light(f,0xb0,89),17);assert.equal(light(f,0xb0,69),41); }
  assert.equal(light(frames[2],0x90,41),3);assert.equal(light(frames[2],0x90,42),0);
  assert.equal(light(createLaunchpadXPerformanceLedFrame({...base,recording:{phase:'recording'}}),0xb0,19),5);
});
test('arp validates notes, schedules on audio subdivisions and does not return to the old held preset',async()=>{
  assert.deepEqual(parseArpNotes('G4 C4 E4 C4'),['C4','E4','G4']);assert.equal(parseArpNotes('C9'),null);
  const notes=[];let disposed=0;
  const arp=createJamArpeggiator({async createJamArpeggioVoice(){return{trigger:(...n)=>notes.push(n),dispose(){disposed++;}};}});
  assert.deepEqual(arp.getSnapshot().presets[0],['C4','E4','G4']);arp.configure(0,'C4 E4 G4');assert.equal(arp.configure(1,'D4 F4 A4'),false);
  await arp.press('old',0,'piano');arp.schedule(0,1,120);arp.schedule(1,1.125,120);
  assert.deepEqual(notes.map(n=>n[0]),['C4','E4']);assert.equal(notes[1][1],1.125);
  await arp.press('new',0,'piano');arp.release('old');arp.schedule(1,1.125,120);assert.equal(notes[2][0],'C4');
  arp.release('new');const count=notes.length;arp.schedule(2,1.25,120);assert.equal(notes.length,count);assert.equal(disposed,2);
});
test('arp load cancellation disposes obsolete voice without restarting and only one preset is configurable',async()=>{
  let complete,disposed=0;const arp=createJamArpeggiator({createJamArpeggioVoice:()=>new Promise(r=>complete=r)});
  arp.configure(0,'C4 E4 G4');const pending=arp.press('key',0,'piano');arp.release('key');complete({trigger(){assert.fail('late attack');},dispose(){disposed++;}});await pending;
  assert.equal(disposed,1);assert.equal(arp.getSnapshot().index,null);
  assert.equal(arp.configure(1,'D4'),false);assert.equal(arp.getSnapshot().presets.length,1);
});
test('new automation lanes round-trip, preserve untouched parameters and release at their own take end',()=>{
  const before={version:1,cycleSteps:64,tracks:{bass:{volume:{initial:-6,points:[]}}}};
  const take={length:32,lanes:{'drums:pitch':{initial:0,points:[{step:1.2,value:-7}]},'bass:chopper':{initial:null,points:[{step:4,value:32}]},'melody:reverb':{initial:0,points:[{step:8,value:.5}]},'chord:brake':{initial:0,points:[{step:5,value:1}]}}};
  const result=normalizeEffectAutomation(mergeEffectTake(before,take));assert.equal(result.tracks.bass.volume.initial,-6);
  for(const [track,p,value] of [['drums','pitch',0],['bass','chopper',null],['chord','brake',0]]) assert.ok(effectLaneEvents(result,track,p).some(e=>e.step===32&&e.value===value));
  assert.equal(result.tracks.melody.reverb.points.length,1);
});

const source=await readFile(new URL('../src/audio/jam-expression.js',import.meta.url),'utf8');
function dsp() {
  let C;const env={sampleRate:8000,currentTime:0,AudioWorkletProcessor:class{constructor(){this.port={};}},registerProcessor:(n,c)=>C=c,Float32Array,Math};
  vm.runInNewContext(source,env);const p=new C();
  return {p,run(seconds,params={}){let out=[];for(let frame=0;frame<seconds*8000;frame+=128){const input=Float32Array.from({length:128},(_,i)=>Math.sin(2*Math.PI*200*(env.currentTime+i/8000)));const output=new Float32Array(128);p.process([[input,input]],[[output,new Float32Array(128)]],Object.fromEntries(['pitch','chopper','brake'].map(k=>[k,new Float32Array([params[k]??0])])));out.push(...output);env.currentTime+=128/8000;}return out;}};
}
const rms=x=>Math.sqrt(x.reduce((s,v)=>s+v*v,0)/x.length);
test('expression DSP bypass is transparent, pitch bends tails, chop gates, brake silences and releases',()=>{
  const dry=dsp().run(1);assert.ok(rms(dry)>.7);
  const shifted=dsp().run(1,{pitch:-12}).slice(4000);let crossings=0;for(let i=1;i<shifted.length;i++)if(shifted[i-1]<=0&&shifted[i]>0)crossings++;
  const frequency=crossings/(shifted.length/8000);assert.ok(Math.abs(frequency-100)<8,`down octave measured ${frequency} Hz`);
  assert.ok(rms(dsp().run(1,{chopper:8}))<rms(dry)*.8);
  const brake=dsp();assert.ok(rms(brake.run(1,{brake:1}).slice(4000))<.001);assert.ok(rms(brake.run(1).slice(4000))>.7);
  brake.p.port.onmessage({data:{reset:true}});assert.ok(brake.p.ring.every(r=>r.every(v=>v===0)));
});

test('track header toggles independent targets, permits empty selection and releases old holds',()=>{
  const calls=[],fx=createJamEffects({setPerformanceEffect:(track,values)=>calls.push({track,values})});
  fx.toggleTrack('bass');assert.deepEqual(fx.getSnapshot().selectedTracks,['drums','bass']);
  fx.press('pitch','held',7,100);fx.toggleTrack('bass');
  assert.deepEqual(fx.getSnapshot().selectedTracks,['drums']);assert.equal(fx.getSnapshot().pitches.bass,0);assert.equal(fx.getSnapshot().pitches.drums,0);
  fx.toggleTrack('drums');assert.deepEqual(fx.getSnapshot().selectedTracks,[]);
  const before=calls.length;fx.press('brake','empty',1);fx.reverb(.5);assert.equal(calls.length,before);
  fx.toggleTrack('melody');assert.equal(fx.getSnapshot().selectedTrack,'melody');fx.reverb(.4);
  assert.equal(fx.getSnapshot().reverbs.melody,.4);assert.equal(fx.getSnapshot().reverbs.bass,0);
  fx.release('pitch','held');assert.equal(fx.getSnapshot().pitches.melody,0);
});

test('simplified arp page leaves only row 5 first key assigned',()=>{
  const input=createPerformanceMidiInput();
  assert.equal(input.handle([0x90,41,127],templates,{effectPage:'arp'}).type,'arp');
  for(const key of [42,43,44,45,46,47,48,31,32,33,34,35,36,37,38]) assert.equal(input.handle([0x90,key,127],templates,{effectPage:'arp'}),null);
});
