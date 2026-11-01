#!/usr/bin/env python3
"""Read authored Session clips only. Never change the source Ableton Live Set."""
import argparse
import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source', type=Path)
parser.add_argument('--output', type=Path, default=Path('src/data/dialPitchedPresets.js'))
args = parser.parse_args()
source = args.source.read_bytes()
root = ET.fromstring(gzip.decompress(source))
presets = []
for track in root.findall('./LiveSet/Tracks/MidiTrack'):
    match = re.fullmatch(r'(Chord|Bass|Melody) Int([1-5])', track.find('Name/EffectiveName').get('Value'))
    if not match:
        continue
    family, intensity = match.groups()
    track_id = family.lower()
    for clip in track.findall('./DeviceChain/MainSequencer/ClipSlotList//MidiClip'):
        name = clip.find('Name').get('Value')
        level_match = re.fullmatch(r'Level ([0-5]) - Int([1-5])', name)
        assert level_match and level_match[2] == intensity, name
        level = int(level_match[1])
        start = float(clip.find('Loop/LoopStart').get('Value'))
        end = float(clip.find('Loop/LoopEnd').get('Value'))
        bar_count = (end - start) / 4
        assert bar_count.is_integer() and bar_count > 0
        bars = [[None] * 16 for _ in range(int(bar_count))]
        events = []
        for lane in clip.findall('./Notes/KeyTracks/KeyTrack'):
            midi = int(lane.find('MidiKey').get('Value'))
            pitch = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12] + str(midi // 12 - 1)
            for event in lane.findall('./Notes/MidiNoteEvent'):
                if event.get('IsEnabled', 'true') == 'false':
                    continue
                at = (float(event.get('Time')) - start) * 4
                duration = float(event.get('Duration')) * 4
                velocity = float(event.get('Velocity')) / 127
                assert 0 <= at < bar_count * 16 and duration > 0
                flat = math.floor(at)
                bar, step = divmod(flat, 16)
                if bars[bar][step] is None:
                    bars[bar][step] = {'type': 'notes' if track_id == 'chord' else track_id,
                                       'notes': [], 'notePerformances': {}, 'noteDurationSteps': {}}
                cell = bars[bar][step]
                if pitch not in cell['notes']:
                    cell['notes'].append(pitch)
                    cell['noteDurationSteps'][pitch] = duration
                cell['notePerformances'].setdefault(pitch, []).append({
                    'offsetSteps': at - flat, 'durationSteps': duration, 'velocity': velocity})
                events.append((midi, at, duration, velocity))
        if track_id != 'chord':
            for cell in (c for bar in bars for c in bar if c):
                if track_id == 'bass':
                    assert len(cell['notes']) == 1, name
                if len(cell['notes']) == 1:
                    cell['note'] = cell.pop('notes')[0]
        strength = (int(intensity) - 1) * 25
        groove = level * 20 if track_id == 'chord' else (level - 1) * 25
        canonical = '\n'.join(f'{midi}:{at:.9f}:{duration:.9f}:{velocity:.9f}'
                              for midi, at, duration, velocity in sorted(events))
        presets.append({'id': f'dial-{track_id}-{strength}-{groove}', 'trackId': track_id,
                        'name': f'强度{strength} · 律动{groove}', 'sourceName': name,
                        'strength': strength, 'groove': groove, 'barCount': int(bar_count),
                        'sourceEventCount': len(events),
                        'sourceEventHash': hashlib.sha256(canonical.encode()).hexdigest(), 'bars': bars})
assert {t: sum(p['trackId'] == t for p in presets) for t in ['chord', 'bass', 'melody']} == {'chord': 30, 'bass': 25, 'melody': 25}
assert len({p['id'] for p in presets}) == 80
args.output.write_text('// Generated from Knob Demo 2.als Session View only; original MIDI pitch, feel and duration retained.\n'
                       f'// Source SHA-256: {hashlib.sha256(source).hexdigest()}\n'
                       'export const DIAL_PITCHED_PRESETS = ' + json.dumps(presets, ensure_ascii=False, separators=(',', ':')) + ';\n'
                       'export const getDialPitchedPreset = (trackId, strength, groove) => DIAL_PITCHED_PRESETS.find(p => p.trackId === trackId && p.strength === strength && p.groove === groove);\n')
print(f'Extracted {len(presets)} clips, {sum(p["sourceEventCount"] for p in presets)} notes to {args.output}')
