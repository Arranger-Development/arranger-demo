import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamStripController, jamStripPadSize, jamStripLayout } from '../src/app/jamStripController.js';
import { jamLauncherColumnCount, jamTemplateRange, jamTemplatePage } from '../src/app/jamTemplateSlots.js';
import { createPerformanceMidiInput, mapPerformanceKeyboard } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { JAM_TEMPLATE_PADS } from '../src/input/jamPadLayout.js';

function fixture() {
  const m = { left:0,pitch:60,visible:960,columns:40,max:1440 };
  const banks=[],edges=[];
  const c=createJamStripController({read:()=>({...m}),write:left=>{m.left=left;},onBank:value=>banks.push(value),onEdges:value=>edges.push(value)});
  return {c,m,banks,edges};
}

test('continuous columns retain holes, global numbering and at least eight trailing creation slots',()=>{
  const rows={drums:[{id:'d9',slotIndex:8},{id:'d32',slotIndex:31}],chord:[],bass:[],melody:[]};
  assert.equal(jamLauncherColumnCount(rows),40);
  const range=jamTemplateRange(rows.drums,0,40);
  assert.equal(range[8].id,'d9');assert.equal(range[31].id,'d32');assert.equal(range[16],null);
  assert.ok(range.slice(32).every(p=>p===null));
  assert.equal(jamLauncherColumnCount({drums:[],chord:[],bass:[],melody:[]}),16);
  assert.equal(jamLauncherColumnCount({drums:[{id:'last',slotIndex:39}]}),48);
});

test('twelve columns stay spaced on desktop and wide screens, instead of reverting to sixteen at the old gem cap',()=>{
  for(const width of [1061,1250,1440,1728,2000]) {
    const {pad,gap}=jamStripLayout(width,120);
    assert.ok(pad>=48&&pad<=96);
    assert.ok(gap>=16);
    assert.ok(Math.abs(120+12*(pad+gap)+6-width)<1e-6);
  }
  assert.equal(jamStripPadSize(159,88),48);
  assert.equal(jamStripPadSize(2000,120),96);
  assert.equal(jamStripLayout(159,88).gap,16);
});

test('wide-screen spacing is used for scroll banks, saved phrase reveal and resize anchors',()=>{
  const {c,m}=fixture();
  Object.assign(m,{left:0,pitch:140,gap:44,visible:1680,columns:40,max:3920});
  c.showBank(2);assert.equal(c.getBank(),2);assert.equal(m.left,1680);
  m.left=8*m.pitch+m.gap+.1;c.scroll();assert.equal(c.getBank(),1,'manual grouping follows the actual wide gap');
  c.revealSlot(31);assert.equal(m.left,2800);assert.equal(c.getBank(),3);
  m.pitch=80;m.gap=16;m.visible=960;m.max=2240;
  c.resize(140,2800);assert.equal(m.left,1600);assert.equal(c.getBank(),3);
});

test('manual scrolling updates eight-column mappings; hardware groups remain selectable at the clamped far edge',()=>{
  const {c,m,edges}=fixture();
  c.moveBy(8);assert.equal(m.left,480);assert.equal(c.getBank(),1);
  c.moveBy(100);assert.equal(m.left,1440);assert.equal(c.getBank(),3);
  assert.deepEqual(edges.at(-1),{left:true,right:false});
  c.showBank(4);assert.equal(c.getBank(),4);assert.equal(m.left,1440,'33–40 are already visible in the final sixteen columns');
  c.scroll();assert.equal(c.getBank(),4,'programmatic scroll events must not undo the hardware group');
  m.left=1439;c.scroll();assert.equal(c.getBank(),3,'next manual movement resumes following the fully visible column');
  c.showBank(0);assert.equal(m.left,0);assert.equal(c.getBank(),0);
  c.showBank(999);assert.equal(c.getBank(),4);
});

test('revealing saved notes, resizing and project reset preserve the intended position without musical callbacks',()=>{
  const {c,m}=fixture();
  c.revealSlot(31);assert.equal(c.getBank(),3);assert.equal(m.left,960);
  const oldPitch=m.pitch,oldLeft=m.left;m.pitch=52;m.visible=500;m.max=1580;
  c.resize(oldPitch,oldLeft);assert.equal(m.left,832);assert.equal(c.getBank(),3);
  m.columns=16;m.max=332;c.resize(52,m.left);assert.equal(m.left,332);assert.equal(c.getBank(),1,'deleting the last occupied block clamps the bank');
  c.reset();assert.equal(m.left,0);assert.equal(c.getBank(),0);
  m.visible=60;m.max=772;c.showBank(1);assert.equal(m.left,416,'narrow screens reveal the beginning of the group');
});

test('keyboard, Launchpad triggers and LEDs use the same eight slots inside a longer visible strip',()=>{
  const row=Array.from({length:34},(_,slotIndex)=>({id:`d${slotIndex+1}`,slotIndex}));
  const templates={drums:jamTemplatePage(row,3),chord:[],bass:[],melody:[]};
  assert.deepEqual(mapPerformanceKeyboard({type:'keydown',code:'Digit8',repeat:false},templates),{type:'template',trackId:'drums',templateId:'d32'});
  const pad=JAM_TEMPLATE_PADS.find(p=>p.trackId==='drums'&&p.index===7);
  const input=createPerformanceMidiInput();
  assert.deepEqual(input.handle([0x90,pad.note,127],templates,{version:5}),{type:'template',trackId:'drums',templateId:'d32'});
  const frame=createLaunchpadXPerformanceLedFrame({version:5,templates,page:3,pageCount:6,selectedTracks:[],status:{mode:'jam',playingPhraseIds:{drums:'d32'}}});
  assert.equal(frame.find(([s,n])=>s===0x90&&n===pad.note)[2],17);
  assert.equal(frame.find(([s,n])=>s===0xb0&&n===94)[2],13);
});
