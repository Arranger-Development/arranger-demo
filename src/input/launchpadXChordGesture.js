import { APP_COMMAND_TYPES } from './appCommands.js';
import { getLaunchpadXChordStep } from './launchpadXChordSurface.js';
import { parseLaunchpadXMessage } from './launchpadXProtocol.js';

const LAUNCHPAD_X_CHORD_LONG_PRESS_MS = 300;

function isActiveChordTarget(context, bar, step) {
  return (
    context?.chordActive === true
    && context?.selectedBar === bar
    && context?.matrix?.chord?.[bar]?.[step]?.type === 'chord'
  );
}

function createLaunchpadXChordGestureController({
  cancelSchedule = (timerId) => globalThis.clearTimeout(timerId),
  dispatch = () => {},
  getContext = () => ({}),
  schedule = (callback, delay) => globalThis.setTimeout(callback, delay),
} = {}) {
  let pending = null;

  const cancel = () => {
    if (!pending) return;
    cancelSchedule(pending.timerId);
    pending = null;
  };

  const handle = (data) => {
    const message = parseLaunchpadXMessage(data);
    if (message?.channel !== 1 || message.kind !== 'note') return false;

    const step = getLaunchpadXChordStep(message.number);
    if (step === null) return false;

    if (!message.pressed) {
      if (!pending || pending.note !== message.number) return false;

      const gesture = pending;
      cancelSchedule(gesture.timerId);
      pending = null;
      if (!gesture.opened && isActiveChordTarget(getContext(), gesture.bar, gesture.step)) {
        dispatch({
          type: APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM,
          bar: gesture.bar,
          step: gesture.step,
        });
      }
      return true;
    }

    const context = getContext();
    const harmonyActive = context?.chordHarmonyState?.bar === context?.selectedBar;
    if (harmonyActive || !context?.chordActive) return false;

    const bar = context.selectedBar;
    if (!isActiveChordTarget(context, bar, step)) return false;

    if (pending?.note === message.number) return true;
    cancel();

    const gesture = {
      bar,
      note: message.number,
      opened: false,
      step,
      timerId: null,
    };
    gesture.timerId = schedule(() => {
      if (pending !== gesture) return;
      if (!isActiveChordTarget(getContext(), gesture.bar, gesture.step)) {
        pending = null;
        return;
      }

      gesture.opened = true;
      dispatch({
        type: APP_COMMAND_TYPES.CHORD_OPEN_HARMONY,
        bar: gesture.bar,
        step: gesture.step,
      });
    }, LAUNCHPAD_X_CHORD_LONG_PRESS_MS);
    pending = gesture;
    return true;
  };

  return { cancel, handle };
}

export {
  createLaunchpadXChordGestureController,
  LAUNCHPAD_X_CHORD_LONG_PRESS_MS,
};
