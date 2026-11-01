import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamMidiController, createJamMidiConnection, findJamMidiInput, jamMidiValue } from '../src/input/jamMidiController.js';

function setup() {
  const context = { active: true, projectId: 'project1', editorVersion: 1, editingTrack: 'drums',
    selectedTrack: 'drums', selectedTracks: ['drums'], playing: true,
    values: { volume: 0, cutoff: 20000, reverb: 0, pitch: 0 }, params: { strength: 50, groove: 50 } };
  const commands = [];
  const controller = createJamMidiController({ getContext: () => context, dispatch(command) {
    commands.push(command);
    if (command.type === 'trackParameter') context.params[command.parameter] = command.value;
    else context.values[command.type] = command.type === 'pitch' && !command.pressed ? 0 : command.value;
  } });
  return { context, commands, controller, send: (cc, raw) => controller.handle([0xb3, cc, raw]) };
}

test('recognizes only this controller input, leaving Launchpad and output ports alone', () => {
  const pad = { type: 'input', name: 'Launchpad X MIDI', state: 'connected' };
  const output = { type: 'output', name: '4AC1F4C4', state: 'connected' };
  const offline = { type: 'input', name: '4AC1F4C4', state: 'disconnected' };
  const device = { type: 'input', name: '4AC1F4C4', state: 'connected' };
  assert.equal(findJamMidiInput([pad, output, offline, device]), device);
  assert.equal(findJamMidiInput([pad, output, offline]), null);
});

test('recognizes both F4C4 hardware names and the product alias with case and spacing variations', () => {
  for (const name of ['4AC0F4C4', '4AC1F4C4', 'MIDIF4C4', '4ac0f4c4', '4AC0-F4C4 MIDI 1']) {
    const device = { type: 'input', name, state: 'connected' };
    assert.equal(findJamMidiInput([device]), device, name);
    assert.equal(findJamMidiInput([{ ...device, type: 'output' }]), null, name);
    assert.equal(findJamMidiInput([{ ...device, state: 'disconnected' }]), null, name);
  }
  assert.equal(findJamMidiInput([{ type: 'input', name: 'Unrelated MIDI controller', state: 'connected' }]), null);
});

test('accepts only measured channel 4 CC1–6, ignoring other devices/protocols and malformed data', () => {
  const { controller, commands } = setup();
  for (const message of [[0xb0, 1, 102], [0x93, 1, 102], [0xb3, 7, 64], [0xb3, 5, 128], [0xb3, 5, -1], [0xb3, 5], [0xb3, 5, 1.5]]) {
    assert.equal(controller.handle(message), false);
  }
  assert.equal(commands.length, 0);
});

test('both measured fader bottom 1 and MIDI bottom 0 reach silence, filter off, dry reverb and lowest pitch', () => {
  for (const raw of [0, 1]) {
    assert.equal(jamMidiValue('volume', raw), -24);
    assert.equal(jamMidiValue('cutoff', raw), 20000);
    assert.equal(jamMidiValue('reverb', raw), 0);
    assert.equal(jamMidiValue('pitch', raw), -12);
  }
  assert.equal(jamMidiValue('volume', 127), 6);
  assert.equal(jamMidiValue('cutoff', 127), 100);
  assert.equal(jamMidiValue('reverb', 127), 1);
  assert.equal(jamMidiValue('pitch', 127), 12);
  for (const raw of [62, 63, 64, 65]) assert.equal(jamMidiValue('pitch', raw), 0);
});

test('faders apply their first received value immediately without pickup', () => {
  const { send, commands } = setup();
  send(1, 10);
  assert.equal(commands.at(-1).value, -22);
  send(1, 90); assert.equal(commands.at(-1).value, -3);
  send(1, 110);
  assert.deepEqual(commands.at(-1), { type: 'volume', parameter: 'volume', value: 2 });
  send(1, 127);
  assert.equal(commands.at(-1).value, 6);
});

test('filter and reverb use existing effect commands and correct endpoints', () => {
  const { send, context, commands } = setup();
  send(2, 1); send(2, 127);
  assert.equal(context.values.cutoff, 100);
  send(3, 1); send(3, 127);
  assert.equal(context.values.reverb, 1);
  assert.deepEqual(commands.map(c => c.type), ['cutoff', 'reverb']);
});

test('filter fader strengthens upward and returns to off at the bottom', () => {
  let previous = 20000;
  for (let raw = 0; raw <= 127; raw++) {
    const cutoff = jamMidiValue('cutoff', raw);
    assert.ok(cutoff <= previous && cutoff >= 100);
    previous = cutoff;
  }
  const { send, context } = setup();
  send(2, 1); send(2, 64);
  assert.equal(context.values.cutoff, 10000);
  send(2, 127); assert.equal(context.values.cutoff, 100);
  send(2, 1); assert.equal(context.values.cutoff, 20000);
});

test('filter follows the first value and immediately controls a newly selected target', () => {
  const { send, context, commands } = setup();
  context.values.cutoff = 5000;
  send(2, 20); assert.equal(context.values.cutoff, 16900);
  send(2, 60); assert.equal(context.values.cutoff, 10600);
  send(2, 96); assert.equal(context.values.cutoff, 5000);
  send(2, 127); assert.equal(context.values.cutoff, 100);
  context.selectedTrack = 'bass'; context.selectedTracks = ['bass']; context.values.cutoff = 20000;
  const count = commands.length;
  send(2, 126); assert.equal(commands.length, count + 1);
  send(2, 1); send(2, 64);
  assert.equal(context.values.cutoff, 10000);
});

test('changing target selection or project does not require crossing the software value', () => {
  const { send, context, commands } = setup();
  send(1, 102); send(1, 127);
  context.selectedTrack = 'bass'; context.selectedTracks = ['bass']; context.values.volume = 0;
  const before = commands.length;
  send(1, 126); assert.equal(commands.length, before + 1);
  send(1, 102); send(1, 80); assert.equal(context.values.volume, -5);
  context.projectId = 'project2'; context.values.volume = 0;
  const after = commands.length;
  send(1, 81); assert.equal(commands.length, after + 1);
});

test('first fader message after mouse or Launchpad changes takes over directly', () => {
  const { send, context, commands } = setup();
  send(3, 0); send(3, 64);
  context.values.reverb = 0.9;
  const before = commands.length;
  send(3, 65); assert.equal(commands.length, before + 1); assert.equal(context.values.reverb, 0.51);
  send(3, 115); send(3, 127); assert.equal(context.values.reverb, 1);
});

test('empty effect targets disable faders without disabling drum editing knobs', () => {
  const { context, commands, send } = setup(); context.selectedTracks = [];
  send(1, 102); send(1, 127); send(4, 64); send(4, 127);
  assert.equal(commands.length, 0);
  send(5, 64); send(5, 127);
  assert.equal(commands.at(-1).type, 'trackParameter');
  assert.equal(context.params.strength, 100);
});

test('pitch stays at the last position until manually centered; reset releases only its own token', () => {
  const { send, context, commands, controller } = setup();
  send(4, 64); send(4, 127);
  assert.equal(context.values.pitch, 12);
  assert.equal(commands.at(-1).pressed, true);
  send(4, 63); assert.equal(context.values.pitch, 0);
  assert.equal(commands.at(-1).pressed, false);
  send(4, 1); assert.equal(context.values.pitch, -12);
  controller.reset(); assert.equal(context.values.pitch, 0);
  assert.equal(commands.at(-1).token, 'midif4c4:pitch');
  const count = commands.length; controller.reset(); assert.equal(commands.length, count);
});

test('stopping disables pitch but leaves stopped-state mix adjustments available', () => {
  const { send, context, commands } = setup();
  send(4, 64); send(4, 127); context.playing = false;
  send(4, 100); assert.equal(commands.at(-1).pressed, false);
  const count = commands.length; send(4, 127); assert.equal(commands.length, count);
  send(1, 102); send(1, 1); assert.equal(context.values.volume, -24);
});

test('knobs address the edited track directly and emit five levels with boundary hysteresis', () => {
  const { context, commands, send } = setup();
  send(5, 64); send(5, 0);
  send(5, 16); assert.equal(context.params.strength, 0);
  for (const raw of [18, 50, 83, 127]) send(5, raw);
  assert.deepEqual(commands.map(c => c.value), [0, 25, 50, 75, 100]);
  assert.ok(commands.every(c => c.type === 'trackParameter' && c.trackId === 'drums' && c.parameter === 'strength'));
  send(6, 64); send(6, 127); assert.equal(context.params.groove, 100);
  for (const trackId of ['bass','chord','melody']) {
    send(5, 127);
    context.editingTrack = trackId; context.params = { strength: 50, groove: 50 };
    const count = commands.length;
    send(5, 127); assert.equal(commands.length, count, 'unchanged report must not change a newly opened track');
    send(5, 126); assert.equal(context.params.groove, 100, 'left Level knob takes over without crossing 50');
    assert.equal(context.params.strength,50,'left knob leaves the right Int axis unchanged');
    send(5, 0);
    assert.equal(commands.at(-1).trackId, trackId); assert.equal(context.params.groove, 0);
  }
  context.editingTrack = null; const count = commands.length;
  send(5, 64); send(5, 127); assert.equal(commands.length, count);
});

test('new templates and undo preserve notes until actual movement, then take over immediately', () => {
  const { context, commands, send } = setup();
  send(5, 64); send(5, 127);
  context.editorVersion += 1; context.params.strength = 50;
  const count = commands.length; send(5, 127); assert.equal(commands.length, count);
  send(5, 126); assert.equal(context.params.strength, 100);
  send(5, 0); assert.equal(context.params.strength, 0);
  context.params.strength = 50;
  send(5, 1); assert.equal(context.params.strength, 0);
});

test('opening position snapshots update continuous UI values without changing the musical draft', () => {
  const { controller, commands, context, send } = setup();
  const events = []; const unsubscribe = controller.subscribe(() => events.push(controller.getSnapshot()));
  assert.deepEqual(controller.getSnapshot(), { strength: null, groove: null });
  controller.handle([0xb3, 5, 38], { positionOnly: true });
  controller.handle([0xb3, 6, 76], { positionOnly: true });
  assert.equal(commands.length, 0);
  assert.deepEqual(context.params, { strength: 50, groove: 50 });
  assert.deepEqual(controller.getSnapshot().strength, { raw: 38, percent: 30, display: true });
  assert.equal(controller.getSnapshot().groove.percent, 60);
  send(5, 38); assert.equal(commands.length, 0);
  send(5, 39); assert.equal(context.params.strength, 25);
  assert.equal(controller.getSnapshot().strength.percent, 31);
  assert.equal(events.length, 3);
  unsubscribe(); send(5, 40); assert.equal(events.length, 3);
});

test('unreported initial position never swallows the first real movement', () => {
  const { controller, send, context } = setup();
  assert.equal(controller.getSnapshot().strength, null);
  assert.equal(send(5, 38), true);
  assert.equal(context.params.strength, 25);
  assert.equal(controller.getSnapshot().strength.percent, 30);
});

test('positions are captured without an editor and across inactive/blocked contexts, with no deferred edits', () => {
  const { controller, context, commands, send } = setup();
  context.editingTrack = null; send(5, 38);
  context.editingTrack = 'bass'; controller.reset(); controller.showPositions();
  assert.equal(controller.getSnapshot().strength.percent, 30);
  assert.equal(commands.length, 0);
  send(5, 38); assert.equal(commands.length, 0);
  send(5, 39); assert.equal(context.params.groove, 25);
  context.blocked = true; send(6, 20);
  context.blocked = false; send(6, 20); assert.equal(context.params.strength, 50);
  context.active = false; send(6, 25);
  context.active = true; send(6, 25); assert.equal(context.params.strength, 50);
  send(6, 26); assert.equal(context.params.strength, 25);
});

test('software edits and undo show musical values without losing hardware positions; disconnect clears positions', () => {
  const { controller, send } = setup();
  send(5, 38); send(6, 76);
  controller.useSoftwareValue('strength');
  assert.deepEqual(controller.getSnapshot().strength, { raw: 38, percent: 30, display: false });
  assert.equal(controller.getSnapshot().groove.display, true);
  send(5, 38); assert.equal(controller.getSnapshot().strength.display, false, 'duplicate hardware report cannot override undo');
  send(5, 39); assert.equal(controller.getSnapshot().strength.display, true);
  controller.useSoftwareValue();
  assert.equal(controller.getSnapshot().groove.display, false);
  controller.reset(); controller.showPositions();
  assert.equal(controller.getSnapshot().groove.display, true);
  controller.disconnect(); assert.deepEqual(controller.getSnapshot(), { strength: null, groove: null });
});

test('inactive mode and open confirmations ignore controls', () => {
  for (const flag of ['blocked', 'active']) {
    const { context, commands, send } = setup();
    context[flag] = flag === 'blocked';
    for (const cc of [1, 2, 3, 4, 5, 6]) { send(cc, 64); send(cc, 127); }
    assert.equal(commands.length, 0);
  }
});

const flush = () => new Promise(resolve => setImmediate(resolve));
class EventSource {
  listeners = new Map();
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, event = {}) { this.listeners.get(type)?.forEach(fn => fn(event)); }
}
function midiSetup(ports = []) {
  const access = new EventSource(); access.inputs = new Map(ports.map((p, i) => [i, p]));
  let resets = 0; const messages = [];
  const connection = createJamMidiConnection({ requestAccess: async () => access,
    controller: { reset() { resets += 1; }, handle(data) { messages.push(data); } } });
  return { connection, access, messages, resetCount: () => resets };
}
function input(name = '4AC1F4C4') {
  return Object.assign(new EventSource(), { name, type: 'input', state: 'connected', open: async () => {} });
}

test('controller connects independently and preserves Launchpad handlers', async () => {
  const pad = input('Launchpad X'), device = input();
  const { connection, access, messages } = midiSetup([pad, device]);
  const existing = () => {}; access.onstatechange = existing; pad.onmidimessage = existing;
  let otherMessages = 0; device.addEventListener('midimessage', () => { otherMessages += 1; });
  await connection.connect();
  assert.equal(connection.getSnapshot().status, 'connected');
  pad.emit('midimessage', { data: [0xb3, 1, 127] }); assert.equal(messages.length, 0);
  device.emit('midimessage', { data: [0xb3, 1, 127] }); assert.equal(messages.length, 1);
  assert.equal(access.onstatechange, existing); assert.equal(pad.onmidimessage, existing);
  connection.dispose(); device.emit('midimessage', { data: [0xb3, 1, 0] });
  assert.equal(messages.length, 1); assert.equal(otherMessages, 2);
});

test('4AC0F4C4 connects and forwards its controls alongside Launchpad', async () => {
  const pad = input('Launchpad X'), device = input('4AC0F4C4');
  const { connection, messages } = midiSetup([pad, device]);
  try {
    await connection.connect();
    assert.equal(connection.getSnapshot().status, 'connected');
    assert.equal(connection.getSnapshot().deviceName, '4AC0F4C4');
    device.emit('midimessage', { data: new Uint8Array([0xb3, 4, 64]) });
    pad.emit('midimessage', { data: new Uint8Array([0xb3, 4, 127]) });
    assert.deepEqual(messages.map(data => Array.from(data)), [[0xb3, 4, 64]]);
  } finally { connection.dispose(); }
});

test('hot unplug releases pitch and hot plug rebinds without duplicate listeners', async () => {
  const device = input(); const { access, connection, messages, resetCount } = midiSetup([device]);
  await connection.connect();
  const before = resetCount(); device.state = 'disconnected'; access.emit('statechange'); await flush();
  assert.equal(connection.getSnapshot().status, 'disconnected'); assert.ok(resetCount() > before);
  device.emit('midimessage', { data: [0xb3, 1, 0] }); assert.equal(messages.length, 0);
  device.state = 'connected'; access.emit('statechange'); await flush();
  await connection.connect(); device.emit('midimessage', { data: [0xb3, 1, 0] });
  assert.equal(messages.length, 1); connection.dispose();
});

test('no controller connected is reported without interfering with another MIDI device', async () => {
  const { connection } = midiSetup([input('Launchpad X')]);
  await connection.connect(); assert.equal(connection.getSnapshot().status, 'disconnected'); connection.dispose();
});

test('permission denial and failed device open report errors; teardown cancels late access', async () => {
  const controller = { reset() {}, handle() {} };
  const connection = createJamMidiConnection({ controller, requestAccess: async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); } });
  await connection.connect(); assert.equal(connection.getSnapshot().status, 'denied');
  const device = input(); device.open = async () => { throw new Error('unplugged'); };
  const setup = midiSetup([device]); await setup.connection.connect();
  assert.equal(setup.connection.getSnapshot().status, 'error'); setup.connection.dispose();
  let resolve; const late = createJamMidiConnection({ controller, requestAccess: () => new Promise(r => { resolve = r; }) });
  const connecting = late.connect(); late.dispose(); resolve(setup.access); await connecting;
  assert.equal(setup.access.listeners.get('statechange')?.size ?? 0, 0);
});

test('port opening snapshots arrive before readiness and cannot generate notes or an undo command', async () => {
  const { controller, commands, context } = setup();
  const device = input(), access = new EventSource(); access.inputs = new Map([['knobs', device]]);
  device.open = async () => {
    device.emit('midimessage', { data: [0xb3, 5, 38] });
    await flush();
    device.emit('midimessage', { data: [0xb3, 6, 76] });
  };
  const connection = createJamMidiConnection({ controller, requestAccess: async () => access });
  await connection.connect();
  assert.equal(connection.getSnapshot().status, 'connected');
  assert.equal(controller.getSnapshot().strength.percent, 30);
  assert.equal(controller.getSnapshot().groove.percent, 60);
  assert.equal(commands.length, 0);
  assert.deepEqual(context.params, { strength: 50, groove: 50 });
  device.emit('midimessage', { data: [0xb3, 5, 39] });
  assert.equal(commands.length, 1); assert.equal(context.params.strength, 25);
  device.state = 'disconnected'; access.emit('statechange'); await flush();
  assert.deepEqual(controller.getSnapshot(), { strength: null, groove: null });
  device.open = async () => {}; device.state = 'connected'; access.emit('statechange'); await flush();
  assert.equal(connection.getSnapshot().status, 'connected');
  assert.equal(controller.getSnapshot().strength, null, 'no fake cached value after reconnect');
  device.emit('midimessage', { data: [0xb3, 5, 126] });
  assert.equal(context.params.strength, 100, 'first real movement after reconnect is not discarded');
  connection.dispose();
});

test('failed or cancelled opening removes its listener and never leaves a stale physical position', async () => {
  const { controller, commands } = setup();
  const device = input(), access = new EventSource(); access.inputs = new Map([['knobs', device]]);
  let resolve;
  device.open = () => new Promise(r => { resolve = r; });
  const connection = createJamMidiConnection({ controller, requestAccess: async () => access });
  const connecting = connection.connect(); await flush();
  device.emit('midimessage', { data: [0xb3, 5, 38] });
  assert.equal(controller.getSnapshot().strength.percent, 30);
  connection.dispose(); resolve(); await connecting;
  assert.equal(connection.getSnapshot().status, 'idle');
  assert.equal(device.listeners.get('midimessage').size, 0);
  assert.equal(controller.getSnapshot().strength, null);
  device.emit('midimessage', { data: [0xb3, 5, 127] }); assert.equal(commands.length, 0);
});

test('measured startup fader batch is recorded and applied once opening succeeds, without touching phrase parameters', async () => {
  const { controller, commands, context } = setup();
  context.playing = false; context.values.cutoff = 800; context.values.reverb = .4;
  const device = input(), access = new EventSource(); access.inputs = new Map([['faders', device]]);
  device.open = async () => {
    for (const [cc, raw] of [[1,127],[2,0],[3,1],[4,65]]) device.emit('midimessage', { data: [0xb3, cc, raw] });
    assert.equal(commands.length, 0, 'failed/cancelled opening must not apply an initial batch');
  };
  const connection = createJamMidiConnection({ controller, requestAccess: async () => access });
  await connection.connect();
  assert.deepEqual(context.values, { volume: 6, cutoff: 20000, reverb: 0, pitch: 0 });
  assert.deepEqual(controller.getFaderSnapshot(), {
    volume: { raw: 127, value: 6 }, cutoff: { raw: 0, value: 20000 },
    reverb: { raw: 1, value: 0 }, pitch: { raw: 65, value: 0 },
  });
  assert.deepEqual(context.params, { strength: 50, groove: 50 });
  assert.deepEqual(controller.getSnapshot(), { strength: null, groove: null });
  assert.deepEqual(commands.map(c => c.type), ['volume','cutoff','reverb']);
  controller.syncFaders(); assert.equal(commands.length, 3, 'consumed initial values cannot override later software changes');
  connection.dispose(); assert.ok(Object.values(controller.getFaderSnapshot()).every(v => v === null));
});

test('unfocused or inactive startup is recorded; pitch waits for playback and resumes from its recorded position', () => {
  const { controller, commands, context, send } = setup();
  context.active = false; context.playing = false;
  send(1,127); send(4,100); send(5,38);
  assert.equal(commands.length, 0);
  assert.equal(controller.getFaderSnapshot().pitch.value, 6.8);
  context.active = true; controller.syncFaders();
  assert.equal(context.values.volume, 6); assert.equal(context.values.pitch, 0);
  assert.equal(context.params.strength, 50, 'knob data must never be replayed as an initial phrase edit');
  context.playing = true; controller.syncFaders(); assert.equal(context.values.pitch, 6.8);
  context.playing = false; controller.suspendPitch(); controller.syncFaders(); assert.equal(context.values.pitch, 0);
  context.playing = true; controller.syncFaders(); assert.equal(context.values.pitch, 6.8);
  controller.disconnect(); assert.equal(context.values.pitch, 0);
  controller.syncFaders(); assert.equal(context.values.pitch, 0);
});

test('startup failure discards recorded faders before they can change software values', async () => {
  const { controller, commands } = setup();
  const device = input(), access = new EventSource(); access.inputs = new Map([['device', device]]);
  device.open = async () => { device.emit('midimessage', { data: [0xb3,1,127] }); throw new Error('unplugged'); };
  const connection = createJamMidiConnection({ controller, requestAccess: async () => access });
  await connection.connect(); controller.syncFaders();
  assert.equal(connection.getSnapshot().status, 'error'); assert.equal(commands.length, 0);
  assert.equal(controller.getFaderSnapshot().volume, null);
  connection.dispose();
});

test('fader value matching the display anchor still applies to all selected effect targets', () => {
  const { context, commands, send } = setup(); context.selectedTracks = ['drums','chord'];
  send(3,0);
  assert.deepEqual(commands.at(-1), { type: 'reverb', parameter: 'reverb', value: 0 });
});
