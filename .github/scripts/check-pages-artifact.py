#!/usr/bin/env python3
"""Refuse source files, maps, hidden files and credential markers in Pages output."""
import argparse
import hashlib
import pathlib
import re

# SHA-256 of the files in @spotify/basic-pitch 1.0.1 and
# @tensorflow/tfjs-backend-wasm 3.21.0 as pinned in package-lock.json.
MODEL_BINARY_SHA256 = {
    'group1-shard1of1.bin': 'b142a95737a52e1e412d5f92e73d8bb80dfe8d04941acc0702f11f4524fb377c',
    'tfjs-backend-wasm.wasm': '3fdde0b7f76782146ed7a5212bca394d1e59e1bfb8768531c72480d6f10aee1f',
    'tfjs-backend-wasm-simd.wasm': '918e97b89039305394e9987088249bacee5ef09111ae9f9384c06bec564e2d7b',
    'tfjs-backend-wasm-threaded-simd.wasm': '7ca7dc269cc43b600cc231c252d16383aae22c4383f4363ce30c413673d8a911',
}
HASHED_BINARY = re.compile(r'(.+)-[A-Za-z0-9_-]{8}(\.bin|\.wasm)')


def validate(root, project):
    root=pathlib.Path(root)
    problems=[]
    allowed={'.html','.js','.css','.json','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.wav','.mp3','.ogg','.mp4','.woff','.woff2','.ttf','.otf'}
    forbidden_dirs={'src','tests','node_modules','docs'}
    marker=re.compile(rb'sourceMappingURL\s*=|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}')
    if not (root/'index.html').is_file(): problems.append('Missing index.html')
    for p in root.rglob('*'):
        rel=p.relative_to(root)
        if rel.as_posix() == '.nojekyll' and p.is_file() and not p.is_symlink() and p.stat().st_size == 0:
            continue
        if p.is_symlink():
            problems.append(f'Symlink: {rel}');continue
        if any(part.startswith('.') or part in forbidden_dirs for part in rel.parts):
            problems.append(f'Forbidden path: {rel}');continue
        if not p.is_file(): continue
        if p.suffix.lower() in {'.bin', '.wasm'}:
            match = HASHED_BINARY.fullmatch(p.name)
            expected = MODEL_BINARY_SHA256.get(''.join(match.groups())) if match else None
            if rel.parent != pathlib.Path('assets') or expected is None:
                problems.append(f'Forbidden binary asset: {rel}')
            elif hashlib.sha256(p.read_bytes()).hexdigest() != expected:
                problems.append(f'Binary asset checksum mismatch: {rel}')
            continue
        if p.suffix.lower() not in allowed: problems.append(f'Forbidden extension: {rel}')
        if p.suffix.lower() in {'.js','.css'} and rel.parts[0]!='assets':
            problems.append(f'Code outside bundled assets: {rel}')
        if p.suffix.lower() in {'.js','.css','.html','.json','.svg'} and marker.search(p.read_bytes()):
            problems.append(f'Source map or credential marker: {rel}')
    if (root/'index.html').is_file():
        html=(root/'index.html').read_text()
        paths=re.findall(r'(?:src|href)=["\']([^"\']+)["\']',html)
        if not paths or any(not path.startswith('/'+project+'/') for path in paths):
            problems.append('HTML asset paths do not match the public project URL')
    if problems: raise ValueError('\n'.join(problems))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('directory');parser.add_argument('project')
    args=parser.parse_args()
    validate(args.directory,args.project)
    print('Pages artifact checks passed.')
