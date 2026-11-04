import assert from 'node:assert/strict';
import { test } from 'node:test';
import AudioEngine from '../src/audio/AudioEngine.js';
import { createPerformanceImport } from '../src/app/performanceImport.js';
import { emptySelection, performanceTemplates } from '../src/app/performanceModel.js';
import { collectProjectEvents, renderProjectToWav } from '../src/export/audioFile.js';
import { createMidiFile } from '../src/export/midiFile.js';
import { getDialPitchedPreset } from '../src/data/dialPitchedPresets.js';
import { createJamTemplateProjects, jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { setJamPitchedNote } from '../src/app/jamNoteEditing.js';
import { usesNaturalSampleTail } from '../src/domain/notePerformances.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const natural = { type: 'melody', note: 'C4', timbreId: 'piano', duration: '16n', playbackMode: 'natural' };

test('authored short chord voices retain natural tails while gated chord and bass notes keep their durations',async()=>{
  const {engine,tone}=setup();
  const bar=Array(16).fill(null);
  for(const step of [0,1,15])bar[step]={type:'notes',notes:['C4'],timbreId:'piano',playbackMode:'natural',
    notePerformances:{C4:[{durationSteps:1,offsetSteps:0,velocity:.6}]}};
  const matrix={chord:[bar]},before=structuredClone(matrix);
  await engine.play({matrixSource:()=>matrix,totalBars:1,bpm:120});
  for(let step=0;step<=16;step++)tone.Transport.tick(step*.125);
  const sampler=engine.getMelodyBank('piano','chord','natural').sampler;
  assert.deepEqual(sampler.hits.map(h=>[h.kind,h.time,h.velocity]),[
    ['natural',0,.6],['natural',.125,.6],['natural',1.875,.6],['natural',2,.6],
  ]);
  assert.deepEqual(sampler.releases,[]);assert.deepEqual(matrix,before);
  assert.equal(usesNaturalSampleTail({type:'chord',playbackMode:'gated',gateDuration:true}),false);
  assert.equal(usesNaturalSampleTail({type:'bass',playbackMode:'natural',gateDuration:true}),false);
  const project={matrix,totalBars:1,bpm:120,trackOrder:['chord']};
  const gated=structuredClone(project);gated.matrix.chord[0].filter(Boolean).forEach(c=>delete c.playbackMode);
  assert.deepEqual(createMidiFile(project),createMidiFile(gated),'sample tails never rewrite MIDI note-offs');
  engine.stopTrackVoices('chord',2.1);assert.ok(sampler.releases.includes(2.1));
});

test('saved authored and manually edited Jam melodies keep natural tails without rewriting MIDI note lengths', () => {
  const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const store=createJamTemplateProjects(storage,'pop',null,100);
  const preset=getDialPitchedPreset('melody',75,50),bars=structuredClone(preset.bars);
  bars[0]=setJamPitchedNote(bars[0],1,'D4',3,false,'melody');
  const saved=store.saveTemplate({trackId:'melody',timbreId:'airy-synth-lead',bars,params:{strength:75,groove:50}},'尾音回归');
  store.patch({selection:{drums:null,chord:null,bass:null,melody:saved.id}});
  const reload=createJamTemplateProjects(storage,'pop',null,100);
  assert.deepEqual(reload.current().workspace.templates.melody[0].bars,bars);
  const snapshot=jamCombinationSnapshot(reload.current().workspace);
  const project={...snapshot,bpm:100,trackOrder:['melody']},events=collectProjectEvents(project);
  assert.ok(events.every(event=>event.gateDuration && usesNaturalSampleTail(event)));
  assert.ok(events.some(event=>event.bar===0&&event.step===1&&event.note==='D4'&&event.durationSteps===3));
  const previous=structuredClone(project);
  previous.matrix.melody.flat().filter(Boolean).forEach(cell=>{delete cell.playbackMode;});
  assert.deepEqual(createMidiFile(project),createMidiFile(previous));
});

test('authored melody expression keeps natural tails across repeats, loop boundaries and duplicate tracks', async () => {
  const { engine, tone, mix } = setup();
  mix.volumes['melody-2'] = -6;
  const bar = Array(16).fill(null);
  bar[0] = { ...natural, notePerformances: { C4: [
    { offsetSteps: .25, durationSteps: .5, velocity: .6 },
    { offsetSteps: .75, durationSteps: .25, velocity: .9 },
  ] } };
  bar[15] = { ...natural, notePerformances: { C4: [{ offsetSteps: .5, durationSteps: .125, velocity: .7 }] } };
  const matrix = { melody: [bar], 'melody-2': [structuredClone(bar)] };
  const original = structuredClone(matrix);
  await engine.play({ matrixSource: () => ({ matrix, trackOrder: ['melody', 'melody-2'] }), bpm: 120, totalBars: 1 });
  for (let step = 0; step <= 16; step++) tone.Transport.tick(step * .125);
  for (const track of ['melody', 'melody-2']) {
    const sampler = engine.getMelodyBank('piano', track, 'natural').sampler;
    assert.ok(sampler.hits.every(hit => hit.kind === 'natural'), 'notePerformances must not gate a natural melody');
    assert.deepEqual(sampler.hits.map(hit => hit.time), [.03125,.09375,1.9375,2.03125,2.09375]);
    assert.deepEqual(sampler.hits.map(hit => hit.velocity), [.6,.9,.7,.6,.9]);
    assert.deepEqual(sampler.releases, []);
    assert.ok(sampler.hits.every(hit => hit.volume === (track === 'melody' ? 0 : -6)));
  }
  assert.deepEqual(matrix, original);
  await engine.stop();
  for (const track of ['melody', 'melody-2']) assert.ok(engine.getMelodyBank('piano', track, 'natural').sampler.releases.length > 0);
});

test('whole and chunked WAV preserve authored natural melody tails beyond short note-offs and chunk boundaries', async t => {
  const stops = [], lengths = [];
  class Context {
    constructor(channels, frames, rate) { this.frames=frames;this.rate=rate;this.voices=[];this.destination={};lengths.push(frames); }
    createGain() { return { gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this;} }; }
    createBufferSource() { const voice={playbackRate:{value:1},connect(){return this;},start(time){this.time=time;},stop(time){this.end=time;stops.push(time);} };this.voices.push(voice);return voice; }
    async decodeAudioData() { return {duration:7}; }
    async startRendering() {
      const data=new Float32Array(this.frames);
      for(const voice of this.voices) {
        const start=Math.max(0,Math.round(voice.time*this.rate));
        const end=Math.min(this.frames,Math.round((voice.end ?? voice.time+voice.buffer.duration/voice.playbackRate.value)*this.rate));
        for(let i=start;i<end;i++) data[i]+=.1;
      }
      return {numberOfChannels:2,length:this.frames,sampleRate:this.rate,getChannelData:()=>data};
    }
  }
  const previous=globalThis.OfflineAudioContext;globalThis.OfflineAudioContext=Context;
  t.after(()=>{if(previous)globalThis.OfflineAudioContext=previous;else delete globalThis.OfflineAudioContext;});
  t.mock.method(globalThis,'fetch',async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}));
  const bar=Array(16).fill(null);
  bar[15]={...natural,notePerformances:{C4:[{offsetSteps:.25,durationSteps:.5,velocity:.8}]}};
  const project={totalBars:3,bpm:120,trackOrder:['melody'],matrix:{melody:[bar,Array(16).fill(null),Array(16).fill(null)]},volumes:{melody:0}};
  const original=structuredClone(project);
  const whole=await renderProjectToWav(project);lengths.length=0;
  const chunks=await renderProjectToWav(project,{chunkSeconds:1});
  assert.deepEqual(stops, [], 'natural melody samples must finish without scheduled note-offs');
  const pcm=await whole.blob.arrayBuffer();
  assert.ok(new DataView(pcm).getInt16(44+6*44100*4,true)>0,'the sample is still ringing at six seconds');
  assert.deepEqual(new Uint8Array(await chunks.blob.arrayBuffer()),new Uint8Array(pcm));
  assert.ok(lengths.some(frames=>frames>5*44100),'chunk preroll must retain the complete seven-second natural sample');
  assert.deepEqual(project,original);
});

function setup() {
  const calls = [], samplers = [];
  const mix = { volumes: { melody: 0 }, mutedTracks: {} };
  const Transport = { bpm: { value: 100 }, position: '0:0:0',
    scheduleRepeat(callback) { this.tick = callback; return 1; },
    clear() {}, start() { calls.push('start'); }, stop() {}, pause() {},
  };
  const tone = { Transport, now: () => 0, start: async () => {}, loaded: async () => {} };
  const engine = new AudioEngine({ tone, volumeSource: () => mix,
    playerFactory: () => ({ start() {}, toDestination() { return this; } }),
    melodyInputSamplerFactory: () => {
      const sampler = { volume: { value: 0 }, hits: [], releases: [],
        triggerAttack(note, time, velocity) { this.hits.push({ kind: 'natural', note, time, velocity, volume: this.volume.value }); },
        triggerAttackRelease(note, duration, time, velocity) { this.hits.push({ kind: 'gated', note, duration, time, velocity }); },
        releaseAll(time) { this.releases.push(time); },
        toDestination() { return this; },
      };
      samplers.push(sampler);
      return sampler;
    },
  });
  return { engine, tone, calls, mix, samplers };
}

test('natural tails overlap repeated notes and loop boundaries independently of gated voices', async () => {
  const { engine, tone, mix } = setup();
  const bar = Array(16).fill(null);
  bar[0] = { ...natural, velocity: .7 };
  bar[1] = { ...natural, playbackMode: undefined };
  bar[2] = { ...natural };
  const matrix = { melody: [bar, Array(16).fill(null)] };
  await engine.play({ matrixSource: () => matrix, bpm: 100, totalBars: 2 });
  const naturalBank = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  const gatedBank = engine.getMelodyBank('piano').sampler;
  assert.notEqual(naturalBank, gatedBank);
  for (let step = 0; step <= 32; step++) tone.Transport.tick(step * .15);
  assert.deepEqual(naturalBank.hits.map(hit => hit.time), [0, .3, 4.8]);
  assert.equal(naturalBank.hits[0].velocity, .7);
  assert.deepEqual(gatedBank.hits.map(hit => [hit.kind, hit.duration, hit.time]), [['gated', '16n', .15]]);
  assert.deepEqual(naturalBank.releases, [], 'loop boundaries and short-note releases do not cut natural tails');
  mix.volumes.melody = -24;
  engine.refreshTrackVolume('melody');
  assert.equal(naturalBank.volume.value, -Infinity);
  assert.equal(gatedBank.volume.value, -Infinity);
  mix.volumes.melody = -6;
  engine.refreshTrackVolume('melody');
  assert.equal(naturalBank.volume.value, -6);
  await engine.stop();
  assert.ok(naturalBank.releases.length > 0 && gatedBank.releases.length > 0);
  const hits = naturalBank.hits.length;
  tone.Transport.tick(6);
  assert.equal(naturalBank.hits.length, hits);
});

test('natural note audition can be cancelled while loading and uses the latest gain on retry', async () => {
  const { engine, tone, mix, samplers } = setup();
  await engine.startAudio();
  let finish;
  const loading = new Promise(resolve => { finish = resolve; });
  tone.loaded = () => loading;
  const options = { timbreId: 'piano', playbackMode: 'natural', velocity: .6 };
  const pending = engine.triggerMelodyInputOneShot('C4', 0, options);
  await flush();
  await engine.stop();
  mix.volumes.melody = -24;
  finish();
  assert.equal(await pending, false);
  assert.ok(samplers.every(sampler => sampler.hits.length === 0));
  assert.equal(await engine.triggerMelodyInputOneShot('C4', 1, options), true);
  const sampler = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  assert.deepEqual(sampler.hits, [{ kind: 'natural', note: 'C4', time: 1, velocity: .6, volume: -Infinity }]);
  engine.disposeTrack('melody');
  assert.equal(engine.getMelodyBank('piano', 'melody', 'natural'), undefined);
  assert.ok(sampler.releases.length > 0);
});

test('rapid playback restart during natural bank loading starts only the latest session', async () => {
  const { engine, tone, calls } = setup();
  await engine.startAudio();
  let finish;
  const loading = new Promise(resolve => { finish = resolve; });
  tone.loaded = () => loading;
  const matrix = { melody: [[natural]] };
  const first = engine.play({ matrixSource: () => matrix, totalBars: 4 });
  await flush();
  await engine.stop();
  const second = engine.play({ matrixSource: () => matrix, totalBars: 4 });
  await flush();
  finish();
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(calls.filter(call => call === 'start').length, 1);
  tone.Transport.tick(0);
  const sampler = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  assert.equal(sampler.hits.length, 1);
  await engine.stop();
  assert.ok(sampler.releases.length > 0);
});

test('adding a melody after a drum-only preview uses the preloaded natural piano bank', async () => {
  const { engine, tone } = setup();
  let snapshot = { totalBars: 2, matrix: { melody: [Array(16).fill(null), Array(16).fill(null)] } };
  await engine.play({ matrixSource: () => snapshot.matrix, playbackSource: () => snapshot,
    totalBars: 2, melodyTimbreIds: ['piano'], melodyPlaybackMode: 'natural' });
  const sampler = engine.getMelodyBank('piano', 'melody', 'natural').sampler;
  snapshot = { totalBars: 4, matrix: { melody: [[natural], [], [], []] } };
  tone.Transport.tick(0);
  assert.equal(sampler.hits.length, 1);
  await engine.stop();
});

test('all 92 Excel chord attacks retain identical MIDI bytes with natural tails', () => {
  const genreId = 'electronic-edm', profileId = 'ai-demo-1';
  const templates = performanceTemplates(genreId, profileId);
  const saved = [...templates.chord.slice(1,5).map(({ id }) => ({ ...emptySelection(), chord: id })), emptySelection()];
  const project = createPerformanceImport({ saved, genreId, profileId, bpm: 100 });
  const events = collectProjectEvents(project);
  assert.equal(events.flatMap(event => event.notes).length, 92);
  assert.ok(events.every(event => event.playbackMode === 'natural' && event.duration === '16n'));
  const previous = structuredClone(project);
  previous.matrix.chord.flat().filter(Boolean).forEach(cell => { delete cell.playbackMode; });
  assert.deepEqual(createMidiFile(project), createMidiFile(previous));
});


test('adding chord polyphony to a running preview uses its preloaded bank without restarting the clock', async () => {
  const { engine, tone, calls } = setup();
  let snapshot = { totalBars: 2, matrix: { chord: [Array(16).fill(null), Array(16).fill(null)] } };
  await engine.play({ matrixSource: () => snapshot.matrix, playbackSource: () => snapshot,
    totalBars: 2, additionalTimbres: [{ trackId: 'chord', timbreId: 'piano', playbackMode: 'natural' }] });
  const sampler = engine.getMelodyBank('piano', 'chord', 'natural').sampler;
  tone.Transport.tick(0);
  snapshot = { totalBars: 4, matrix: { chord: [[null, {
    type: 'notes', notes: ['E3', 'C#3'], duration: '16n', timbreId: 'piano', playbackMode: 'natural',
  }], [], [], []] } };
  tone.Transport.tick(.15);
  assert.deepEqual(sampler.hits.map(hit => [hit.note, hit.time]), [['E3', .15], ['C#3', .15]]);
  assert.deepEqual(calls, ['start']);
  await engine.stop();
});
