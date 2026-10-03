import { PERFORMANCE_TRACKS, hasSelection } from '../app/performanceModel.js';
import { JAM_VOLUME_STEPS, JAM_FILTER_STEPS, JAM_TRACK_CC, JAM_PITCH_STEPS, JAM_REVERB_STEPS, nearestJamStep } from './performanceInput.js';

const TRACK_COLORS = { drums: [19, 18, 17], chord: [11, 10, 9], bass: [43, 42, 41], melody: [51, 50, 49] };
export function createLaunchpadXPerformanceLedFrame(surface = {}, now = 0) {
  const { templates = {}, sections = [], drafts = {}, editingId, page = 0, status = {}, beatPhase = 0,
    selectedTrack = 'drums', selectedTracks = [selectedTrack], effectPage = 'mix', pitches = {}, reverbs = {}, choppers = {}, brakes = {}, arp = {}, recording = {}, volumes = {}, cutoffs = {}, repeat = null, savedAt = -Infinity, storageError = false } = surface;
  const notes = new Map(), controls = new Map();
  const active = status.mode && status.mode !== 'stopped';
  PERFORMANCE_TRACKS.forEach((track, row) => {
    templates[track]?.slice(0, 8).forEach((phrase, index) => {
      if (phrase) notes.set((8 - row) * 10 + index + 1, TRACK_COLORS[track][drafts[editingId]?.selection[track] === phrase.id ? 2 : 0]);
    });
    controls.set(JAM_TRACK_CC[row], TRACK_COLORS[track][selectedTracks.includes(track) ? 2 : 0]);
  });
  const color = TRACK_COLORS[selectedTrack] ?? TRACK_COLORS.drums;
  const hasTargets = selectedTracks.length > 0;
  const volume = nearestJamStep(JAM_VOLUME_STEPS, volumes[selectedTrack] ?? 0);
  const filter = nearestJamStep(JAM_FILTER_STEPS, cutoffs[selectedTrack] ?? 20000);
  for (let i = 0; i < 8; i++) {
    if (!hasTargets && effectPage !== 'arp') { notes.set(41+i,0); notes.set(31+i,0); }
    else if (effectPage === 'mix') {
      notes.set(41+i, i === volume ? color[2] : i < volume ? color[0] : 0);
      notes.set(31+i, i === filter ? color[2] : i < filter ? color[0] : 0);
    } else if (effectPage === 'expression') {
      notes.set(41+i, active && !status.loading ? (pitches[selectedTrack] === JAM_PITCH_STEPS[i] ? 3 : i < 4 ? 47 : 55) : 0);
      const level=nearestJamStep(JAM_REVERB_STEPS,reverbs[selectedTrack]??0);
      notes.set(31+i,i===level?3:i<level?47:0);
    } else {
      notes.set(41+i, i === 0 && arp.presets?.[0] ? arp.index===0 ? 3 : 51 : 0);
      notes.set(31+i,0);
    }
  }
  [49,39,29].forEach((cc,i)=>controls.set(cc,['mix','expression','arp'][i]===effectPage?3:1));
  controls.set(19,recording.phase==='recording'?5:recording.phase==='armed'?(Math.floor(now/300)%2?5:0):7);
  [4,8,16,32].forEach((division,index)=>notes.set(24+index,active&&!status.loading&&hasTargets?(choppers[selectedTrack]===division?3:37):0));
  notes.set(28,active&&!status.loading&&hasTargets?(brakes[selectedTrack]?3:5):0);
  [4, 8, 16].forEach((division, index) => notes.set(21 + index, active && !status.loading && hasTargets ? color[repeat === division ? 2 : 0] : 0));
  sections.slice(page * 8, page * 8 + 8).forEach((section, index) => notes.set(11 + index,
    section.id === status.pendingId ? (beatPhase < .5 ? 13 : 0)
      : section.id === status.playingId ? (beatPhase < .5 ? 15 : 13)
      : status.loading && section.id === status.requestedId ? (Math.floor(now / 300) % 2 ? 15 : 0)
      : section.id === editingId ? 15 : 13));
  controls.set(93, page > 0 ? 13 : 0);
  controls.set(94, (page + 1) * 8 < sections.length ? 13 : 0);
  controls.set(97, storageError ? 5 : now - savedAt < 700 ? 17 : hasSelection(drafts[editingId]?.selection) ? 9 : 0);
  controls.set(98, status.loading ? (Math.floor(now / 300) % 2 ? 7 : 5) : active ? 5 : sections.length ? 17 : 0);
  const frame = [];
  for (let row = 8; row >= 1; row--) for (let col = 1; col <= 8; col++) frame.push([0x90, row * 10 + col, notes.get(row * 10 + col) ?? 0]);
  for (const cc of [91,92,93,94,95,96,97,98,89,79,69,59,49,39,29,19]) frame.push([0xb0, cc, controls.get(cc) ?? 0]);
  return frame;
}

export function createLedFrameSender() {
  let cache = new Map();
  return {
    reset() { cache = new Map(); },
    send(output, frame) {
      for (const message of frame) {
        const key = `${message[0]}:${message[1]}`;
        if (cache.get(key) === message[2]) continue;
        output.send(message);
        cache.set(key, message[2]);
      }
    },
  };
}
