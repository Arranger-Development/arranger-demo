import { getTotalBars } from '../domain/projectLength.js';
import { getTrackOutputVolume } from '../domain/trackVolume.js';
import { createMatrixPlaybackAdapter } from '../audio/matrixPlaybackAdapter.js';
import { getPitchedSampleBank, getPerformanceSampleBank } from '../data/performanceTimbres.js';
import {
  BEATS_PER_BAR,
  DEFAULT_BPM,
  STEPS_PER_BAR,
} from '../domain/musicConstants.js';

const SAMPLE_RATE = 44_100;
const TAIL_SECONDS = 3;
const MASTER_GAIN = 0.62;
const DRUM_SAMPLE_FILES = Object.freeze({
  hihat: 'samples/Drums/Hihat_v0.22.wav',
  kick: 'samples/Drums/Kick_v0.22.wav',
  snare: 'samples/Drums/Snare_v0.22.wav',
});
const BASS_SAMPLE_FILES = Object.freeze({
  A0: 'samples/Bass/Bass_A0_v0.22.wav',
  B0: 'samples/Bass/Bass_B0_v0.22.wav',
  C1: 'samples/Bass/Bass_C1_v0.22.wav',
  D1: 'samples/Bass/Bass_D1_v0.22.wav',
  E1: 'samples/Bass/Bass_E1_v0.22.wav',
  F0: 'samples/Bass/Bass_F0_v0.22.wav',
  G0: 'samples/Bass/Bass_G0_v0.22.wav',
});
const NATURAL_ROOTS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
const CHORD_SAMPLE_FILES = Object.freeze(Object.fromEntries(
  [2, 3, 4].flatMap((octave) => NATURAL_ROOTS.map((root) => [
    `${root}${octave}`,
    `samples/Chords/Chord_${root}${octave}_v0.3.wav`,
  ])),
));

function getBaseUrl() {
  return import.meta.env?.BASE_URL ?? '/';
}

function createAssetUrl(file) {
  const baseUrl = getBaseUrl();
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${file}`;
}

function noteNameToMidi(note) {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note ?? '');
  if (!match) return null;
  const pitchClasses = {
    A: 9,
    B: 11,
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
  };
  return (Number(match[3]) + 1) * 12 + pitchClasses[match[1]] + (match[2] ? 1 : 0);
}

function findClosestSample(note, sampleFiles, preferHigher = false) {
  const noteMidi = noteNameToMidi(note);
  if (!Number.isInteger(noteMidi)) return null;

  return Object.entries(sampleFiles)
    .map(([sampleNote, file]) => ({
      file,
      midi: noteNameToMidi(sampleNote),
      sampleNote,
    }))
    .filter(({ midi }) => Number.isInteger(midi))
    .sort((a, b) => Math.abs(a.midi - noteMidi) - Math.abs(b.midi - noteMidi)
      || (preferHigher ? b.midi - a.midi : 0))[0] ?? null;
}

function getDurationSeconds(event, bpm) {
  const secondsPerBeat = 60 / bpm;
  if (Number.isInteger(event.durationSteps) && event.durationSteps > 0) {
    return event.durationSteps * secondsPerBeat / 4;
  }
  if (event.duration === '1n') return secondsPerBeat * 4;
  if (event.duration === '2n') return secondsPerBeat * 2;
  if (event.duration === '4n') return secondsPerBeat;
  if (event.duration === '8n') return secondsPerBeat / 2;
  return secondsPerBeat / 4;
}

function getEventTime(event, bpm) {
  return Math.max(
    0,
    (event.bar * STEPS_PER_BAR + event.step + (event.timingOffset ?? 0)) * (60 / bpm / 4),
  );
}

function getGainValue(volume) {
  if (volume === -Infinity) return 0;
  return Number.isFinite(volume) ? Math.pow(10, volume / 20) : 1;
}

function getEventVolume(state, event) {
  const rawVolume = getTrackOutputVolume(state.volumes?.[event.trackId], state.mutedTracks?.[event.trackId]);
  if (rawVolume === -Infinity) return -Infinity;
  const bank = getPerformanceSampleBank(event.type, event.timbreId);
  const trackVolume = bank ? (rawVolume ?? 0) + bank.gainDb
    : ['melody', 'chord'].includes(event.type) && event.timbreId
      ? (rawVolume ?? 0) + getPitchedSampleBank(event.timbreId).gainDb : rawVolume;
  if (!['chord', 'drums', 'melody', 'bass'].includes(event.type) || !Number.isFinite(event.velocity)) {
    return trackVolume;
  }
  if (trackVolume === -Infinity) return -Infinity;
  const normalizedVelocity = Math.min(1, Math.max(0.2, event.velocity));
  return (Number.isFinite(trackVolume) ? trackVolume : 0) + (20 * Math.log10(normalizedVelocity));
}

function collectProjectEvents(state, options = {}) {
  const trackOrder = state.trackOrder ?? [];
  const allowedTrackIds = Array.isArray(options.trackIds)
    ? new Set(options.trackIds.filter((trackId) => typeof trackId === 'string'))
    : null;
  const adapter = createMatrixPlaybackAdapter({
    matrix: state.matrix,
    trackInstancesById: state.trackInstancesById,
    trackOrder,
  }, { totalBars: getTotalBars(state) });
  const events = [];
  for (let bar = 0; bar < getTotalBars(state); bar += 1) {
    for (let step = 0; step < STEPS_PER_BAR; step += 1) {
      adapter.getEventsForStep(bar, step).forEach((event) => {
        if (
          getTrackOutputVolume(state.volumes?.[event.trackId], state.mutedTracks?.[event.trackId]) !== -Infinity
          && (!allowedTrackIds || allowedTrackIds.has(event.trackId))
        ) {
          events.push(event);
        }
      });
    }
  }
  return events;
}

function getAudioExportTrackIds(state) {
  return [...new Set(collectProjectEvents(state).map((event) => event.trackId))];
}

function getSampleSelections(event, melodyTimbreId) {
  if (event.type === 'drums') {
    const file = (getPerformanceSampleBank('drums', event.timbreId)?.sampleFiles ?? DRUM_SAMPLE_FILES)[event.instrument];
    return file ? [{ file, noteMidi: null, sampleMidi: null }] : [];
  }

  const sampleFiles = event.type === 'bass'
    ? (getPerformanceSampleBank('bass', event.timbreId)?.sampleFiles ?? BASS_SAMPLE_FILES)
    : event.type === 'chord' && !event.timbreId
      ? CHORD_SAMPLE_FILES
      : getPitchedSampleBank(event.timbreId ?? melodyTimbreId).sampleFiles;
  const notes = event.type === 'chord' ? event.notes : [event.note];

  return notes.map((note) => {
    // Tone.Sampler searches upward first when pitches are equally close.
    const sample = findClosestSample(note, sampleFiles, Boolean(getPerformanceSampleBank(event.type, event.timbreId)));
    if (!sample) return null;
    return {
      file: sample.file,
      noteMidi: noteNameToMidi(note),
      sampleMidi: sample.midi,
    };
  }).filter(Boolean);
}

async function loadSampleBuffers(context, files) {
  const entries = await Promise.all([...files].map(async (file) => {
    try {
      const response = await fetch(createAssetUrl(file));
      if (!response.ok) throw new Error(`Could not load ${file}`);
      const data = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(data.slice(0));
      return [file, buffer];
    } catch {
      return [file, null];
    }
  }));
  return new Map(entries);
}

function scheduleFallbackTone(context, destination, time, duration, noteMidi, isDrum, volume = 0) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const midi = Number.isInteger(noteMidi) ? noteMidi : 36;
  oscillator.type = isDrum ? 'sine' : 'triangle';
  oscillator.frequency.value = isDrum ? 75 : 440 * (2 ** ((midi - 69) / 12));
  gain.gain.setValueAtTime((isDrum ? 0.16 : 0.1) * getGainValue(volume), time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(duration, isDrum ? 0.18 : 0.45));
  oscillator.connect(gain).connect(destination);
  oscillator.start(time);
  oscillator.stop(time + Math.min(duration, isDrum ? 0.2 : 0.5));
}

function scheduleSample(context, destination, buffer, selection, event, state, bpm, windowStart = 0) {
  const time = Math.max(0, getEventTime(event, bpm) - windowStart);
  const source = context.createBufferSource();
  const gain = context.createGain();
  const duration = event.type === 'chord' && !event.timbreId
    ? 2
    : event.type === 'melody' && !event.timbreId
      ? buffer.duration
      : getDurationSeconds(event, bpm);
  source.buffer = buffer;
  source.playbackRate.value = Number.isInteger(selection.noteMidi)
    ? 2 ** ((selection.noteMidi - selection.sampleMidi) / 12)
    : 1;
  gain.gain.value = getGainValue(getEventVolume(state, event));
  source.connect(gain).connect(destination);
  source.start(time);
  if (['melody', 'chord'].includes(event.type) && event.timbreId && event.playbackMode !== 'natural') {
    const level = gain.gain.value;
    gain.gain.setValueAtTime(level, time + duration);
    gain.gain.linearRampToValueAtTime(0, time + duration + 0.1);
    source.stop(time + duration + 0.1);
  } else if (event.type !== 'drums' && event.type !== 'melody' && event.playbackMode !== 'natural') {
    source.stop(time + Math.max(0.01, duration));
  }
}

function getOfflineAudioContext() {
  return globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext ?? null;
}

function audioBufferToWavBlob(buffer) {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frameCount = buffer.length;
  const data = new ArrayBuffer(44 + frameCount * channels * 2);
  const view = new DataView(data);
  const writeText = (offset, value) => {
    [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  };
  const blockAlign = channels * 2;
  const byteRate = buffer.sampleRate * blockAlign;

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, frameCount * blockAlign, true);

  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, Math.round(sample * 0x7fff), true);
      offset += 2;
    }
  }

  return new Blob([data], { type: 'audio/wav' });
}

async function renderWholeProjectToWav(state, options = {}) {
  if (!state?.matrix) throw new TypeError('A project matrix is required to render audio.');
  const OfflineContext = getOfflineAudioContext();
  if (!OfflineContext) {
    throw new Error('这个浏览器不支持离线音频渲染，无法导出 WAV。');
  }

  const bpm = Number.isFinite(state.bpm) && state.bpm > 0 ? state.bpm : DEFAULT_BPM;
  const projectDuration = getTotalBars(state) * BEATS_PER_BAR * 60 / bpm;
  const context = new OfflineContext(2, Math.ceil((projectDuration + TAIL_SECONDS) * SAMPLE_RATE), SAMPLE_RATE);
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);

  const events = collectProjectEvents(state, options);
  const selections = events.map((event) => ({
    event,
    selections: getSampleSelections(event, state.melodyTimbreId),
  }));
  const sampleBuffers = await loadSampleBuffers(
    context,
    new Set(selections.flatMap(({ selections: items }) => items.map(({ file }) => file))),
  );

  selections.forEach(({ event, selections: items }) => {
    const eventTime = getEventTime(event, bpm);
    const duration = getDurationSeconds(event, bpm);
    items.forEach((selection) => {
      const buffer = sampleBuffers.get(selection.file);
      if (buffer) {
        scheduleSample(context, master, buffer, selection, event, state, bpm);
      } else {
        scheduleFallbackTone(
          context,
          master,
          eventTime,
          duration,
          selection.noteMidi,
          event.type === 'drums',
          getEventVolume(state, event),
        );
      }
    });
  });

  const renderedBuffer = await context.startRendering();
  return {
    blob: audioBufferToWavBlob(renderedBuffer),
    durationSeconds: projectDuration,
  };
}


// Render with preroll long enough to reproduce every voice that crosses a chunk
// boundary. Only trimmed PCM chunks survive each iteration, never a full-song float buffer.
async function renderProjectToWav(state, options = {}) {
  const bpm = Number.isFinite(state?.bpm) && state.bpm > 0 ? state.bpm : DEFAULT_BPM;
  const duration = getTotalBars(state) * BEATS_PER_BAR * 60 / bpm;
  const chunkSeconds = options.chunkSeconds ?? 30;
  if (duration + TAIL_SECONDS <= (options.chunkSeconds ?? 120)) return renderWholeProjectToWav(state, options);
  if (!state?.matrix) throw new TypeError('A project matrix is required to render audio.');
  const OfflineContext = getOfflineAudioContext();
  if (!OfflineContext) throw new Error('这个浏览器不支持离线音频渲染，无法导出 WAV。');
  if (!Number.isFinite(chunkSeconds) || chunkSeconds <= 0) throw new Error('Invalid audio chunk length');
  const events = collectProjectEvents(state, options);
  const selections = events.map((event) => ({ event, selections: getSampleSelections(event, state.melodyTimbreId) }));
  const decodeContext = new OfflineContext(2, 1, SAMPLE_RATE);
  const buffers = await loadSampleBuffers(decodeContext, new Set(selections.flatMap((s) => s.selections.map((i) => i.file))));
  let longestTail = 3;
  for (const { event, selections: items } of selections) for (const item of items) {
    const rate = Number.isInteger(item.noteMidi) ? 2 ** ((item.noteMidi-item.sampleMidi)/12) : 1;
    const natural = buffers.get(item.file)?.duration / rate || 0.5;
    const gated = event.playbackMode !== 'natural' && event.type !== 'drums' && !(event.type === 'melody' && !event.timbreId);
    const duration = event.type === 'chord' && !event.timbreId ? 2 : getDurationSeconds(event,bpm);
    longestTail = Math.max(longestTail, gated ? Math.min(natural, duration + .1) : natural);
  }
  const frameCount = Math.ceil((duration + TAIL_SECONDS) * SAMPLE_RATE);
  const chunkFrames = Math.max(1, Math.floor(chunkSeconds * SAMPLE_RATE));
  const preroll = Math.ceil(longestTail * SAMPLE_RATE) + 1;
  const header = new ArrayBuffer(44); const view = new DataView(header);
  const text = (at, value) => [...value].forEach((c,i) => view.setUint8(at+i,c.charCodeAt(0)));
  text(0,'RIFF'); view.setUint32(4,36+frameCount*4,true); text(8,'WAVE'); text(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,2,true); view.setUint32(24,SAMPLE_RATE,true);
  view.setUint32(28,SAMPLE_RATE*4,true); view.setUint16(32,4,true); view.setUint16(34,16,true); text(36,'data'); view.setUint32(40,frameCount*4,true);
  const parts = [header];
  for (let first=0;first<frameCount;first+=chunkFrames) {
    if (options.signal?.aborted) throw new DOMException('导出已取消','AbortError');
    const end = Math.min(frameCount,first+chunkFrames); const renderFirst = Math.max(0,first-preroll);
    const offset = renderFirst/SAMPLE_RATE;
    const context = new OfflineContext(2,end-renderFirst,SAMPLE_RATE);
    const master = context.createGain(); master.gain.value = MASTER_GAIN; master.connect(context.destination);
    for (const { event, selections: items } of selections) {
      const time = getEventTime(event,bpm);
      if (time < offset || time >= end/SAMPLE_RATE) continue;
      for (const item of items) {
        const buffer = buffers.get(item.file);
        if (buffer) scheduleSample(context,master,buffer,item,event,state,bpm,offset);
        else scheduleFallbackTone(context,master,time-offset,getDurationSeconds(event,bpm),item.noteMidi,event.type==='drums',getEventVolume(state,event));
      }
    }
    const rendered = await context.startRendering();
    const pcm = new ArrayBuffer((end-first)*4); const data = new DataView(pcm);
    const channels = [rendered.getChannelData(0),rendered.getChannelData(1)];
    for(let frame=first;frame<end;frame++) for(let ch=0;ch<2;ch++) {
      const sample = Math.max(-1,Math.min(1,channels[ch][frame-renderFirst]));
      data.setInt16((frame-first)*4+ch*2,Math.round(sample*0x7fff),true);
    }
    parts.push(new Blob([pcm]));
    options.onProgress?.(end/frameCount);
  }
  return { blob: new Blob(parts,{ type:'audio/wav' }), durationSeconds: duration };
}

export {
  SAMPLE_RATE,
  audioBufferToWavBlob,
  collectProjectEvents,
  getAudioExportTrackIds,
  getDurationSeconds,
  getEventVolume,
  getEventTime,
  renderProjectToWav,
};
