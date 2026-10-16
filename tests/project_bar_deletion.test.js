import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import useMusicStore from '../src/store/useMusicStore.js';
import { getTimelineBars } from '../src/domain/projectLength.js';
import { createUndoSnapshot, restoreUndoSnapshot, pushHistoryCheckpoint, createUndoTransition, createRedoTransition } from '../src/app/undoHistory.js';
import { createProjectFile } from '../src/export/projectFile.js';
import { createMidiFile } from '../src/export/midiFile.js';
import { renderProjectToWav } from '../src/export/audioFile.js';

const reset = () => useMusicStore.setState(useMusicStore.getInitialState(), true);
afterEach(reset);
function filledProject(length = 8) {
  reset();
  if (length > 8) useMusicStore.getState().extendProject(length);
  const extra = useMusicStore.getState().addTrackInstance('melody');
  const state = useMusicStore.getState();
  for (const track of state.trackOrder) for (let bar = 0; bar < length; bar++) {
    state.createClip(track, bar);
    state.setCell(track, bar, 0, { note: 'C4', marker: `${track}:${bar}` });
  }
  return extra;
}
test('ripple deletion atomically moves all tracks and IDs while preserving custom clip data', () => {
  const extra = filledProject();
  const state = useMusicStore.getState();
  state.renameClip(`${extra}-bar-6`, '保留名字');
  state.selectClip(`${extra}-bar-6`);
  const before = useMusicStore.getState(), original = structuredClone(before.matrix);
  const updates = [];
  const unsub = useMusicStore.subscribe(s => updates.push(s));
  assert.equal(before.deleteProjectBars(2, 4), true); unsub();
  const next = useMusicStore.getState();
  assert.equal(updates.length, 1); assert.equal(next.totalBars, 5); assert.equal(getTimelineBars(next), 8);
  for (const [track, bars] of Object.entries(next.matrix)) {
    assert.deepEqual(bars, [...original[track].slice(0, 2), ...original[track].slice(5)]);
    if (next.trackOrder.includes(track)) assert.equal(next.clips.byId[`${track}-bar-2`].bar, 2);
  }
  assert.equal(next.selectedClipId, `${extra}-bar-3`); assert.equal(next.selectedBar, 3);
  assert.equal(next.clips.byId[next.selectedClipId].name, '保留名字');
  assert.equal(next.clips.ids.length, next.trackOrder.length * 5);
  assert.equal(new Set(next.clips.ids).size, next.clips.ids.length);
  for (const key of ['volumes', 'mutedTracks', 'trackOrder', 'trackInstancesById', 'bpm']) assert.deepEqual(next[key], before[key]);
  assert.deepEqual(before.matrix, original);
});
test('first and last columns, blank columns and 256-bar projects shorten exactly', () => {
  for (const [length, start, end] of [[8,0,0], [8,7,7], [8,2,4], [256,127,130]]) {
    reset(); useMusicStore.getState().extendProject(length);
    assert.ok(useMusicStore.getState().deleteProjectBars(start, end));
    const next = useMusicStore.getState();
    assert.equal(next.totalBars, length - (end - start + 1));
    assert.ok(Object.values(next.matrix).every(b => b.length === next.totalBars));
  }
});
test('deleted selections clear; transport before, inside and after the range maps correctly', () => {
  for (const [bar, step, expectedBar, expectedStep] of [[0,7,0,7], [3,9,2,0], [7,12,4,12]]) {
    filledProject(); const s = useMusicStore.getState(); s.selectClip('drums-bar-3'); s.setPosition(bar,step);
    s.deleteProjectBars(2,4); const next=useMusicStore.getState();
    assert.equal(next.selectedClipId,null); assert.equal(next.selectedBar,2);
    assert.deepEqual([next.currentBar,next.currentStep,next.seekBar,next.seekStep],[expectedBar,expectedStep,expectedBar,expectedStep]);
  }
  useMusicStore.getState().setPosition(4,8);
  useMusicStore.getState().deleteProjectBars(3,4);
  assert.equal(useMusicStore.getState().seekBar,2); assert.equal(useMusicStore.getState().seekStep,0);
});
test('all bars become one empty bar; invalid ranges and repeated empty deletion are no-ops', () => {
  filledProject(); useMusicStore.getState().setPosition(6,4);
  useMusicStore.getState().deleteProjectBars(0,7);
  const next=useMusicStore.getState();
  assert.equal(next.totalBars,1); assert.equal(next.clips.ids.length,0);
  assert.ok(Object.values(next.matrix).every(b=>b.length===1 && b[0].every(c=>c===null)));
  assert.equal(next.seekBar,0); assert.equal(next.seekStep,0);
  for(const [a,b] of [[0,0],[-1,0],[0,1],[1,0],[0.5,0.5],[NaN,0]]) {
    assert.equal(next.deleteProjectBars(a,b),false); assert.equal(useMusicStore.getState(),next);
  }
});
test('delete, add, move and paste cannot collide with reindexed clip IDs', () => {
  filledProject(); const s=useMusicStore.getState(); s.deleteProjectBars(2,4);
  const copied=useMusicStore.getState().createClipClipboardSnapshot('drums-bar-2');
  s.deleteClip('drums-bar-3');
  assert.ok(s.pasteClipClipboardSnapshot(copied,'drums',3));
  s.deleteClip('drums-bar-4'); assert.ok(s.moveClipToBar('drums-bar-3',4));
  assert.ok(s.createClip('drums',3));
  const next=useMusicStore.getState();
  assert.equal(new Set(next.clips.ids).size,next.clips.ids.length);
  assert.deepEqual(next.matrix.drums[4],copied.barData);
  assert.ok(next.createClip('drums',5));
  assert.equal(useMusicStore.getState().totalBars,6);
  assert.ok(Object.values(useMusicStore.getState().matrix).every(bars => bars.length === 6));
});
test('one deletion checkpoint restores music, IDs, length and range; new edits clear redo', () => {
  filledProject(); const selection={startBar:2,endBar:4,trackIds:['drums']};
  const before=createUndoSnapshot({appState:useMusicStore.getState(),editorState:{timelineSelection:selection}});
  useMusicStore.getState().deleteProjectBars(2,4);
  const after=createUndoSnapshot({appState:useMusicStore.getState(),editorState:{timelineSelection:null}});
  const history=pushHistoryCheckpoint({undoHistory:[],snapshot:before});
  assert.equal(history.undoHistory.length,1);
  const undo=createUndoTransition({...history,currentSnapshot:after}); let restoredSelection;
  restoreUndoSnapshot({snapshot:undo.snapshot,store:useMusicStore,setTimelineSelection:value=>{restoredSelection=value;}});
  assert.deepEqual(restoredSelection,selection); assert.equal(useMusicStore.getState().totalBars,8);
  const redo=createRedoTransition({...undo,currentSnapshot:before});
  restoreUndoSnapshot({snapshot:redo.snapshot,store:useMusicStore});
  assert.equal(useMusicStore.getState().totalBars,5);
  assert.deepEqual(createUndoSnapshot({appState:useMusicStore.getState()}).appState,after.appState);
  assert.equal(pushHistoryCheckpoint({...undo,snapshot:before}).redoHistory.length,0);
});
test('saved project and MIDI use the shortened actual length', () => {
  reset(); useMusicStore.getState().deleteProjectBars(2,4);
  const state=useMusicStore.getState(), file=JSON.parse(JSON.stringify(createProjectFile(state)));
  assert.equal(file.arrangement.totalBars,5); assert.ok(Object.values(file.arrangement.matrix).every(b=>b.length===5));
  const midi=createMidiFile(state), view=new DataView(midi.buffer,midi.byteOffset,midi.byteLength);
  let offset=14; const endings=[];
  while(offset<midi.length) {
    const end=offset+8+view.getUint32(offset+4); offset+=8; let tick=0;
    const variable=()=>{let n=0,b;do{b=midi[offset++];n=(n<<7)|(b&127);}while(b&128);return n;};
    while(offset<end) { tick+=variable(); const status=midi[offset++];
      if(status===255){const type=midi[offset++],size=variable();offset+=size;if(type===47)endings.push(tick);}
      else offset+=(status&240)===192||(status&240)===208?1:2;
    }
  }
  assert.ok(endings.length>0 && endings.every(t=>t===5*1920));
});
test('WAV rendering includes only remaining bars plus the existing tail', async t => {
  reset(); useMusicStore.getState().deleteProjectBars(2,7);
  const previous=globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext=class {
    constructor(channels,frames,rate){this.frames=frames;this.rate=rate;this.destination={};}
    createGain(){return {gain:{value:1},connect(){}};}
    async startRendering(){return {numberOfChannels:2,length:this.frames,sampleRate:this.rate,getChannelData:()=>new Float32Array(this.frames)};}
  };
  t.after(()=>{if(previous)globalThis.OfflineAudioContext=previous;else delete globalThis.OfflineAudioContext;});
  const result=await renderProjectToWav({...useMusicStore.getState(),bpm:240},{chunkSeconds:10});
  assert.equal(result.durationSeconds,2);
  assert.equal(new DataView(await result.blob.arrayBuffer()).getUint32(40,true),(2+3)*44100*4);
});
