#!/usr/bin/env python3
"""Refuse source files, maps, hidden files and credential markers in Pages output."""
import argparse
import pathlib
import re

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
