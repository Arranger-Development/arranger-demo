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
