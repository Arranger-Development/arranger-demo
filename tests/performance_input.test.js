import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PERFORMANCE_KEYS, mapPerformanceKeyboard, createPerformanceMidiInput, performanceKeyLabel } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame, createLedFrameSender } from '../src/input/launchpadXPerformanceSurface.js';
import { createPerformanceEditor } from '../src/app/performanceEditor.js';
import { createPerformancePlayback } from '../src/app/performancePlayback.js';
import { PERFORMANCE_TRACKS, emptySelection, performanceTemplates, createPerformanceMatrix, createPerformanceSequence } from '../src/app/performanceModel.js';
import { AI_PERFORMANCE_PROFILE_ID } from '../src/data/aiPerformanceTemplates.js';

const templates = Object.fromEntries(Object.entries(performanceTemplates('pop', AI_PERFORMANCE_PROFILE_ID)).map(([track, list]) => [track, list.filter(p => p.id.startsWith('ai-demo-1-'))]));
const session = () => ({ bpm: 100, saved: Array.from({ length: 5 }, emptySelection) });
const key = (code, overrides = {}) => ({ type: 'keydown', code, ...overrides });
const light = (frame, note) => frame.find(([status, number]) => status === 0x90 && number === note)?.[2];

test('four keyboard rows follow actual template order in AI and every ordinary genre', () => {
  for (const group of [templates, ...['pop', 'hip-hop', 'r-and-b', 'electronic-edm', 'rock'].map((genre) => performanceTemplates(genre))]) {
    for (const trackId of PERFORMANCE_TRACKS) {
      PERFORMANCE_KEYS[trackId].forEach((code, index) => {
        const expected = group[trackId][index];
        assert.deepEqual(mapPerformanceKeyboard(key(code), group), expected
          ? { type: 'template', trackId, templateId: expected.id } : null);
        assert.equal(performanceKeyLabel(trackId, index), ({ Semicolon: ';', Comma: ',', Period: '.', Slash: '/' })[code] ?? code.replace(/^(Key|Digit)/, ''));
      });
    }
  }
  // Physical position is independent of key text / Caps Lock.
  assert.deepEqual(mapPerformanceKeyboard(key('KeyQ', { key: 'Q' }), templates), mapPerformanceKeyboard(key('KeyQ', { key: 'q' }), templates));
});

test('typing, composing, held keys, modifiers, transport and loop shortcuts are ignored', () => {
  for (const overrides of [
    { repeat: true }, { type: 'keyup' }, { isComposing: true }, { keyCode: 229 },
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    ...['INPUT', 'TEXTAREA', 'SELECT'].map((tagName) => ({ target: { tagName } })),
    { target: { isContentEditable: true } }, { target: { closest: () => ({}) } },
  ]) assert.equal(mapPerformanceKeyboard(key('KeyQ', overrides), templates), null);
  for (const code of ['Space', 'Enter', 'Escape', 'Tab', 'F1', 'Digit7', 'ArrowRight', 'Numpad1']) {
    assert.equal(mapPerformanceKeyboard(key(code), templates), null);
  }
  assert.ok(mapPerformanceKeyboard(key('KeyQ', { target: { tagName: 'BUTTON' } }), templates));
});

test('Launchpad maps physical top rows and bottom controls; repeat/release/pressure never retrigger', () => {
  const input = createPerformanceMidiInput();
  PERFORMANCE_TRACKS.forEach((trackId, row) => {
    for (let column = 0; column < 8; column += 1) {
      const note = (8 - row) * 10 + column + 1;
      const template = templates[trackId][column];
      assert.deepEqual(input.handle([0x90, note, 127], templates), template
        ? { type: 'template', trackId, templateId: template.id } : null);
      assert.equal(input.handle([0x90, note, 64], templates), null);
      assert.equal(input.handle([0xa0, note, 127], templates), null);
      assert.equal(input.handle([0x80, note, 64], templates), null);
    }
  });
  for (let index = 0; index < 8; index++) assert.deepEqual(input.handle([0x90,11+index,127],templates), {type:'loop',index});
  assert.deepEqual(input.handle([0xb0,97,127],templates), {type:'save'});
  assert.deepEqual(input.handle([0xb0,98,127],templates), {type:'togglePlayback'});
  assert.equal(input.handle([0xb0,98,100],templates),null);
  input.handle([0xb0,98,0],templates);
  assert.deepEqual(input.handle([0xb0,98,127],templates), {type:'togglePlayback'});
  assert.deepEqual(input.handle([0xb0,93,127],templates), {type:'page',delta:-1});
  assert.deepEqual(input.handle([0xb0,94,127],templates), {type:'page',delta:1});
  [89,79,69,59].forEach((cc,i)=>assert.deepEqual(input.handle([0xb0,cc,127],templates),{type:'selectTrack',trackId:PERFORMANCE_TRACKS[i],additive:i>0}));
  [-24,-18,-12,-9,-6,-3,0,6].forEach((value,i)=>assert.deepEqual(input.handle([0x90,41+i,127],templates),{type:'volume',value}));
  [100,250,500,1000,2000,5000,10000,20000].forEach((value,i)=>assert.deepEqual(input.handle([0x90,31+i,127],templates),{type:'cutoff',value}));
  [4,8,16].forEach((division,i)=>{
    const token=`midi:note:${21+i}`;
    assert.deepEqual(input.handle([0x90,21+i,127],templates),{type:'repeat',token,division,pressed:true});
    assert.equal(input.handle([0xa0,21+i,127],templates),null);
    assert.deepEqual(input.handle([0x80,21+i,0],templates),{type:'repeat',token,division,pressed:false});
  });
  for (const data of [[0xb0,95,127],[0x91,81,127]]) assert.equal(input.handle(data,templates),null);
  input.reset();
  assert.deepEqual(input.handle([0xb0,98,127],templates),{type:'togglePlayback'});
});

test('consecutive inputs before rendering preserve tracks, drafts and independent saved snapshots', () => {
  const initial = session();
  const editor = createPerformanceEditor(initial);
  let changes = 0;
  const unsubscribe = editor.subscribe(() => { changes += 1; });
  const midi = createPerformanceMidiInput();
  const actions = [mapPerformanceKeyboard(key('Digit1'), templates), midi.handle([0x90, 51, 127], templates)];
  for (const action of actions) editor.toggleTemplate(action.trackId, action.templateId);
  assert.equal(editor.getSnapshot().drafts[0].drums, templates.drums[0].id);
  assert.equal(editor.getSnapshot().drafts[0].melody, templates.melody[0].id);
  const saved = editor.save();
  editor.toggleTemplate('drums', templates.drums[1].id);
  editor.selectLoop(1);
  editor.toggleTemplate('bass', templates.bass[0].id);
  editor.save();
  editor.selectLoop(0);
  assert.equal(editor.getSnapshot().drafts[0].drums, templates.drums[1].id);
  assert.equal(saved.saved[0].drums, templates.drums[0].id);
  assert.deepEqual(initial.saved, session().saved);
  editor.toggleTemplate('drums', templates.drums[1].id);
  editor.toggleTemplate('melody', templates.melody[0].id);
  assert.deepEqual(editor.save().saved[0], emptySelection());
  assert.equal(editor.setBpm(140).bpm, 140);
  assert.equal(editor.getSnapshot().session.saved[1].bass, templates.bass[0].id);
  assert.equal(editor.selectLoop(5), null);
  assert.ok(changes >= 10);
  unsubscribe();
  const previous = changes;
  editor.selectLoop(2);
  assert.equal(changes, previous);
});

test('Jam LEDs show eight loops, selected track, slider values, repeat ownership and save feedback', () => {
  const sections=Array.from({length:10},(_,i)=>({id:`loop-${i}`,selection:{drums:templates.drums[0].id}}));
  const cc=(frame,n)=>frame.find(([s,k])=>s===0xb0&&k===n)?.[2];
  const base={templates,sections,drafts:{draft:{selection:{drums:templates.drums[0].id}}},editingId:'draft',status:{mode:'jam',playingId:'loop-0',pendingId:'loop-1'},selectedTrack:'bass',volumes:{bass:-8},cutoffs:{bass:1900},repeat:8};
  const frame=createLaunchpadXPerformanceLedFrame(base);
  assert.equal(frame.length,80);
  assert.equal(light(frame,81),17);
  assert.equal(light(frame,11),15); assert.equal(light(frame,12),13); assert.equal(light(frame,18),13);
  assert.equal(cc(frame,69),41); assert.equal(cc(frame,89),19);
  assert.equal(light(frame,44),41); assert.equal(light(frame,45),0);
  assert.equal(light(frame,35),41); assert.equal(light(frame,36),0);
  assert.equal(light(frame,22),41); assert.equal(light(frame,21),43);
  assert.equal(cc(frame,93),0); assert.equal(cc(frame,94),13);
  assert.equal(cc(frame,97),9); assert.equal(cc(createLaunchpadXPerformanceLedFrame({...base,savedAt:10},100),97),17);
  assert.equal(cc(createLaunchpadXPerformanceLedFrame({...base,storageError:true}),97),5);
  for(const n of [24,25,26,27,28]) assert.ok(light(frame,n)>0);
  for(const n of [91,92,95,96]) assert.equal(cc(frame,n),0);
  const next=createLaunchpadXPerformanceLedFrame({...base,page:1,status:{mode:'stopped'}});
  assert.equal(light(next,11),13); assert.equal(light(next,13),0);
  assert.equal(light(next,22),0); assert.equal(cc(next,93),13); assert.equal(cc(next,94),0);
  const waiting=createLaunchpadXPerformanceLedFrame({...base,status:{mode:'sequence',loading:true,requestedId:'loop-2'}},300);
  assert.equal(light(waiting,13),15); assert.equal(light(waiting,21),0); assert.equal(cc(waiting,98),7);
});

test('LED output sends only changed colors and repaints fully after reset or partial failure', () => {
  const sender = createLedFrameSender();
  const sent = [];
  const output = { send: (message) => sent.push(message) };
  const frame = createLaunchpadXPerformanceLedFrame({ templates });
  sender.send(output, frame);
  sender.send(output, frame);
  assert.equal(sent.length, 80);
  sender.send(output, [[0x90, 18, 5]]);
  assert.equal(sent.length, 81);
  sender.reset();
  sender.send(output, frame);
  assert.equal(sent.length, 161);
  assert.throws(() => sender.send({ send() { throw new Error('Disconnected'); } }, [[0x90, 18, 5]]));
  sender.send(output, [[0x90, 18, 5]]);
  assert.equal(sent.length, 162);
});

test('beat indication uses audio position across BPM changes, variable segments, loading and stops', async () => {
  let finish;
  let position = 0;
  let starts = 0;
  const audio = {
    startAudio: async () => { starts += 1; },
    play: () => new Promise((resolve) => { finish = resolve; }),
    stop() {}, stopAllVoices() {}, setTempo() {},
    getPlaybackProgress: () => ({ position }),
  };
  const playback = createPerformancePlayback(audio);
  await playback.unlockAudio();
  assert.equal(starts, 1);
  const selections = session().saved;
  selections[1] = { ...emptySelection(), drums: templates.drums[0].id };
  selections[4] = { ...emptySelection(), chord: templates.chord[1].id };
  playback.sequence(createPerformanceSequence(selections, 'pop', AI_PERFORMANCE_PROFILE_ID), 100);
  assert.equal(playback.getBeatPhase(), 0);
  assert.equal(playback.getProgress(), null);
  finish(true);
  await new Promise((resolve) => setImmediate(resolve));
  position = 34.5;
  assert.equal(playback.getBeatPhase(), .625);
  assert.deepEqual(playback.getProgress(), { segment: 1, fraction: 2.5 / 64 });
  playback.setTempo(180);
  assert.equal(playback.getBeatPhase(), .625);
  playback.preview(createPerformanceMatrix(selections[1], 'pop', AI_PERFORMANCE_PROFILE_ID), 180);
  playback.stop();
  finish(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(playback.getBeatPhase(), 0);
  assert.equal(playback.getProgress(), null);
  assert.equal(playback.isActive(), false);
});


test('eight keyboard and Launchpad slots match the six plus two workbench', () => {
  const slots = Object.fromEntries(PERFORMANCE_TRACKS.map(track => [track, Array.from({length:8}, (_, i) => ({id:`${track}-${i}`}))]));
  for (const track of PERFORMANCE_TRACKS) {
    assert.equal(PERFORMANCE_KEYS[track].length,8);
    PERFORMANCE_KEYS[track].forEach((code,i) => assert.deepEqual(mapPerformanceKeyboard(key(code),slots), {type:'template',trackId:track,templateId:`${track}-${i}`}));
  }
  const frame = createLaunchpadXPerformanceLedFrame({version:4,templates:slots,sections:[],drafts:{draft:{selection:{}}},editingId:'draft',page:0,status:{mode:'stopped'},progress:null,beatPhase:0});
  assert.ok(light(frame,88)>0);
  assert.equal(light(frame,48),0);
  assert.ok(light(frame,87)>0);
});
