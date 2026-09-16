import { PERFORMANCE_TRACKS } from '../app/performanceModel.js';
import { parseLaunchpadXMessage } from './launchpadXProtocol.js';

export const PERFORMANCE_KEYS = {
  drums: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],
  chord: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'],
  bass: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'],
  melody: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN'],
};
export function performanceKeyLabel(trackId, index) {
  return PERFORMANCE_KEYS[trackId]?.[index]?.replace(/^(Key|Digit)/, '') ?? '';
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

// One press per physical depression. Releases only clear the latch; pressure,
// peripheral controls and other MIDI channels never enter the performance route.
export function createPerformanceMidiInput() {
  const held = new Set();
  return {
    reset() { held.clear(); },
    handle(data, templates) {
      const message = parseLaunchpadXMessage(data);
      if (message?.channel !== 1 || message.kind !== 'note') return null;
      if (!message.pressed) { held.delete(message.number); return null; }
      if (held.has(message.number)) return null;
      held.add(message.number);
      const row = 8 - Math.floor(message.number / 10);
      const column = message.number % 10 - 1;
      if (row >= 0 && row < 4 && column >= 0 && column < 6) {
        return templateCommand(templates, PERFORMANCE_TRACKS[row], column);
      }
      if (message.number >= 11 && message.number <= 15) return { type: 'loop', index: message.number - 11 };
      if (message.number === 17) return { type: 'save' };
      if (message.number === 18) return { type: 'togglePlayback' };
      return null;
    },
  };
}
