/**
 * The to-dos have one source and two generated views.
 *
 * Each to-do file carries front matter with the handful of fields a reader triages on.
 * `to-dos/README.md`'s index table and `to-dos/punch-list.html`'s ITEMS array are both
 * RENDERED from that front matter — nobody edits either by hand.
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
}

export interface TodoDoc {
  /** Repo-root path, e.g. `to-dos/gc-on-notice/README.md`. */
  file: string
  slug: string
  meta: TodoMeta
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

/** Validate one to-do's front matter into a `TodoDoc`, or say exactly what is wrong. */
export function readTodoDoc(file: string, markdown: string): TodoDoc | TodoParseError {
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
  return {
    file,
    slug: slugForFile(file),
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
    },
  }
}

export function isBoardGroup(value: string): value is BoardGroup {
  return (BOARD_GROUPS as readonly string[]).includes(value)
}

export function isParseError(value: TodoDoc | TodoParseError): value is TodoParseError {
  return (value as TodoParseError).problem !== undefined
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
    out.push('| To-do | Status | Summary | Next |', '|---|---|---|---|')
    for (const d of inGroup) {
      // Link text is the name, which is also what the rows are sorted by; the slug is
      // visible in the href and is what `npm run sessions` and branch names use.
      const link = `[${escapeCell(d.meta.name)}](${indexHref(d.file)})`
      out.push(
        `| ${link} | ${escapeCell(d.meta.status)} | ${escapeCell(d.meta.summary)} | ${escapeCell(d.meta.next)} |`,
      )
    }
    out.push('')
  }
  return out.join('\n').trimEnd()
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

/** Escape a value for the double-quoted JS string literals the board's array uses. */
export function jsString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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

export const ITEMS_BEGIN = '  const ITEMS = ['
export const ITEMS_END = '  ];'

/** The ITEMS array body, grouped with a comment per group so the source stays readable. */
export function renderBoardItems(docs: readonly TodoDoc[]): string {
  const sorted = sortDocs(docs)
  const out: string[] = []
  for (const group of GROUP_ORDER) {
    const inGroup = sorted.filter((d) => d.meta.group === group)
    if (inGroup.length === 0) continue
    out.push(`    // ${GROUP_LABELS[group]}`)
    for (const d of inGroup) {
      const m = d.meta
      const s = (value: string): string => jsString(toPlainText(value))
      const head =
        `    { slug: "${jsString(d.slug)}", g: "${m.group}", name: "${s(m.name)}", ` +
        `file: "${jsString(d.file)}"${m.pointer ? ', pointer: true' : ''},`
      out.push(head)
      out.push(`      sum: "${s(m.summary)}",`)
      out.push(
        `      next: "${s(m.next)}", size: "${s(m.size)}", ` +
          `blocker: "${s(m.blocker)}", ver: "${s(m.ver)}" },`,
      )
    }
  }
  return out.join('\n')
}

/** Replace the board's ITEMS array, leaving the page's markup and script alone. */
export function spliceBoardItems(html: string, items: string): string {
  const lines = html.split('\n')
  const start = lines.findIndex((l) => l.trimEnd() === ITEMS_BEGIN.trimEnd() || l.includes('const ITEMS = ['))
  if (start < 0) throw new Error('to-dos/punch-list.html: no `const ITEMS = [` found.')
  let end = start + 1
  while (end < lines.length && !/^\s*\];\s*$/.test(lines[end] ?? '')) end++
  if (end >= lines.length) throw new Error('to-dos/punch-list.html: the ITEMS array is not closed.')
  return [...lines.slice(0, start + 1), ...items.split('\n'), ...lines.slice(end)].join('\n')
}

export interface Stamp {
  date: string
  version: string
  openItems: number
}

const STAMP_RE = /Validated against main <b>([\d-]+)<\/b> at <b>(v2\.\d+)<\/b>/
const COUNT_RE = /(\d+) open items/

export function parseStamp(html: string): Stamp | null {
  const s = STAMP_RE.exec(html)
  const c = COUNT_RE.exec(html)
  if (!s?.[1] || !s[2] || !c?.[1]) return null
  return { date: s[1], version: s[2], openItems: Number(c[1]) }
}

export function writeStamp(html: string, stamp: Stamp): string {
  return html
    .replace(STAMP_RE, `Validated against main <b>${stamp.date}</b> at <b>${stamp.version}</b>`)
    .replace(COUNT_RE, `${stamp.openItems} open items`)
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
    board: string
    today: string
    newestVersion: string
  },
): { readme: string; board: string } {
  const { docs, today, newestVersion } = input
  const readme = spliceIndex(input.readme, renderIndexBlock(docs))
  const withItems = spliceBoardItems(input.board, renderBoardItems(docs))
  const board = writeStamp(withItems, {
    date: today,
    version: newestVersion,
    openItems: openItemCount(docs),
  })
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
      message: "to-dos/punch-list.html's ITEMS array or stamp does not match the to-dos' front matter.",
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
    FM_FENCE,
  ].join('\n')
}

function quoteIfNeeded(value: string): string {
  return /^[>|&*#!%@`'"[\]{}]|:\s|\s#/.test(value) || value.trim() !== value ? JSON.stringify(value) : value
}
