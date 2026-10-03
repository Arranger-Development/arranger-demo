const tracks = ['drums', 'chord', 'bass', 'melody'];
export async function createPerformanceEffects(engine) {
  await engine.startAudio();
  const toneContext = engine.getToneContext();
  const context = toneContext?.rawContext;
  if (!context?.audioWorklet || !globalThis.AudioWorkletNode) throw new Error('演出效果需要支持 AudioWorklet 的浏览器，请使用最新版 Chrome 或 Edge。');
  await context.audioWorklet.addModule(new URL('./beat-repeat.js?no-inline', import.meta.url).href);
  await context.audioWorklet.addModule(new URL('./jam-expression.js?no-inline', import.meta.url).href);
  const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 2.4), context.sampleRate);
  let seed = 7381;
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      data[i] = (seed / 2147483648) * (1-i/data.length)**2.6;
    }
  }
  const buses = new Map(tracks.map((id) => {
    const input = context.createGain();
    const repeat = toneContext.createAudioWorkletNode('arranger-beat-repeat', { outputChannelCount: [2] });
    const expression = toneContext.createAudioWorkletNode('arranger-jam-expression', { outputChannelCount: [2] });
    const verb = context.createConvolver(); verb.buffer = impulse;
    const wet = context.createGain(), dry = context.createGain(); wet.gain.value = 0;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 20000; filter.Q.value = 0.7;
    const gain = context.createGain();
    input.connect(repeat).connect(expression).connect(filter);
    filter.connect(dry).connect(gain); filter.connect(verb).connect(wet).connect(gain); gain.connect(context.destination);
    return [id, { input, repeat, expression, filter, gain, wet, dry }];
  }));
  const routed = new WeakSet();
  function route(node, track) {
    if (!buses.has(track) || !node?.connect || routed.has(node)) return;
    node.disconnect(); node.connect(buses.get(track).input); routed.add(node);
  }
  return {
    route() {
      engine.drumTrackBanks?.forEach((banks, track) => banks.forEach((bank) => bank.players.forEach((node) => route(node, track))));
      engine.drumPlayers.forEach((n) => route(n, 'drums')); route(engine.fallbackSynth, 'drums');
      route(engine.bassSampler, 'bass'); route(engine.chordSampler, 'chord'); route(engine.chordSynth, 'chord');
      for (const key of ['melodySampler', 'melodyInputSampler', 'melodyOneShotSampler']) route(engine[key], 'melody');
      engine.melodyTrackBanks.forEach((banks, track) => banks.forEach((bank) => route(bank.sampler, track)));
    },
    connect(node, track) { route(node, track); },
    clock(step, time, bpm) {
      // Schedule musical position in the audio thread; gates stay on the beat
      // through mid-cycle presses, quantized changes and tempo edits.
      for (const bus of buses.values()) {
        const clock = bus.expression.parameters.get('clock');
        clock.cancelScheduledValues(time);
        clock.linearRampToValueAtTime(step, time);
        clock.linearRampToValueAtTime(step + 1, time + 60 / bpm / 4);
      }
    },
    set(track, values, time) {
      const at = time ?? context.currentTime;
      const bus = buses.get(track); if (!bus) return;
      if (values.cutoff !== undefined) bus.filter.frequency.setTargetAtTime(values.cutoff || 20000, at, 0.015);
      if (values.volume !== undefined) bus.gain.gain.setTargetAtTime(values.muted || values.volume <= -24 ? 0 : 10 ** (values.volume / 20), at, 0.015);
      for (const p of ['pitch','brake','chopper']) if (values[p] !== undefined) {
        const value = p === 'chopper' ? (values.chopper ?? 0) : values[p];
        const param = bus.expression.parameters.get(p);
        // Discrete gates use exact clock times; bend and brake are smoothed.
        if (p === 'chopper') param.setValueAtTime(value, at);
        else param.setTargetAtTime(value, at, p === 'brake' && value ? .12 : .02);
      }
      if (values.reverb !== undefined) {
        bus.wet.gain.setTargetAtTime(values.reverb * .85, at, .08);
        bus.dry.gain.setTargetAtTime(1-values.reverb * .85, at, .08);
      }
      if (values.held !== undefined) bus.repeat.port.postMessage({ ...(Number.isFinite(time) ? { time } : {}), held: values.held, seconds: (60 / values.bpm) * (4 / values.division) });
    },
    cancel(track, parameter, time = context.currentTime) {
      const bus = buses.get(track); if (!bus) return;
      if (parameter === 'repeat') bus.repeat.port.postMessage({ cancelFrom: time });
      else {
        const params = parameter === 'volume' ? [bus.gain.gain] : parameter === 'cutoff' ? [bus.filter.frequency]
          : parameter === 'reverb' ? [bus.wet.gain, bus.dry.gain] : [bus.expression.parameters.get(parameter)];
        for (const param of params.filter(Boolean)) {
          if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(time);
          else { const value = param.value; param.cancelScheduledValues(time); param.setValueAtTime(value, time); }
        }
      }
    },
    reset() { buses.forEach((bus) => { bus.repeat.port.postMessage({ reset: true }); bus.expression.port.postMessage({ reset: true }); }); },
  };
}
