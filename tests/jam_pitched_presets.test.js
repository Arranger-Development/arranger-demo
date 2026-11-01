import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAL_PITCHED_PRESETS, getDialPitchedPreset } from '../src/data/dialPitchedPresets.js';
import { JAM_PITCHED_PRESETS, getJamPitchedPreset, snapJamPitchedPreset } from '../src/app/jamPitchedPresets.js';
import { applyJamTrackParameter, blankJamDraft } from '../src/app/jamDraftActions.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { collectProjectEvents, getDurationSeconds } from '../src/export/audioFile.js';
import { jamTrackKnobs, jamParameterLevels } from '../src/app/jamPerformanceState.js';
import { createJamMidiController } from '../src/input/jamMidiController.js';

for(const trackId of ['chord','bass','melody'])test(`${trackId} left knob follows Level and right rhythm follows Int for every source preset`,()=>{
  const [left,right]=jamTrackKnobs(trackId);
  assert.deepEqual([left.label,left.lowLabel,left.highLabel],trackId==='chord'?['色彩','清晰','朦胧']:['旋律','纯净','丰富']);
  assert.deepEqual([right.label,right.lowLabel,right.highLabel],['律动','轻盈','激昂']);
  for(const preset of JAM_PITCHED_PRESETS.filter(p=>p.trackId===trackId)) {
    const context={active:true,editingTrack:trackId,params:{strength:50,groove:trackId==='chord'?60:50}};
    const controller=createJamMidiController({getContext:()=>context,dispatch:cmd=>{context.params[cmd.parameter]=cmd.value;}});
    const levelValues=jamParameterLevels(trackId,'groove');
    const level=levelValues.indexOf(preset.groove),int=jamParameterLevels(trackId,'strength').indexOf(preset.strength);
    controller.handle([0xb3,5,Math.round(level*127/(levelValues.length-1))]);
    controller.handle([0xb3,6,Math.round(int*127/4)]);
    assert.deepEqual(context.params,{strength:preset.strength,groove:preset.groove});
    assert.equal(preset.sourceName,`Level ${level+(trackId==='chord'?0:1)} - Int${int+1}`);
    assert.equal(preset.name,`${left.label}${preset.groove} · 律动${preset.strength}`);
    assert.equal(getJamPitchedPreset(trackId,context.params.strength,context.params.groove).id,preset.id);
  }
});

test('all 80 Jam pitched presets align starts and ends without losing pitches, velocities or source data', () => {
  const original=getDialPitchedPreset('chord',0,0);
  assert.equal(getJamPitchedPreset('chord',0,0).bars[0][0].notePerformances['C#3'][0].durationSteps,16);
  assert.equal(original.bars[0][0].notePerformances['C#3'][0].durationSteps,15.4);
  for(const preset of JAM_PITCHED_PRESETS) {
    const source=DIAL_PITCHED_PRESETS.find(p=>p.id===preset.id),before=structuredClone(source);
    const tuples=p=>p.bars.flat().flatMap(cell=>Object.entries(cell?.notePerformances??{}).flatMap(([note,hits])=>hits.map(hit=>[note,hit.velocity])))
      .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    assert.deepEqual(tuples(preset),tuples(source),preset.id);
    assert.equal(preset.bars.length,source.bars.length);
    for(const cell of preset.bars.flat())for(const hits of Object.values(cell?.notePerformances??{}))for(const hit of hits) {
      assert.equal(hit.offsetSteps,0);
      assert.ok(Number.isInteger(hit.durationSteps)&&hit.durationSteps>=1);
    }
    assert.deepEqual(snapJamPitchedPreset(preset),preset,'alignment is idempotent');
    assert.deepEqual(source,before,'raw Ableton import remains intact');
  }
});

test('grid snapping fills near-bar tails, preserves a complete rest step and retains simultaneous chord tones',()=>{
  const fixture={trackId:'chord',barCount:1,bars:[[{
    type:'notes',notes:['C3','E3','G3'],notePerformances:{
      C3:[{offsetSteps:0,durationSteps:15.4,velocity:.7}],
      E3:[{offsetSteps:.4,durationSteps:14.6,velocity:.5}],
      G3:[{offsetSteps:.6,durationSteps:.2,velocity:.6}],
    },
  },...Array(15).fill(null)]]};
  const snapped=snapJamPitchedPreset(fixture);
  assert.equal(snapped.bars[0][0].notePerformances.C3[0].durationSteps,16);
  assert.equal(snapped.bars[0][0].notePerformances.E3[0].durationSteps,15);
  assert.equal(snapped.bars[0][1].notePerformances.G3[0].durationSteps,1);
  assert.deepEqual(snapped.bars[0][0].notes,['C3','E3']);
});

test('the full-bar note reaches knob editing, saved gems, playback and WAV events at 16 steps', () => {
  let draft={...blankJamDraft('chord','deep-autumn-chord',2),params:{strength:25,groove:0}};
  draft=applyJamTrackParameter(draft,'strength',0);
  assert.deepEqual(draft.bars,getJamPitchedPreset('chord',0,0).bars);
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const store=createJamTemplateProjects(storage,'pop',null,100);
  assert.ok(store.saveTemplate(draft,'Full bar'));
  const saved=createJamTemplateProjects(storage,'pop',null,100).current().workspace.templates.chord[0];
  const state={matrix:{chord:saved.bars},trackOrder:['chord'],totalBars:4,bpm:100};
  const live=createMatrixPlaybackAdapter(state.matrix,{totalBars:4}).getEventsForStep(0,0)[0];
  const exported=collectProjectEvents(state).find(event=>event.bar===0&&event.step===0);
  for(const event of [live,exported]) {
    assert.deepEqual(event.notes,['C#3']);
    assert.equal(event.durationSteps,16);
    assert.equal(event.gateDuration,true);
    assert.equal(getDurationSeconds(event,100),2.4);
  }
});
