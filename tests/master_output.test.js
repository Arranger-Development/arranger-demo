import assert from 'node:assert/strict';
import { test } from 'node:test';
import AudioEngine from '../src/audio/AudioEngine.js';

function audioNode() {
  return {
    outputs: [],
    connect(target) { this.outputs.push(target); return target; },
    disconnect() { this.outputs = []; },
    toDestination() { assert.fail('voices must use the protected output'); },
  };
}

test('creation playback, previews and extra tracks share one protected master', async () => {
  const gains = [], compressors = [];
  const context = {
    destination: {},
    createGain() {
      const gain = { ...audioNode(), gain: { value: 1 } };
      gains.push(gain);
      return gain;
    },
    createDynamicsCompressor() {
      const compressor = { ...audioNode(), ...Object.fromEntries(
        ['threshold', 'knee', 'ratio', 'attack', 'release'].map((name) => [name, { value: 0 }]),
      ) };
      compressors.push(compressor);
      return compressor;
    },
  };
  const engine = new AudioEngine({
    tone: { start: async () => {}, getContext: () => ({ rawContext: context }) },
    playerFactory: audioNode,
    samplerFactory: audioNode,
    chordSamplerFactory: audioNode,
    fallbackSynthFactory: audioNode,
    chordSynthFactory: audioNode,
  });
  await engine.startAudio();
  await engine.prepareMatrixPlaybackSamples();
  await engine.prepareMelodyTimbre('piano', 'chord');
  await engine.prepareDrumTimbre('deep-autumn-drums');
  const voices = [
    ...engine.drumPlayers.values(), engine.fallbackSynth, engine.chordSampler,
    engine.chordSynth, engine.bassSampler, engine.melodySampler,
    engine.melodyOneShotSampler, engine.createMelodyInputSampler(),
    engine.getMelodyBank('piano', 'chord').sampler,
    ...engine.drumTrackBanks.get('drums').get('deep-autumn-drums').players.values(),
  ];
  for (const type of ['drums', 'bass', 'chord', 'melody']) {
    const nodes = engine.ensureInstanceAudioNodes(`${type}-2`, type);
    voices.push(...nodes.drumPlayers.values(), ...[
      'fallbackSynth', 'bassSampler', 'chordSampler', 'chordSynth',
      'melodySampler', 'melodyInputSampler', 'melodyOneShotSampler',
    ].map((field) => nodes[field]).filter(Boolean));
  }
  const master = engine.getMasterOutput();
  assert.equal(gains.length, 1+engine.trackMixOutputs.size, 'each channel has one calibration trim and shares the master');
  assert.equal(compressors.length, 1+engine.trackMixOutputs.size);
  assert.ok(voices.length > 20);
  assert.ok(voices.every((voice) => voice.outputs.length === 1 && [...engine.trackMixOutputs.values()].includes(voice.outputs[0])));
  assert.ok([...engine.trackMixOutputs.values()].every(output=>output.outputs.length===1&&output.outputs[0].outputs[0]===master));
  assert.notEqual(engine.getTrackMixOutput('bass'),engine.getTrackMixOutput('bass-2'),'duplicate tracks keep independent dynamics');
  const oldBassOutput=engine.getTrackMixOutput('bass-2');
  engine.disposeTrack('bass-2');
  assert.equal(engine.trackMixOutputs.has('bass-2'),false);
  assert.deepEqual(oldBassOutput.outputs,[]);
  assert.equal(master.gain.value, 10 ** (-6 / 20));
  assert.deepEqual(master.outputs, [compressors[0]]);
  assert.deepEqual(compressors[0].outputs, [context.destination]);
  assert.deepEqual(Object.fromEntries(
    ['threshold', 'knee', 'ratio', 'attack', 'release'].map((name) => [name, compressors[0][name].value]),
  ), { threshold: -3, knee: 0, ratio: 20, attack: 0.003, release: 0.1 });
});
