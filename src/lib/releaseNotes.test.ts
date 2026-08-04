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
  duplicateRecentFeaturesVersions,
  newestRecentFeaturesVersionNumber,
  recentFeaturesVersionNumbers,
  releaseNoteVersionNumber,
  releaseNotesMissingFromRecentFeatures,
  validateReleaseNotes,
} from './releaseNotes'
import type { ReleaseNote } from './releaseNotes'

const RECENT_FEATURES_PATH = join(__dirname, '../../docs/RECENT_FEATURES.md')

/**
 * Discrepancies already on main when these guards landed — frozen so anything
 * NEW fails while the historical debt is repaired separately. Both lists are a
 * ratchet: shrink them, never extend them. Extending one means a PR lost an
 * entry, which is the failure the guards exist to catch.
 *
 * `v2.25`, `v2.95`, `v2.545` each carry two "## Latest Updates" headings.
 * `v2.1037`–`v2.1040` are in releaseNotes.ts with no heading at all; `v2.1012`
 * is mentioned in prose but never as a heading.
 */
const LEGACY_DUPLICATE_RECENT_FEATURES_VERSIONS: readonly number[] = [25, 95, 545]
const LEGACY_UNDOCUMENTED_RELEASE_NOTES: readonly string[] = ['v2.1040', 'v2.1039', 'v2.1038', 'v2.1037', 'v2.1012']

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

  it('no version is documented twice in RECENT_FEATURES.md', () => {
    const dupes = duplicateRecentFeaturesVersions(readFileSync(RECENT_FEATURES_PATH, 'utf8')).filter(
      (v) => !LEGACY_DUPLICATE_RECENT_FEATURES_VERSIONS.includes(v),
    )
    expect(
      dupes,
      'docs/RECENT_FEATURES.md documents the same v2.NNN twice — two sessions claimed one number. ' +
        'Claim with `npm run claim` and renumber the newer entry; do not delete either one.',
    ).toEqual([])
  })

  it('every release note has a RECENT_FEATURES.md entry', () => {
    const missing = releaseNotesMissingFromRecentFeatures(
      RELEASE_NOTES,
      readFileSync(RECENT_FEATURES_PATH, 'utf8'),
    ).filter((v) => !LEGACY_UNDOCUMENTED_RELEASE_NOTES.includes(v))
    expect(
      missing,
      'these versions are in src/content/releaseNotes.ts but have no docs/RECENT_FEATURES.md heading — ' +
        'a merge or conflict resolution dropped one side of the pair',
    ).toEqual([])
  })
})

describe('recentFeaturesVersionNumbers', () => {
  it('lists every heading version in file order', () => {
    const md = '## Latest Updates (v2.3)\ntext\n\n## Latest Updates (v2.1)\nmore\n'
    expect(recentFeaturesVersionNumbers(md)).toEqual([3, 1])
  })

  it('ignores headings that are not the Latest Updates form', () => {
    expect(recentFeaturesVersionNumbers('### Latest Updates (v2.3)\n## Other (v2.4)\n')).toEqual([])
  })
})

describe('duplicateRecentFeaturesVersions', () => {
  it('is empty for a clean file', () => {
    expect(duplicateRecentFeaturesVersions('## Latest Updates (v2.3)\n## Latest Updates (v2.2)\n')).toEqual([])
  })

  it('reports a version documented twice, ascending', () => {
    const md = '## Latest Updates (v2.9)\n## Latest Updates (v2.5)\n## Latest Updates (v2.9)\n## Latest Updates (v2.5)\n'
    expect(duplicateRecentFeaturesVersions(md)).toEqual([5, 9])
  })
})

describe('releaseNotesMissingFromRecentFeatures', () => {
  it('is empty when every note is documented', () => {
    const md = '## Latest Updates (v2.901)\n## Latest Updates (v2.900)\n'
    expect(releaseNotesMissingFromRecentFeatures([note({ version: 'v2.901' }), note({ version: 'v2.900' })], md)).toEqual([])
  })

  it('names notes with no matching heading', () => {
    const md = '## Latest Updates (v2.900)\n'
    expect(releaseNotesMissingFromRecentFeatures([note({ version: 'v2.901' }), note({ version: 'v2.900' })], md)).toEqual([
      'v2.901',
    ])
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
