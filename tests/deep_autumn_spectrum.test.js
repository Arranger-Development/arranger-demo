import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERFORMANCE_SAMPLE_BANKS } from '../src/data/performanceTimbres.js';
import { formatNoteLabel } from '../src/app/noteDisplay.js';

function decodePcm(wav) {
  let format, data;
  for (let offset=12;offset+8<=wav.length;) {
    const size=wav.readUInt32LE(offset+4),id=wav.toString('ascii',offset,offset+4);
    if(id==='fmt ')format=offset+8;
    if(id==='data')data={offset:offset+8,size};
    offset+=8+size+(size%2);
  }
  assert.ok(format&&data,'WAV format and data chunks are required');
  assert.equal(wav.readUInt16LE(format),1,'uncompressed PCM fixture');
  const channels=wav.readUInt16LE(format+2),rate=wav.readUInt32LE(format+4);
  const bytes=wav.readUInt16LE(format+14)/8,frameBytes=channels*bytes;
  const samples=new Float64Array(data.size/frameBytes);
  for(let frame=0;frame<samples.length;frame++) {
    for(let channel=0;channel<channels;channel++)samples[frame]+=wav.readIntLE(data.offset+frame*frameBytes+channel*bytes,bytes);
    samples[frame]/=channels*2**(bytes*8-1);
  }
  return {samples,rate};
}

function windowAt({samples,rate},start) {
  const stride=4,length=Math.floor(rate*.5/stride),window=new Float64Array(length);
  for(let i=0;i<length;i++)window[i]=samples[Math.floor(start*rate)+i*stride]*(.5-.5*Math.cos(2*Math.PI*i/(length-1)));
  return {window,rate:rate/stride};
}

// Measure a frequency band, not the loudest peak in the entire recording.
// These chorused instruments drift slightly and often emphasize the second harmonic.
function bandPeak({window,rate},frequency) {
  const low=frequency*.965,high=frequency*1.035,steps=Math.ceil((high-low)/.75);
  let peak=0;
  for(let i=0;i<=steps;i++) {
    const coefficient=2*Math.cos(2*Math.PI*(low+(high-low)*i/steps)/rate);
    let previous=0,older=0;
    for(const sample of window) {
      const current=sample+coefficient*previous-older;
      older=previous;previous=current;
    }
    peak=Math.max(peak,Math.sqrt(Math.max(0,previous*previous+older*older-coefficient*previous*older)));
  }
  return peak;
}

function frequencyOf(note) {
  const [,pitch,octave]=/^([A-G]#?)(-?\d+)$/.exec(note);
  const midi=(Number(octave)+1)*12+['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(pitch);
  return 440*2**((midi-69)/12);
}

for(const [track,count,minimumRootToSubharmonic] of [['chord',21,2],['melody',15,20]]) {
  test(`all ${count} Deep Autumn ${track} WAVs support their source pitches despite strong harmonics`,async()=>{
    const files=Object.entries(PERFORMANCE_SAMPLE_BANKS[`deep-autumn-${track}`].sampleFiles);
    assert.equal(files.length,count);
    let strongerSecondHarmonics=0;
    for(const [root,file] of files) {
      // Melody explicitly follows the user's source-sample/UI octave convention.
      // Its stored playback key is one octave above the source WAV's real pitch.
      const sourcePitch=track==='melody'?formatNoteLabel(root):root;
      const pcm=decodePcm(await readFile(new URL(`../public/${file}`,import.meta.url))),frequency=frequencyOf(sourcePitch);
      for(const start of [.15,.65]) {
        const window=windowAt(pcm,start),fundamental=bandPeak(window,frequency);
        const subharmonic=bandPeak(window,frequency/2),second=bandPeak(window,frequency*2);
        assert.ok(fundamental>subharmonic*minimumRootToSubharmonic,
          `${file}: ${root} has excessive lower-octave energy (${(fundamental/subharmonic).toFixed(2)})`);
        assert.ok(fundamental>second*.07,`${file}: missing fundamental at ${frequency.toFixed(2)} Hz`);
        if(second>fundamental)strongerSecondHarmonics++;
      }
    }
    if(track==='melody')assert.ok(strongerSecondHarmonics>=15,'retain the real fixtures where the strongest peak is not the fundamental');
  });
}
