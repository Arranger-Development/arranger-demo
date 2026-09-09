# Private development and public demo

Develop in `Arranger-Development/arranger-demo`. The public repository
`Project-Arranger/arranger-demo` contains only compiled site files and deployment configuration.

The public URL remains https://project-arranger.github.io/arranger-demo/.
Pushing development commits does not update the public demo.

## Publish intentionally

In the private repository, open Actions → Publish demo manually → Run workflow.
Run the workflow from `main`; enter the source branch, tag, or commit to publish.
The workflow installs locked dependencies, builds, validates the output, and
pushes only `dist` into the public repository's `site` directory.
The public repository then deploys those files with GitHub Pages.

`PAGES_DEPLOY_KEY` is a dedicated SSH key with write access only to this
public publishing repository. Keep it in this private repository's Actions secrets.
Do not add source-repository credentials to the public repository.

## Roll back

Run the private publishing workflow for a previously verified source commit,
or restore a previously verified `site` tree in the public publishing repository.
The migration backup includes a byte-for-byte verified copy of the original site.
Keep the source repositories private during recovery.

## Release check

Run `python3 .github/scripts/check-pages-artifact.py dist arranger-demo` after building.
The check rejects hidden files, source directories, source maps, credential markers,
and asset URLs pointing to a different project path. It complements review; it is
not an exhaustive secret scanner. Browser-delivered code and media remain public.
