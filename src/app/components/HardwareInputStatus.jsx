import { MIDI_CONNECTION_STATUS } from '../../input/useLaunchpadXCommands.js';

const STATUS_LABELS = Object.freeze({
  [MIDI_CONNECTION_STATUS.CONNECTED]: 'Launchpad 已连接',
  [MIDI_CONNECTION_STATUS.CONNECTING]: '连接中…',
  [MIDI_CONNECTION_STATUS.DENIED]: '重新授权 MIDI',
  [MIDI_CONNECTION_STATUS.DISCONNECTED]: '重新连接 Launchpad',
  [MIDI_CONNECTION_STATUS.ERROR]: '重试 MIDI',
  [MIDI_CONNECTION_STATUS.IDLE]: '连接 Launchpad',
  [MIDI_CONNECTION_STATUS.UNSUPPORTED]: '浏览器不支持 MIDI',
});

function HardwareInputStatus({
  captureLabel = 'CAPTURE = PLAY',
  deviceName = null,
  errorMessage = null,
  lastMessage = '',
  ledAvailable = false,
  ledErrorMessage = null,
  onConnect = () => {},
  status = MIDI_CONNECTION_STATUS.IDLE,
}) {
  const label = STATUS_LABELS[status] ?? STATUS_LABELS[MIDI_CONNECTION_STATUS.ERROR];
  const canConnect = ![
    MIDI_CONNECTION_STATUS.CONNECTED,
    MIDI_CONNECTION_STATUS.CONNECTING,
    MIDI_CONNECTION_STATUS.UNSUPPORTED,
  ].includes(status);
  const inputOnly = status === MIDI_CONNECTION_STATUS.CONNECTED && !ledAvailable;
  const detail = inputOnly
    ? [lastMessage, 'LED 不可用'].filter(Boolean).join(' · ')
    : lastMessage || (
      status === MIDI_CONNECTION_STATUS.CONNECTED ? captureLabel : 'MIDI INPUT'
    );
  const title = [
    deviceName,
    errorMessage,
    ledErrorMessage,
    inputOnly && 'LED output unavailable',
    lastMessage && `Last MIDI: ${lastMessage}`,
  ]
    .filter(Boolean)
    .join(' · ') || label;

  return (
    <button
      className="hardware-midi-control"
      data-status={status}
      type="button"
      aria-label={label}
      title={title}
      disabled={!canConnect}
      onClick={canConnect ? onConnect : undefined}
    >
      <span className="hardware-midi-dot" aria-hidden="true" />
      <span className="hardware-midi-label">{label}</span>
      <span className="hardware-midi-message" aria-live="polite">{detail}</span>
    </button>
  );
}

export { HardwareInputStatus };
