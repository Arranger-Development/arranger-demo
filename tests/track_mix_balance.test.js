import test from 'node:test';
import assert from 'node:assert/strict';
import AudioEngine from '../src/audio/AudioEngine.js';
import {renderProjectToWav} from '../src/export/audioFile.js';
import {TRACK_MIX_DYNAMICS} from '../src/audio/trackMixBalance.js';

test('bass and melody receive the requested one-decibel output lift after track compression',()=>{
  assert.equal(TRACK_MIX_DYNAMICS.bass.outputTrimDb,-7);
  assert.equal(TRACK_MIX_DYNAMICS.melody.outputTrimDb,0);
  assert.equal(TRACK_MIX_DYNAMICS.drums.outputTrimDb,-3);
  assert.equal(TRACK_MIX_DYNAMICS.chord.outputTrimDb,0);
});

const param=()=>({value:0,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},cancelScheduledValues(){},linearRampToValueAtTime(){}});
const node=()=>({outputs:[],connect(n){this.outputs.push(n);return n;},disconnect(){this.outputs=[];},toDestination(){throw new Error('unprotected voice');}});
function mockGlobal(t,name,value) {
  const original=Object.getOwnPropertyDescriptor(globalThis,name);
  Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
  t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
}
function context() {
  const compressors=[];
  return {compressors,destination:{},sampleRate:44100,
    createGain:()=>({...node(),gain:param()}),createBiquadFilter:()=>({...node(),frequency:param(),Q:param()}),
    createDynamicsCompressor(){const n={...node(),...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(p=>[p,param()]))};compressors.push(n);return n;},
    createConvolver:node,createBuffer:(_c,frames)=>({getChannelData:()=>new Float32Array(frames)}),
    audioWorklet:{async addModule(){}},
  };
}

test('entering Jam reuses creation track dynamics exactly once and fader/mute still control the correct track',async t=>{
  mockGlobal(t,'AudioWorkletNode',class {});
  const ctx=context();
  const tone={start:async()=>{},loaded:async()=>{},getContext:()=>({rawContext:ctx,
    createAudioWorkletNode(){return {...node(),port:{postMessage(){}},parameters:new Map(['pitch','brake','chopper','clock'].map(p=>[p,param()]))};}})};
  const engine=new AudioEngine({tone,playerFactory:node,samplerFactory:node,chordSamplerFactory:node,chordSynthFactory:node,fallbackSynthFactory:node});
  await engine.startAudio();await engine.prepareMatrixPlaybackSamples();
  const before=new Map(engine.trackMixOutputs);
  const count=ctx.compressors.length;
  const effects=await engine.preparePerformanceEffects();effects.route();effects.route();
  assert.equal(ctx.compressors.length,count,'rerouting into Jam adds no second dynamics stage');
  for(const [track,output] of before) assert.equal(engine.getTrackMixOutput(track),output);
  effects.set('bass',{volume:-24,muted:true});
  const bassInput=engine.bassSampler.outputs[0];
  const bassFader=bassInput.outputs[0].outputs[0].outputs[0].outputs[0].outputs[0];
  assert.equal(bassFader.gain.value,0);
  assert.equal(bassFader.outputs[0].outputs[0],engine.getTrackMixOutput('bass'));
  assert.notEqual(engine.getTrackMixOutput('bass'),engine.getTrackMixOutput('chord'));
});

test('whole and chunked WAV exports give each stem one independent dynamics stage with the same settings',async t=>{
  const contexts=[];
  class OfflineContext {
    constructor(_channels,frames,rate){Object.assign(this,context());this.frames=frames;this.rate=rate;this.voices=[];contexts.push(this);}
    createBufferSource(){const n={...node(),playbackRate:param(),start(){},stop(){}};this.voices.push(n);return n;}
    async decodeAudioData(){return {duration:.2};}
    async startRendering(){return {numberOfChannels:2,length:this.frames,sampleRate:this.rate,getChannelData:()=>new Float32Array(this.frames)};}
  }
  mockGlobal(t,'OfflineAudioContext',OfflineContext);
  t.mock.method(globalThis,'fetch',async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));
  const tracks=['drums','chord','bass','melody','bass-2'];
  const state={bpm:120,totalBars:2,trackOrder:tracks,matrix:Object.fromEntries(tracks.map(track=>{
    const type=track.split('-')[0];
    const cell=type==='drums'?{type,instruments:['kick']} : type==='chord'?{type,notes:['C4','E4','G4']}:{type,note:type==='bass'?'C1':'E4'};
    return [track,Array.from({length:2},()=>Array.from({length:16},(_,i)=>i%4===0?cell:null))];
  }))};
  for(const chunkSeconds of [120,1]) {
    contexts.length=0;
    await renderProjectToWav(state,{chunkSeconds});
    const renderContexts=contexts.filter(c=>c.voices.length);
    assert.ok(renderContexts.length>0);
    for(const c of renderContexts){
      assert.ok(c.compressors.length<=tracks.length,'one compressor per audible track, not per note');
      assert.ok(c.compressors.every(n=>Object.values(TRACK_MIX_DYNAMICS).some(p=>n.threshold.value===p.threshold&&n.ratio.value===p.ratio)));
      assert.ok(c.compressors.every(n=>n.outputs.length===1&&n.outputs[0].outputs.length===1));
    }
  }
});
