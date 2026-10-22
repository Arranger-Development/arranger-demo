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
    if (command.type === 'drumParameter') context.params[command.parameter] = command.value;
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

test('both measured fader bottom 1 and MIDI bottom 0 reach silence, minimum filter, dry reverb and lowest pitch', () => {
  for (const raw of [0, 1]) {
    assert.equal(jamMidiValue('volume', raw), -24);
    assert.equal(jamMidiValue('cutoff', raw), 100);
    assert.equal(jamMidiValue('reverb', raw), 0);
    assert.equal(jamMidiValue('pitch', raw), -12);
  }
  assert.equal(jamMidiValue('volume', 127), 6);
  assert.equal(jamMidiValue('cutoff', 127), 20000);
  assert.equal(jamMidiValue('reverb', 127), 1);
  assert.equal(jamMidiValue('pitch', 127), 12);
  for (const raw of [62, 63, 64, 65]) assert.equal(jamMidiValue('pitch', raw), 0);
});

test('faders wait for pickup; a crossing catches the current value even if MIDI skipped it', () => {
  const { send, commands } = setup();
  send(1, 10); send(1, 90);
  assert.equal(commands.length, 0);
  send(1, 110);
  assert.deepEqual(commands.at(-1), { type: 'volume', parameter: 'volume', value: 2 });
  send(1, 127);
  assert.equal(commands.at(-1).value, 6);
});

test('filter and reverb use existing effect commands and correct endpoints', () => {
  const { send, context, commands } = setup();
  send(2, 127); send(2, 1);
  assert.equal(context.values.cutoff, 100);
  send(3, 1); send(3, 127);
  assert.equal(context.values.reverb, 1);
  assert.deepEqual(commands.map(c => c.type), ['cutoff', 'reverb']);
});

test('changing target selection or project re-arms pickup rather than jumping the new target', () => {
  const { send, context, commands } = setup();
  send(1, 102); send(1, 127);
  context.selectedTrack = 'bass'; context.selectedTracks = ['bass']; context.values.volume = 0;
  const before = commands.length;
  send(1, 126); assert.equal(commands.length, before);
  send(1, 102); send(1, 80); assert.equal(context.values.volume, -5);
  context.projectId = 'project2'; context.values.volume = 0;
  const after = commands.length;
  send(1, 81); assert.equal(commands.length, after);
});

test('mouse and Launchpad changes re-arm the physical control', () => {
  const { send, context, commands } = setup();
  send(3, 0); send(3, 64);
  context.values.reverb = 0.9;
  const before = commands.length;
  send(3, 65); assert.equal(commands.length, before);
  send(3, 115); send(3, 127); assert.equal(context.values.reverb, 1);
});

test('empty effect targets disable faders without disabling drum editing knobs', () => {
  const { context, commands, send } = setup(); context.selectedTracks = [];
  send(1, 102); send(1, 127); send(4, 64); send(4, 127);
  assert.equal(commands.length, 0);
  send(5, 64); send(5, 127);
  assert.equal(commands.at(-1).type, 'drumParameter');
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

test('knobs change only drum drafts and emit five real preset levels with boundary hysteresis', () => {
  const { context, commands, send } = setup();
  send(5, 64); send(5, 0);
  send(5, 16); assert.equal(context.params.strength, 0);
  for (const raw of [18, 50, 83, 127]) send(5, raw);
  assert.deepEqual(commands.map(c => c.value), [0, 25, 50, 75, 100]);
  assert.ok(commands.every(c => c.type === 'drumParameter' && c.parameter === 'strength'));
  send(6, 64); send(6, 127); assert.equal(context.params.groove, 100);
  context.editingTrack = 'bass'; const count = commands.length;
  send(5, 64); send(6, 0); assert.equal(commands.length, count);
});

test('newly opened templates and undo re-arm knob pickup', () => {
  const { context, commands, send } = setup();
  send(5, 64); send(5, 127);
  context.editorVersion += 1; context.params.strength = 50;
  const count = commands.length; send(5, 126); assert.equal(commands.length, count);
  send(5, 64); send(5, 0); assert.equal(context.params.strength, 0);
  context.params.strength = 50;
  const count2 = commands.length; send(5, 1); assert.equal(commands.length, count2);
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
