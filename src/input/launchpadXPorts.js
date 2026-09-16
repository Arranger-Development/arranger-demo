function getPortSearchText(port) {
  return `${port?.manufacturer ?? ''} ${port?.name ?? ''}`.trim().toLowerCase();
}

function scoreLaunchpadXMidiPort(port, expectedType) {
  if (
    !port
    || (port.type && port.type !== expectedType)
    || port.state === 'disconnected'
  ) {
    return -1;
  }

  const text = getPortSearchText(port);
  if (text.includes('daw')) return -1;

  const identifiesLaunchpadX = text.includes('launchpad x') || /\blpx\b/.test(text);
  if (!identifiesLaunchpadX) return -1;

  let score = 1;
  if (text.includes('midi')) score += 2;
  if (text.includes('lpx midi')) score += 2;
  if (text.includes('novation')) score += 1;
  return score;
}

function findLaunchpadXMidiPort(ports, expectedType) {
  if (!ports || typeof ports[Symbol.iterator] !== 'function') return null;

  let bestPort = null;
  let bestScore = -1;

  for (const port of ports) {
    const score = scoreLaunchpadXMidiPort(port, expectedType);
    if (score > bestScore) {
      bestPort = port;
      bestScore = score;
    }
  }

  return bestPort;
}

function scoreLaunchpadXMidiInput(port) {
  return scoreLaunchpadXMidiPort(port, 'input');
}

function scoreLaunchpadXMidiOutput(port) {
  return scoreLaunchpadXMidiPort(port, 'output');
}

function findLaunchpadXMidiInput(ports) {
  return findLaunchpadXMidiPort(ports, 'input');
}

function findLaunchpadXMidiOutput(ports) {
  return findLaunchpadXMidiPort(ports, 'output');
}

export {
  findLaunchpadXMidiInput,
  findLaunchpadXMidiOutput,
  scoreLaunchpadXMidiInput,
  scoreLaunchpadXMidiOutput,
};
