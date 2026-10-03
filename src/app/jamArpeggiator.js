const NOTE = /^([A-G])(#?)([3-5])$/;
const pitch = note => { const m=NOTE.exec(note); return m ? (Number(m[3])+1)*12+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]])+(m[2]?1:0) : NaN; };
const name = midi => `${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]}${Math.floor(midi/12)-1}`;
export function parseArpNotes(text) {
  const notes = [...new Set(text.trim().split(/[\s,，]+/).filter(Boolean))];
  return notes.length && notes.length <= 8 && notes.every(n => NOTE.test(n)) ? notes.sort((a,b)=>pitch(a)-pitch(b)) : null;
}
// Separate sampler per press. Disposing it cancels only improvisation voices,
// including scheduled attacks, without releasing the Loop's melody sampler.
export function createJamArpeggiator(audio) {
  let state = { presets: [['C4','E4','G4']], index: null, loading: false, error: '' };
  let owner = null, generation = 0, voice = null, cursor = 0;
  const listeners = new Set(); const emit = patch => { state={...state,...patch}; listeners.forEach(f=>f()); };
  function stop() { generation++; owner=null; voice?.dispose(); voice=null; cursor=0; emit({index:null,loading:false}); }
  return {
    getSnapshot:()=>state, subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}, stop,
    configure(index, text) { if (index !== 0) return false; const notes = text.trim() ? parseArpNotes(text) : null; if (text.trim() && !notes) return false;
      stop(); const presets=[...state.presets]; presets[index]=notes; emit({presets,error:''}); return true; },
    async press(token, index, timbre) {
      if (!state.presets[index]) return;
      stop(); owner=token; const request=++generation; emit({index,loading:true,error:''});
      try {
        const next=await audio.createJamArpeggioVoice(timbre);
        if (request!==generation) {next.dispose();return;}
        voice=next; emit({loading:false});
      } catch { if(request===generation) {stop();emit({error:'琶音音色加载失败，请重试'});} }
    },
    release(token) {if(owner===token) stop();},
    schedule(step,time,bpm) {
      if (!voice || state.index===null) return;
      const sequence=state.presets[0], interval=1;
      for (let at=Math.ceil(step/interval)*interval;at<step+1;at+=interval) {
        const note=name(pitch(sequence[cursor++%sequence.length]));
        voice.trigger(note,time+(at-step)*60/bpm/4,interval*60/bpm/4*.8);
      }
    },
  };
}
