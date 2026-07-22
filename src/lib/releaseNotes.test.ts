/**
 * Release-notes conformance + drift test (v2.944). The drift test is the
 * convention's enforcement: every PR adds a docs/RECENT_FEATURES.md entry
 * (existing convention), and this test fails CI until a matching
 * src/content/releaseNotes.ts entry with the same v2.NNN exists.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES } from '../content/releaseNotes'
import {
  newestRecentFeaturesVersionNumber,
  releaseNoteVersionNumber,
  validateReleaseNotes,
} from './releaseNotes'
import type { ReleaseNote } from './releaseNotes'

const RECENT_FEATURES_PATH = join(__dirname, '../../docs/RECENT_FEATURES.md')

const note = (overrides: Partial<ReleaseNote>): ReleaseNote => ({
  version: 'v2.900',
  date: '2026-07-22',
  title: 'A change',
  kind: 'feature',
  highlights: ['Something changed.'],
  ...overrides,
})

describe('release notes content', () => {
  it('every entry is well-formed, newest first', () => {
    expect(validateReleaseNotes(RELEASE_NOTES)).toEqual([])
  })

  it('newest release note matches the newest RECENT_FEATURES.md version', () => {
    const newestNote = RELEASE_NOTES[0]
    const newestDocumented = newestRecentFeaturesVersionNumber(readFileSync(RECENT_FEATURES_PATH, 'utf8'))
    expect(newestDocumented).not.toBeNull()
    expect(
      newestNote == null ? null : releaseNoteVersionNumber(newestNote.version),
      'docs/RECENT_FEATURES.md has a newer version than src/content/releaseNotes.ts — every PR ships a ' +
        'release note: add an entry for the new version (same v2.NNN) to src/content/releaseNotes.ts',
    ).toBe(newestDocumented)
  })
})

describe('releaseNoteVersionNumber', () => {
  it('parses v2.NNN and rejects everything else', () => {
    expect(releaseNoteVersionNumber('v2.944')).toBe(944)
    expect(releaseNoteVersionNumber('v2.4')).toBe(4)
    expect(releaseNoteVersionNumber('2.944')).toBeNull()
    expect(releaseNoteVersionNumber('v3.1')).toBeNull()
    expect(releaseNoteVersionNumber('v2.944-rc1')).toBeNull()
  })
})

describe('validateReleaseNotes', () => {
  it('accepts a valid descending list', () => {
    expect(validateReleaseNotes([note({ version: 'v2.901' }), note({ version: 'v2.900' })])).toEqual([])
  })

  it('flags empty list, bad version, ascending order, duplicates, bad date, empty title, bad kind, highlight bounds', () => {
    expect(validateReleaseNotes([])).toContain('release notes list is empty')
    expect(validateReleaseNotes([note({ version: 'v2.x' })]).join()).toContain('version must match')
    expect(
      validateReleaseNotes([note({ version: 'v2.900' }), note({ version: 'v2.901' })]).join(),
    ).toContain('strictly descending')
    expect(
      validateReleaseNotes([note({ version: 'v2.900' }), note({ version: 'v2.900' })]).join(),
    ).toContain('strictly descending')
    expect(validateReleaseNotes([note({ date: '2026-13-40' })]).join()).toContain('valid YYYY-MM-DD')
    expect(validateReleaseNotes([note({ date: '07/22/2026' })]).join()).toContain('valid YYYY-MM-DD')
    expect(validateReleaseNotes([note({ title: '  ' })]).join()).toContain('title is empty')
    expect(validateReleaseNotes([note({ kind: 'chore' as ReleaseNote['kind'] })]).join()).toContain('unknown kind')
    expect(validateReleaseNotes([note({ highlights: [] })]).join()).toContain('needs 1–4 highlights')
    expect(
      validateReleaseNotes([note({ highlights: ['a', 'b', 'c', 'd', 'e'] })]).join(),
    ).toContain('needs 1–4 highlights')
    expect(validateReleaseNotes([note({ highlights: [' '] })]).join()).toContain('empty highlight')
  })
})

describe('newestRecentFeaturesVersionNumber', () => {
  it('takes the max across all Latest Updates headings', () => {
    const md = '## Latest Updates (v2.941)\n\ntext\n\n## Latest Updates (v2.943)\n\n## Latest Updates (v2.942)\n'
    expect(newestRecentFeaturesVersionNumber(md)).toBe(943)
  })

  it('ignores non-heading mentions and returns null when absent', () => {
    expect(newestRecentFeaturesVersionNumber('see Latest Updates (v2.900) inline')).toBeNull()
    expect(newestRecentFeaturesVersionNumber('# Other doc')).toBeNull()
  })
})
