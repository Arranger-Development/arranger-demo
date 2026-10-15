#!/usr/bin/env python3
"""Extract only the authored Session View drum grid; never modify the Live Set."""
import argparse
import gzip
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('src/data/dialDrumPresets.js'))
args = parser.parse_args()
root = ET.fromstring(gzip.decompress(args.source.read_bytes()))
roles = {41: 'kick', 39: 'snare', 42: 'hihat'}
presets = []
for clip in root.findall('./LiveSet/Tracks/MidiTrack/DeviceChain/MainSequencer/ClipSlotList//MidiClip'):
    name = clip.find('Name').get('Value')
    strength, groove = map(int, re.findall(r'\d+', name))
    bar = [None] * 16
    for lane in clip.findall('./Notes/KeyTracks/KeyTrack'):
        instrument = roles[int(lane.find('MidiKey').get('Value'))]
        for note in lane.findall('./Notes/MidiNoteEvent'):
            at = float(note.get('Time')) * 4
            step = int(at)
            if bar[step] is None:
                bar[step] = {'instruments': [], 'drumHits': []}
            if instrument not in bar[step]['instruments']:
                bar[step]['instruments'].append(instrument)
            bar[step]['drumHits'].append({'instrument': instrument, 'offsetSteps': at-step,
                'durationSteps': float(note.get('Duration'))*4, 'velocity': float(note.get('Velocity'))/127})
    presets.append({'id': f'dial-drums-{strength}-{groove}', 'name': name,
        'strength': strength, 'groove': groove, 'bars': [bar], 'barCount': 1})
assert len(presets) == 25 and len({(p['strength'], p['groove']) for p in presets}) == 25
assert sum(len(c['drumHits']) for p in presets for c in p['bars'][0] if c) == 406
args.output.write_text('// Session View presets from Dial Loop Demo - Drum.als, Ableton Live 12.4.6.\n'
    '// Source MIDI roles: 41 kick, 39 snare, 42 closed hi-hat. Times are sixteenth steps.\n'
    'export const DIAL_DRUM_LEVELS = [0, 25, 50, 75, 100];\n'
    'export const DIAL_DRUM_PRESETS = ' + json.dumps(presets, ensure_ascii=False, separators=(',', ':')) + ';\n'
    'export const getDialDrumPreset = (strength, groove) => DIAL_DRUM_PRESETS.find(p => p.strength === strength && p.groove === groove);\n')
print(f'Extracted {len(presets)} presets to {args.output}')
