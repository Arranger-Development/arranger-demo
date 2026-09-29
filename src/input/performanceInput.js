import { PERFORMANCE_TRACKS } from '../app/performanceModel.js';
import { parseLaunchpadXMessage } from './launchpadXProtocol.js';

export const PERFORMANCE_KEYS = {
  drums: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'],
  chord: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI'],
  bass: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'],
  melody: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma'],
};
export function performanceKeyLabel(trackId, index) {
  const code = PERFORMANCE_KEYS[trackId]?.[index];
  return ({ Semicolon: ';', Comma: ',', Period: '.', Slash: '/' })[code] ?? code?.replace(/^(Key|Digit)/, '') ?? '';
}
function templateCommand(templates, trackId, index) {
  const template = templates?.[trackId]?.[index];
  return template ? { type: 'template', trackId, templateId: template.id } : null;
}
export function mapPerformanceKeyboard(event, templates) {
  if (event.type !== 'keydown' || event.repeat || event.isComposing || event.keyCode === 229
    || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null;
  const target = event.target;
  if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target?.tagName ?? '')
    || target?.closest?.('[role="textbox"]')) return null;
  for (const trackId of PERFORMANCE_TRACKS) {
    const index = PERFORMANCE_KEYS[trackId].indexOf(event.code);
    if (index >= 0) return templateCommand(templates, trackId, index);
  }
  return null;
}

export const JAM_VOLUME_STEPS = [-24, -18, -12, -9, -6, -3, 0, 6];
export const JAM_FILTER_STEPS = [100, 250, 500, 1000, 2000, 5000, 10000, 20000];
export const JAM_TRACK_CC = [89, 79, 69, 59];
export function nearestJamStep(steps, value) {
  return steps.reduce((best, step, index) => Math.abs(step - value) < Math.abs(steps[best] - value) ? index : best, 0);
}

// Programmer mode, channel 1. Repeated Note/CC presses and aftertouch are ignored.
export function createPerformanceMidiInput() {
  const held = new Set();
  return {
    reset() { held.clear(); },
    handle(data, templates) {
      const message = parseLaunchpadXMessage(data);
      if (message?.channel !== 1) return null;
      const { number, kind, pressed } = message;
      const token = `midi:${kind}:${number}`;
      const repeater = kind === 'note' && number >= 21 && number <= 23;
      if (!pressed) {
        held.delete(token);
        return repeater ? { type: 'repeat', token, division: [4, 8, 16][number - 21], pressed: false } : null;
      }
      if (held.has(token)) return null;
      held.add(token);
      if (kind === 'control-change') {
        if (JAM_TRACK_CC.includes(number)) return { type: 'selectTrack', trackId: PERFORMANCE_TRACKS[JAM_TRACK_CC.indexOf(number)] };
        if (number === 93 || number === 94) return { type: 'page', delta: number === 93 ? -1 : 1 };
        if (number === 97) return { type: 'save' };
        if (number === 98) return { type: 'togglePlayback' };
        return null;
      }
      const row = 8 - Math.floor(number / 10), column = number % 10 - 1;
      if (row >= 0 && row < 4 && column >= 0 && column < 8) return templateCommand(templates, PERFORMANCE_TRACKS[row], column);
      if (number >= 11 && number <= 18) return { type: 'loop', index: number - 11 };
      if (number >= 41 && number <= 48) return { type: 'volume', value: JAM_VOLUME_STEPS[number - 41] };
      if (number >= 31 && number <= 38) return { type: 'cutoff', value: JAM_FILTER_STEPS[number - 31] };
      if (repeater) return { type: 'repeat', token, division: [4, 8, 16][number - 21], pressed: true };
      return null;
    },
  };
}
