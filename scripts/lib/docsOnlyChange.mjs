/**
 * Decides whether a CI build can skip the full test suite because every changed file is documentation.
 * Plain JS with no dependencies: ci.yml runs it right after `npm ci`, and src/lib/docsOnlyChange.test.ts pins it.
 *
 * On 2026-11-02 the suite took 13 to 21 of the checks job's 25 minutes, 16 of the day's 74 merges touched
 * only docs/, to-dos/ or a release note, and the merge queue ran three builds at a time — so a docs-only build
 * cost the queue as much as a code one. The rule here is fail-safe: no files, a list cut at the compare API's
 * cap, or one file outside the patterns means the whole suite runs. The doc-reading tests always run on a
 * docs-only change, since they are the ones such a change can break.
 */

/** A path that no test but the doc readers can see. */
export const DOCS_ONLY_PATTERNS = [
  /^docs\//,
  /^to-dos\//,
  /^[^/]+\.md$/, // CLAUDE.md, AGENTS.md, README.md and the other root notes
  /^\.claude\//, // skills, session cards, claims
  /^src\/content\/releaseNotes\/v2\.\d+\.ts$/, // a release note; releaseNotes.test.ts reads it
]

/** The tests that read docs/, to-dos/, .claude/ or the release notes from disk. Kept in CI by the test. */
export const DOC_READING_TESTS = [
  'src/lib/releaseNotes.test.ts', // every release note has its fragment, no version twice
  'src/lib/twins/appDirectoryCheck.test.ts', // docs/twins/APP_DIRECTORY.md names real routes and guides
  'src/lib/todos/punchListView.test.ts', // the punch list renders from to-dos/
  'src/lib/todos/todoBoard.test.ts', // the to-do board's rows and collisions from to-dos/
  'src/lib/sessionClaims.test.ts', // .claude/sessions claims and cards
]

/** The compare API answers at most this many files in one page; a list this long may be cut. */
export const COMPARE_FILE_CAP = 300

export function isDocFile(path) {
  return DOCS_ONLY_PATTERNS.some((re) => re.test(path))
}

/**
 * @param {string[]} files every path the build changes against its base (a rename counts both names)
 * @param {{ cap?: number }} [opts]
 * @returns {{ docsOnly: boolean, reason: string, outside: string[] }}
 */
export function docsOnlyVerdict(files, opts = {}) {
  const cap = opts.cap ?? COMPARE_FILE_CAP
  const list = Array.from(new Set((files ?? []).filter((f) => typeof f === 'string' && f.length > 0)))
  if (list.length === 0) return { docsOnly: false, reason: 'no files listed, so everything runs', outside: [] }
  if (list.length >= cap) {
    return { docsOnly: false, reason: `${list.length} files, at the compare cap, so everything runs`, outside: [] }
  }
  const outside = list.filter((f) => !isDocFile(f))
  if (outside.length > 0) {
    const shown = outside.slice(0, 5).join(', ') + (outside.length > 5 ? ` and ${outside.length - 5} more` : '')
    return { docsOnly: false, reason: `code changed: ${shown}`, outside }
  }
  return { docsOnly: true, reason: `${list.length} file${list.length === 1 ? '' : 's'}, all docs`, outside: [] }
}

/** The lines written to $GITHUB_OUTPUT. */
export function docsOnlyOutputs(verdict) {
  return [`docs_only=${verdict.docsOnly ? 'true' : 'false'}`, `doc_tests=${DOC_READING_TESTS.join(' ')}`]
}

/** The file names in a compare API body, renames counted under both names; [] for anything that is not one. */
export function filesOfCompare(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.files)) return []
  const out = []
  for (const f of body.files) {
    if (f && typeof f.filename === 'string') out.push(f.filename)
    if (f && typeof f.previous_filename === 'string') out.push(f.previous_filename)
  }
  return out
}
