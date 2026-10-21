// Measured on the user's 4AC1F4C4: MIDI channel 4, faders CC1–4, knobs CC5–6.
export const JAM_MIDI_BINDINGS = Object.freeze({
  1: 'volume', 2: 'cutoff', 3: 'reverb', 4: 'pitch', 5: 'strength', 6: 'groove',
});
const PITCH_TOKEN = 'midif4c4:pitch';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 10) / 10;

export function findJamMidiInput(ports) {
  return Array.from(ports).find(port => port.type === 'input' && port.state !== 'disconnected'
    && /(?:4ac1f4c4|midif4c4)/i.test(port.name?.replace(/[^a-z0-9]/gi, '') ?? '')) ?? null;
}

export function jamMidiValue(parameter, raw) {
  // The faders measured 1–127; accept both 0 and 1 as the bottom endpoint.
  const unit = raw <= 1 ? 0 : raw / 127;
  if (parameter === 'volume') return Math.round(-24 + unit * 30);
  if (parameter === 'cutoff') return clamp(Math.round((100 + unit * 19900) / 100) * 100, 100, 20000);
  if (parameter === 'reverb') return Math.round(unit * 100) / 100;
  if (parameter === 'pitch') return raw >= 62 && raw <= 65 ? 0
    : round(raw < 62 ? -12 * (62 - Math.max(1, raw)) / 61 : 12 * (raw - 65) / 62);
  return Math.round(raw / 127 * 4) * 25;
}

function midiPosition(parameter, value) {
  if (parameter === 'volume') return (value + 24) / 30 * 127;
  if (parameter === 'cutoff') return (value - 100) / 19900 * 127;
  if (parameter === 'reverb') return value * 127;
  if (parameter === 'pitch') return value === 0 ? 63.5 : value < 0 ? 62 + value / 12 * 61 : 65 + value / 12 * 62;
  return value / 100 * 127;
}

export function createJamMidiController({ getContext, dispatch }) {
  const slots = new Map();
  let pitchOwned = false;
  const releasePitch = () => {
    if (pitchOwned) dispatch({ type: 'pitch', token: PITCH_TOKEN, pressed: false });
    pitchOwned = false;
  };
  return {
    reset() { releasePitch(); slots.clear(); },
    handle(data) {
      if (data?.length !== 3 || data[0] !== 0xb3 || !Number.isInteger(data[1])
        || !Number.isInteger(data[2]) || data[2] < 0 || data[2] > 127) return false;
      const parameter = JAM_MIDI_BINDINGS[data[1]];
      if (!parameter) return false;
      const context = getContext();
      const knob = parameter === 'strength' || parameter === 'groove';
      if (!context?.active || context.blocked || (knob ? context.editingTrack !== 'drums' : !context.selectedTracks.length)
        || (parameter === 'pitch' && !context.playing)) {
        slots.delete(parameter);
        if (parameter === 'pitch') releasePitch();
        return false;
      }
      const value = knob ? context.params[parameter] : context.values[parameter];
      const key = knob ? `${context.projectId}:${context.editorVersion}`
        : `${context.projectId}:${context.selectedTrack}:${context.selectedTracks.join(',')}:${parameter === 'pitch' ? context.playing : ''}`;
      let slot = slots.get(parameter);
      // Re-arm when a screen control, undo, template or another MIDI device changes the value.
      if (!slot || slot.key !== key || Math.abs(value - slot.expected) > 0.000001) {
        slot = { key, expected: value, raw: null, latched: false };
        slots.set(parameter, slot);
      }
      const raw = data[2], target = midiPosition(parameter, value);
      if (!slot.latched) {
        slot.latched = Math.abs(raw - target) <= 2 || (slot.raw !== null && (slot.raw - target) * (raw - target) <= 0);
      }
      slot.raw = raw;
      if (!slot.latched) return false;
      const next = jamMidiValue(parameter, raw);
      if (knob && next !== value) {
        const boundary = (value / 25 + (next > value ? 0.5 : -0.5)) * 127 / 4;
        if (Math.abs(raw - boundary) < 2) return false;
      }
      if (next === value) return false;
      slot.expected = next;
      if (parameter === 'pitch') {
        if (next === 0) releasePitch();
        else { pitchOwned = true; dispatch({ type: 'pitch', token: PITCH_TOKEN, value: next, pressed: true }); }
      } else dispatch({ type: knob ? 'drumParameter' : parameter, parameter, value: next });
      return true;
    },
  };
}

// Independent listeners preserve Launchpad's input and MIDIAccess state handler.
export function createJamMidiConnection({ requestAccess, controller }) {
  let state = { status: 'idle', deviceName: null, errorMessage: null };
  let access = null, input = null, generation = 0;
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  const receive = event => controller.handle(event.data);
  const detach = () => {
    input?.removeEventListener('midimessage', receive);
    input = null; controller.reset();
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
      await next.open();
      if (ownGeneration !== generation || input !== next) return;
      next.addEventListener('midimessage', receive);
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
    },
  };
}
