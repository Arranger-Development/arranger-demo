import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createJamMidiConnection, createJamMidiController } from './jamMidiController.js';

function createDevice() {
  let context = { active: false, controlsRef: null, focused: true };
  const connection = createJamMidiConnection({
    requestAccess: async () => {
      if (!navigator.requestMIDIAccess) throw new Error('当前浏览器不支持 MIDI，请使用 Chrome 或 Edge');
      let timer;
      try {
        return await Promise.race([
          navigator.requestMIDIAccess({ sysex: false }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MIDI 连接未完成，请确认浏览器权限，或在 Chrome / Edge 中重试')), 15000); }),
        ]);
      } finally { clearTimeout(timer); }
    },
    controller: createJamMidiController({
      getContext() {
        const current = context;
        const snapshot = current.controlsRef?.current?.getMidiContext();
        return snapshot ? { ...snapshot, active: current.active && current.focused } : null;
      },
      dispatch: command => context.controlsRef?.current?.dispatch(command),
    }),
  });
  return { connection, update(next) { context = { ...context, ...next }; } };
}

export default function useJamMidiController({ active, controlsRef }) {
  const [device] = useState(createDevice);
  const { connection } = device;
  const state = useSyncExternalStore(connection.subscribe, connection.getSnapshot);
  useLayoutEffect(() => {
    device.update({ active, controlsRef });
    if (!active) connection.reset();
  }, [active, controlsRef, connection, device]);
  useEffect(() => {
    const blur = () => { device.update({ focused: false }); connection.reset(); };
    const focus = () => { device.update({ focused: true }); };
    const visibility = () => { if (document.hidden) blur(); else device.update({ focused: document.hasFocus() }); };
    device.update({ focused: document.hasFocus() });
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
      connection.dispose();
    };
  }, [connection, device]);
  return { ...state, connect: connection.connect, reset: connection.reset };
}
