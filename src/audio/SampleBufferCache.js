// Share decoded audio, while keeping each sampler's gain and voices independent.
export default class SampleBufferCache {
  buffers = new Map();
  nodeLoads = new WeakMap();
  factoryLoadPromise = null;

  load(tone, url) {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const entry = { buffer: null, promise: null };
    entry.promise = Promise.resolve().then(() => tone.ToneAudioBuffer.load(url)).then((buffer) => {
      entry.buffer = buffer;
      return buffer;
    }).catch((error) => {
      this.buffers.delete(url);
      throw error;
    });
    this.buffers.set(url, entry);
    return entry;
  }

  getBuffer(url) {
    return this.buffers.get(url)?.buffer;
  }

  track(node, promise) {
    this.nodeLoads.set(node, promise);
    // Startup can create nodes before anyone awaits them. Readiness still
    // rejects for callers, without an unhandled rejection in the meantime.
    void promise.catch(() => {});
    return node;
  }

  createSampler(tone, urls) {
    if (!tone.ToneAudioBuffer?.load) return new tone.Sampler({ urls });
    const entries = Object.entries(urls).map(([note, url]) => [note, this.load(tone, url)]);
    const sampler = new tone.Sampler({
      urls: Object.fromEntries(entries.filter(([, entry]) => entry.buffer).map(([note, entry]) => [note, entry.buffer])),
    });
    const pending = entries.filter(([, entry]) => !entry.buffer);
    return this.track(sampler, Promise.all(pending.map(([, entry]) => entry.promise)).then((buffers) => {
      if (!sampler.disposed) pending.forEach(([note], index) => sampler.add(note, buffers[index]));
    }));
  }

  createPlayer(tone, url) {
    if (!tone.ToneAudioBuffer?.load) return new tone.Player(url);
    const entry = this.load(tone, url);
    const player = new tone.Player(entry.buffer ?? undefined);
    return this.track(player, entry.promise.then((buffer) => {
      if (!player.disposed) player.buffer.set(buffer);
    }));
  }

  waitFor(tone, nodes) {
    const loads = nodes.filter(Boolean).map((node) => this.nodeLoads.get(node));
    // Custom factories may manage loading themselves through Tone's queue.
    if (loads.some((load) => !load)) {
      this.factoryLoadPromise ??= Promise.resolve().then(() => tone?.loaded?.()).finally(() => {
        this.factoryLoadPromise = null;
      });
      loads.push(this.factoryLoadPromise);
    }
    return Promise.all(loads);
  }
}
