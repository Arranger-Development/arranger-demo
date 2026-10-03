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
export const JAM_PITCH_STEPS = [-12, -7, -3, -1, 1, 3, 7, 12];
export const JAM_REVERB_STEPS = [0, 1/7, 2/7, 3/7, 4/7, 5/7, 6/7, 1];
export const JAM_EFFECT_PAGES = ['mix', 'expression', 'arp'];
export const JAM_TRACK_CC = [89, 79, 69, 59];
export function nearestJamStep(steps, value) {
  return steps.reduce((best, step, index) => Math.abs(step - value) < Math.abs(steps[best] - value) ? index : best, 0);
}

// Remember each press command: releasing after a page change uses its original role.
export function createPerformanceMidiInput() {
  const held = new Map();
  return {
    reset() { held.clear(); },
    handle(data, templates, surface = {}) {
      const message = parseLaunchpadXMessage(data);
      if (message?.channel !== 1) return null;
      const { number, kind, pressed } = message;
      const token = `midi:${kind}:${number}`;
      if (!pressed) {
        const original = held.get(token); held.delete(token);
        return original?.pressed ? { ...original, pressed: false } : null;
      }
      if (held.has(token)) return null;
      let command = null;
      if (kind === 'control-change') {
        if (JAM_TRACK_CC.includes(number)) {
          const additive = [...held.values()].some(c => c?.type === 'selectTrack');
          command = { type: 'selectTrack', trackId: PERFORMANCE_TRACKS[JAM_TRACK_CC.indexOf(number)], additive };
        }
        if ([49,39,29].includes(number)) command = { type: 'effectPage', page: JAM_EFFECT_PAGES[[49,39,29].indexOf(number)] };
        if (number === 19) command = { type: 'recordEffects' };
        if (number === 93 || number === 94) command = { type: 'page', delta: number === 93 ? -1 : 1 };
        if (number === 97) command = { type: 'save' };
        if (number === 98) command = { type: 'togglePlayback' };
      } else {
        const row = 8 - Math.floor(number / 10), column = number % 10 - 1;
        if (row >= 0 && row < 4 && column >= 0 && column < 8) command = templateCommand(templates, PERFORMANCE_TRACKS[row], column);
        if (number >= 11 && number <= 18) command = { type: 'loop', index: number - 11 };
        if (number >= 21 && number <= 23) command = { type: 'repeat', token, division: [4,8,16][number-21], pressed: true };
        if (number >= 24 && number <= 27) command = { type: 'chopper', token, value: [4,8,16,32][number-24], pressed: true };
        if (number === 28) command = { type: 'brake', token, value: 1, pressed: true };
        const page = surface.effectPage ?? 'mix';
        if (number >= 41 && number <= 48) {
          const index = number - 41;
          command = page === 'mix' ? { type: 'volume', value: JAM_VOLUME_STEPS[index] }
            : page === 'expression' ? { type: 'pitch', token, value: JAM_PITCH_STEPS[index], pressed: true }
              : index === 0 ? { type: 'arp', token, index, pressed: true } : null;
        }
        if (number >= 31 && number <= 38) {
          const index = number - 31;
          command = page === 'mix' ? { type: 'cutoff', value: JAM_FILTER_STEPS[index] }
            : page === 'expression' ? { type: 'reverb', value: JAM_REVERB_STEPS[index] }
              : null;
        }
      }
      held.set(token, command); return command;
    },
  };
}
