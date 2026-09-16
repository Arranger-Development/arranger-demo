#!/usr/bin/env python3
"""Allow promotion only for a main build with a successful Development deployment."""
import json
from pathlib import Path
import re
import subprocess
import sys

REPOSITORY = 'Arranger-Development/arranger-demo'


def api(path):
    return json.loads(subprocess.check_output(['gh', 'api', path], text=True))


def verify(directory, release_sha, request=api):
    manifest = json.loads((Path(directory) / 'deployment.json').read_text())
    source_sha = manifest.get('source_sha', '')
    if (manifest.get('repository') != REPOSITORY or manifest.get('source_ref') != 'main'
            or not re.fullmatch(r'[0-9a-f]{40}', source_sha)
            or not re.fullmatch(r'[0-9a-f]{40}', release_sha)):
        raise ValueError('Release must identify an exact Development main build')
    comparison = request(f'repos/{REPOSITORY}/compare/{source_sha}...main')
    if comparison['status'] not in ('ahead', 'identical'):
        raise ValueError('Release source is not part of main')
    for sha in {source_sha, release_sha}:
        deployments = request(f'repos/{REPOSITORY}/deployments?sha={sha}&environment=github-pages&per_page=100')
        for deployment in deployments:
            statuses = request(f'repos/{REPOSITORY}/deployments/{deployment["id"]}/statuses?per_page=100')
            if any(status['state'] == 'success' for status in statuses):
                print(f'Accepted preview provenance verified: {release_sha} (source {source_sha})')
                return
    raise ValueError('No successful Development Pages deployment exists for this release')


if __name__ == '__main__':
    verify(*sys.argv[1:])
