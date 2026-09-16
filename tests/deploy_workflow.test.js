import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Development main publishes an artifact branch before deploying the preview', async () => {
  const workflow = await readFile('.github/workflows/development-pages.yml', 'utf8');
  assert.match(workflow, /branches: \[main, release\/development-pages\]/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /git push origin HEAD:release\/development-pages/);
  assert.match(workflow, /needs\.build\.outputs\.release_sha \|\| github\.sha/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.doesNotMatch(workflow, /Project-Arranger|PAGES_DEPLOY_KEY/);
});

test('External release is manual and copies a pinned accepted artifact without rebuilding', async () => {
  const workflow = await readFile('.github/workflows/jekyll-gh-pages.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^ {2}(push|pull_request|workflow_run|schedule):/m);
  assert.match(workflow, /test "\$CONFIRMATION" = 'PUBLISH'/);
  assert.match(workflow, /merge-base --is-ancestor "\$RELEASE_COMMIT" HEAD/);
  assert.match(workflow, /verify-preview-release\.py dist/);
  assert.match(workflow, /repository: Project-Arranger\/arranger-demo/);
  assert.doesNotMatch(workflow, /npm |setup-node|source_ref:/);
});

test('Release preparation and promotion enforce artifact and deployment boundaries', () => {
  execFileSync('python3', ['.github/scripts/test-pages-release.py'], { stdio: 'pipe' });
});
