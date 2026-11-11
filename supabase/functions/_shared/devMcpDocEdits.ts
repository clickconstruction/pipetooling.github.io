/**
 * Small edits inside a section (v2.6949): `plan_person_doc` / `plan_matter_narrative` take two more ops beside
 * `replace_section`, `insert_after` and `append` — `prepend_section { heading, markdown }` (new lines straight under a
 * heading, above the section's own lines: the op a "newest first" log needs) and `replace_text { heading, find, replace }`
 * (one exact run of text swapped inside the named section, refused when the run is absent or occurs more than once).
 * Neither resends the section, so nobody retypes another author's words to add a line.
 *
 * The section grammar lives in the database (`hr_doc_apply_ops` and `dev_person_doc_write`, 20261107100000 and
 * 20261108193000). A call that carries a small edit is worked out HERE instead, with no migration: the server reads the
 * document's text and its `updated_at` as the dev, this kernel applies every op of the call in order — the three section
 * ops as the database cuts and joins them, the two small ones by an exact splice — and the result rides to the same RPC
 * as the whole `markdown` with `expect_updated_at` set to the stamp just read. So the database still refuses a write over
 * a document saved in between, still archives the prior version, and the plan hash commits to the text and the stamp.
 * The plan's `changes` are this kernel's: a small edit shows the whole removed and added text, uncapped.
 *
 * Pure: `prepareDocEdits` takes the read as a function, so a test stands in for the database.
 */

type Json = Record<string, unknown>

const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The three ops the database applies itself, and the two this kernel adds. */
export const SECTION_OPS = ['replace_section', 'insert_after', 'append'] as const
export const SMALL_EDIT_OPS = ['prepend_section', 'replace_text'] as const
export const DOC_OPS_MAX = 20
/** The database's cap on a section op's removed and added words in a plan (`v_cap`); a small edit's are shown whole. */
export const SECTION_OP_WORDS_CAP = 6000
const CONTEXT_CAP = 2000
const ABOVE_CAP = 200

const opName = (op: unknown): string => {
  const o = obj(op)
  return o && typeof o.op === 'string' ? o.op.trim() : ''
}

/** True when a call's ops carry a `prepend_section` or a `replace_text`. */
export function hasSmallEdits(ops: unknown): boolean {
  return Array.isArray(ops) && ops.some((op) => (SMALL_EDIT_OPS as readonly string[]).includes(opName(op)))
}

/**
 * The lines a section op's markdown would double (v2.6949): each of the database's section ops sets its own blank line
 * above the new lines, so empty lines at the head of the markdown — the blank line under a heading, sent along when a
 * section is copied as it was read — would make two. They are dropped before the op travels.
 */
export function withoutLeadingBlankLines(markdown: string): string {
  return markdown.replace(/^(?:[ \t]*\r?\n)+/, '')
}

/** A call's ops with each section op's markdown cut at its head as above; anything else is handed back untouched. */
export function sectionOpsForRpc(ops: unknown[]): unknown[] {
  return ops.map((op) => {
    const o = obj(op)
    if (!o || typeof o.markdown !== 'string' || !(SECTION_OPS as readonly string[]).includes(opName(o))) return op
    const cut = withoutLeadingBlankLines(o.markdown)
    return cut === o.markdown ? op : { ...o, markdown: cut }
  })
}

export interface DocHeading {
  /** 1-based. */
  line: number
  level: number
  heading: string
}

/** A document's headings as `hr_doc_headings` reads them: ATX, fence-aware, backticks and bold markers stripped. */
export function docHeadings(md: string): DocHeading[] {
  if (!md) return []
  const out: DocHeading[] = []
  let fence = false
  md.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence
      return
    }
    if (fence) return
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) return
    const heading = m[2].split('`').join('').split('**').join('').trim()
    if (!heading) return
    out.push({ line: i + 1, level: m[1].length, heading })
  })
  return out
}

/** A heading as an op names it, folded the way the database folds it before it compares. */
function wantedHeading(raw: unknown): string {
  const s = typeof raw === 'string' ? raw : ''
  return s.replace(/^\s*#{1,6}\s+/, '').replace(/\s*#*\s*$/, '').split('`').join('').split('**').join('').trim().toLowerCase()
}

const left = (s: string, cap: number): string => (s.length <= cap ? s : [...s].slice(0, cap).join(''))

/** Every place `find` starts in `text`, overlaps counted, so a run that could be read two ways is never taken as one. */
function occurrences(text: string, find: string): number[] {
  const at: number[] = []
  for (let i = text.indexOf(find); i !== -1; i = text.indexOf(find, i + 1)) at.push(i)
  return at
}

const lineOfOffset = (text: string, offset: number): number => {
  let line = 1
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) line += 1
  return line
}

export type DocOpsResult = { ok: true; after: string; changes: Json[] } | { ok: false; error: string }

/**
 * A call's ops applied to a text, in order, each against the text the one before it left. `what` names the text in the
 * refusals ("document", "summary", "narrative"). The three section ops cut and join as `hr_doc_apply_ops` does — one
 * blank line under the heading, one before the next heading — and name their change with the words capped; the two small
 * edits change nothing but their own run and name it whole.
 */
export function applyDocOps(text: string, ops: unknown, what = 'document'): DocOpsResult {
  if (!Array.isArray(ops) || ops.length === 0) return { ok: false, error: 'ops must be a list of at least one op' }
  if (ops.length > DOC_OPS_MAX) return { ok: false, error: `at most ${DOC_OPS_MAX} ops a call` }
  let after = text ?? ''
  const changes: Json[] = []
  for (const raw of ops) {
    const op = obj(raw) ?? {}
    const name = opName(op)
    const isSection = (SECTION_OPS as readonly string[]).includes(name)
    if (!isSection && !(SMALL_EDIT_OPS as readonly string[]).includes(name)) {
      return { ok: false, error: `op must be replace_section, insert_after, append, prepend_section or replace_text (got "${name}")` }
    }
    const lines = after === '' ? [] : after.split('\n')
    const n = lines.length

    let md = ''
    let keepBlankUnder = false
    if (name !== 'replace_text') {
      if (typeof op.markdown !== 'string') return { ok: false, error: `op ${name} needs markdown` }
      const cut = withoutLeadingBlankLines(op.markdown)
      // The section ops trim the line breaks at the end, as the database does; a prepend also drops empty lines there,
      // and reads one as the caller's word that a blank line belongs between the new lines and the old.
      md = name === 'prepend_section' ? cut.replace(/(?:\r?\n[ \t]*)+$/, '') : cut.replace(/\n+$/, '')
      keepBlankUnder = name === 'prepend_section' && /\n\s*\n\s*$/.test(cut)
      // "Words" as the database reads them for its own ops (btrim: spaces alone); a prepend takes no line of only white space.
      const blank = name === 'prepend_section' ? md.trim() === '' : md.replace(/^ +| +$/g, '') === ''
      if (name !== 'replace_section' && blank) return { ok: false, error: `op ${name} needs words` }
    }
    const newLines = md === '' ? [] : md.split('\n')

    if (name === 'append') {
      const next = n > 0 && lines[n - 1] !== '' ? [...lines, '', ...newLines] : [...lines, ...newLines]
      changes.push({ op: 'append', at_line: n + 1, added_lines: newLines.length, added: left(md, SECTION_OP_WORDS_CAP) })
      after = next.join('\n')
      continue
    }

    const want = wantedHeading(op.heading)
    if (!want) return { ok: false, error: `op ${name} needs heading (the section's heading text)` }
    const headings = docHeadings(after)
    const matches = headings.filter((h) => h.heading.toLowerCase() === want)
    if (matches.length === 0) {
      const listed = headings.slice(0, 60).map((h) => h.heading).join(' | ') || '(none)'
      return { ok: false, error: `no heading "${String(op.heading)}" in the ${what}. Its headings: ${listed}` }
    }
    if (matches.length > 1) return { ok: false, error: `the heading "${String(op.heading)}" appears ${matches.length} times in the ${what}; make it unique first` }
    const { line: start, level, heading: found } = matches[0]
    const nextHeading = headings.find((h) => h.line > start && h.level <= level)
    // 1-based: the heading is line `start`, the section's own lines run start + 1 … end.
    const end = nextHeading ? nextHeading.line - 1 : n

    if (name === 'replace_section') {
      const removed = lines.slice(start, end).join('\n')
      const next = [...lines.slice(0, start), ...(md === '' ? [] : ['', ...newLines]), ...(end < n ? [''] : []), ...lines.slice(end)]
      changes.push({
        op: 'replace_section', heading: found, level, from_line: start + 1, to_line: end,
        removed_lines: end - start, added_lines: newLines.length,
        removed: left(removed, SECTION_OP_WORDS_CAP), added: left(md, SECTION_OP_WORDS_CAP),
      })
      after = next.join('\n')
      continue
    }
    if (name === 'insert_after') {
      const next = [...lines.slice(0, end), ...(end > 0 && lines[end - 1] !== '' ? [''] : []), ...newLines, ...(end < n ? [''] : []), ...lines.slice(end)]
      changes.push({ op: 'insert_after', heading: found, level, at_line: end + 1, added_lines: newLines.length, added: left(md, SECTION_OP_WORDS_CAP) })
      after = next.join('\n')
      continue
    }
    if (name === 'prepend_section') {
      // The first line of the section that holds words; the blank lines under the heading stay where they are.
      let first = -1
      for (let i = start; i < end; i += 1) {
        if (lines[i].trim() !== '') {
          first = i
          break
        }
      }
      if (first === -1) {
        // A heading with nothing under it: the new lines become the section, framed as a section is.
        const next = [...lines.slice(0, start), '', ...newLines, ...(end < n ? [''] : []), ...lines.slice(end)]
        changes.push({ op: 'prepend_section', heading: found, level, at_line: start + 2, added_lines: newLines.length, added: md, above: null })
        after = next.join('\n')
        continue
      }
      const placed = keepBlankUnder ? [...newLines, ''] : newLines
      const next = [...lines.slice(0, first), ...placed, ...lines.slice(first)]
      changes.push({ op: 'prepend_section', heading: found, level, at_line: first + 1, added_lines: placed.length, added: md, above: left(lines[first], ABOVE_CAP) })
      after = next.join('\n')
      continue
    }

    // replace_text: one exact run inside the section's own lines; the heading line is never in reach.
    if (typeof op.find !== 'string' || op.find === '') return { ok: false, error: 'op replace_text needs find (the exact words to swap, as they stand in the section)' }
    if (typeof op.replace !== 'string') return { ok: false, error: "op replace_text needs replace (the words to put there; '' takes the run out)" }
    const find = op.find
    if (find === op.replace) return { ok: false, error: `op replace_text changes nothing: find and replace are the same words` }
    // Offsets into `after`: the section's own lines begin after the heading line's line break.
    const bodyFrom = lines.slice(0, start).reduce((sum, l) => sum + l.length + 1, 0)
    const body = lines.slice(start, end).join('\n')
    const hits = occurrences(body, find)
    if (hits.length === 0) {
      const elsewhere = occurrences(after, find)
      let where = ''
      if (elsewhere.length > 0) {
        const line = lineOfOffset(after, elsewhere[0])
        const under = [...headings].reverse().find((h) => h.line <= line)
        where = ` They occur ${elsewhere.length} ${elsewhere.length === 1 ? 'time' : 'times'} elsewhere in the ${what}, first on line ${line}${under ? ` under "${under.heading}"` : ''}.`
      }
      return { ok: false, error: `op replace_text: the words to find occur 0 times in the section "${found}".${where} They must match to the letter, the space and the line break; read the section and copy the run from it.` }
    }
    if (hits.length > 1) {
      const onLines = hits.map((h) => lineOfOffset(after, bodyFrom + h)).join(', ')
      return { ok: false, error: `op replace_text: the words to find occur ${hits.length} times in the section "${found}" (lines ${onLines}); send a longer run that occurs once, so the plan changes one place.` }
    }
    const at = bodyFrom + hits[0]
    const next = after.slice(0, at) + op.replace + after.slice(at + find.length)
    const line = lineOfOffset(after, at)
    // The whole lines the run now stands in, so the reader sees the sentence it changed.
    const from = next.lastIndexOf('\n', at - 1) + 1
    const toBreak = next.indexOf('\n', at + op.replace.length)
    const reads = next.slice(from, toBreak === -1 ? next.length : toBreak)
    changes.push({
      op: 'replace_text', heading: found, level, line,
      removed_chars: find.length, added_chars: op.replace.length,
      removed: find, added: op.replace,
      reads: left(reads, CONTEXT_CAP), ...(reads.length > CONTEXT_CAP ? { reads_cut: true } : {}),
    })
    after = next
  }
  return { ok: true, after, changes }
}

export type DocEditVerb = 'plan_person_doc' | 'apply_person_doc' | 'plan_matter_narrative' | 'apply_matter_narrative'

/** Where the text a call edits is kept. */
export type DocEditTarget =
  | { table: 'person_documents'; personId: string; docId: string; what: 'document' }
  | { table: 'person_files'; personId: string; kind: 'summary' | 'narrative'; what: 'summary' | 'narrative' }
  | { table: 'legal_matters'; matterId: string; what: 'narrative' }

/** The one GET that reads a target's text and its stamp, as the dev. */
export function docEditQuery(target: DocEditTarget): { table: string; query: string } {
  if (target.table === 'person_documents') return { table: target.table, query: `select=content,updated_at&id=eq.${target.docId}&person_id=eq.${target.personId}&limit=1` }
  if (target.table === 'person_files') return { table: target.table, query: `select=content,updated_at&person_id=eq.${target.personId}&kind=eq.${target.kind}&limit=1` }
  return { table: target.table, query: `select=narrative_md,narrative_updated_at&id=eq.${target.matterId}&limit=1` }
}

export type DocEditStored = { exists: boolean; text: string; updatedAt: string | null }

/** That GET's rows as the text and the stamp; no row is a text that does not exist yet. */
export function docEditStored(target: DocEditTarget, rows: unknown): DocEditStored {
  const row = Array.isArray(rows) ? obj(rows[0]) : null
  if (!row) return { exists: false, text: '', updatedAt: null }
  const text = target.table === 'legal_matters' ? row.narrative_md : row.content
  const stamp = target.table === 'legal_matters' ? row.narrative_updated_at : row.updated_at
  return { exists: true, text: typeof text === 'string' ? text : '', updatedAt: typeof stamp === 'string' ? stamp : null }
}

export type DocEditReader = (target: DocEditTarget) => Promise<DocEditStored | { error: string }>

export interface DocEditPrepared {
  ok: true
  /** The call's arguments as the grammar takes them: the ops gone, the whole text and the stamp in their place. */
  args: Record<string, unknown>
  /** What each op does, in order — the plan's `changes`. */
  changes: Json[]
  target: DocEditTarget
  /** The stamp the text was read at; the write refuses when the document moved past it. */
  readAt: string | null
}

const sameInstant = (a: string, b: string): boolean => {
  const x = Date.parse(a)
  const y = Date.parse(b)
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1
}

/**
 * A document call that carries a small edit, made ready for the RPC — or null when it carries none (or its shape is one
 * the grammar refuses in its own words), and the call goes on as it came. Reads the text once through `read`.
 */
export async function prepareDocEdits(verb: string, args: Record<string, unknown>, read: DocEditReader): Promise<DocEditPrepared | { ok: false; error: string } | null> {
  const isPerson = verb === 'plan_person_doc' || verb === 'apply_person_doc'
  const isMatter = verb === 'plan_matter_narrative' || verb === 'apply_matter_narrative'
  if (!isPerson && !isMatter) return null
  const key = isPerson ? 'doc' : 'narrative'
  const input = obj(args[key])
  if (!input || !Array.isArray(input.ops) || !hasSmallEdits(input.ops)) return null
  // Shapes the grammar refuses itself: the text beside the ops, too many ops, no usable target.
  if (typeof input.markdown === 'string' || input.ops.length > DOC_OPS_MAX) return null

  let target: DocEditTarget
  if (isPerson) {
    const personId = typeof input.person_id === 'string' ? input.person_id.trim() : ''
    const kind = typeof input.kind === 'string' ? input.kind.trim() : ''
    const docId = typeof input.doc_id === 'string' ? input.doc_id.trim() : ''
    const title = typeof input.title === 'string' ? input.title.trim() : ''
    if (!UUID_RE.test(personId) || [kind !== '', docId !== '', title !== ''].filter(Boolean).length !== 1) return null
    if (title) return { ok: false, error: `${verb}: prepend_section and replace_text edit a document that exists, and a new title has no section yet. Make the document with markdown first, then edit it by doc_id.` }
    if (kind) {
      if (kind !== 'summary' && kind !== 'narrative') return null
      target = { table: 'person_files', personId, kind, what: kind }
    } else {
      if (!UUID_RE.test(docId)) return null
      target = { table: 'person_documents', personId, docId, what: 'document' }
    }
  } else {
    const matterId = typeof input.matter_id === 'string' ? input.matter_id.trim() : ''
    if (!UUID_RE.test(matterId)) return null
    target = { table: 'legal_matters', matterId, what: 'narrative' }
  }

  const stored = await read(target)
  if ('error' in stored) return { ok: false, error: `${verb}: the ${target.what} could not be read for the edit: ${stored.error}` }
  if (!stored.exists) {
    const missing = target.table === 'person_documents' ? 'no document with that doc_id on that person' : target.table === 'legal_matters' ? 'no matter with that matter_id' : `no ${target.what} on that person yet`
    return { ok: false, error: `${verb}: ${missing}, so there is no section to edit.` }
  }
  const expect = typeof input.expect_updated_at === 'string' ? input.expect_updated_at.trim() : ''
  if (expect && (!stored.updatedAt || !sameInstant(expect, stored.updatedAt))) {
    return { ok: false, error: `${verb}: the ${target.what} was saved at ${stored.updatedAt ?? 'no recorded time'}, after the version you loaded (${expect}). Read it again and edit from that.` }
  }
  const applied = applyDocOps(stored.text, input.ops, target.what)
  if (!applied.ok) return { ok: false, error: `${verb}: ${applied.error}` }

  const { ops: _ops, ...rest } = input
  const next: Json = { ...rest, markdown: applied.after }
  // The stamp just read rides along when the caller sent none, so a save between this read and the write is refused.
  if (!expect && stored.updatedAt) next.expect_updated_at = stored.updatedAt
  return { ok: true, args: { ...args, [key]: next }, changes: applied.changes, target, readAt: stored.updatedAt }
}

/** The plan as the agent reads it: the RPC's reply with its one "rewrite" line swapped for what each op does. */
export function docEditPlanReply(planned: Record<string, unknown>, prepared: DocEditPrepared): Record<string, unknown> {
  return {
    ...planned,
    changes: prepared.changes,
    worked_out: `On the server, from the ${prepared.target.what} as it stood at ${prepared.readAt ?? 'its last save'}: each change above is all that moves. A save by anyone before the apply refuses it; plan again from the fresh text.`,
  }
}

/** The apply's reply: the narrative's RPC counts its one rewrite, so the count of ops that landed stands in. */
export function docEditApplyReply(reply: unknown, prepared: DocEditPrepared): unknown {
  const r = obj(reply)
  if (!r) return reply
  return typeof r.changes === 'number' ? { ...r, changes: prepared.changes.length } : r
}
