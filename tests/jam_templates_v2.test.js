import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DIAL_PITCHED_PRESETS, getDialPitchedPreset } from '../src/data/dialPitchedPresets.js';
import { getJamPitchedPreset } from '../src/app/jamPitchedPresets.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { jamTemplatePage, jamSavedPageCount, normalizeJamSlots } from '../src/app/jamTemplateSlots.js';
import { blankJamDraft, hasJamNotes, applyJamTrackParameter } from '../src/app/jamDraftActions.js';
import { jamParameterLevels, jamTrackParameters } from '../src/app/jamPerformanceState.js';
import { setJamPitchedNote, jamPitchedRenderState } from '../src/app/jamNoteEditing.js';
import { createJamMidiController } from '../src/input/jamMidiController.js';
import { collectProjectEvents, getDurationSeconds, getEventTime } from '../src/export/audioFile.js';

const pitchNumber = note => {
  const [, name, octave] = /^([A-G]#?)(-?\d+)$/.exec(note);
  return (Number(octave) + 1) * 12 + ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(name);
};

test('all 80 Session presets preserve every source MIDI event, length, velocity and fractional timing', () => {
  assert.equal(DIAL_PITCHED_PRESETS.length, 80);
  assert.equal(new Set(DIAL_PITCHED_PRESETS.map(p => p.id)).size, 80);
  let total = 0, fractional = 0, repeated = 0;
  for (const preset of DIAL_PITCHED_PRESETS) {
    const adapter = createMatrixPlaybackAdapter({ [preset.trackId]: preset.bars }, { totalBars: preset.barCount });
    const tuples = [];
    for (let bar = 0; bar < preset.barCount; bar++) for (let step = 0; step < 16; step++) {
      const events = adapter.getEventsForStep(bar, step);
      for (const event of events) {
        assert.equal(getDurationSeconds(event,120),event.durationSteps/8);
        assert.equal(getEventTime(event,120),(bar*16+step+(event.timingOffset ?? 0))/8);
        for (const note of event.notes ?? [event.note]) tuples.push([pitchNumber(note),bar*16+step+(event.timingOffset ?? 0),event.durationSteps,event.velocity]);
        fractional += !Number.isInteger(event.timingOffset) || !Number.isInteger(event.durationSteps);
      }
      repeated += Object.values(preset.bars[bar][step]?.notePerformances ?? {}).filter(p => p.length > 1).length;
    }
    tuples.sort((a,b) => { for(let i=0;i<4;i++) if(a[i]!==b[i]) return a[i]-b[i]; return 0; });
    const canonical = tuples.map(([note,...values]) => `${note}:${values.map(v=>v.toFixed(9)).join(':')}`).join('\n');
    assert.equal(tuples.length, preset.sourceEventCount, preset.id);
    assert.equal(createHash('sha256').update(canonical).digest('hex'),preset.sourceEventHash,preset.id);
    assert.equal(adapter.getPositionForFlatStep(preset.barCount*16).bar,0);
    total += tuples.length;
  }
  assert.equal(total,2728); assert.ok(fractional > 1000); assert.equal(repeated,2);
});

test('all 55 authored chord and melody phrases retain source MIDI and feel through Deep Autumn export', () => {
  const presets=DIAL_PITCHED_PRESETS.filter(p=>p.trackId==='chord'||p.trackId==='melody');
  assert.equal(presets.length,55);
  for(const preset of presets) {
    const before=structuredClone(preset),bars=structuredClone(preset.bars),timbreId=`deep-autumn-${preset.trackId}`;
    for(const cell of bars.flat())if(cell)cell.requestedTimbreId=timbreId;
    const events=collectProjectEvents({matrix:{[preset.trackId]:bars},trackOrder:[preset.trackId],totalBars:preset.barCount,bpm:120});
    assert.ok(events.every(event=>event.timbreId===timbreId&&event.playbackMode==='natural'));
    const tuples=events.flatMap(event=>(event.notes??[event.note]).map(note=>[
      pitchNumber(note),getEventTime(event,120)*8,getDurationSeconds(event,120)*8,event.velocity,
    ]));
    tuples.sort((a,b)=>{for(let i=0;i<4;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;});
    const canonical=tuples.map(([note,...values])=>`${note}:${values.map(v=>v.toFixed(9)).join(':')}`).join('\n');
    assert.equal(tuples.length,preset.sourceEventCount,preset.id);
    assert.equal(createHash('sha256').update(canonical).digest('hex'),preset.sourceEventHash,preset.id);
    assert.deepEqual(preset,before,'playback and export must not rewrite the source preset');
  }
});

test('slots accept 9/16/17 templates, retain holes after deletion and survive project reload', () => {
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const store=createJamTemplateProjects(storage,'pop',null,100);
  const draft=blankJamDraft('bass','round-electric-bass',0);
  draft.bars[0]=setJamPitchedNote(draft.bars[0],0,'C1',2,false,'bass');
  const saved=[];
  for(let slot=0;slot<17;slot++) {
    saved.push(store.saveTemplate({...draft,targetSlot:slot},`Slot ${slot+1}`));
    if([8,15,16].includes(slot)) assert.equal(jamSavedPageCount(store.current().workspace.templates),Math.floor(slot/8)+1);
  }
  store.removeTemplate('bass',saved[2].id);
  let row=store.current().workspace.templates.bass;
  assert.equal(row.length,16); assert.equal(jamTemplatePage(row)[2],null);
  assert.equal(jamTemplatePage(row,1)[7].id,saved[15].id);
  assert.equal(jamTemplatePage(row,2)[0].id,saved[16].id);
  assert.equal(store.saveTemplate({...draft,targetSlot:3},'Occupied'),null);
  const replacement=store.saveTemplate({...draft,targetSlot:2},'Fill hole');
  assert.equal(replacement.slotIndex,2);
  const reload=createJamTemplateProjects(storage,'pop',null,100);
  row=reload.current().workspace.templates.bass;
  assert.equal(jamTemplatePage(row)[2].id,replacement.id);
  assert.equal(jamTemplatePage(row,1)[7].id,saved[15].id);
  assert.equal(reload.saveTemplate({...saved[16],bars:draft.bars},'Updated',saved[16].id).slotIndex,16);
  assert.deepEqual(normalizeJamSlots([{id:'old-a'},{id:'old-b'}]).map(p=>p.slotIndex),[0,1]);
});

test('all tracks start genuinely blank and empty saves are rejected without destroying the draft', () => {
  const store=createJamTemplateProjects({getItem:()=>null,setItem(){}},'pop',null,88);
  for(const track of ['drums','chord','bass','melody']) {
    const draft=blankJamDraft(track,'default',12);
    assert.equal(draft.bars.length,1); assert.equal(hasJamNotes(draft),false);
    store.setDraft(draft); assert.equal(store.saveTemplate(draft,'Empty'),null);
    assert.deepEqual(store.current().workspace.draft,draft);
  }
});

test('pitched editors preserve untouched feel and replace only the edited pitch; bass stays monophonic per step', () => {
  for(const track of ['chord','bass','melody']) {
    const preset=getDialPitchedPreset(track,50,track==='chord'?60:50);
    const bars=structuredClone(preset.bars),before=structuredClone(bars);
    const step=bars[0].findIndex(Boolean),cell=bars[0][step],notes=cell.notes??[cell.note];
    const pitch=notes[0], edited=setJamPitchedNote(bars[0],step,pitch,3,false,track);
    assert.deepEqual(bars,before);
    for(const other of notes.slice(1)) assert.deepEqual(edited[step].notePerformances[other],cell.notePerformances[other]);
    const events=createMatrixPlaybackAdapter({[track]:[edited]},{totalBars:1}).getEventsForStep(0,step);
    const changed=events.filter(e=>(e.notes??[e.note]).includes(pitch));
    assert.equal(changed.length,1);assert.equal(changed[0].timingOffset,0);assert.equal(changed[0].durationSteps,3);
    assert.equal(jamPitchedRenderState(edited,step,pitch,track).active,true);
    assert.equal(jamPitchedRenderState(setJamPitchedNote(edited,step,pitch,1,true,track),step,pitch,track).start,false);
  }
  const bar=setJamPitchedNote(setJamPitchedNote(Array(16).fill(null),0,'C1',4,false,'bass'),0,'D1',2,false,'bass');
  assert.equal(bar[0].note,'D1');assert.equal(bar[0].notes,undefined);
  let melody=setJamPitchedNote(Array(16).fill(null),0,'C4',4,false,'melody');
  melody=setJamPitchedNote(melody,0,'E4',2,false,'melody');
  assert.deepEqual(melody[0].notes,['C4','E4']);
});

test('four-track macros use authored presets, leave the original manual draft intact, and normalize six chord levels', () => {
  assert.deepEqual(jamParameterLevels('chord','groove'),[0,20,40,60,80,100]);
  assert.equal(jamTrackParameters({groove:50},'chord').groove,60);
  for(const track of ['drums','chord','bass','melody']) {
    const draft=blankJamDraft(track,'default',7);const before=structuredClone(draft);
    const next=applyJamTrackParameter(draft,'strength',75);
    assert.deepEqual(draft,before);assert.equal(next.targetSlot,7);assert.equal(next.params.strength,75);assert.ok(hasJamNotes(next));
    if(track!=='drums') assert.deepEqual(next.bars,getJamPitchedPreset(track,75,track==='chord'?60:50).bars);
    assert.equal(applyJamTrackParameter(next,'strength',75),next);
  }
});

test('MIDI left chord color uses six Level values, displays physical percentage and directly takes over across track changes', () => {
  const context={active:true,projectId:'p',editorVersion:1,editingTrack:'chord',selectedTracks:[],params:{strength:50,groove:60},parameterLevels:{groove:jamParameterLevels('chord','groove')}};
  const seen=[];
  const c=createJamMidiController({getContext:()=>context,dispatch:cmd=>{seen.push(cmd);context.params[cmd.parameter]=cmd.value;}});
  assert.equal(c.handle([0xb3,5,0]),true);
  c.handle([0xb3,5,76]); c.handle([0xb3,5,127]);
  assert.equal(seen.at(-1).value,100);
  for(const raw of [0,25,51,76,102,127]) c.handle([0xb3,5,raw]);
  assert.deepEqual([...new Set(seen.map(cmd=>cmd.value))].sort((a,b)=>a-b),[0,20,40,60,80,100]);
  context.editingTrack='melody';context.params.groove=50;context.parameterLevels.groove=jamParameterLevels('melody','groove');
  assert.equal(c.handle([0xb3,5,127]),false); c.handle([0xb3,5,126]);
  assert.equal(seen.at(-1).trackId,'melody');assert.equal(seen.at(-1).value,100);
  assert.equal(c.getSnapshot().strength.percent,99);
});
