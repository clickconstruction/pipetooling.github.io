/**
 * Release-notes conformance + drift test (v2.944; fragments cutover 2026-08-20).
 * The drift test is the convention's enforcement: every PR adds a
 * docs/recent-features/v2.NNNN.md fragment, and this test fails CI until a
 * matching src/content/releaseNotes/v2.NNNN.ts fragment exists. The pre-cutover
 * archives (docs/RECENT_FEATURES.md, src/content/releaseNotesArchive.ts) are
 * frozen and still checked so historical damage cannot creep back in.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RELEASE_NOTES, RELEASE_NOTE_FRAGMENTS } from '../content/releaseNotes'
import {
  duplicateRecentFeaturesVersions,
  duplicateVersions,
  newestRecentFeaturesVersionNumber,
  recentFeaturesFragmentProblems,
  recentFeaturesFragmentVersionNumbers,
  recentFeaturesVersionNumbers,
  releaseNoteVersionNumber,
  releaseNotesMissingFromDocumented,
  releaseNotesMissingFromRecentFeatures,
  validateReleaseNotes,
} from './releaseNotes'
import type { ReleaseNote } from './releaseNotes'

const RECENT_FEATURES_PATH = join(__dirname, '../../docs/RECENT_FEATURES.md')
const RECENT_FEATURES_DIR = join(__dirname, '../../docs/recent-features')

const fragmentMdFiles = () => readdirSync(RECENT_FEATURES_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md')

/** Every documented version: frozen archive headings + fragment filenames. */
const documentedVersions = () => [
  ...recentFeaturesVersionNumbers(readFileSync(RECENT_FEATURES_PATH, 'utf8')),
  ...recentFeaturesFragmentVersionNumbers(fragmentMdFiles()),
]

/**
 * Both guards enforce a hard zero (v2.1373). The historical damage they were
 * frozen around when they landed in v2.1372 is repaired: `v2.25` / `v2.95` /
 * `v2.545` each carried two "## Latest Updates" headings and are now merged
 * under one, and the five orphaned release notes (`v2.1012`, `v2.1037`–
 * `v2.1040`) got their headings back from git history.
 *
 * The empty arrays stay as named constants on purpose: a future repair may need
 * a temporary exemption, and a reviewer seeing a version added here knows
 * exactly what it means. They are a ratchet — anything added must come back out.
 */
const LEGACY_DUPLICATE_RECENT_FEATURES_VERSIONS: readonly number[] = []
const LEGACY_UNDOCUMENTED_RELEASE_NOTES: readonly string[] = []

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

  it('newest release note matches the newest documented version (fragments + archive)', () => {
    const newestNote = RELEASE_NOTES[0]
    const newestDocumented = documentedVersions().reduce((a, b) => Math.max(a, b), 0)
    expect(newestDocumented).toBeGreaterThan(0)
    expect(
      newestNote == null ? null : releaseNoteVersionNumber(newestNote.version),
      'docs/recent-features/ has a newer version than the release-note fragments — every PR ships a ' +
        'release note: add src/content/releaseNotes/v2.NNNN.ts (same v2.NNNN as your docs fragment)',
    ).toBe(newestDocumented)
  })

  it('no version is documented twice (across the archive and fragments)', () => {
    const dupes = duplicateVersions(documentedVersions()).filter(
      (v) => !LEGACY_DUPLICATE_RECENT_FEATURES_VERSIONS.includes(v),
    )
    expect(
      dupes,
      'the same v2.NNNN is documented twice (two fragment/archive entries) — two sessions claimed one ' +
        'number. Claim with `npm run claim` and renumber the newer entry; do not delete either one.',
    ).toEqual([])
  })

  it('every release note has a recent-features entry (fragment or archive heading)', () => {
    const missing = releaseNotesMissingFromDocumented(RELEASE_NOTES, new Set(documentedVersions())).filter(
      (v) => !LEGACY_UNDOCUMENTED_RELEASE_NOTES.includes(v),
    )
    expect(
      missing,
      'these release-note versions have no docs/recent-features/ fragment or archive heading — ' +
        'a merge or conflict resolution dropped one side of the pair',
    ).toEqual([])
  })

  it('every release-note fragment filename matches its version', () => {
    for (const { file, note: fragNote } of RELEASE_NOTE_FRAGMENTS) {
      expect(file, `fragment ${file} must be named after its version (${fragNote.version}.ts)`).toBe(
        `${fragNote.version}.ts`,
      )
    }
  })

  it('every recent-features fragment starts with its own version heading', () => {
    const problems = fragmentMdFiles().flatMap((f) =>
      recentFeaturesFragmentProblems(f, readFileSync(join(RECENT_FEATURES_DIR, f), 'utf8')),
    )
    expect(problems).toEqual([])
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

describe('recentFeaturesFragmentVersionNumbers', () => {
  it('parses v2.NNNN.md names and ignores everything else', () => {
    expect(recentFeaturesFragmentVersionNumbers(['v2.1898.md', 'v2.1900.md', 'README.md', 'v2.1x.md'])).toEqual([
      1898, 1900,
    ])
  })
})

describe('duplicateVersions', () => {
  it('reports duplicates ascending, empty when clean', () => {
    expect(duplicateVersions([9, 5, 9, 5, 3])).toEqual([5, 9])
    expect(duplicateVersions([3, 2, 1])).toEqual([])
  })
})

describe('recentFeaturesFragmentProblems', () => {
  it('accepts a fragment whose first line names its own version', () => {
    expect(recentFeaturesFragmentProblems('v2.1898.md', '# v2.1898 — Fragments cutover (2026-08-20)\n\nBody.\n')).toEqual([])
  })

  it('flags a bad filename and a mismatched or missing heading', () => {
    expect(recentFeaturesFragmentProblems('notes.md', '# v2.1898 — x\n').join()).toContain('must be named')
    expect(recentFeaturesFragmentProblems('v2.1898.md', '# v2.1899 — wrong (2026-08-20)\n').join()).toContain(
      'first line',
    )
    expect(recentFeaturesFragmentProblems('v2.1898.md', '\n\n').join()).toContain('first line')
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
