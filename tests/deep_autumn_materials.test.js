import test from 'node:test';
import assert from 'node:assert/strict';
import { DEEP_AUTUMN_TEMPLATES } from '../src/data/deepAutumnTemplates.js';
import { AI_PERFORMANCE_PROFILE_ID as profile } from '../src/data/aiPerformanceTemplates.js';
import { performanceTemplates, createPerformanceMatrix, emptySelection } from '../src/app/performanceModel.js';
import { createSession, defaultTimbres, snapshotSection, createLiveImport, readSession, sessionKey } from '../src/app/performanceSession.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { collectProjectEvents } from '../src/export/audioFile.js';
import { createProjectFile } from '../src/export/projectFile.js';
const catalog = performanceTemplates('chill', profile);
const all = Object.entries(DEEP_AUTUMN_TEMPLATES).flatMap(([track, list]) => list.map(p => ({track,...p})));
const phrase = name => all.find(p => p.name === name);
const section = p => ({id:'test',name:p.name,kind:p.kind,selection:{...emptySelection(),[p.track]:p.id},timbres:defaultTimbres()});
const snapshot = p => snapshotSection(section(p),'chill',profile);
const events = p => {
  const s = snapshot(p); const adapter = createMatrixPlaybackAdapter(s.matrix,{totalBars:s.totalBars});
  return Array.from({length:p.barCount*16},(_,step)=>adapter.getEventsForFlatStep(step)).flat();
};

test('26 sourced additions append to stable legacy IDs with complete main/transition catalogs', () => {
  assert.equal(all.length,26); assert.equal(new Set(all.map(p=>p.id)).size,26);
  for (const [track,expected] of Object.entries({drums:[5,4,6],chord:[5,1,5],bass:[5,1,4],melody:[4,1,5]})) {
    assert.equal(DEEP_AUTUMN_TEMPLATES[track].filter(p=>p.kind==='main').length,expected[0]);
    assert.equal(DEEP_AUTUMN_TEMPLATES[track].filter(p=>p.kind==='transition').length,expected[1]);
    assert.ok(catalog[track].slice(0,expected[2]).every(p=>p.id.startsWith('ai-demo-1-')));
  }
  for (const p of all) {
    assert.equal(p.bars.length,p.barCount); assert.match(p.source.url,/^https:\/\/app.notion.com\//);
    assert.match(p.source.imageSha256,/^[a-f0-9]{64}$/);
    for (const bar of p.bars) {
      const hits=p.track==='drums'?Object.values(bar).flat().map(s=>[s]):bar;
      for (const [step,note,duration=1] of hits) {
        assert.ok(Number.isInteger(step)&&step>=0&&step<16,p.name);
        if(p.track!=='drums') {assert.match(note,/^[A-G]#?\d$/);assert.ok(duration>=1&&step+duration<=16,p.name);}
      }
    }
  }
});

test('every supplied attack survives matrix playback with independent phrase length and no duplicate notes', () => {
  for (const p of all) {
    const expected=p.bars.flatMap((bar,b)=>p.track==='drums'
      ? Object.entries(bar).flatMap(([n,steps])=>steps.map(s=>`${b}:${s}:${n}:1`))
      : bar.map(([s,n,d=1])=>`${b}:${s}:${n}:${d}`)).sort();
    const actual=events(p).flatMap(e=>(e.notes??[e.note??e.instrument]).map(n=>`${e.bar}:${e.step}:${n}:${e.durationSteps??1}`)).sort();
    assert.deepEqual(actual,expected,p.name);
    assert.equal(new Set(actual).size,actual.length,p.name);
    assert.equal(snapshot(p).totalBars,Math.max(p.kind==='transition'?1:2,p.barCount));
    const matrix=createPerformanceMatrix(section(p).selection,'chill',profile);
    for (const track of ['drums','chord','bass','melody'].filter(t=>t!==p.track)) assert.ok(matrix[track].flat().every(c=>c===null));
  }
});

test('source checkpoints retain the two distinct Chinese drum bars and all transition rests', () => {
  const chinese=phrase('中国鼓律动'); assert.equal(chinese.barCount,2);
  assert.deepEqual(chinese.bars,[
    {kick:[0,6,7,8,9],snare:[12],hihat:[2,6,10,14]},
    {kick:[0,6,7,8,9,14],snare:[12],hihat:[2,6,10,12,14]},
  ]);
  assert.deepEqual(phrase('逐步加速').bars[0].kick,[0,4,8,10,12,13,14,15]);
  assert.deepEqual(phrase('娜塔莎的期待').bars[0],[[10,'G#3'],[11,'A3'],[12,'C4'],[13,'C#4'],[14,'E4'],[15,'G#4']]);
  assert.deepEqual(phrase('低沉衔接').bars[0],[[0,'C#1'],[8,'G#0'],[12,'G#0'],[13,'A0'],[14,'B0']]);
  assert.deepEqual(phrase('摇摆感节奏').bars,phrase('非洲舞步').bars);
  assert.notEqual(phrase('摇摆感节奏').id,phrase('非洲舞步').id);
});

test('sustained harmony retains octave-two notes and different per-note lengths on the same attack through creation export', () => {
  const piano=events(phrase('怀旧钢琴')).filter(e=>e.bar===0&&e.step===0);
  assert.equal(piano.length,1); assert.equal(piano[0].durationSteps,8);
  assert.deepEqual([...piano[0].notes].sort(),['B2','C#3','E3','G#2']);
  const cloud=phrase('拨云见雾'); const group=events(cloud).filter(e=>e.bar===0&&e.step===8);
  assert.equal(group.length,2);
  assert.deepEqual(group.find(e=>e.durationSteps===2).notes,['G#3']);
  assert.deepEqual([...group.find(e=>e.durationSteps===4).notes].sort(),['A2','C#3','E3','F#2']);
  const session=createSession('chill',profile);session.columns=[{id:'copy',name:'副歌',repeat:2,snapshot:snapshot(cloud)}];
  const project=createLiveImport(session);const exported=collectProjectEvents(project).filter(e=>e.bar===0&&e.step===8);
  assert.deepEqual(exported.map(e=>[e.durationSteps,[...e.notes].sort()]).sort(),group.map(e=>[e.durationSteps,[...e.notes].sort()]).sort());
  const file=createProjectFile(project);assert.deepEqual(file.arrangement.matrix,project.matrix);
});

test('legacy fourteen-pad session fills supplied transition slots without changing saved selections or Live copies', () => {
  const before=createSession('chill',profile);
  before.pads=Object.fromEntries(Object.entries(catalog).map(([t,list])=>[t,[...list.filter(p=>p.id.startsWith('ai-demo-1-')).map(p=>p.id),...Array(14).fill(null)].slice(0,14)]));
  before.sections[0].selection.chord='ai-demo-1-chord-ripple-1';
  before.columns[0].snapshot=snapshot(phrase('风之谷'));
  const raw=JSON.stringify(before);const storage={getItem:key=>key===sessionKey('chill',profile)?raw:null};
  const restored=readSession(storage,'chill',profile);
  assert.deepEqual(restored.sections,before.sections);assert.deepEqual(restored.columns,before.columns);
  assert.equal(restored.pads.drums[6],phrase('稳妥过渡').id);assert.equal(restored.pads.drums[7],phrase('逐步加速').id);
  assert.equal(restored.pads.chord[5],phrase('怀旧钢琴').id);
});
