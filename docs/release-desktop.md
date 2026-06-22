# Desktop releases (Windows) & auto-update

## Cutting a release

From `web-desktop`:

```
pnpm run release 1.0.0        # bumps package.json + tauri.conf.json + Cargo.toml
git commit -am "chore: release v1.0.0"
git tag v1.0.0
git push && git push --tags
```

Pushing the tag runs the workflow. When it finishes, the GitHub Release is
published with the installer attached. Share the Release page (or the installer
asset link) for public download.

## Versioning (SemVer)

Use `MAJOR.MINOR.PATCH`:

- **PATCH** — bug fixes, no behaviour change for users.
- **MINOR** — new features, backwards compatible.
- **MAJOR** — breaking change to how the app behaves.

The `pnpm run release` script keeps the three version fields in lockstep so the
auto-updater compares the right number.

## Testing the update flow

1. Release `v1.0.0`, install it locally from the GitHub Release.
2. `pnpm run release 1.0.1`, commit, tag `v1.0.1`, push tags.
3. Once the workflow publishes, relaunch the installed v1.0.0 — it should update
   to v1.0.1 within a moment and relaunch.

## Notes / future

- The release notes are currently a static line. We mandate Conventional
  Commits, so we can later auto-generate `CHANGELOG.md` / release notes with
  `git cliff` at tag time (deferred to keep this lean).
- Auto-update applies on next startup. There's no in-app "check for updates" button yet;
  add one later if useful.
- macOS/Linux builds can be added by expanding the workflow to a build matrix;
  Windows-only for now.
