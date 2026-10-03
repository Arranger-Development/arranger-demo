import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPerformanceEffects } from '../src/audio/performanceEffects.js';

const param = () => ({ value: 0, setTargetAtTime(value) { this.value = value; }, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value,time) { this.ramp={value,time}; }, cancelScheduledValues(time) { this.cancelledAt=time; }, cancelAndHoldAtTime(time) { this.cancelledAt=time; } });
const node = () => ({ outputs: [], gain: param(), frequency: param(), Q: param(), connect(target) { this.outputs.push(target); return target; }, disconnect() { this.outputs = []; } });

test('each audible track routes through its own repeat/filter/gain and only the target changes', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioWorkletNode');
  Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: class {} });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'AudioWorkletNode', previous); else delete globalThis.AudioWorkletNode; });
  const filters = [], repeats = [], expressions = [], modules = [];
  const context = { sampleRate: 1024, createBuffer: (channels,length)=>({getChannelData:()=>new Float32Array(length)}), createConvolver:node, currentTime: 1, destination: node(), audioWorklet: { async addModule(url) { modules.push(url); } },
    createGain: node, createBiquadFilter() { const n = node(); filters.push(n); return n; } };
  const engine = { async startAudio() {}, getToneContext: () => ({rawContext: context,
    createAudioWorkletNode(name) { const n = node(); n.messages = []; n.port = {postMessage: m => n.messages.push(m)}; if(name==='arranger-beat-repeat') repeats.push(n); else {n.parameters=new Map(['pitch','chopper','brake','clock'].map(p=>[p,param()]));expressions.push(n);} return n; }}),
    drumPlayers: new Map([['kick',node()]]), fallbackSynth: node(), bassSampler: node(), chordSampler: node(), chordSynth: node(),
    melodySampler: node(), melodyInputSampler: node(), melodyOneShotSampler: node(), melodyTrackBanks: new Map([['chord',new Map([['piano',{sampler:node()}]])]]) };
  const effects = await createPerformanceEffects(engine); effects.route();
  assert.equal(modules.length, 2);
  assert.match(await readFile(new URL(modules[0]), 'utf8'), /registerProcessor\('arranger-beat-repeat'/);
  const input = engine.chordSampler.outputs[0];
  assert.equal(input.outputs[0],repeats[1]);
  assert.equal(repeats[1].outputs[0],expressions[1]);
  assert.equal(expressions[1].outputs[0],filters[1]);
  assert.equal(filters[1].outputs[0].outputs[0].outputs[0],context.destination);
  assert.equal(engine.melodyTrackBanks.get('chord').get('piano').sampler.outputs[0],input);
  assert.notEqual(engine.bassSampler.outputs[0],input);
  effects.set('chord',{cutoff:600,volume:-6,held:true,bpm:120,division:8});
  assert.deepEqual(filters.map(f=>f.frequency.value),[20000,600,20000,20000]);
  assert.ok(Math.abs(filters[1].outputs[0].outputs[0].gain.value-10**(-6/20))<1e-9);
  assert.deepEqual(repeats.map(r=>r.messages.length),[0,1,0,0]);
  assert.deepEqual(repeats[1].messages[0],{held:true,seconds:.25});
  effects.set('chord',{held:false}); assert.equal(repeats[1].messages.at(-1).held,false);
  effects.set('bass',{pitch:-7,chopper:16,brake:1,reverb:.5,bpm:120},3);
  assert.equal(expressions[2].parameters.get('pitch').value,-7);
  assert.equal(expressions[2].parameters.get('chopper').value,16);
  assert.equal(expressions[1].parameters.get('pitch').value,0);
  effects.clock(32,5,120);assert.deepEqual(expressions[2].parameters.get('clock').ramp,{value:33,time:5.125});
  effects.cancel('bass','pitch',4); assert.equal(expressions[2].parameters.get('pitch').cancelledAt,4);
  effects.reset(); assert.ok(repeats.every(r=>r.messages.at(-1).reset));
});
