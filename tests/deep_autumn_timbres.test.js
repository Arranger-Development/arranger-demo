import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import AudioEngine, { createBassSampleUrls, createMelodySampleUrls } from '../src/audio/AudioEngine.js';
import { DEEP_AUTUMN_DRUMS as drums, DEEP_AUTUMN_CHORD as chord, PERFORMANCE_SAMPLE_BANKS as banks } from '../src/data/performanceTimbres.js';
import { createSection, createSession, snapshotSection, createArrangementImport, readSession, sessionKey } from '../src/app/performanceSession.js';
import { collectProjectEvents, renderProjectToWav, getEventVolume } from '../src/export/audioFile.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { getJamPitchedPreset } from '../src/app/jamPitchedPresets.js';
import { formatNoteLabel } from '../src/app/noteDisplay.js';

const profile = 'ai-demo-1';
function project() {
  const session = createSession('chill', profile); session.sections = [createSection()];
  const section = session.sections[0];
  section.selection.drums = 'deep-autumn-drums-chinese-groove';
  section.selection.chord = 'deep-autumn-chord-nostalgic-piano';
  section.timbres = { ...section.timbres, drums, chord };
  session.columns = [{ id: 'column', name: '深秋', repeat: 1, snapshot: snapshotSection(section, 'chill', profile) }];
  return { session, state: createArrangementImport(session, session.columns) };
}

function setup() {
  const players = [], samplers = [], calls = [];
  const Transport = { bpm: { value: 100 }, position: '0:0:0', scheduleRepeat(fn) { this.tick = fn; return 1; },
    clear() {}, start() { calls.push('start'); }, stop() {}, pause() {} };
  const tone = { Transport, now: () => 0, start: async () => {}, loaded: async () => {} };
  const engine = new AudioEngine({ tone, baseUrl: '/arranger-demo/',
    playerFactory: (url) => {
      const node = { url, volume: { value: 0 }, hits: [], stops: [], start(time) { this.hits.push(time); },
        stop(time) { this.stops.push(time); }, dispose() { this.disposed = true; }, toDestination() { return this; } };
      players.push(node); return node;
    },
    melodyInputSamplerFactory: (urls) => {
      const node = { urls, hits: [], releases: [], volume: { value: 0 },
        triggerAttack(note, time) { this.hits.push({ note, time }); }, releaseAll(time) { this.releases.push(time); },
        dispose() {}, toDestination() { return this; } };
      samplers.push(node); return node;
    },
  });
  return { engine, tone, players, samplers, calls };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('melody 0/0 UI E4 binds directly to the original E4 WAV in editor and playback banks',async()=>{
  const preset=getJamPitchedPreset('melody',0,0),before=structuredClone(preset);
  const note=preset.bars[0][2].note;
  assert.equal(note,'E5','stored/source MIDI remains unchanged');
  assert.equal(formatNoteLabel(note),'E4');
  assert.equal(banks['deep-autumn-melody'].sampleFiles[note],'samples/DeepAutumn/Melody/E4.wav');
  const {engine}=setup();
  for(const trackId of ['melody','melody-2']) {
    assert.equal(await engine.triggerMelodyInputOneShot(note,0,{trackId,timbreId:'deep-autumn-melody',playbackMode:'natural'}),true);
    const sampler=engine.getMelodyBank('deep-autumn-melody',trackId,'natural').sampler;
    assert.match(sampler.urls[note],/\/Melody\/E4.wav\?/);
    assert.equal(sampler.hits.at(-1).note,note);
  }
  assert.deepEqual(preset,before);
});

test('chord source calibration stays consistent across playback, audition, export and independent faders', async () => {
  const {engine}=setup();
  const mix={volumes:{chord:0,'chord-2':-7},mutedTracks:{}};
  engine.setVolumeSource(()=>mix);
  const voices=[];
  for(const trackId of ['chord','chord-2']) for(const playbackMode of ['natural',undefined]) {
    await engine.prepareMelodyTimbre(chord,trackId,playbackMode);
    const sampler=engine.getMelodyBank(chord,trackId,playbackMode).sampler;
    sampler.triggerAttack=(note,time,velocity)=>voices.push({trackId,note,time,velocity,db:sampler.volume.value});
    sampler.triggerAttackRelease=(note,duration,time,velocity)=>voices.push({trackId,note,time,velocity,duration,db:sampler.volume.value});
    const event={type:'chord',trackId,timbreId:chord,playbackMode,note:'E3',velocity:.6,durationSteps:2,gateDuration:playbackMode!=='natural'};
    assert.equal(engine.triggerMelodyBankEvent(event,1,120),true);
    const voice=voices.at(-1);
    assert.equal(voice.db,mix.volumes[trackId]+4,'source calibration is combined with the user fader');
    assert.equal(voice.velocity,.6,'authored dynamics remain intact');
    assert.ok(Math.abs(10**(voice.db/20)*voice.velocity-10**(getEventVolume(mix,event)/20))<1e-12,
      'WAV and live playback apply the same gain exactly once');
  }
  mix.volumes.chord=-10;
  engine.refreshTrackVolume('chord');
  assert.equal(engine.getMelodyBank(chord,'chord','natural').sampler.volume.value,-6);
  assert.equal(engine.getMelodyBank(chord,'chord-2','natural').sampler.volume.value,-3);
  mix.mutedTracks.chord=true;
  engine.refreshTrackVolume('chord');
  assert.equal(engine.getMelodyBank(chord,'chord','natural').sampler.volume.value,-Infinity);
  assert.equal(getEventVolume(mix,{type:'chord',trackId:'chord',timbreId:chord}),-Infinity);
  assert.equal(getEventVolume({volumes:{drums:0}},{type:'drums',trackId:'drums',timbreId:drums}),-7);
  assert.equal(getEventVolume({volumes:{bass:0}},{type:'bass',trackId:'bass',timbreId:'deep-autumn-bass'}),0);
  assert.equal(getEventVolume({volumes:{melody:0}},{type:'melody',trackId:'melody',timbreId:'deep-autumn-melody'}),2);
});

test('bass measured roots and melody UI sample bindings retain source files and old banks', () => {
  const expected = {
    bass: ['E1', 'F#1', 'G#1', 'A1', 'B1', 'C#2', 'D#2', 'E2', 'F#2'],
    melody: ['C#4', 'D#4', 'E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5', 'F#5', 'G#5', 'A5', 'B5', 'C#6'],
  };
  for (const [track, roots] of Object.entries(expected)) {
    const urls = createMelodySampleUrls('/', `deep-autumn-${track}`);
    assert.deepEqual(Object.keys(urls), roots);
    for (const root of roots) {
      assert.equal(new URL(urls[root], 'http://localhost').pathname,
        `/samples/DeepAutumn/${track === 'bass' ? 'Bass' : 'Melody'}/${root.replace(/(-?\d+)$/, octave => Number(octave) - 1).replace('#','')}.wav`);
    }
  }
  assert.match(createBassSampleUrls('/').C1, /\/Bass\/Bass_C1_v0.22.wav/);
  assert.match(createBassSampleUrls('/').A0, /\/Bass\/Bass_A0_v0.22.wav/);
  assert.match(createMelodySampleUrls('/', 'piano').C4, /\/Melody\/Melody_C4_v0.22.wav/);
  assert.match(createMelodySampleUrls('/', 'piano').A3, /\/Melody\/Melody_A3_v0.22.wav/);
});

test('all nine Deep Autumn bass roots match the measured WAV fundamental, including their octave', async () => {
  const frequencies = { E1:41.2034, 'F#1':46.2493, 'G#1':51.9131, A1:55, B1:61.7354,
    'C#2':69.2957, 'D#2':77.7817, E2:82.4069, 'F#2':92.4986 };
  for (const [root,file] of Object.entries(banks['deep-autumn-bass'].sampleFiles)) {
    assert.ok(frequencies[root], `unexpected root ${root}`);
    const wav=await readFile(new URL(`../public/${file}`,import.meta.url));
    let format, data;
    for (let offset=12;offset+8<=wav.length;) {
      const size=wav.readUInt32LE(offset+4),id=wav.toString('ascii',offset,offset+4);
      if(id==='fmt ')format=offset+8;
      if(id==='data')data={offset:offset+8,size};
      offset+=8+size+(size%2);
    }
    assert.ok(format&&data, `${file}: PCM chunks missing`);
    assert.equal(wav.readUInt16LE(format),1,'uncompressed PCM fixture');
    const channels=wav.readUInt16LE(format+2),rate=wav.readUInt32LE(format+4);
    const bytes=wav.readUInt16LE(format+14)/8,frameBytes=channels*bytes;
    const sample=frame=>Array.from({length:channels},(_,channel)=>wav.readIntLE(data.offset+frame*frameBytes+channel*bytes,bytes))
      .reduce((sum,value)=>sum+value,0)/channels;
    // Interpolated positive zero crossings in the stable sustain; these bass
    // recordings have a dominant fundamental. Measure bytes, not filename labels.
    const crossings=[];
    let previous=sample(Math.floor(rate*.15)-1);
    for(let frame=Math.floor(rate*.15);frame<Math.min(Math.floor(rate*1.15),data.size/frameBytes);frame++) {
      const current=sample(frame);
      if(previous<=0&&current>0)crossings.push(frame-1-previous/(current-previous));
      previous=current;
    }
    assert.ok(crossings.length>20,`${file}: insufficient sustained cycles`);
    const measured=(crossings.length-1)*rate/(crossings.at(-1)-crossings[0]);
    const cents=1200*Math.log2(measured/frequencies[root]);
    assert.ok(Math.abs(cents)<10,`${root}: measured ${measured.toFixed(2)} Hz (${cents.toFixed(1)} cents)`);
  }
});

test('natural, sharp and out-of-range notes use corrected realtime roots and WAV transposition', async (t) => {
  const urls = [], voices = [];
  class Context {
    constructor(channels, frames, rate) { this.frames = frames; this.rate = rate; this.destination = {}; }
    createGain() { return { gain: { value: 1 }, connect() { return this; } }; }
    createBufferSource() {
      const voice = { playbackRate: { value: 1 }, connect() { return this; }, start() {}, stop() {} };
      voices.push(voice); return voice;
    }
    async decodeAudioData() { return { duration: 1.5 }; }
    async startRendering() { return { numberOfChannels: 2, length: this.frames, sampleRate: this.rate, getChannelData: () => new Float32Array(this.frames) }; }
  }
  const original = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = Context;
  t.after(() => { if (original) globalThis.OfflineAudioContext = original; else delete globalThis.OfflineAudioContext; });
  t.mock.method(globalThis, 'fetch', async url => { urls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; });
  // Each fixture is [requested note, source root, original filename, semitone shift].
  const cases = {
    chord: [
      ['C#3', 'C#3', 'CSharp2', 0], ['E3', 'E3', 'E2', 0],
      ['A4', 'A4', 'A3', 0], ['G#5', 'G#5', 'GSharp4', 0],
      ['C4', 'C#4', 'CSharp3', -1], ['F4', 'F#4', 'FSharp3', -1],
      ['G4', 'G#4', 'GSharp3', -1], ['D4', 'D#4', 'DSharp3', -1],
      ['C#2', 'C#3', 'CSharp2', -12], ['B5', 'B5', 'B4', 0],
    ],
    bass: [
      ['C2', 'C#2', 'C1', -1], ['C#2', 'C#2', 'C1', 0],
      ['D2', 'D#2', 'D1', -1], ['D#2', 'D#2', 'D1', 0],
      ['F1', 'F#1', 'F0', -1], ['F#1', 'F#1', 'F0', 0],
      ['G1', 'G#1', 'G0', -1], ['G#1', 'G#1', 'G0', 0],
      ['E1', 'E1', 'E0', 0], ['A1', 'A1', 'A0', 0], ['B1', 'B1', 'B0', 0],
      ['F#2', 'F#2', 'F1', 0], ['C0', 'E1', 'E0', -16], ['B2', 'F#2', 'F1', 5],
    ],
    melody: [
      ['C4', 'C#4', 'C3', -1], ['C#4', 'C#4', 'C3', 0],
      ['D4', 'D#4', 'D3', -1], ['D#4', 'D#4', 'D3', 0],
      ['F4', 'F#4', 'F3', -1], ['F#4', 'F#4', 'F3', 0],
      ['G4', 'G#4', 'G3', -1], ['G#4', 'G#4', 'G3', 0],
      ['E5', 'E5', 'E4', 0], ['A4', 'A4', 'A3', 0], ['B5', 'B5', 'B4', 0],
      ['C3', 'C#4', 'C3', -13], ['C5', 'C#5', 'C4', -1],
      ['C#5', 'C#5', 'C4', 0], ['E4', 'E4', 'E3', 0],
    ],
  };
  for (const [track, entries] of Object.entries(cases)) {
    const { engine, tone } = setup();
    for (const [note, root, file, semitones] of entries) {
      const timbreId = `deep-autumn-${track}`;
      const state = { totalBars: 1, bpm: 120, trackOrder: [track], matrix: {
        [track]: [[{ ...(track === 'chord' ? {type:'notes',notes:[note]} : {type:track,note}), timbreId, requestedTimbreId: timbreId, playbackMode: 'natural' }]],
      } };
      await engine.play({ matrixSource: () => state.matrix, totalBars: 1 });
      tone.Transport.tick(0);
      const sampler = engine.getMelodyBank(timbreId, track, 'natural').sampler;
      assert.equal(sampler.hits.at(-1).note, note, 'musical note data must not be transposed');
      const sourcePath = new URL(sampler.urls[root], 'http://localhost').pathname;
      assert.ok(sourcePath.endsWith(`/${file}.wav`));
      assert.equal(await engine.triggerMelodyInputOneShot(note, 2, {trackId:track,timbreId,playbackMode:'natural'}), true);
      assert.deepEqual(sampler.hits.at(-1), {note,time:2}, 'editor input preserves pitch and uses the same sample bank');
      await engine.stop();
      urls.length = 0; voices.length = 0;
      await renderProjectToWav(state);
      assert.deepEqual(urls, [sourcePath.replace('/arranger-demo', '')]);
      assert.equal(voices.length, 1);
      assert.ok(Math.abs(voices[0].playbackRate.value - 2 ** (semitones / 12)) < 1e-12,
        `${track} ${note}: incorrect shift from ${root}`);
    }
  }
});

test('48 local WAVs match source hashes and sharp filenames map to standard notes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/samples/DeepAutumn/manifest.json', import.meta.url)));
  assert.equal(manifest.length, 48);
  assert.equal(Object.keys(banks[drums].sampleFiles).length, 3);
  assert.equal(Object.keys(banks[chord].sampleFiles).length, 21);
  assert.deepEqual(new Set(manifest.map(x => x.file)), new Set(Object.values(banks).flatMap(x => Object.values(x.sampleFiles))));
  for (const entry of manifest) {
    const bytes = await readFile(new URL(`../public/${entry.file}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  const urls = createMelodySampleUrls('/arranger-demo/', chord);
  assert.match(urls['C#3'], /\/Chord\/CSharp2.wav\?/);
  assert.match(urls['G#5'], /\/Chord\/GSharp4.wav\?/);
  assert.ok(Object.values(urls).every(url => !url.includes('#')));
  assert.match(createMelodySampleUrls('/', 'piano').C2, /samples\/Melody\/Melody_C2_v0.22.wav/);
});

test('chosen banks survive session, independent Live copy, single-track replacement and creation project export', () => {
  const { session, state } = project();
  const copy = structuredClone(session.columns[0]);
  const raw = JSON.stringify(session);
  const restored = readSession({ getItem: key => key === sessionKey('chill', profile) ? raw : null }, 'chill', profile);
  assert.deepEqual(restored.sections, session.sections);
  const events = collectProjectEvents(state);
  assert.ok(events.filter(e => e.type === 'drums').every(e => e.timbreId === drums));
  assert.ok(events.filter(e => e.type === 'chord').every(e => e.timbreId === chord && e.playbackMode === 'natural'));
  assert.deepEqual(createProjectFile(state).arrangement.matrix, state.matrix);
  session.sections[0].timbres.chord = 'warm-electric-piano';
  assert.deepEqual(session.columns[0], copy);
  assert.equal(createSection().timbres.drums, 'soft-electronic-kit');
});

test('real-time banks play original pitches and natural tails through selected channels; stop releases drums', async () => {
  const { engine, tone, players } = setup();
  const { state } = project();
  let routed = 0; engine.performanceEffects = { route() { routed++; } };
  await engine.play({ matrixSource: () => state.matrix, totalBars: state.totalBars });
  tone.Transport.tick(0);
  const kick = engine.drumTrackBanks.get('drums').get(drums).players.get('kick');
  const harmony = engine.getMelodyBank(chord, 'chord', 'natural').sampler;
  assert.deepEqual(kick.hits, [0]);
  assert.equal(kick.volume.value, -7);
  assert.equal(harmony.volume.value, 4);
  assert.equal(getEventVolume(state, { type: 'drums', trackId: 'drums', timbreId: drums }), kick.volume.value);
  assert.equal(getEventVolume(state, { type: 'chord', trackId: 'chord', timbreId: chord }), harmony.volume.value);
  assert.ok(players.filter(p => !p.url.includes('DeepAutumn')).every(p => p.hits.length === 0));
  assert.deepEqual(harmony.hits.map(x => x.note).sort(), ['B2', 'C#3', 'E3', 'G#2']);
  assert.equal(harmony.releases.length, 0);
  assert.ok(routed > 0);
  await engine.pause(); assert.ok(kick.stops.length > 0 && harmony.releases.length > 0);
  await engine.stop(); assert.ok(kick.stops.length > 1);
  engine.disposeTrack('drums'); assert.equal(engine.drumTrackBanks.has('drums'), false); assert.ok(kick.disposed);
});

test('dense drum retriggers crossfade old tails and schedule velocity changes at each hit, including half steps', async () => {
  const { engine, tone } = setup();
  const ramps = [];
  await engine.startAudio();
  await engine.prepareDrumTimbre(drums);
  const kick = engine.drumTrackBanks.get('drums').get(drums).players.get('kick');
  // An immediate shared-volume write would alter a tail before its next hit.
  kick.volume = {
    get value() { return 0; },
    set value(_) { assert.fail('hit volume must use the audio clock'); },
    linearRampTo(value, duration, time) { ramps.push({ value, duration, time }); },
  };
  const matrix = { drums: [[{ instruments: ['kick'], requestedTimbreId: drums, drumHits: [
    { instrument: 'kick', offsetSteps: 0, durationSteps: .5, velocity: 1 },
    { instrument: 'kick', offsetSteps: .5, durationSteps: .5, velocity: .5 },
  ] }]] };
  await engine.play({ matrixSource: () => matrix, totalBars: 1, bpm: 100 });
  tone.Transport.tick(1);
  assert.deepEqual(kick.hits,[1,1.075]);
  assert.deepEqual(ramps,[
    { value: -7, duration: .002, time: 1 },
    { value: -7 + 20 * Math.log10(.5), duration: .002, time: 1.075 },
  ]);
  assert.ok(kick.fadeOut >= .003 && kick.fadeOut <= .005, 'a few milliseconds of release prevent abrupt tail cuts');
  assert.ok(kick.fadeIn > 0 && kick.fadeIn <= .001, 'the new hit retains its percussive attack');
  const defaultKick = engine.drumPlayers.get('kick');
  assert.equal(defaultKick.fadeOut,kick.fadeOut,'both drum banks use the same retrigger protection');
  await engine.stop();
  assert.ok(kick.stops.length > 0,'stop must still release the bank');
});

test('drum bank failure cleans up and retries; deletion or stop during loading never starts obsolete playback', async () => {
  const { engine, tone, players, calls } = setup();
  await engine.startAudio();
  tone.loaded = async () => { throw new Error('load failed'); };
  assert.equal(await engine.prepareDrumTimbre(drums), false);
  assert.ok(players.filter(p => p.url.includes('DeepAutumn')).every(p => p.disposed));
  let finish; tone.loaded = () => new Promise(resolve => { finish = resolve; });
  const pendingBank = engine.prepareDrumTimbre(drums); await flush();
  engine.disposeTrack('drums'); finish(); assert.equal(await pendingBank, false);
  const { state } = project();
  const pendingPlay = engine.play({ matrixSource: () => state.matrix }); await flush();
  await engine.stop(); tone.loaded = async () => {}; finish();
  assert.equal(await pendingPlay, false); assert.deepEqual(calls, []);
  assert.equal(await engine.play({ matrixSource: () => state.matrix }), true);
  assert.deepEqual(calls, ['start']);
});

test('WAV render requests the same local banks and leaves drum and harmony sample tails ungated', async (t) => {
  const urls = [], voices = [];
  class Context {
    constructor(channels, frames, rate) { this.frames = frames; this.rate = rate; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return this; } }; }
    createBufferSource() { const voice = { playbackRate: { value: 1 }, connect() { return this; }, start() {}, stop() { this.stopped = true; } }; voices.push(voice); return voice; }
    async decodeAudioData() { return { duration: 1.5 }; }
    async startRendering() { return { numberOfChannels: 2, length: this.frames, sampleRate: this.rate, getChannelData: () => new Float32Array(this.frames) }; }
  }
  const original = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = Context;
  t.after(() => { if (original) globalThis.OfflineAudioContext = original; else delete globalThis.OfflineAudioContext; });
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; });
  const { state } = project();
  state.matrix.bass[0][0] = { type: 'bass', note: 'F#1', timbreId: 'deep-autumn-bass', requestedTimbreId: 'deep-autumn-bass', playbackMode: 'natural' };
  state.matrix.melody[0][0] = { type: 'melody', note: 'D#5', timbreId: 'deep-autumn-melody', playbackMode: 'natural' };
  await renderProjectToWav(state, { chunkSeconds: 1 });
  assert.ok(urls.some(url => url.includes('/Bass/F0.wav')));
  assert.ok(urls.some(url => url.includes('/Melody/D4.wav')));
  assert.ok(urls.length > 3 && urls.every(url => url.includes('/samples/DeepAutumn/')));
  assert.ok(urls.some(url => url.includes('/Drums/Kick.wav')) && urls.some(url => url.includes('/Chord/CSharp2.wav')));
  assert.ok(voices.length > 0 && voices.every(voice => !voice.stopped));
  urls.length = 0;
  await renderProjectToWav({ totalBars: 1, bpm: 100, trackOrder: ['chord'], matrix: {
    chord: [[{ type: 'notes', notes: ['C4'], timbreId: chord, playbackMode: 'natural' }]],
  } });
  assert.deepEqual(urls, ['/samples/DeepAutumn/Chord/CSharp3.wav'], 'equidistant source selection matches Tone.Sampler, not the lower B3');
});


test('bass and melody banks preserve selected pitches and natural release in realtime and session export', async () => {
  const { session } = project(); const section = session.sections[0];
  // Use the supplied catalog rather than inventing a phrase identity.
  const { performanceTemplates } = await import('../src/app/performanceModel.js');
  const catalog = performanceTemplates('chill', profile);
  section.selection.bass = catalog.bass[0].id; section.selection.melody = catalog.melody[0].id;
  section.timbres.bass = 'deep-autumn-bass'; section.timbres.melody = 'deep-autumn-melody';
  const copy = snapshotSection(section, 'chill', profile);
  const state = createArrangementImport(session, [{id:'new',name:'new',repeat:1,snapshot:copy}]);
  const events = collectProjectEvents(state).filter(e => ['bass','melody'].includes(e.type));
  assert.ok(events.length); assert.ok(events.every(e => e.timbreId === `deep-autumn-${e.type}` && e.playbackMode === 'natural'));
  const { engine, tone } = setup(); await engine.play({matrixSource:()=>state.matrix,totalBars:state.totalBars}); tone.Transport.tick(0);
  for (const track of ['bass','melody']) {
    const bank = engine.getMelodyBank(`deep-autumn-${track}`, track, 'natural'); assert.ok(bank.ready);
    assert.ok(bank.sampler.hits.length); assert.ok(Object.values(bank.sampler.urls).every(url => url.includes(`/DeepAutumn/${track === 'bass' ? 'Bass' : 'Melody'}/`)));
  }
  await engine.stop(); assert.ok(engine.getMelodyBank('deep-autumn-bass','bass','natural').sampler.releases.length);
});
