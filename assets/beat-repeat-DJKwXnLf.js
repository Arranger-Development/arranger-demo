/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentTime */
// Record dry input continuously; a held slice is independent of the live clock.
class BeatRepeatProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = Math.ceil(sampleRate * 2);
    this.ring = [new Float32Array(this.size), new Float32Array(this.size)];
    this.slice = null; this.write = 0; this.read = 0; this.mix = 0;
    this.queue = []; this.frameTime = 0;
    this.port.onmessage = ({ data }) => {
      if (data.reset) { this.queue = []; this.slice = null; this.mix = 0; this.ring.forEach((r) => r.fill(0)); return; }
      if (data.cancelFrom !== undefined) { this.queue = this.queue.filter(item => item.time < data.cancelFrom); return; }
      if (Number.isFinite(data.time)) {
        this.queue.push(data); this.queue.sort((a, b) => a.time - b.time);
      } else this.apply(data);
    };
  }
  apply(data) {
    if (!data.held) { this.slice = null; return; }
    const length = Math.max(1, Math.min(this.size, Math.round(sampleRate * data.seconds)));
    this.slice = this.ring.map((ring) => Float32Array.from({ length }, (_, i) => ring[(this.write - length + i + this.size) % this.size]));
    this.read = 0;
  }
  process(inputs, outputs) {
    const output = outputs[0]; const input = inputs[0];
    const blockTime = typeof currentTime === 'number' ? currentTime : this.frameTime;
    for (let i = 0; i < output[0].length; i++) {
      while (this.queue.length && this.queue[0].time <= blockTime + i / sampleRate) this.apply(this.queue.shift());
      this.mix += ((this.slice ? 1 : 0) - this.mix) * 0.05;
      for (let ch = 0; ch < output.length; ch++) {
        const dry = input[ch]?.[i] ?? input[0]?.[i] ?? 0;
        this.ring[ch % 2][this.write] = dry;
        const wet = this.slice?.[ch % 2]?.[this.read] ?? dry;
        // Short edge fades avoid discontinuities at slice boundaries.
        const edge = this.slice ? Math.min(1, this.read / 64, (this.slice[0].length - 1 - this.read) / 64) : 1;
        output[ch][i] = dry * (1 - this.mix) + wet * this.mix * edge;
      }
      this.write = (this.write + 1) % this.size;
      if (this.slice) this.read = (this.read + 1) % this.slice[0].length;
    }
    this.frameTime = blockTime + output[0].length / sampleRate;
    return true;
  }
}
registerProcessor('arranger-beat-repeat', BeatRepeatProcessor);
