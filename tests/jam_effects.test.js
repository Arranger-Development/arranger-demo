import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamEffects } from '../src/app/jamEffects.js';
test('screen and hardware share one last-press repeater owner; switching tracks releases the old track',()=>{
 const calls=[],fx=createJamEffects({setPerformanceEffect:(...args)=>calls.push(args)});
 fx.repeat.press('pointer:1',4,100);fx.repeat.press('midi:22',8,100);fx.repeat.release('pointer:1');assert.equal(fx.repeat.getSnapshot(),8);
 fx.select('bass');assert.deepEqual(calls.at(-1),['drums',{held:false}]);assert.equal(fx.repeat.getSnapshot(),null);
 fx.repeat.press('midi:23',16,100);fx.repeat.release('midi:22');assert.equal(fx.repeat.getSnapshot(),16);fx.reset();assert.deepEqual(calls.at(-1),['bass',{held:false}]);
});
test('filter values survive track selection but reset together without changing volume',()=>{
 const calls=[],fx=createJamEffects({setPerformanceEffect:(...args)=>calls.push(args)});fx.cutoff('drums',500);fx.select('melody');fx.cutoff('melody',2000);fx.select('drums');assert.equal(fx.getSnapshot().cutoffs.drums,500);
 fx.reset(true);assert.ok(Object.values(fx.getSnapshot().cutoffs).every(n=>n===20000));assert.ok(calls.every(([,patch])=>patch.volume===undefined));
});

test('releasing simultaneous performance effects restores every target and preserves mix settings',()=>{
 const calls=[],fx=createJamEffects({setPerformanceEffect:(track,patch)=>calls.push({track,patch})});
 fx.select('bass',true);fx.volume('drums',-8);fx.cutoff('drums',800);fx.reverb(.4);
 fx.repeat.press('screen:repeat',8,100);fx.press('pitch','screen:pitch',5,100);
 fx.press('chopper','midi:chopper',16,100);fx.press('brake','midi:brake',1,100);
 for(const track of ['drums','bass']) {
  const state=fx.getSnapshot();
  assert.equal(state.repeats[track],8);assert.equal(state.pitches[track],5);
  assert.equal(state.choppers[track],16);assert.equal(state.brakes[track],1);
 }
 fx.resetHolds();
 for(const track of ['drums','bass']) {
  const state=fx.getSnapshot();
  assert.equal(state.repeats[track],null);assert.equal(state.pitches[track],0);
  assert.equal(state.choppers[track],null);assert.equal(state.brakes[track],0);
  assert.ok(calls.some(c=>c.track===track && c.patch.held===false));
 }
 assert.equal(fx.getSnapshot().volumes.drums,-8);assert.equal(fx.getSnapshot().cutoffs.drums,800);
 assert.equal(fx.getSnapshot().reverbs.drums,.4);assert.equal(fx.getSnapshot().reverbs.bass,.4);
 fx.repeat.release('screen:repeat');fx.release('pitch','screen:pitch');
 fx.press('chopper','new',32,100);fx.release('chopper','midi:chopper');
 assert.equal(fx.getSnapshot().choppers.drums,32);
});
