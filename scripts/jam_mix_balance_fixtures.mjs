/* global structuredClone, URL, console */
// Analysis fixtures use the production score adapter, source banks and note timing.
import {writeFile} from 'node:fs/promises';
import {performanceTemplates} from '../src/app/performanceModel.js';
import {snapshotSection} from '../src/app/performanceSession.js';
import {jamCombinationSnapshot} from '../src/app/jamTemplateProjects.js';
import {getDialDrumPreset} from '../src/data/dialDrumPresets.js';
import {getDialPitchedPreset} from '../src/data/dialPitchedPresets.js';
import {PERFORMANCE_SAMPLE_BANKS} from '../src/data/performanceTimbres.js';
import {collectProjectEvents,getEventTime,getDurationSeconds,getEventVolume} from '../src/export/audioFile.js';
import {usesNaturalSampleTail} from '../src/domain/notePerformances.js';
import {TRACK_MIX_DYNAMICS} from '../src/audio/trackMixBalance.js';

const tracks=['drums','chord','bass','melody'];
const timbres=Object.fromEntries(tracks.map(t=>[t,`deep-autumn-${t}`]));
const catalog=performanceTemplates('chill','ai-demo-1');
const cases=[];
for(const [name,indices] of [['march-ripple',[1,1,1,0]],['full-heartbeat',[5,4,3,2]],['sparse-ripple',[0,3,0,1]]]) {
  const selection=Object.fromEntries(tracks.map((t,i)=>[t,catalog[t][indices[i]].id]));
  cases.push({name,snapshot:snapshotSection({id:name,kind:'main',selection,timbres},'chill','ai-demo-1')});
}
const selection=Object.fromEntries(tracks.map(t=>[t,catalog[t].find(p=>p.id.startsWith('deep-autumn')).id]));
cases.push({name:'deep-autumn',snapshot:snapshotSection({id:'deep',kind:'main',selection,timbres},'chill','ai-demo-1')});
for(const strength of [0,50,100]) {
  const templates=Object.fromEntries(tracks.map(t=>[t,[{...(t==='drums'?getDialDrumPreset(strength,50):getDialPitchedPreset(t,strength,t==='chord'?60:50)),id:t,trackId:t}]]));
  const w={templates,selection:Object.fromEntries(tracks.map(t=>[t,t])),timbres};
  cases.push({name:`knobs-${strength}`,snapshot:jamCombinationSnapshot(w)});
}
const fixtures=cases.map(({name,snapshot})=>{
  const bpm=104,bars=8;
  const matrix=Object.fromEntries(tracks.map(t=>[t,Array.from({length:bars},(_,b)=>structuredClone(snapshot.matrix[t][b%(snapshot.phraseBars?.[t]??snapshot.matrix[t].length)]))]));
  const state={matrix,totalBars:bars,trackOrder:tracks,bpm,volumes:Object.fromEntries(tracks.map(t=>[t,0]))};
  const events=collectProjectEvents(state).map(event=>({event,time:getEventTime(event,bpm),duration:getDurationSeconds(event,bpm),
    gated:!!event.gateDuration&&!usesNaturalSampleTail(event),gainDb:getEventVolume(state,event)}));
  return{name,bpm,bars,duration:bars*240/bpm,events,state};
});
await writeFile(new URL('../output/jam-mix-balance/fixtures.json',import.meta.url),JSON.stringify({banks:PERFORMANCE_SAMPLE_BANKS,dynamics:TRACK_MIX_DYNAMICS,fixtures},null,2));
console.log(JSON.stringify(fixtures.map(f=>({name:f.name,events:f.events.length})),null,2));
