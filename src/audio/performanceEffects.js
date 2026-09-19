const tracks = ['drums', 'chord', 'bass', 'melody'];
export async function createPerformanceEffects(engine) {
  await engine.startAudio();
  const toneContext = engine.getToneContext();
  const context = toneContext?.rawContext;
  if (!context?.audioWorklet || !globalThis.AudioWorkletNode) throw new Error('演出效果需要支持 AudioWorklet 的浏览器，请使用最新版 Chrome 或 Edge。');
  const base = import.meta.env?.BASE_URL ?? '/';
  await context.audioWorklet.addModule(`${base}audio/beat-repeat.js`);
  const buses = new Map(tracks.map((id) => {
    const input = context.createGain();
    const repeat = toneContext.createAudioWorkletNode('arranger-beat-repeat', { outputChannelCount: [2] });
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 20000; filter.Q.value = 0.7;
    const gain = context.createGain();
    input.connect(repeat).connect(filter).connect(gain).connect(context.destination);
    return [id, { input, repeat, filter, gain }];
  }));
  const routed = new WeakSet();
  function route(node, track) {
    if (!node?.connect || routed.has(node)) return;
    node.disconnect(); node.connect(buses.get(track).input); routed.add(node);
  }
  return {
    route() {
      engine.drumPlayers.forEach((n) => route(n, 'drums')); route(engine.fallbackSynth, 'drums');
      route(engine.bassSampler, 'bass'); route(engine.chordSampler, 'chord'); route(engine.chordSynth, 'chord');
      for (const key of ['melodySampler', 'melodyInputSampler', 'melodyOneShotSampler']) route(engine[key], 'melody');
      engine.melodyTrackBanks.forEach((banks, track) => banks.forEach((bank) => route(bank.sampler, track)));
    },
    set(track, values) {
      const bus = buses.get(track); if (!bus) return;
      if (values.cutoff !== undefined) bus.filter.frequency.setTargetAtTime(values.cutoff || 20000, context.currentTime, 0.015);
      if (values.volume !== undefined) bus.gain.gain.setTargetAtTime(values.muted || values.volume <= -24 ? 0 : 10 ** (values.volume / 20), context.currentTime, 0.015);
      if (values.held !== undefined) bus.repeat.port.postMessage({ held: values.held, seconds: (60 / values.bpm) * (4 / values.division) });
    },
    reset() { buses.forEach((bus) => { bus.repeat.port.postMessage({ reset: true }); }); },
  };
}
