const targetRate = 22050;
export const maxHumSeconds = 10;

export async function decodeHumRecording(blob) {
  const audio = new AudioContext();
  let decoded;
  try {
    decoded = await audio.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await audio.close();
  }
  const duration = Math.min(maxHumSeconds, decoded.duration);
  const offline = new OfflineAudioContext(1, Math.max(1, Math.floor(duration * targetRate)), targetRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export function playHumNotes(notes) {
  const audio = new AudioContext();
  const start = audio.currentTime + 0.025;
  for (const [index, note] of notes.entries()) {
    const time = start + note.start;
    const end = start + Math.min(note.end, notes[index + 1]?.start ?? Infinity);
    const length = end - time;
    if (length <= 0) continue;
    const attack = Math.min(0.008, length / 3), release = Math.min(0.012, length / 3);
    const voice = audio.createOscillator(), envelope = audio.createGain();
    voice.type = 'triangle';
    voice.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(0.18, time + attack);
    envelope.gain.setValueAtTime(0.18, end - release);
    envelope.gain.linearRampToValueAtTime(0, end);
    voice.connect(envelope).connect(audio.destination);
    voice.start(time);
    voice.stop(end);
  }
  const close = () => { if (audio.state !== 'closed') void audio.close(); };
  const timer = setTimeout(close, (notes.at(-1).end + 0.1) * 1000);
  return () => { clearTimeout(timer); close(); };
}
