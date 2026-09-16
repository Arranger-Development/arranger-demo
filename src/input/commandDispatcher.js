import { getTotalBars } from '../domain/projectLength.js';
import useMusicStore from '../store/useMusicStore.js';
import { APP_COMMAND_TYPES } from './appCommands.js';
import { isValidAppCommand } from './commandGuards.js';

function getStore(deps) {
  return deps.store ?? useMusicStore;
}

async function maybeCall(fn, ...args) {
  if (typeof fn !== 'function') return;
  await fn(...args);
}

async function maybeCallMethod(target, methodName, ...args) {
  const fn = target?.[methodName];
  if (typeof fn !== 'function') return;
  await fn.call(target, ...args);
}

function createAudioPlayOptions(store, state, audio, command = {}) {
  const positionObserver = audio?.onPositionChange;
  const matrixSource = () => {
    const currentState = store.getState();
    if (!currentState.trackInstancesById || !currentState.trackOrder) return currentState.matrix;
    return {
      matrix: currentState.matrix,
      trackInstancesById: currentState.trackInstancesById,
      trackOrder: currentState.trackOrder,
    };
  };
  let snapshot;
  let previousMatrix;
  let previousInstances;
  let previousOrder;
  const playbackSource = () => {
    const current = store.getState();
    const totalBars = getTotalBars(current);
    if (!snapshot || current.matrix !== previousMatrix
      || current.trackInstancesById !== previousInstances || current.trackOrder !== previousOrder
      || totalBars !== snapshot.totalBars) {
      previousMatrix = current.matrix;
      previousInstances = current.trackInstancesById;
      previousOrder = current.trackOrder;
      snapshot = { matrix: matrixSource(), totalBars };
    }
    return snapshot;
  };
  return {
    audibleTrackIds: command.audibleTrackIds,
    bpm: state.bpm,
    totalBars: getTotalBars(state),
    bar: state.currentBar,
    maxPlaybackSteps: command.maxPlaybackSteps,
    step: state.currentStep,
    matrixSource,
    playbackSource,
    melodyTimbreSource: () => store.getState().melodyTimbreId,
    onPositionChange: (bar, step) => {
      syncStoreTransportPosition(store, bar, step);
      positionObserver?.(bar, step);
    },
    volumeSource: () => {
      const currentState = store.getState();
      return {
        mutedTracks: currentState.mutedTracks,
        volumes: currentState.volumes,
      };
    },
  };
}

function syncStoreTransportPosition(store, bar, step) {
  const state = store.getState();
  if (typeof state.setTransportPosition === 'function') {
    state.setTransportPosition(bar, step);
    return;
  }

  state.setPosition?.(bar, step);
  state.setSeekPosition?.(bar, step);
}

async function dispatchTransportCommand(command, deps) {
  const store = getStore(deps);
  const state = store.getState();

  switch (command.type) {
    case APP_COMMAND_TYPES.TRANSPORT_TOGGLE_PLAY:
      if (state.isPlaying) {
        state.pause?.();
        await maybeCallMethod(deps.audio, 'pause');
      } else {
        state.play?.();
        await maybeCallMethod(
          deps.audio,
          'play',
          createAudioPlayOptions(store, state, deps.audio, command),
        );
      }
      return { ok: true };

    case APP_COMMAND_TYPES.TRANSPORT_STOP:
      state.stop?.();
      await maybeCallMethod(deps.audio, 'stop');
      return { ok: true };

    case APP_COMMAND_TYPES.TRANSPORT_STOP_AND_REWIND:
      state.stop?.();
      await maybeCallMethod(deps.audio, 'stop');
      syncStoreTransportPosition(store, 0, 0);
      await maybeCallMethod(deps.audio, 'seekToStep', 0, 0);
      return { ok: true };

    case APP_COMMAND_TYPES.TRANSPORT_SEEK:
      syncStoreTransportPosition(store, command.bar, command.step);
      await maybeCallMethod(deps.audio, 'seekToStep', command.bar, command.step);
      return { ok: true };

    default:
      return null;
  }
}

async function dispatchClipCommand(command, deps) {
  const store = getStore(deps);
  const state = store.getState();

  switch (command.type) {
    case APP_COMMAND_TYPES.CLIP_COPY_SELECTED:
      await maybeCall(deps.handlers?.clip?.copySelected, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CLIP_DELETE_SELECTED:
      state.deleteSelectedClip?.();
      return { ok: true };

    case APP_COMMAND_TYPES.CLIP_PASTE:
      await maybeCall(deps.handlers?.clip?.paste, command);
      return { ok: true };

    default:
      return null;
  }
}

async function dispatchTrackCommand(command, deps) {
  if (command.type !== APP_COMMAND_TYPES.TRACK_TOGGLE_MUTE) return null;

  const state = getStore(deps).getState();
  state.toggleTrackMute?.(command.trackId);
  await maybeCallMethod(deps.audio, 'refreshTrackVolume', command.trackId);
  return { ok: true };
}

async function dispatchHandlerCommand(command, deps) {
  const { handlers = {} } = deps;

  switch (command.type) {
    case APP_COMMAND_TYPES.APP_REDO:
      await maybeCall(handlers.app?.redo, command);
      return { ok: true };

    case APP_COMMAND_TYPES.APP_UNDO:
      await maybeCall(handlers.app?.undo, command);
      return { ok: true };

    case APP_COMMAND_TYPES.TUTORIAL_NEXT:
      await maybeCall(handlers.tutorial?.next, command);
      return { ok: true };

    case APP_COMMAND_TYPES.TUTORIAL_COMPLETE_TASK:
      await maybeCall(handlers.tutorial?.completeTask, command);
      return { ok: true };

    case APP_COMMAND_TYPES.DRUMS_TOGGLE:
      await maybeCall(handlers.drums?.toggle, command);
      if (command.preview) {
        if (command.trackId) {
          await maybeCallMethod(
            deps.audio,
            'triggerDrumsStep',
            command.instrument,
            undefined,
            { trackId: command.trackId },
          );
        } else {
          await maybeCallMethod(deps.audio, 'triggerDrumsStep', command.instrument);
        }
      }
      return { ok: true };

    case APP_COMMAND_TYPES.DRUMS_PREVIEW:
      if (command.trackId) {
        await maybeCallMethod(
          deps.audio,
          'triggerDrumsStep',
          command.instrument,
          undefined,
          { immediate: true, trackId: command.trackId },
        );
      } else {
        await maybeCallMethod(
          deps.audio,
          'triggerDrumsStep',
          command.instrument,
          undefined,
          { immediate: true },
        );
      }
      return { ok: true };

    case APP_COMMAND_TYPES.DRUMS_SELECT_CLIP:
      await maybeCall(handlers.drums?.selectClip, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_SELECT_CLIP:
      await maybeCall(handlers.chord?.selectClip, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_TOGGLE_RHYTHM:
      await maybeCall(handlers.chord?.toggleRhythm, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_OPEN_HARMONY:
      await maybeCall(handlers.chord?.openHarmony, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_CLOSE_HARMONY:
      await maybeCall(handlers.chord?.closeHarmony, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_APPLY_HARMONY_OPTION:
      await maybeCall(handlers.chord?.applyHarmonyOption, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_SELECT_HARMONY_OPTION:
      await maybeCall(handlers.chord?.selectHarmonyOption, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_PREVIEW_HARMONY_OPTION:
      await maybeCall(handlers.chord?.previewHarmonyOption, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_SELECT_OPTION:
      await maybeCall(handlers.chord?.selectOption, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_CONFIRM:
      await maybeCall(handlers.chord?.confirm, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_SET_CELL:
      await maybeCall(handlers.chord?.setCell, command);
      return { ok: true };

    case APP_COMMAND_TYPES.CHORD_CLEAR_CELL:
      await maybeCall(handlers.chord?.clearCell, command);
      return { ok: true };

    case APP_COMMAND_TYPES.MELODY_NOTE_ON:
      await maybeCallMethod(deps.audio, 'triggerMelodyInputOneShot', command.note);
      return { ok: true };

    case APP_COMMAND_TYPES.MELODY_NOTE_OFF:
      await maybeCall(handlers.melody?.noteOff, command);
      return { ok: true };

    case APP_COMMAND_TYPES.MELODY_SELECT_CLIP:
      await maybeCall(handlers.melody?.selectClip, command);
      return { ok: true };

    case APP_COMMAND_TYPES.MELODY_SELECT_STEP:
      await maybeCall(handlers.melody?.selectStep, command);
      return { ok: true };

    default:
      return null;
  }
}

async function dispatchCommand(command, deps = {}) {
  if (!isValidAppCommand(command, (deps.store ?? useMusicStore).getState())) {
    return { ok: false, reason: 'invalid-command' };
  }

  const transportResult = await dispatchTransportCommand(command, deps);
  if (transportResult) return transportResult;

  const clipResult = await dispatchClipCommand(command, deps);
  if (clipResult) return clipResult;

  const trackResult = await dispatchTrackCommand(command, deps);
  if (trackResult) return trackResult;

  const handlerResult = await dispatchHandlerCommand(command, deps);
  if (handlerResult) return handlerResult;

  return { ok: false, reason: 'unhandled-command' };
}

function createCommandDispatcher(deps = {}) {
  return (command) => dispatchCommand(command, deps);
}

export { createCommandDispatcher, dispatchCommand };
