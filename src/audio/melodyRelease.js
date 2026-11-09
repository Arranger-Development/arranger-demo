export function melodyReleaseSeconds(noteEnd, nextAttack = Infinity) {
  return Math.min(0.25, Math.max(0, nextAttack - noteEnd + 0.05));
}

export function scheduleMelodyRelease(gain, level, end, release) {
  if (!release) {
    gain.setValueAtTime(0, end);
    return;
  }
  gain.setValueAtTime(level, end);
  gain.linearRampToValueAtTime(level * 0.25, end + release / 2);
  gain.linearRampToValueAtTime(0, end + release);
}

export function playMelodySample(context, output, buffer, rate, level, start, duration, release, onEnd) {
  const source = context.createBufferSource();
  const envelope = context.createGain();
  const gateEnd = start + duration;
  let stopTime = gateEnd + release;
  source.buffer = buffer;
  source.playbackRate.value = rate;
  envelope.gain.setValueAtTime(level, start);
  scheduleMelodyRelease(envelope.gain, level, gateEnd, release);
  source.connect(envelope).connect(output);
  source.onended = () => {
    source.disconnect();
    envelope.disconnect();
    onEnd();
  };
  source.start(start);
  source.stop(stopTime);

  return time => {
    if (time >= stopTime) return;
    if (time <= start) {
      stopTime = time;
    } else {
      stopTime = Math.min(stopTime, time + 0.008);
      const gain = envelope.gain;
      if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(time);
      else {
        const phase = Math.min(1, Math.max(0, (time - gateEnd) / release));
        const value = level * (phase < 0.5 ? 1 - 1.5 * phase : (1 - phase) / 2);
        gain.cancelScheduledValues(time);
        gain.setValueAtTime(value, time);
      }
      gain.linearRampToValueAtTime(0, stopTime);
    }
    source.stop(stopTime);
  };
}
