import { useEffect } from 'react';
import useMusicStore from '../store/useMusicStore.js';
import { dispatchCommand } from './commandDispatcher.js';
import { mapKeyboardEventToCommand, shouldPreventDefaultForCommand } from './keyboardMap.js';

function useKeyboardCommands(options = {}) {
  const {
    canPasteClip = false,
    enabled = true,
    dispatch = dispatchCommand,
    hasTimelineSelection = false,
  } = options;

  useEffect(() => {
    if (!enabled) return undefined;

    const handleKeyboardEvent = (event) => {
      const state = {
        ...useMusicStore.getState(),
        canPasteClip,
        hasTimelineSelection,
      };
      const command = mapKeyboardEventToCommand(event, state);
      if (!command) return;

      if (shouldPreventDefaultForCommand(command)) {
        event.preventDefault();
      }

      void dispatch(command);
    };

    window.addEventListener('keydown', handleKeyboardEvent);
    window.addEventListener('keyup', handleKeyboardEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyboardEvent);
      window.removeEventListener('keyup', handleKeyboardEvent);
    };
  }, [canPasteClip, dispatch, enabled, hasTimelineSelection]);
}

export default useKeyboardCommands;
