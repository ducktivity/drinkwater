// Bumps the desktop app version in the three places that must stay in lockstep:
//   - web-desktop/package.json              (npm version)
//   - web-desktop/src-tauri/tauri.conf.json (the version the updater compares)
//   - web-desktop/src-tauri/Cargo.toml      (the Rust crate version)
//
// Usage (from web-desktop):  pnpm run release <MAJOR.MINOR.PATCH>
// It edits only the version field in each file (no reformatting); committing and
// tagging is left to you (see docs/release-desktop.md) so you can review first.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const webDesktop = join(here, '..')

const version = process.argv[2]
if (!version) {
  console.error('Usage: pnpm run release <MAJOR.MINOR.PATCH>')
  process.exit(1)
}
// SemVer core only (no pre-release/build metadata) — keep release tags simple.
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${version}". Expected MAJOR.MINOR.PATCH, e.g. 1.2.3`)
  process.exit(1)
}

/**
 * Replaces the first match of `pattern` in a file, preserving all other bytes
 * (whitespace, line endings, key order). `$1` in the replacement keeps the
 * captured prefix so only the version literal changes.
 */
function bump(relPath, pattern) {
  const path = join(webDesktop, relPath)
  const text = readFileSync(path, 'utf8')
  if (!pattern.test(text)) {
    console.error(`  Could not find a version field in ${relPath}`)
    process.exit(1)
  }
  writeFileSync(path, text.replace(pattern, `$1${version}$2`))
  console.log(`  ${relPath} -> ${version}`)
}

console.log(`Bumping Drinkwater desktop version to ${version}:`)
// JSON: "version": "x.y.z"
bump('package.json', /("version":\s*")[^"]*(")/)
bump('src-tauri/tauri.conf.json', /("version":\s*")[^"]*(")/)
// TOML [package] table: version = "x.y.z" (first occurrence, anchored to line)
bump('src-tauri/Cargo.toml', /^(version = ")[^"]*(")/m)

console.log('\nDone. Next:')
console.log(`  git commit -am "chore: release v${version}"`)
console.log(`  git tag v${version}`)
console.log('  git push && git push --tags')
