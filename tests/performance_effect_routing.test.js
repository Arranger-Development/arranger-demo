import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPerformanceEffects } from '../src/audio/performanceEffects.js';
import { createMasterOutput } from '../src/audio/masterOutput.js';

const param = () => ({ value: 0, setTargetAtTime(value) { this.value = value; }, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value,time) { this.ramp={value,time}; }, cancelScheduledValues(time) { this.cancelledAt=time; }, cancelAndHoldAtTime(time) { this.cancelledAt=time; } });
const node = () => ({ outputs: [], gain: param(), frequency: param(), Q: param(), connect(target) { this.outputs.push(target); return target; }, disconnect(target) { this.outputs = target ? this.outputs.filter(n=>n!==target) : []; } });

test('each audible track routes through its own repeat/filter/gain and only the target changes', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioWorkletNode');
  Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: class {} });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'AudioWorkletNode', previous); else delete globalThis.AudioWorkletNode; });
  const filters = [], repeats = [], expressions = [], modules = [], compressors = [];
  const context = { sampleRate: 1024, createBuffer: (channels,length)=>({getChannelData:()=>new Float32Array(length)}), createConvolver:node, currentTime: 1, destination: node(), audioWorklet: { async addModule(url) { modules.push(url); } },
    createGain: node, createBiquadFilter() { const n = node(); filters.push(n); return n; },
    createDynamicsCompressor() {
      const n = { ...node(), ...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(p => [p,param()])) };
      compressors.push(n); return n;
    } };
  const sharedMaster = createMasterOutput(context);
  const engine = { async startAudio() {}, getMasterOutput: () => sharedMaster, getToneContext: () => ({rawContext: context,
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
  const trackGains = filters.map(filter => filter.outputs[0].outputs[0]);
  const gates=trackGains.map(gain=>gain.outputs[0]);
  const balances=gates.map(gain=>gain.outputs[0]);
  const master = balances[0].outputs[0].outputs[0];
  assert.equal(master, sharedMaster, 'Jam reuses one master after independent track dynamics');
  assert.ok(balances.every(balance=>balance.outputs.length===1&&balance.outputs[0].outputs[0]===master));
  assert.ok(filters.every((filter, i) => filter.outputs[1].outputs[0].outputs[0] === trackGains[i]), 'reverb tails also pass through the protected output');
  assert.equal(master.gain.value,10 ** (-6 / 20));
  assert.equal(compressors.length,5);
  assert.deepEqual(master.outputs,[compressors[0]]);
  assert.deepEqual(compressors[0].outputs,[context.destination]);
  assert.deepEqual(Object.fromEntries(['threshold','knee','ratio','attack','release'].map(p => [p,compressors[0][p].value])), {
    threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1,
  });
  assert.equal(engine.melodyTrackBanks.get('chord').get('piano').sampler.outputs[0],input);
  assert.notEqual(engine.bassSampler.outputs[0],input);
  effects.set('chord',{cutoff:600,volume:-6,held:true,bpm:120,division:8});
  assert.deepEqual(filters.map(f=>f.frequency.value),[20000,600,20000,20000]);
  assert.ok(Math.abs(filters[1].outputs[0].outputs[0].gain.value-10**(-6/20))<1e-9);
  assert.equal(master.gain.value,10 ** (-6 / 20), 'track volume edits must not remove the shared headroom');
  assert.deepEqual(repeats.map(r=>r.messages.length),[0,1,0,0]);
  assert.deepEqual(repeats[1].messages[0],{held:true,seconds:.25});
  effects.set('chord',{held:false}); assert.equal(repeats[1].messages.at(-1).held,false);
  effects.set('bass',{pitch:-7,chopper:16,brake:1,reverb:.5,bpm:120},3);
  assert.equal(expressions[2].parameters.get('pitch').value,-7);
  assert.equal(expressions[2].parameters.get('chopper').value,16);
  assert.equal(expressions[1].parameters.get('pitch').value,0);
  effects.clock(32,5,120);assert.deepEqual(expressions[2].parameters.get('clock').ramp,{value:33,time:5.125});
  effects.cancel('bass','pitch',4); assert.equal(expressions[2].parameters.get('pitch').cancelledAt,4);
  const messagesBefore=repeats.map(r=>r.messages.length);
  effects.releaseTrack('bass',5);
  assert.deepEqual(repeats[2].messages.at(-1),{clear:true,time:5});
  assert.deepEqual(expressions[2].messages.at(-1),{clear:true,time:5});
  assert.deepEqual(repeats.map((r,i)=>r.messages.length-messagesBefore[i]),[0,0,1,0]);
  assert.equal(expressions[2].parameters.get('pitch').value,-7,'track release preserves effect settings');
  effects.reset(); assert.ok(repeats.every(r=>r.messages.at(-1).reset));
  const mix = trackGains.map(g=>g.gain.value), oldVerbs=filters.map(f=>f.outputs[1]);
  effects.silence(6);
  assert.ok(gates.every(g=>g.gain.ramp.value===0&&g.gain.ramp.time===6.005));
  assert.deepEqual(trackGains.map(g=>g.gain.value),mix,'transport silence leaves user faders intact');
  assert.ok(expressions.every(e=>['pitch','brake','chopper','clock'].every(p=>e.parameters.get(p).cancelledAt===6&&e.parameters.get(p).value===0)));
  assert.ok(repeats.every(r=>r.messages.at(-1).reset));
  assert.ok(oldVerbs.every((verb,i)=>verb.outputs.length===0&&filters[i].outputs[1]!==verb),'old convolution tails cannot return on restart');
  effects.resume(6.1);
  assert.ok(gates.every(g=>g.gain.ramp.value===1&&Math.abs(g.gain.ramp.time-6.105)<1e-10));
  assert.deepEqual(trackGains.map(g=>g.gain.value),mix);
});
