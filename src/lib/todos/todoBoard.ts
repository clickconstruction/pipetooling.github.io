/**
 * The to-dos have one source and two generated views.
 *
 * Each to-do file carries front matter with the handful of fields a reader triages on.
 * `to-dos/README.md`'s index table and `src/content/punchList.generated.ts` — the data the
 * app's Punch list page (`/punch-list`) renders — are both RENDERED from that front matter;
 * nobody edits either by hand.
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
 * Pure string/data work — all file IO lives in `scripts/check-todo-drift.ts`.
 */

export const BOARD_GROUPS = ['ready', 'close', 'gated', 'waiting', 'residual'] as const
export type BoardGroup = (typeof BOARD_GROUPS)[number]

/** Order the views present groups in; also the index table's sort. */
export const GROUP_ORDER: readonly BoardGroup[] = BOARD_GROUPS

export interface TodoMeta {
  /** Row name in both views. */
  name: string
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
  /** Standing pointers are listed but are not "open items". */
  pointer: boolean
  /**
   * `mockup: not required — <why>` in the front matter: the to-do changes no screen (a live
   * test, a refactor, a retirement), so the board says "not required" instead of "waiting".
   * Empty when a mock-up is expected.
   */
  mockupNotRequired: string
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

const REQUIRED: ReadonlyArray<keyof TodoMeta> = ['name', 'group', 'status', 'summary', 'next', 'size', 'blocker']

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
  const slug = slugForFile(file)
  return {
    file,
    slug,
    mockups: mockupsFor(file, siblings),
    artifacts: artifactsCited(fm.body),
    meta: {
      name: (fm.fields.name ?? '').trim(),
      group,
      status: (fm.fields.status ?? '').trim(),
      summary: (fm.fields.summary ?? '').trim(),
      next: (fm.fields.next ?? '').trim(),
      size: (fm.fields.size ?? '').trim(),
      blocker: (fm.fields.blocker ?? '').trim(),
      ver: (fm.fields.ver ?? '').trim(),
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

/** A link back to the to-do, relative to `to-dos/README.md`. */
export function indexHref(file: string): string {
  return `./${file.replace(/^to-dos\//, '')}`
}

/** Pipes would split the markdown table; nothing else needs escaping in a cell. */
export function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export const INDEX_BEGIN = '<!-- BEGIN GENERATED INDEX -->'
export const INDEX_END = '<!-- END GENERATED INDEX -->'

/** The whole index block: a table per group, newest-readiness first. */
export function renderIndexBlock(docs: readonly TodoDoc[]): string {
  const sorted = sortDocs(docs)
  const out: string[] = []
  for (const group of GROUP_ORDER) {
    const inGroup = sorted.filter((d) => d.meta.group === group)
    if (inGroup.length === 0) continue
    out.push(`### ${GROUP_LABELS[group]} (${inGroup.length})`, '')
    out.push('| To-do | Status | Summary | Next | Links |', '|---|---|---|---|---|')
    for (const d of inGroup) {
      // Link text is the name, which is also what the rows are sorted by; the slug is
      // visible in the href and is what `npm run sessions` and branch names use.
      const link = `[${escapeCell(d.meta.name)}](${indexHref(d.file)})`
      out.push(
        `| ${link} | ${escapeCell(d.meta.status)} | ${escapeCell(d.meta.summary)} | ${escapeCell(d.meta.next)} | ${renderIndexLinks(d)} |`,
      )
    }
    out.push('')
  }
  return out.join('\n').trimEnd()
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
 * The index's Links cell: each mock-up rendered, each artifact, and the to-do's history —
 * the commits that touched its folder, which is every PR that moved it.
 */
export function renderIndexLinks(doc: TodoDoc): string {
  const state = mockupState(doc)
  const parts = [
    ...(state === 'waiting' ? ['*waiting on a mock-up*'] : []),
    ...(state === 'not-required' && !doc.meta.pointer ? [`*mock-up not required — ${escapeCell(doc.meta.mockupNotRequired)}*`] : []),
    ...doc.mockups.map((m) => `[${escapeCell(mockupLabel(doc, m))}](${REPO_RENDERED}${m})`),
    ...doc.artifacts.map((a) => `[${escapeCell(toPlainText(a.label))}](${a.url})`),
    `[history](${REPO_COMMITS}${doc.file.endsWith('/README.md') ? dirForFile(doc.file) : doc.file})`,
  ]
  return parts.join(' · ')
}

/** Replace the generated region of `to-dos/README.md`, keeping the prose around it. */
export function spliceIndex(readme: string, block: string): string {
  const a = readme.indexOf(INDEX_BEGIN)
  const b = readme.indexOf(INDEX_END)
  if (a < 0 || b < 0 || b < a) {
    throw new Error(`to-dos/README.md is missing the ${INDEX_BEGIN} / ${INDEX_END} markers.`)
  }
  return `${readme.slice(0, a + INDEX_BEGIN.length)}\n\n${block}\n\n${readme.slice(b)}`
}

/**
 * The front matter is written as markdown, because the index renders as markdown. The
 * board interpolates its strings straight into HTML, so `**bold**` and `` `code` `` would
 * show as literal asterisks and backticks there. Strip the markup for that view only.
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

/** One row of the app's Punch list page, as `src/content/punchList.generated.ts` carries it. */
export interface BoardItem {
  slug: string
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
      group: d.meta.group,
      name: toPlainText(d.meta.name),
      file: d.file,
      pointer: d.meta.pointer,
      summary: toPlainText(d.meta.summary),
      next: toPlainText(d.meta.next),
      size: toPlainText(d.meta.size),
      blocker: toPlainText(d.meta.blocker),
      ver: toPlainText(d.meta.ver),
      mockups: [...d.mockups],
      artifacts: d.artifacts.map((a) => ({ label: toPlainText(a.label), url: a.url })),
      mockup: mockupState(d),
      mockupNote: toPlainText(d.meta.mockupNotRequired),
    })),
  }
}

const MODULE_HEAD = `// Generated by \`npm run check:todo-drift -- --fix\` from the to-dos' front matter. Do not edit;
// change the to-do file and re-render. CI (\`npm run check:todo-drift\`) fails when this is stale.
import type { BoardData } from '../lib/todos/todoBoard'

const data: BoardData = `

/**
 * The generated module's text — a typed default export of pretty JSON with a trailing
 * newline, so diffs stay readable and the page imports it like any other module.
 */
export function renderBoardModule(data: BoardData): string {
  return `${MODULE_HEAD}${JSON.stringify(data, null, 2)}\n\nexport default data\n`
}

/** The stamp already on disk, so the checking mode never reddens a PR that merely trails main. */
export function parseBoardValidated(moduleText: string): BoardData['validated'] | null {
  const m = /"validated": \{\s*"date": "([^"]+)",\s*"version": "([^"]+)"/.exec(moduleText)
  return m?.[1] && m[2] ? { date: m[1], version: m[2] } : null
}

/** The data back out of the module text (tests and the script's summary). */
export function parseBoardModule(moduleText: string): BoardData | null {
  const start = moduleText.indexOf('const data: BoardData = ')
  const end = moduleText.lastIndexOf('\nexport default data')
  if (start < 0 || end < 0) return null
  try {
    return JSON.parse(moduleText.slice(start + 'const data: BoardData = '.length, end)) as BoardData
  } catch {
    return null
  }
}

/** Numeric order for `v2.NNNN`, so "newest" is a comparison and not a string sort. */
export function versionNumber(version: string): number {
  const m = /^v2\.(\d+)$/.exec(version)
  return m?.[1] ? Number(m[1]) : 0
}

export function openItemCount(docs: readonly TodoDoc[]): number {
  return docs.filter((d) => !d.meta.pointer).length
}

/** Render both views from the same docs, so they cannot disagree. */
export function renderViews(
  input: {
    docs: readonly TodoDoc[]
    readme: string
    today: string
    newestVersion: string
  },
): { readme: string; board: string } {
  const { docs, today, newestVersion } = input
  const readme = spliceIndex(input.readme, renderIndexBlock(docs))
  const board = renderBoardModule(renderBoardData(docs, { date: today, version: newestVersion }))
  return { readme, board }
}

export type FindingKind =
  | 'front_matter'
  | 'index_out_of_date'
  | 'board_out_of_date'
  | 'unknown_version'
  | 'duplicate_slug'

export interface Finding {
  kind: FindingKind
  severity: 'error' | 'warn'
  /** Whether `--fix` resolves it by re-rendering. */
  fixable: boolean
  file?: string
  message: string
}

export interface DriftInput {
  docs: readonly TodoDoc[]
  errors: readonly TodoParseError[]
  readme: string
  board: string
  rendered: { readme: string; board: string }
  knownVersions: ReadonlySet<string>
}

/**
 * With both views generated, drift is simply "what is on disk is not what the sources
 * render to" — no heuristics about prose, because there is only one copy of the prose.
 */
export function findDrift(input: DriftInput): Finding[] {
  const findings: Finding[] = []

  for (const e of input.errors) {
    findings.push({
      kind: 'front_matter',
      severity: 'error',
      fixable: false,
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
        fixable: false,
        file: d.file,
        message: `two to-dos share the slug "${d.slug}": ${prior} and ${d.file}.`,
      })
    }
    seen.set(d.slug, d.file)
  }

  for (const d of input.docs) {
    for (const v of versionsCited(`${d.meta.status} ${d.meta.ver}`)) {
      if (!input.knownVersions.has(v)) {
        findings.push({
          kind: 'unknown_version',
          severity: 'error',
          fixable: false,
          file: d.file,
          message: `${d.file} cites ${v}, which has no docs/recent-features fragment and is not in the frozen archive.`,
        })
      }
    }
  }

  if (input.readme !== input.rendered.readme) {
    findings.push({
      kind: 'index_out_of_date',
      severity: 'error',
      fixable: true,
      message: "to-dos/README.md's generated index does not match the to-dos' front matter.",
    })
  }
  if (input.board !== input.rendered.board) {
    findings.push({
      kind: 'board_out_of_date',
      severity: 'error',
      fixable: true,
      message: "src/content/punchList.generated.ts does not match the to-dos' front matter.",
    })
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
    `group: ${meta.group}`,
    ...wrap('status', meta.status),
    ...wrap('summary', meta.summary),
    ...wrap('next', meta.next),
    ...wrap('size', meta.size),
    ...wrap('blocker', meta.blocker),
    ...wrap('ver', meta.ver || '—'),
    ...(meta.pointer ? ['pointer: true'] : []),
    ...(meta.mockupNotRequired ? wrap('mockup', `not required — ${meta.mockupNotRequired}`) : []),
    FM_FENCE,
  ].join('\n')
}

function quoteIfNeeded(value: string): string {
  return /^[>|&*#!%@`'"[\]{}]|:\s|\s#/.test(value) || value.trim() !== value ? JSON.stringify(value) : value
}
