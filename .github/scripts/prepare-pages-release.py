#!/usr/bin/env python3
"""Copy a validated build into an artifact branch without touching its Git data."""
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys


def prepare(source, target, source_sha):
    source, target = Path(source).resolve(), Path(target).resolve()
    if not re.fullmatch(r'[0-9a-f]{40}', source_sha):
        raise ValueError('A full main commit SHA is required')
    if source == target or source in target.parents or target in source.parents:
        raise ValueError('Build and release directories must be separate')
    spec = importlib.util.spec_from_file_location('artifact_check', Path(__file__).with_name('check-pages-artifact.py'))
    checker = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(checker)
    checker.validate(source, 'arranger-demo')
    target.mkdir(parents=True, exist_ok=True)
    for entry in target.iterdir():
        if entry.name == '.git':
            continue
        if entry.is_dir() and not entry.is_symlink():
            shutil.rmtree(entry)
        else:
            entry.unlink()
    shutil.copytree(source, target, dirs_exist_ok=True)
    (target / '.nojekyll').touch()
    (target / 'deployment.json').write_text(json.dumps({
        'repository': 'Arranger-Development/arranger-demo',
        'source_ref': 'main',
        'source_sha': source_sha,
    }, indent=2) + '\n')


if __name__ == '__main__':
    prepare(*sys.argv[1:])
