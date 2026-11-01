"""Render dry analysis stems with production score events and report loop LUFS.

Requires local ffmpeg and numpy. Linear sample interpolation approximates Web Audio;
this is a source-level analysis aid. verify.html uses the actual browser export
path for final dynamics measurements and listening comparisons.
Run jam_mix_balance_fixtures.mjs first. Source WAVs and user projects are never edited.
"""
import argparse
import concurrent.futures
import json
import pathlib
import re
import subprocess
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'output/jam-mix-balance'
RATE=22050
TRACKS=['drums','chord','bass','melody']
FFMPEG='/opt/homebrew/bin/ffmpeg'

def midi(note):
    m=re.fullmatch(r'([A-G])(#?)(-?\d+)',note)
    return (int(m[3])+1)*12+{'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[m[1]]+bool(m[2])

def decode(path):
    raw=subprocess.run([FFMPEG,'-v','error','-i',str(ROOT/'public'/path),'-f','f32le','-ar',str(RATE),'-ac','2','-'],capture_output=True,check=True).stdout
    return path,np.frombuffer(raw,dtype='<f4').reshape(-1,2)

def loudness(audio):
    run=subprocess.run([FFMPEG,'-hide_banner','-nostats','-f','f32le','-ar',str(RATE),'-ac','2','-i','-','-af','ebur128=peak=true','-f','null','-'],input=audio.astype('<f4').tobytes(),capture_output=True,check=True)
    log=run.stderr.decode()
    return {'lufs':float(re.findall(r'I:\s+(-?[\d.]+) LUFS',log)[-1]),'peakDb':float(20*np.log10(max(1e-12,np.max(np.abs(audio)))))}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--offsets',default='{}',help='Additional per-track analysis gain in dB')
    parser.add_argument('--label',default='dry-stems')
    args=parser.parse_args()
    offsets=json.loads(args.offsets)
    doc=json.loads((OUT/'fixtures.json').read_text())
    files={f for bank in doc['banks'].values() for f in bank['sampleFiles'].values()}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: buffers=dict(pool.map(decode,files))
    report=[]
    for fixture in doc['fixtures']:
        frames=round((fixture['duration']+3)*RATE)
        stems={t:np.zeros((frames,2),dtype=np.float32) for t in TRACKS}
        for item in fixture['events']:
            e=item['event'];bank=doc['banks'][e['timbreId']];sources=bank['sampleFiles']
            notes=e.get('notes',[e.get('note')]) if e['type']!='drums' else [None]
            for note in notes:
                root=min(sources,key=lambda s:(abs(midi(s)-midi(note)),-midi(s))) if note else e['instrument']
                source=buffers[sources[root]]
                rate=2**((midi(note)-midi(root))/12) if note else 1
                length=int(np.ceil(len(source)/rate))
                if item['gated']: length=min(length,round((item['duration']+.1)*RATE))
                start=round(item['time']*RATE);length=min(length,frames-start)
                pos=np.arange(length)*rate
                voice=np.stack([np.interp(pos,np.arange(len(source)),source[:,ch]) for ch in range(2)],axis=1)
                if item['gated']:
                    env=np.clip((item['duration']+.1-np.arange(length)/RATE)/.1,0,1)
                    voice*=env[:,None]
                stems[e['trackId']][start:start+length]+=voice*10**((item['gainDb']+offsets.get(e['trackId'],0))/20)
        active=round(fixture['duration']*RATE)
        stats={t:loudness(stems[t][:active]) for t in TRACKS}
        mix=sum(stems.values())*10**(-6/20)
        stats['mix']=loudness(mix[:active])
        report.append({'name':fixture['name'],'tracks':stats})
        if fixture['name']=='march-ripple':
            # A/B excerpts use identical notes, timing and master attenuation.
            subprocess.run([FFMPEG,'-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','-','-t','12','-c:a','pcm_s16le',str(OUT/f'{args.label}.wav')],input=np.clip(mix,-1,1).astype('<f4').tobytes(),check=True)
        print(fixture['name'],json.dumps(stats),flush=True)
    (OUT/f'{args.label}-metrics.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__': main()
