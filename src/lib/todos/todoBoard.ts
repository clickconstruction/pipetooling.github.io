/**
 * The to-dos have one source and one rendered view.
 *
 * Each to-do file carries front matter with the handful of fields a reader triages on. The
 * app's Punch list page (`/punch-list`) renders the board from that front matter — at build
 * time, as the `virtual:punch-list` module `todoBoardPlugin` (vite.config.ts) serves; nothing
 * generated is committed. (v2.3497–v2.3622 also rendered an index table into `to-dos/README.md`
 * and a committed `src/content/punchList.generated.ts`; every to-do PR then conflicted on those
 * two files whenever main moved — eleven times on 2026-09-19 alone — so v2.3623 stopped
 * committing them.)
 *
 * Why: on 2026-09-16 the same fact lived in three places (a to-do's `Status:` line, the
 * index's Status cell, the board's row) and all three disagreed. Three to-dos written in
 * the previous two days had no board row at all; `gc-on-notice` read "built" in its folder
 * and "not started" in the index; the board cited v2.3478 for something that shipped as
 * v2.3482. A drift check over three hand-kept copies was a band-aid; this removes two of
 * the copies, which is `docs/README.md`'s "each fact has one home" applied properly.
 *
 * The body of a to-do is untouched by all of this: the ask in the owner's words, the
 * decision, the mock-up, the PR train and the verify recipe stay prose, in the file, in
 * git, next to their artboards. Only the triage fields are structured.
 *
 * Pure string/data work — all file IO lives in `scripts/todos/readTodos.ts`.
 */

export const BOARD_GROUPS = ['ready', 'close', 'gated', 'waiting', 'residual'] as const
export type BoardGroup = (typeof BOARD_GROUPS)[number]

/** Order the views present groups in; also the index table's sort. */
export const GROUP_ORDER: readonly BoardGroup[] = BOARD_GROUPS

export interface TodoMeta {
  /** Row name in both views. */
  name: string
  /**
   * The row's number on the board (`#16`) — the handle people use to refer to it (v2.3708).
   * Given once, when the to-do is written (the next free one: `npm run check:todos` prints it),
   * and never reused: a retired to-do's number retires with it, so "#16" always means the
   * same work.
   */
  number: number
  group: BoardGroup
  /** The one-line state. This is the sentence the index's Status column shows. */
  status: string
  /** One paragraph: what this is. The index's Summary column and the board's blurb. */
  summary: string
  /** What to do next, concretely. */
  next: string
  /** Free text, e.g. "M (2 client-only PRs)". */
  size: string
  /** What stands in the way, or "None." */
  blocker: string
  /** Versions or a short provenance note, shown as a chip. */
  ver: string
  /**
   * `opinion: <verdict> — <one sentence>` — a reviewer's call on whether to do it and the one
   * benefit or cost that decides it. The verdict is one of `build`, `later`, `drop`, `your call`
   * (see `parseOpinion`); the sentence is free text. Optional; anyone with repo access edits it.
   */
  opinion: string
  /** Standing pointers are listed but are not "open items". */
  pointer: boolean
  /**
   * `mockup: not required — <why>` in the front matter: the to-do changes no screen (a live
   * test, a refactor, a retirement), so the board says "not required" instead of "waiting".
   * Empty when a mock-up is expected.
   */
  mockupNotRequired: string
}

/** The verdict word an `opinion:` opens with. */
export type OpinionVerdict = 'build' | 'later' | 'drop' | 'your call'

const OPINION_VERDICTS: ReadonlyArray<OpinionVerdict> = ['build', 'later', 'drop', 'your call']

/**
 * `build — one script PR ends it` -> { verdict: 'build', note: 'one script PR ends it' }.
 * The verdict is case-insensitive and may carry a parenthetical (`build (PR 3)`), which stays
 * in the note; text with no recognised verdict is all note, verdict null. Empty -> null.
 */
export function parseOpinion(text: string | null | undefined): { verdict: OpinionVerdict | null; note: string } | null {
  // Tolerates a row with no field at all (a generated file older than this column).
  const t = (text ?? '').trim()
  if (!t) return null
  const m = /^(build|later|drop|your call)\b\s*(\([^)]*\))?\s*(?:[—–-]+\s*)?/i.exec(t)
  if (!m) return { verdict: null, note: t }
  const verdict = m[1]!.toLowerCase() as OpinionVerdict
  const paren = m[2] ? `${m[2]} ` : ''
  return { verdict: OPINION_VERDICTS.includes(verdict) ? verdict : null, note: (paren + t.slice(m[0].length)).trim() }
}

/** Where a to-do stands on its drawing: it has one, it is waiting for one, or it needs none. */
export type MockupState = 'has' | 'waiting' | 'not-required'

export function mockupState(doc: Pick<TodoDoc, 'mockups'> & { meta: Pick<TodoMeta, 'mockupNotRequired' | 'pointer'> }): MockupState {
  if (doc.mockups.length > 0) return 'has'
  if (doc.meta.pointer || doc.meta.mockupNotRequired) return 'not-required'
  return 'waiting'
}

/** The front-matter `mockup:` value → the "not required" reason, or '' when a mock-up is expected. */
export function parseMockupField(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  const m = /^not[\s-]+required\b\s*(?:[—–:-]\s*)?(.*)$/i.exec(v)
  if (!m) return ''
  return m[1]?.trim() || 'not required'
}

/** A link the to-do's prose carries to a published artifact (a mock-up on claude.ai). */
export interface TodoLink {
  label: string
  url: string
}

export interface TodoDoc {
  /** Repo-root path, e.g. `to-dos/gc-on-notice/README.md`. */
  file: string
  slug: string
  meta: TodoMeta
  /**
   * Repo-root paths of the `.html` pages saved beside the to-do (mock-ups, before/afters).
   * Derived from the folder listing, never declared: a file added or removed beside a to-do
   * changes both views on the next `--fix`, and the drift check notices until it runs.
   */
  mockups: string[]
  /** Published artifacts the prose links, in order of first mention. */
  artifacts: TodoLink[]
}

export interface TodoParseError {
  file: string
  problem: string
}

export interface FrontMatter {
  fields: Record<string, string>
  body: string
  found: boolean
}

const FM_FENCE = '---'

/**
 * Read a leading `---` front-matter block. Deliberately a small reader rather than a YAML
 * dependency: the fields are flat strings, and a `>` block scalar is the only structure
 * used (for the long summary).
 */
export function parseFrontMatter(markdown: string): FrontMatter {
  const lines = markdown.split('\n')
  if (lines[0]?.trim() !== FM_FENCE) return { fields: {}, body: markdown, found: false }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === FM_FENCE)
  if (end < 0) return { fields: {}, body: markdown, found: false }

  const fields: Record<string, string> = {}
  let key: string | null = null
  let blockLines: string[] = []
  const flush = (): void => {
    if (key) fields[key] = blockLines.join(' ').replace(/\s+/g, ' ').trim()
    key = null
    blockLines = []
  }
  for (let i = 1; i < end; i++) {
    const line = lines[i] ?? ''
    const kv = /^([a-zA-Z_][\w-]*):\s*(.*)$/.exec(line)
    if (kv?.[1] !== undefined && !/^\s/.test(line)) {
      flush()
      const value = (kv[2] ?? '').trim()
      if (value === '>' || value === '>-' || value === '|') key = kv[1]
      else fields[kv[1]] = stripQuotes(value)
      continue
    }
    if (key) blockLines.push(line.trim())
  }
  flush()
  return { fields, body: lines.slice(end + 1).join('\n').replace(/^\n+/, ''), found: true }
}

function stripQuotes(value: string): string {
  // `renderFrontMatter` writes a scalar that needs quoting with JSON.stringify, so an inner
  // quote or backslash arrives escaped; read it back the same way so the pair round-trips.
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string
    } catch {
      return value.slice(1, -1)
    }
  }
  const m = /^'([\s\S]*)'$/.exec(value)
  return m?.[1] ?? value
}

/** `to-dos/gc-on-notice/README.md` -> `gc-on-notice`; `to-dos/foo.md` -> `foo`. */
export function slugForFile(file: string): string {
  const rel = file.replace(/^to-dos\//, '')
  return rel.endsWith('/README.md') ? rel.slice(0, -'/README.md'.length) : rel.replace(/\.md$/, '')
}

const REQUIRED: ReadonlyArray<keyof TodoMeta> = ['name', 'number', 'group', 'status', 'summary', 'next', 'size', 'blocker']

/**
 * Validate one to-do's front matter into a `TodoDoc`, or say exactly what is wrong.
 * `siblings` are the repo-root paths of the other files in the to-do's directory; the
 * mock-ups are picked out of them (see `mockupsFor`).
 */
export function readTodoDoc(
  file: string,
  markdown: string,
  siblings: readonly string[] = [],
): TodoDoc | TodoParseError {
  const fm = parseFrontMatter(markdown)
  if (!fm.found) {
    return { file, problem: 'no front matter. Every to-do opens with a --- block (see to-dos/README.md).' }
  }
  const missing = REQUIRED.filter((k) => !(fm.fields[k] ?? '').trim())
  if (missing.length > 0) return { file, problem: `front matter is missing: ${missing.join(', ')}.` }

  const group = (fm.fields.group ?? '').trim()
  if (!isBoardGroup(group)) {
    return { file, problem: `group "${group}" is not one of ${BOARD_GROUPS.join(', ')}.` }
  }
  const numberText = (fm.fields.number ?? '').trim()
  if (!/^[1-9]\d*$/.test(numberText)) {
    return {
      file,
      problem: `number "${numberText}" is not a whole number from 1 up — the row's handle on the board; take the next free one (npm run check:todos prints it).`,
    }
  }
  const slug = slugForFile(file)
  return {
    file,
    slug,
    mockups: mockupsFor(file, siblings),
    artifacts: artifactsCited(fm.body),
    meta: {
      name: (fm.fields.name ?? '').trim(),
      number: Number(numberText),
      group,
      status: (fm.fields.status ?? '').trim(),
      summary: (fm.fields.summary ?? '').trim(),
      next: (fm.fields.next ?? '').trim(),
      size: (fm.fields.size ?? '').trim(),
      blocker: (fm.fields.blocker ?? '').trim(),
      ver: (fm.fields.ver ?? '').trim(),
      opinion: (fm.fields.opinion ?? '').trim(),
      pointer: /^true$/i.test((fm.fields.pointer ?? '').trim()),
      mockupNotRequired: parseMockupField(fm.fields.mockup),
    },
  }
}

export function isBoardGroup(value: string): value is BoardGroup {
  return (BOARD_GROUPS as readonly string[]).includes(value)
}

export function isParseError(value: TodoDoc | TodoParseError): value is TodoParseError {
  return (value as TodoParseError).problem !== undefined
}

/** `to-dos/gc-on-notice/README.md` -> `to-dos/gc-on-notice`; `to-dos/foo.md` -> `to-dos`. */
export function dirForFile(file: string): string {
  return file.slice(0, file.lastIndexOf('/'))
}

/**
 * The mock-ups saved beside a to-do. A folder to-do owns every `.html` in its folder; a flat
 * `to-dos/foo.md` owns the top-level pages named after it (`to-dos/foo-earned-revenue.html`).
 */
export function mockupsFor(file: string, siblings: readonly string[]): string[] {
  const dir = dirForFile(file)
  const slug = slugForFile(file)
  const isFolder = file.endsWith('/README.md')
  return siblings
    .filter((s) => s.endsWith('.html') && dirForFile(s) === dir)
    .filter((s) => {
      if (isFolder) return true
      const base = s.slice(dir.length + 1, -'.html'.length)
      return base === slug || base.startsWith(`${slug}-`) || base.startsWith(`${slug}.`)
    })
    .sort()
}

const ARTIFACT_URL = String.raw`https://claude\.ai/(?:code/)?artifact/[A-Za-z0-9_-]+`

/**
 * Every published artifact the prose links, deduped, first mention first. A markdown link
 * keeps its text as the label. A bare URL is labelled from the words before it on its line —
 * the way the to-dos write them: `Artifact: *Office Days* — https://…`, `(also on the design
 * canvas https://…)` — and by its position ("artifact 2") when the line gives nothing.
 */
export function artifactsCited(body: string): TodoLink[] {
  const out: TodoLink[] = []
  const seen = new Set<string>()
  const add = (label: string, url: string): void => {
    if (seen.has(url)) return
    seen.add(url)
    out.push({ label: label.trim(), url })
  }
  const linked = new RegExp(String.raw`\[([^\]]*)\]\((${ARTIFACT_URL})\)`, 'g')
  const bare = new RegExp(String.raw`(?<![(\w])(${ARTIFACT_URL})`, 'g')
  // Two passes so a labelled link wins over the same URL mentioned bare elsewhere.
  for (const m of body.matchAll(linked)) add(m[1] ?? '', m[2] ?? '')
  for (const m of body.matchAll(bare)) {
    const lineStart = body.lastIndexOf('\n', m.index ?? 0) + 1
    add(labelFromContext(body.slice(lineStart, m.index)), m[1] ?? '')
  }
  const labelled = out.map((l, i) => (l.label ? l : { ...l, label: `artifact ${i + 1}` }))
  // Two different pages with the same label on one to-do ("design canvas" twice) get numbered.
  const counts = new Map<string, number>()
  for (const l of labelled) counts.set(l.label, (counts.get(l.label) ?? 0) + 1)
  const seenLabel = new Map<string, number>()
  return labelled.map((l) => {
    if ((counts.get(l.label) ?? 0) < 2) return l
    const n = (seenLabel.get(l.label) ?? 0) + 1
    seenLabel.set(l.label, n)
    return { ...l, label: `${l.label} ${n}` }
  })
}

/**
 * The last *italic title* or `code title` (not a file name) before the URL, else the phrase
 * "design canvas", else nothing.
 */
export function labelFromContext(before: string): string {
  // Only the tail of the line belongs to the link; a title forty words back does not.
  if (/mock-?up:?\s*<?$/i.test(before)) return 'mock-up'
  before = before.slice(-48)
  const italics = [...before.matchAll(/(?:^|[\s(—–-])\*([^*\n]{2,60}?)\*(?=[\s.,;:)—–-]|$)/g)]
  const lastItalic = italics[italics.length - 1]?.[1]
  if (lastItalic) return lastItalic.trim()
  const codes = [...before.matchAll(/`([^`\n]{2,60})`/g)].map((m) => m[1] ?? '').filter((t) => !/[./]/.test(t))
  const lastCode = codes[codes.length - 1]
  if (lastCode) return lastCode.trim()
  return /design canvas/i.test(before) ? 'design canvas' : ''
}

/** Both views present to-dos in the same order: by group, then by name. */
export function sortDocs(docs: readonly TodoDoc[]): TodoDoc[] {
  return [...docs].sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.meta.group) - GROUP_ORDER.indexOf(b.meta.group)
    return g !== 0 ? g : a.meta.name.localeCompare(b.meta.name)
  })
}

export const GROUP_LABELS: Record<BoardGroup, string> = {
  ready: 'Ready to build',
  close: 'Close out',
  gated: 'Needs an owner decision',
  waiting: 'Waiting on time or usage',
  residual: 'Residuals',
}

/** Every `v2.NNN`/`v2.NNNN` in a piece of text, deduped, in order. */
export function versionsCited(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\bv2\.(\d{3,4})\b/g)) {
    const v = `v2.${m[1]}`
    if (!out.includes(v)) out.push(v)
  }
  return out
}

export const REPO_BLOB = 'https://github.com/clickconstruction/pipetooling.github.io/blob/main/'
export const REPO_COMMITS = 'https://github.com/clickconstruction/pipetooling.github.io/commits/main/'
/** The app serves every .html under to-dos/ at this origin (`todoMockupsPlugin`), so a mock-up opens as a page. */
export const REPO_RENDERED = 'https://clicktooling.com/'

/** `to-dos/foo/mockup.html` -> `mockup`; `to-dos/foo-earned-revenue.html` -> `earned-revenue` (for `foo`). */
export function mockupLabel(doc: Pick<TodoDoc, 'file' | 'slug'>, mockup: string): string {
  const base = mockup.slice(mockup.lastIndexOf('/') + 1, -'.html'.length)
  if (doc.file.endsWith('/README.md')) return base
  return base === doc.slug ? 'mock-up' : base.slice(doc.slug.length).replace(/^[-.]/, '')
}

/**
 * The front matter is written as markdown (it reads on GitHub). The board interpolates its
 * strings straight into HTML, so `**bold**` and `` `code` `` would show as literal asterisks
 * and backticks there. Strip the markup for the board.
 */
export function toPlainText(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Emphasis only: the content may not start or end with a space, so "3 * 4 * 5" stays.
    .replace(/(^|\s)\*(\S(?:[^*]*\S)?)\*(?=\s|$|[.,;:)])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\\|/g, '|')
    .replace(/\s+/g, ' ')
    .trim()
}

/** One row of the app's Punch list page, as the `virtual:punch-list` module carries it. */
export interface BoardItem {
  slug: string
  /** The row's handle, `#16` on the page. See `TodoMeta.number`. */
  number: number
  group: BoardGroup
  name: string
  /** Repo-root path of the to-do file. */
  file: string
  pointer: boolean
  summary: string
  next: string
  size: string
  blocker: string
  ver: string
  /** The reviewer's call, plain text as written (`build — …`); '' when none. See `parseOpinion`. */
  opinion: string
  /** Repo-root paths; the app serves each at `/` + path (the build copies every .html under to-dos/ into dist). */
  mockups: string[]
  artifacts: TodoLink[]
  /** has · waiting · not-required — see `mockupState`. */
  mockup: MockupState
  /** The reason when not required ('' otherwise). */
  mockupNote: string
}

export interface BoardData {
  /** The `main` the rows were rendered against: a local date and its newest shipped version. */
  validated: { date: string; version: string }
  openItems: number
  items: BoardItem[]
}

/** The page's rows: grouped, sorted, plain text (the page renders strings, not markdown). */
export function renderBoardData(docs: readonly TodoDoc[], validated: BoardData['validated']): BoardData {
  return {
    validated,
    openItems: openItemCount(docs),
    items: sortDocs(docs).map((d) => ({
      slug: d.slug,
      number: d.meta.number,
      group: d.meta.group,
      name: toPlainText(d.meta.name),
      file: d.file,
      pointer: d.meta.pointer,
      summary: toPlainText(d.meta.summary),
      next: toPlainText(d.meta.next),
      size: toPlainText(d.meta.size),
      blocker: toPlainText(d.meta.blocker),
      ver: toPlainText(d.meta.ver),
      opinion: toPlainText(d.meta.opinion),
      mockups: [...d.mockups],
      artifacts: d.artifacts.map((a) => ({ label: toPlainText(a.label), url: a.url })),
      mockup: mockupState(d),
      mockupNote: toPlainText(d.meta.mockupNotRequired),
    })),
  }
}

const MODULE_HEAD = `// virtual:punch-list — rendered at build time from the to-dos' front matter (todoBoardPlugin,
// vite.config.ts). Nothing to edit here; change the to-do file.
const data = `

/**
 * The module's text — a default export of pretty JSON (plain JS: a virtual module has no
 * extension for Vite to transpile types by), the shape `BoardData` declares in vite-env.d.ts.
 */
export function renderBoardModule(data: BoardData): string {
  return `${MODULE_HEAD}${JSON.stringify(data, null, 2)}\n\nexport default data\n`
}

/** The stamp off a rendered module (tests). */
export function parseBoardValidated(moduleText: string): BoardData['validated'] | null {
  const m = /"validated": \{\s*"date": "([^"]+)",\s*"version": "([^"]+)"/.exec(moduleText)
  return m?.[1] && m[2] ? { date: m[1], version: m[2] } : null
}

/** The data back out of the module text (tests and the script's summary). */
export function parseBoardModule(moduleText: string): BoardData | null {
  const start = moduleText.indexOf('const data = ')
  const end = moduleText.lastIndexOf('\nexport default data')
  if (start < 0 || end < 0) return null
  try {
    return JSON.parse(moduleText.slice(start + 'const data = '.length, end)) as BoardData
  } catch {
    return null
  }
}

/** Numeric order for `v2.NNNN`, so "newest" is a comparison and not a string sort. */
export function versionNumber(version: string): number {
  const m = /^v2\.(\d+)$/.exec(version)
  return m?.[1] ? Number(m[1]) : 0
}

/**
 * The number the next to-do takes: one past the highest ever assigned — the folder plus every
 * number the repo remembers giving out (`assignedNumbers`: the fragments' "punch list #N"
 * mentions and the `number:` lines of to-dos git history has seen). A retired number is never
 * refilled, so deleting the newest to-do must not hand its number to the next one (v2.3807).
 */
export function nextTodoNumber(docs: ReadonlyArray<Pick<TodoDoc, 'meta'>>, assignedNumbers: Iterable<number> = []): number {
  let max = docs.reduce((m, d) => Math.max(m, d.meta.number), 0)
  for (const n of assignedNumbers) if (Number.isInteger(n) && n > max) max = n
  return max + 1
}

/**
 * The punch-list numbers a `docs/recent-features/` fragment cites — "Punch list **#41**",
 * "(punch list #34, retired)", "to-do #27". Only the two phrasings the fragments use, so a
 * PR number ("PR #3448") or a journey-map item ("Tier-2 #41") never counts.
 */
export function assignedNumbersInFragment(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(/\b(?:punch[ -]list|to-do)\s+\**#(\d{1,3})\b/gi)) out.push(Number(m[1]))
  return out
}

/** Every `number:` a to-do ever carried, from `git log -p -- to-dos` output (added or removed lines both count). */
export function assignedNumbersInGitLog(patch: string): number[] {
  const out: number[] = []
  for (const m of patch.matchAll(/^[+-]number:\s*(\d{1,3})\s*(?:#.*)?$/gm)) out.push(Number(m[1]))
  return out
}

export function openItemCount(docs: readonly TodoDoc[]): number {
  return docs.filter((d) => !d.meta.pointer).length
}

export type FindingKind = 'front_matter' | 'unknown_version' | 'duplicate_slug' | 'duplicate_number'

export interface Finding {
  kind: FindingKind
  severity: 'error' | 'warn'
  file?: string
  message: string
}

export interface TodoProblemsInput {
  docs: readonly TodoDoc[]
  errors: readonly TodoParseError[]
  knownVersions: ReadonlySet<string>
  /** Numbers the repo remembers assigning beyond the folder (see `nextTodoNumber`); the build leaves it out. */
  assignedNumbers?: Iterable<number>
}

/**
 * What can still be wrong with the sources: a to-do that does not parse, two that share a
 * slug or a number, a cited version that never shipped. (Until v2.3623 this also compared two committed
 * views against a fresh render; there is nothing committed to compare any more.)
 */
export function findTodoProblems(input: TodoProblemsInput): Finding[] {
  const findings: Finding[] = []

  for (const e of input.errors) {
    findings.push({
      kind: 'front_matter',
      severity: 'error',
      file: e.file,
      message: `${e.file}: ${e.problem}`,
    })
  }

  const seen = new Map<string, string>()
  for (const d of input.docs) {
    const prior = seen.get(d.slug)
    if (prior) {
      findings.push({
        kind: 'duplicate_slug',
        severity: 'error',
        file: d.file,
        message: `two to-dos share the slug "${d.slug}": ${prior} and ${d.file}.`,
      })
    }
    seen.set(d.slug, d.file)
  }

  const numbered = new Map<number, string>()
  for (const d of input.docs) {
    const prior = numbered.get(d.meta.number)
    if (prior) {
      findings.push({
        kind: 'duplicate_number',
        severity: 'error',
        file: d.file,
        message: `two to-dos carry #${d.meta.number}: ${prior} and ${d.file}. A number is given once and never reused — the next free one is #${nextTodoNumber(input.docs, input.assignedNumbers)}.`,
      })
    }
    numbered.set(d.meta.number, d.file)
  }

  for (const d of input.docs) {
    for (const v of versionsCited(`${d.meta.status} ${d.meta.ver}`)) {
      if (!input.knownVersions.has(v)) {
        findings.push({
          kind: 'unknown_version',
          severity: 'error',
          file: d.file,
          message: `${d.file} cites ${v}, which has no docs/recent-features fragment and is not in the frozen archive.`,
        })
      }
    }
  }

  return findings
}

/** Serialize front matter for a to-do file, long fields as `>` blocks. */
export function renderFrontMatter(meta: TodoMeta): string {
  const wrap = (key: string, value: string): string[] => {
    if (value.length <= 90 && !value.includes('\n')) return [`${key}: ${quoteIfNeeded(value)}`]
    const words = value.split(/\s+/)
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      if (`${line} ${w}`.trim().length > 96) {
        lines.push(`  ${line.trim()}`)
        line = w
      } else line = `${line} ${w}`.trim()
    }
    if (line.trim()) lines.push(`  ${line.trim()}`)
    return [`${key}: >`, ...lines]
  }
  return [
    FM_FENCE,
    ...wrap('name', meta.name),
    `number: ${meta.number}`,
    `group: ${meta.group}`,
    ...wrap('status', meta.status),
    ...wrap('summary', meta.summary),
    ...wrap('next', meta.next),
    ...wrap('size', meta.size),
    ...wrap('blocker', meta.blocker),
    ...wrap('ver', meta.ver || '—'),
    ...(meta.opinion ? wrap('opinion', meta.opinion) : []),
    ...(meta.pointer ? ['pointer: true'] : []),
    ...(meta.mockupNotRequired ? wrap('mockup', `not required — ${meta.mockupNotRequired}`) : []),
    FM_FENCE,
  ].join('\n')
}

function quoteIfNeeded(value: string): string {
  return /^[>|&*#!%@`'"[\]{}]|:\s|\s#/.test(value) || value.trim() !== value ? JSON.stringify(value) : value
}
