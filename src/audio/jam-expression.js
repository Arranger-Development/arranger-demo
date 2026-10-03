/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentTime */
// Two overlapping variable-delay grains transpose the live bus (including tails).
// The independent brake head slows a captured rolling stream while input keeps running.
class JamExpression extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitch', defaultValue: 0, minValue: -12, maxValue: 12 },
      { name: 'chopper', defaultValue: 0, minValue: 0, maxValue: 32 },
      { name: 'clock', defaultValue: 0, minValue: 0 },
      { name: 'brake', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }
  constructor() {
    super(); this.size = Math.ceil(sampleRate * 2); this.ring = [new Float32Array(this.size),new Float32Array(this.size)];
    this.write = 0; this.phase = 0; this.brakeHead = 0; this.braking = false; this.chopGain = 1; this.pitchMix = 0; this.brakeMix = 0;
    this.port.onmessage = ({data}) => { if (data.reset) { this.ring.forEach(r => r.fill(0)); this.braking = false; this.pitchMix = this.brakeMix = 0; } };
  }
  read(ch, pos) {
    const p = ((pos % this.size) + this.size) % this.size, i = Math.floor(p), f = p-i;
    return this.ring[ch][i]*(1-f)+this.ring[ch][(i+1)%this.size]*f;
  }
  process(inputs, outputs, parameters) {
    const output = outputs[0], input = inputs[0]; if (!output?.[0]) return true;
    const window = sampleRate * .05;
    for (let i=0;i<output[0].length;i++) {
      const pitch = parameters.pitch[parameters.pitch.length === 1 ? 0 : i];
      const chop = parameters.chopper[parameters.chopper.length === 1 ? 0 : i];
      const brake = parameters.brake[parameters.brake.length === 1 ? 0 : i];
      const ratio = 2**(pitch/12), phase2 = (this.phase+.5)%1;
      const gain1 = .5-.5*Math.cos(this.phase*Math.PI*2), gain2 = 1-gain1;
      this.pitchMix += ((Math.abs(pitch) > .005 ? 1 : 0)-this.pitchMix)*.005;
      if (brake > .001 && !this.braking) { this.brakeHead = this.write-1; this.braking = true; }
      if (brake < .001) this.braking = false;
      this.brakeMix += ((this.braking ? 1 : 0)-this.brakeMix)*.01;
      const clock = parameters.clock?.[parameters.clock.length === 1 ? 0 : i] ?? (currentTime+i/sampleRate)*100/60*4;
      this.chopGain += ((chop > 0 && (clock*chop/16)%1 >= .5 ? 0 : 1)-this.chopGain)*.03;
      for (let ch=0;ch<output.length;ch++) {
        const dry = input[ch]?.[i] ?? input[0]?.[i] ?? 0;
        this.ring[ch][this.write] = dry;
        const shifted = this.read(ch,this.write-2-this.phase*window)*gain1 + this.read(ch,this.write-2-phase2*window)*gain2;
        const live = dry*(1-this.pitchMix)+shifted*this.pitchMix;
        const slowed = this.read(ch,this.brakeHead)*(1-brake);
        output[ch][i] = (live*(1-this.brakeMix)+slowed*this.brakeMix)*this.chopGain;
      }
      this.brakeHead += Math.max(0,1-brake);
      this.phase = (this.phase+(1-ratio)/window+1)%1;
      this.write = (this.write+1)%this.size;
    }
    return true;
  }
}
registerProcessor('arranger-jam-expression', JamExpression);
