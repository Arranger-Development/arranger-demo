import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/audio/beat-repeat.js',import.meta.url),'utf8');
function processor() {
  let Constructor;
  class Base { constructor(){this.port={};} }
  vm.runInNewContext(source,{AudioWorkletProcessor:Base,registerProcessor:(name,c)=>Constructor=c,sampleRate:1024,Float32Array,Math});
  return new Constructor();
}
const block = (p,value,n=128) => { const out=[new Float32Array(n),new Float32Array(n)]; p.process([[new Float32Array(n).fill(value),new Float32Array(n).fill(value/2)]],[out]); return out; };
test('beat repeater is transparent while released, freezes a slice and resumes the ongoing input',()=>{
  const p=processor();assert.equal(block(p,.7)[0][50],Math.fround(.7));
  p.port.onmessage({data:{held:true,seconds:.125}});
  const repeated=block(p,.2,256); assert.ok(repeated[0][190]>.6); assert.ok(repeated[1][190]>.3);
  p.port.onmessage({data:{held:false}}); const normal=block(p,.1,512);assert.ok(Math.abs(normal[0][511]-.1)<1e-5);
});
test('repeat buffers are isolated by track, dry input continues recording, and reset clears old audio',()=>{
  const a=processor(),b=processor();block(a,.8);block(b,.2);
  a.port.onmessage({data:{held:true,seconds:.125}});assert.equal(block(b,.3)[0][20],Math.fround(.3));
  block(a,.1,256);a.port.onmessage({data:{held:false}});a.port.onmessage({data:{held:true,seconds:.125}});
  assert.ok(block(a,.5,256)[0][190]<.11);
  a.port.onmessage({data:{reset:true}});assert.equal(block(a,0)[0][20],0);
});
