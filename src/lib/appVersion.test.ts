import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES } from '../content/releaseNotes'
import { APP_VERSION } from './appVersion'
import { newestReleaseNoteVersion } from './newestReleaseNote'

describe('newestReleaseNoteVersion', () => {
  it('takes the highest number, not the last name in order', () => {
    expect(newestReleaseNoteVersion(['v2.999.ts', 'v2.1000.ts', 'v2.7720.ts', 'v2.812.ts'])).toBe('v2.7720')
  })

  it('passes over names that are not a release note', () => {
    expect(newestReleaseNoteVersion(['README.md', 'index.ts', 'v2.9999.ts.bak', 'v2.x.ts', 'v3.1.ts', 'v2.12.ts'])).toBe('v2.12')
  })

  it('is null with no release note', () => {
    expect(newestReleaseNoteVersion([])).toBeNull()
    expect(newestReleaseNoteVersion(['README.md'])).toBeNull()
  })
})

describe('APP_VERSION', () => {
  it('is the newest release note in the tree the build read', () => {
    const names = readdirSync(join(process.cwd(), 'src/content/releaseNotes'))
    expect(APP_VERSION).toMatch(/^v2\.\d+$/)
    expect(APP_VERSION).toBe(newestReleaseNoteVersion(names))
  })

  it('names the same note Settings → Release notes puts first', () => {
    expect(APP_VERSION).toBe(RELEASE_NOTES[0]!.version)
  })
})
