const MIDI_STATUS = Object.freeze({
  CONTROL_CHANGE: 0xb0,
  NOTE_OFF: 0x80,
  NOTE_ON: 0x90,
});

function isMidiByte(value, max = 0xff) {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

function readThreeByteMessage(data) {
  if (!data || typeof data.length !== 'number' || data.length < 3) return null;

  const bytes = [Number(data[0]), Number(data[1]), Number(data[2])];
  if (!isMidiByte(bytes[0]) || !isMidiByte(bytes[1], 0x7f) || !isMidiByte(bytes[2], 0x7f)) {
    return null;
  }

  return bytes;
}

function parseLaunchpadXMessage(data) {
  const bytes = readThreeByteMessage(data);
  if (!bytes) return null;

  const [status, number, value] = bytes;
  const messageType = status & 0xf0;
  const channel = (status & 0x0f) + 1;

  if (messageType === MIDI_STATUS.NOTE_ON || messageType === MIDI_STATUS.NOTE_OFF) {
    return {
      channel,
      kind: 'note',
      number,
      pressed: messageType === MIDI_STATUS.NOTE_ON && value > 0,
      value,
    };
  }

  if (messageType === MIDI_STATUS.CONTROL_CHANGE) {
    return {
      channel,
      kind: 'control-change',
      number,
      pressed: value > 0,
      value,
    };
  }

  return null;
}

function formatMidiMessage(data) {
  if (!data || typeof data.length !== 'number') return '';

  return Array.from(data, (value) => Number(value))
    .filter((value) => isMidiByte(value))
    .map((value) => value.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export { formatMidiMessage, parseLaunchpadXMessage };
