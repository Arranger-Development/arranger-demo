import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProjectToWav } from '../src/export/audioFile.js';
import { createDrumsCell } from '../src/domain/drumsCells.js';
test('chunked WAV is sample-identical to whole rendering across natural tails and encodes the exact duration',async(t)=>{
  const lengths=[];
  class Context {
    constructor(channels,frames,rate){this.frames=frames;this.rate=rate;this.voices=[];this.destination={};lengths.push(frames);}
    createGain(){return {gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this;}};}
    createBufferSource(){const voice={playbackRate:{value:1},connect(){return this;},start(time){this.time=time;},stop(time){this.end=time;}};this.voices.push(voice);return voice;}
    async decodeAudioData(){return {duration:1.7};}
    async startRendering(){const data=new Float32Array(this.frames);for(const voice of this.voices){const start=Math.round(voice.time*this.rate);const end=Math.min(this.frames,Math.round((voice.time+voice.buffer.duration/voice.playbackRate.value)*this.rate));for(let i=start;i<end;i++) data[i]+=.125;}return {numberOfChannels:2,length:this.frames,sampleRate:this.rate,getChannelData:()=>data};}
  }
  const previous=globalThis.OfflineAudioContext;globalThis.OfflineAudioContext=Context;
  t.after(()=>{if(previous)globalThis.OfflineAudioContext=previous;else delete globalThis.OfflineAudioContext;});
  t.mock.method(globalThis,'fetch',async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));
  const bar=Array(16).fill(null);bar[7]=createDrumsCell(['kick']);bar[15]=createDrumsCell(['snare']);
  const state={totalBars:1,bpm:120,matrix:{drums:[bar]},trackOrder:['drums'],volumes:{drums:0}};
  const whole=await renderProjectToWav(state);lengths.length=0;
  const chunks=await renderProjectToWav(state,{chunkSeconds:1});
  assert.deepEqual(new Uint8Array(await chunks.blob.arrayBuffer()),new Uint8Array(await whole.blob.arrayBuffer()));
  assert.equal(chunks.durationSeconds,2);assert.ok(lengths.every(n=>n<=4*44100+1));
  assert.equal(new DataView(await chunks.blob.arrayBuffer()).getUint32(40,true),5*44100*4);
});
