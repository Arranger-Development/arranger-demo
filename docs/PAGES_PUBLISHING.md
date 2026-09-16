# Development preview and external release

All source development lives in `Arranger-Development/arranger-demo`.
Repository visibility is currently public; changing it is a separate decision.

## Normal development

1. Develop on a feature or fix branch, then merge verified changes into `main`.
2. A push to `main` runs **Deploy Development preview**: clean install, tests,
   lint, build, and artifact validation. A failure leaves the release unchanged.
3. The workflow writes only the built files, `.nojekyll`, and `deployment.json`
   to `release/development-pages`. The manifest records the exact `main` commit.
4. The workflow checks out that exact release commit and deploys it to
   https://arranger-development.github.io/arranger-demo/ for acceptance.
   Direct pushes to the release branch also deploy its artifact; ordinary
   source changes belong on `main`, not on the artifact branch.

GitHub Pages uses GitHub Actions, not the legacy branch builder. The build job's
`GITHUB_TOKEN` push does not launch another workflow, so the same workflow
explicitly deploys the release commit after pushing it. The existing
`github-pages` environment permits `main` and `release/development-pages`.

“Deploy” means update this Development preview. It never means external release.
Uncommitted local files and unmerged feature branches are not included.

## External release: only after explicit user acceptance

The external site is https://project-arranger.github.io/arranger-demo/.
It is backed by `Project-Arranger/arranger-demo`, branch `main`, directory `site`.

After the user explicitly approves external release:

1. Record the full `release/development-pages` commit SHA the user accepted.
2. Run **Publish approved demo externally** from Development `main`, with that
   `release_commit` and confirmation `PUBLISH`.
3. The workflow verifies the release belongs to the artifact branch, comes from
   Development `main`, and has a successful Development Pages deployment.
4. It copies that exact release to the external repository's `site` directory
   without rebuilding. The external repository deploys it automatically.
5. Verify the external Pages deployment and served asset version.

There is no push, workflow-completion, or scheduled trigger for external release.
`PAGES_DEPLOY_KEY` is used only by this manual workflow and grants writes to the
external publishing repository. The preview workflow does not use it.

## Recovery

Retry **Deploy Development preview** on `main` after a transient failure. To
restore a prior preview, create a new release-branch commit containing the prior
artifact and its original manifest; preserve branch history. External rollback
also requires explicit user authorization and uses an already accepted release.
Never force-push either publishing branch or copy source files into the external
repository. Browser-required JavaScript, media, and fonts remain public.
