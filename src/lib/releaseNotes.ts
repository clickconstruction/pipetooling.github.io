/**
 * Release notes kernel (v2.944): types + validation for the in-app release
 * notes feed (Settings → Release notes), plus the RECENT_FEATURES.md version
 * parser the CI drift test uses to enforce "every PR ships a release note".
 * Data lives in src/content/releaseNotes.ts — one entry per PR, same v2.NNN
 * as the PR's docs/RECENT_FEATURES.md entry.
 */

export type ReleaseNoteKind = 'feature' | 'fix' | 'infra'

export interface ReleaseNote {
  /** App version, e.g. "v2.944" — matches the PR's RECENT_FEATURES.md entry. */
  version: string
  /** ISO date the PR merged, e.g. "2026-07-22". */
  date: string
  /** Short human-readable summary — what a user would want to know. */
  title: string
  kind: ReleaseNoteKind
  /** 1–4 short bullets; plain sentences, no file paths. */
  highlights: string[]
}

const VERSION_RE = /^v2\.(\d+)$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const KINDS: ReadonlySet<string> = new Set(['feature', 'fix', 'infra'])

/** Numeric minor version from "v2.NNN", or null when malformed. */
export function releaseNoteVersionNumber(version: string): number | null {
  const m = VERSION_RE.exec(version)
  const digits = m?.[1]
  return digits != null ? Number(digits) : null
}

/**
 * All problems with the release-notes array (empty array = valid): version
 * format, strictly-descending unique versions (newest first), ISO dates,
 * non-empty title, 1–4 non-empty highlights, known kind.
 */
export function validateReleaseNotes(notes: ReleaseNote[]): string[] {
  const problems: string[] = []
  if (notes.length === 0) problems.push('release notes list is empty')
  let prevNumber: number | null = null
  notes.forEach((note, i) => {
    const label = `${note.version || `entry #${i}`}`
    const num = releaseNoteVersionNumber(note.version)
    if (num == null) problems.push(`${label}: version must match v2.NNN`)
    if (num != null && prevNumber != null && num >= prevNumber) {
      problems.push(`${label}: versions must be unique and strictly descending (newest first)`)
    }
    if (num != null) prevNumber = num
    if (!DATE_RE.test(note.date) || Number.isNaN(new Date(`${note.date}T00:00:00Z`).getTime())) {
      problems.push(`${label}: date must be a valid YYYY-MM-DD`)
    }
    if (note.title.trim() === '') problems.push(`${label}: title is empty`)
    if (!KINDS.has(note.kind)) problems.push(`${label}: unknown kind "${note.kind}"`)
    if (note.highlights.length < 1 || note.highlights.length > 4) {
      problems.push(`${label}: needs 1–4 highlights (has ${note.highlights.length})`)
    }
    if (note.highlights.some((h) => h.trim() === '')) problems.push(`${label}: has an empty highlight`)
  })
  return problems
}

/**
 * Newest version number documented in docs/RECENT_FEATURES.md, parsed from its
 * "## Latest Updates (v2.NNN)" headings (max across all, so ordering quirks in
 * the file can't break the check). Null when no heading is found.
 */
export function newestRecentFeaturesVersionNumber(markdown: string): number | null {
  let newest: number | null = null
  for (const num of recentFeaturesVersionNumbers(markdown)) {
    if (newest == null || num > newest) newest = num
  }
  return newest
}

/** Every version number with a "## Latest Updates (v2.NNN)" heading, in file order. */
export function recentFeaturesVersionNumbers(markdown: string): number[] {
  const versions: number[] = []
  for (const m of markdown.matchAll(/^## Latest Updates \(v2\.(\d+)\)/gm)) {
    const digits = m[1]
    if (digits != null) versions.push(Number(digits))
  }
  return versions
}

/**
 * Versions with more than one "## Latest Updates" heading, ascending.
 *
 * Two sessions that claim the same v2.NNN produce this the moment their doc
 * heads are merged together — which is the visible half of the failure that
 * silently dropped a merged PR's entry on 2026-08-03. `newestRecentFeatures-
 * VersionNumber` takes a max, so duplicates are invisible to it; this is the
 * check that fails instead of letting the merge through.
 */
export function duplicateRecentFeaturesVersions(markdown: string): number[] {
  const seen = new Set<number>()
  const dupes = new Set<number>()
  for (const num of recentFeaturesVersionNumbers(markdown)) {
    if (seen.has(num)) dupes.add(num)
    seen.add(num)
  }
  return [...dupes].sort((a, b) => a - b)
}

/**
 * Release-note versions with no matching RECENT_FEATURES.md heading. Conflict
 * resolution that keeps one file's entry and drops the other's leaves the pair
 * inconsistent; the newest-version drift test only compares the two heads, so
 * anything below the newest entry can rot unnoticed.
 */
export function releaseNotesMissingFromRecentFeatures(notes: ReleaseNote[], markdown: string): string[] {
  return releaseNotesMissingFromDocumented(notes, new Set(recentFeaturesVersionNumbers(markdown)))
}

/** Same check against a precomputed documented-version set (archive + fragments). */
export function releaseNotesMissingFromDocumented(notes: ReleaseNote[], documented: ReadonlySet<number>): string[] {
  return notes
    .filter((note) => {
      const num = releaseNoteVersionNumber(note.version)
      return num != null && !documented.has(num)
    })
    .map((note) => note.version)
}

/**
 * Version numbers from recent-features fragment filenames (docs/recent-features/
 * v2.NNNN.md). Non-matching names (README.md etc.) are ignored.
 */
export function recentFeaturesFragmentVersionNumbers(filenames: string[]): number[] {
  const versions: number[] = []
  for (const name of filenames) {
    const m = /^v2\.(\d+)\.md$/.exec(name)
    if (m?.[1] != null) versions.push(Number(m[1]))
  }
  return versions
}

/** Duplicates in a combined documented-version list (archive + fragments), ascending. */
export function duplicateVersions(versions: number[]): number[] {
  const seen = new Set<number>()
  const dupes = new Set<number>()
  for (const num of versions) {
    if (seen.has(num)) dupes.add(num)
    seen.add(num)
  }
  return [...dupes].sort((a, b) => a - b)
}

/**
 * Problems with one recent-features fragment: its first non-empty line must be
 * a heading that names the same version as the filename — the guard against
 * pasting an entry into a wrongly-numbered file (the fragment-era shape of the
 * duplicate-heading damage the 2026-08-03 races caused).
 */
export function recentFeaturesFragmentProblems(filename: string, content: string): string[] {
  const m = /^v2\.(\d+)\.md$/.exec(filename)
  if (!m) return [`${filename}: fragment files must be named v2.NNNN.md`]
  const firstLine = content.split('\n').find((line) => line.trim() !== '')
  if (!firstLine || !firstLine.startsWith(`# v2.${m[1]} `)) {
    return [`${filename}: first line must be a "# v2.${m[1]} — <title> (<date>)" heading`]
  }
  return []
}
