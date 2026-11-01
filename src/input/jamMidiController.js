import { jamParameterLevels, jamTrackKnobs } from '../app/jamPerformanceState.js';

// Measured on the user's 4AC1F4C4: MIDI channel 4, faders CC1–4, knobs CC5–6.
// Binding keys retain physical knob positions; musical parameters depend on the track.
export const JAM_MIDI_BINDINGS = Object.freeze({
  1: 'volume', 2: 'cutoff', 3: 'reverb', 4: 'pitch', 5: 'strength', 6: 'groove',
});
const PITCH_TOKEN = 'midif4c4:pitch';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 10) / 10;

export function findJamMidiInput(ports) {
  return Array.from(ports).find(port => port.type === 'input' && port.state !== 'disconnected'
    && /(?:4ac[01]f4c4|midif4c4)/i.test(port.name?.replace(/[^a-z0-9]/gi, '') ?? '')) ?? null;
}

export function jamMidiValue(parameter, raw, levels = [0, 25, 50, 75, 100]) {
  // The faders measured 1–127; accept both 0 and 1 as the bottom endpoint.
  const unit = raw <= 1 ? 0 : raw / 127;
  if (parameter === 'volume') return Math.round(-24 + unit * 30);
  if (parameter === 'cutoff') return clamp(Math.round((20000 - unit * 19900) / 100) * 100, 100, 20000);
  if (parameter === 'reverb') return Math.round(unit * 100) / 100;
  if (parameter === 'pitch') return raw >= 62 && raw <= 65 ? 0
    : round(raw < 62 ? -12 * (62 - Math.max(1, raw)) / 61 : 12 * (raw - 65) / 62);
  return levels[Math.round(raw / 127 * (levels.length - 1))];
}

export function createJamMidiController({ getContext, dispatch }) {
  const listeners = new Set();
  let positions = { strength: null, groove: null };
  const emptyFaders = () => ({ volume: null, cutoff: null, reverb: null, pitch: null });
  let faders = emptyFaders();
  const pendingFaders = new Set();
  const publish = next => { positions = next; listeners.forEach(listener => listener()); };
  let pitchOwned = false;
  const releasePitch = () => {
    if (pitchOwned) dispatch({ type: 'pitch', token: PITCH_TOKEN, pressed: false });
    pitchOwned = false;
  };
  const suspendPitch = () => { releasePitch(); if (faders.pitch) pendingFaders.add('pitch'); };
  function applyFader(parameter) {
    const context = getContext(), position = faders[parameter];
    if (!position || !context?.active || context.blocked || !context.selectedTracks.length) {
      if (parameter === 'pitch') releasePitch();
      return false;
    }
    if (parameter === 'pitch' && !context.playing) { releasePitch(); return false; }
    pendingFaders.delete(parameter);
    const next = position.value;
    if (parameter === 'pitch') {
      if (next === 0) { const owned = pitchOwned; releasePitch(); return owned; }
      if (pitchOwned && next === context.values.pitch) return false;
      pitchOwned = true; dispatch({ type: 'pitch', token: PITCH_TOKEN, value: next, pressed: true });
    } else {
      if (next === context.values[parameter] && context.selectedTracks.length === 1) return false;
      dispatch({ type: parameter, parameter, value: next });
    }
    return true;
  }
  const syncFaders = () => { for (const parameter of [...pendingFaders]) applyFader(parameter); };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => positions,
    getFaderSnapshot: () => faders,
    syncFaders, suspendPitch,
    // A mouse edit/undo shows the software value, without forgetting the physical position.
    useSoftwareValue(parameter) {
      const next = { ...positions };
      for (const p of parameter ? [parameter] : ['strength', 'groove']) {
        if (next[p]?.display) next[p] = { ...next[p], display: false };
      }
      if (next.strength !== positions.strength || next.groove !== positions.groove) publish(next);
    },
    reset: suspendPitch,
    showPositions() {
      const next = Object.fromEntries(Object.entries(positions).map(([p, position]) =>
        [p, position ? { ...position, display: true } : null]));
      publish(next);
    },
    disconnect() {
      releasePitch(); pendingFaders.clear();
      faders = emptyFaders();
      listeners.forEach(listener => listener());
      if (positions.strength || positions.groove) publish({ strength: null, groove: null });
    },
    handle(data, { positionOnly = false } = {}) {
      if (data?.length !== 3 || data[0] !== 0xb3 || !Number.isInteger(data[1])
        || !Number.isInteger(data[2]) || data[2] < 0 || data[2] > 127) return false;
      let parameter = JAM_MIDI_BINDINGS[data[1]];
      if (!parameter) return false;
      const knob = parameter === 'strength' || parameter === 'groove';
      const raw = data[2], previousRaw = knob ? positions[parameter]?.raw : null;
      if (!knob) {
        faders = { ...faders, [parameter]: { raw, value: jamMidiValue(parameter, raw) } };
        pendingFaders.add(parameter);
        listeners.forEach(listener => listener());
        return positionOnly ? false : applyFader(parameter);
      }
      // Capture even with no editor, an inactive tab, or an open confirmation. Never replay it later.
      if (knob && previousRaw !== raw) publish({ ...positions,
        [parameter]: { raw, percent: Math.round(raw / 127 * 100), display: true } });
      if (positionOnly || knob && previousRaw === raw) return false;
      const context = getContext();
      if (!context?.active || context.blocked || !['drums','chord','bass','melody'].includes(context.editingTrack)) return false;
      parameter = jamTrackKnobs(context.editingTrack).find(knob => knob.hardwareParameter === parameter).parameter;
      const value = context.params[parameter];
      const levels = context.parameterLevels?.[parameter] ?? jamParameterLevels(context.editingTrack,parameter);
      const next = jamMidiValue(parameter, raw, levels);
      if (next === value) return false;
      const index = levels.indexOf(value), nextIndex = levels.indexOf(next);
      if (Math.abs(index - nextIndex) === 1) {
        const boundary = (index + (next > value ? 0.5 : -0.5)) * 127 / (levels.length - 1);
        if (Math.abs(raw - boundary) < 2) return false;
      }
      dispatch({ type: 'trackParameter', trackId: context.editingTrack, parameter, value: next });
      return true;
    },
  };
}

// Independent listeners preserve Launchpad's input and MIDIAccess state handler.
export function createJamMidiConnection({ requestAccess, controller }) {
  let state = { status: 'idle', deviceName: null, errorMessage: null };
  let access = null, input = null, generation = 0, opening = false;
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const receive = event => controller.handle(event.data, { positionOnly: opening });
  const detach = () => {
    input?.removeEventListener('midimessage', receive);
    input = null; opening = false;
    if (controller.disconnect) controller.disconnect(); else controller.reset();
  };
  async function bind() {
    const next = findJamMidiInput(access.inputs.values());
    if (next === input) {
      if (!next) publish({ status: 'disconnected', deviceName: null, errorMessage: null });
      return;
    }
    detach();
    if (!next) { publish({ status: 'disconnected', deviceName: null, errorMessage: null }); return; }
    input = next;
    const ownGeneration = generation;
    try {
      // Listen before opening so a device's opening snapshot cannot be lost or generate notes.
      opening = true;
      next.addEventListener('midimessage', receive);
      await next.open();
      if (ownGeneration !== generation || input !== next) return;
      opening = false;
      controller.syncFaders?.();
      publish({ status: 'connected', deviceName: next.name, errorMessage: null });
    } catch (error) {
      if (ownGeneration !== generation || input !== next) return;
      detach(); publish({ status: 'error', deviceName: null, errorMessage: error.message || '无法打开旋钮推子控制器' });
    }
  }
  const changed = () => { void bind(); };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => state,
    async connect() {
      if (state.status === 'connecting') return;
      const ownGeneration = ++generation;
      publish({ status: 'connecting', errorMessage: null });
      try {
        const next = await requestAccess();
        if (generation !== ownGeneration) return;
        access?.removeEventListener('statechange', changed);
        access = next;
        access.addEventListener('statechange', changed);
        // Reconnect may reuse an already open port.
        detach();
        await bind();
      } catch (error) {
        if (generation !== ownGeneration) return;
        publish({ status: error.name === 'NotAllowedError' ? 'denied' : 'error', deviceName: null,
          errorMessage: error.message || '无法访问旋钮推子控制器' });
      }
    },
    reset: () => controller.reset(),
    dispose() {
      generation += 1;
      access?.removeEventListener('statechange', changed);
      access = null; detach();
      publish({ status: 'idle', deviceName: null, errorMessage: null });
    },
  };
}
