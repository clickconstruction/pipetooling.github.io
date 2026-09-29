/**
 * Assign pages (Submittals stage 3, v2.4143): the walk through a vendor PDF that puts
 * every page on a row. The estimator sees each page in turn — the package goes to the
 * customer, so nothing is placed unseen — with the answer pre-filled where the page's
 * text names a row's model. A pick marks where a fixture starts; Space on the next page
 * continues it. Pure: the modal holds `WalkDecisions` and a `seen` set and calls these.
 *
 * Pages are 1-based. A decision is a row id, or 'skip' for a page that is not a cut
 * sheet (the cover, the index, a blank, a terms page).
 */
import type { SubmittalItemRow } from './submittalRevision'

export type Decision = string | 'skip'
export type WalkDecisions = Readonly<Record<number, Decision>>

/** What the walk needs of a row: its id, its label, and the strings that would name it on a page. */
export type WalkRow = { id: string; tag: string; label: string; models: string[] }

/**
 * What the reader found on a page: the row its text names; the index; or a page the
 * vendor stamped with a tag that is not a row on this revision (an ET-1 expansion tank
 * in a file whose rows stop at the heater) — not a cut sheet here.
 */
export type PageRead = { itemId: string; why: 'model' | 'tag' | 'stamp' } | { itemId: null; why: 'index' } | { itemId: null; why: 'other'; tag: string }
export type PageReads = Readonly<Record<number, PageRead>>

/** Upper-case, every run of non-alphanumerics one space, padded so token matches can use spaces as boundaries. */
export function normalizeText(s: string | null | undefined): string {
  const t = (s ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
  return t ? ` ${t} ` : ''
}

/** A model string is worth matching when it has a digit and at least four characters — "Z1700-500-OV", not "ET" or "SINK". */
function isModelToken(t: string): boolean {
  return t.length >= 4 && /\d/.test(t)
}

/**
 * The strings that name a row on a page, longest first: the submitted model whole, its
 * model-like tokens, the specified model (a sheet often carries both), the label's
 * model-like tokens. Normalized like page text.
 */
export function rowModels(it: Pick<SubmittalItemRow, 'submitted_model' | 'submitted_label' | 'specified_model'>): string[] {
  const out = new Set<string>()
  const add = (raw: string | null | undefined, whole: boolean) => {
    const n = normalizeText(raw).trim()
    if (!n) return
    if (whole && isModelToken(n.replace(/ /g, ''))) out.add(n)
    for (const tok of n.split(' ')) if (isModelToken(tok)) out.add(tok)
  }
  add(it.submitted_model, true)
  add(it.specified_model, true)
  add(it.submitted_label, false)
  return [...out].sort((a, b) => b.length - a.length)
}

export function walkRowsFrom(items: ReadonlyArray<SubmittalItemRow>): WalkRow[] {
  return items.map((it) => ({ id: it.id, tag: it.tag.trim(), label: it.submitted_label ?? it.submitted_model ?? '', models: rowModels(it) }))
}

/**
 * The tags a row answers to, as page-text tokens: "WHA-500" → " WHA 500 "; a combined row
 * "UR-1, UR-2" answers to either; a bare word like "FD" is too common to match on its own.
 */
export function tagTokens(tag: string): string[] {
  return tag
    .split(/[,&/]|\band\b/i)
    .map((t) => normalizeText(t).trim())
    .filter((n) => n && /\d/.test(n))
    .map((n) => ` ${n} `)
}

/** The model is on the page as a whole token — or, at five characters or more, as the start of one (the row says CT708, the sheet says CT708UVG). */
export function textHasModel(text: string, model: string): boolean {
  return text.includes(` ${model} `) || (model.length >= 5 && text.includes(` ${model}`))
}

/**
 * The words most pages start with — a supply house stamps its project name on each
 * page; the cover (a date, a name) need not. The pages that share their first two
 * words, when they are at least half the file, give the longest prefix they all share,
 * cut at a word. '' when the file has no such header.
 */
export function commonHeader(texts: ReadonlyArray<string>): string {
  const pages = texts.map((t) => normalizeText(t)).filter((t) => t.trim().length >= 20)
  if (pages.length < 2) return ''
  const keyOf = (t: string) => t.trim().split(' ').slice(0, 2).join(' ')
  const counts = new Map<string, number>()
  for (const t of pages) counts.set(keyOf(t), (counts.get(keyOf(t)) ?? 0) + 1)
  const [key, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!
  if (n < 2 || n * 2 < pages.length) return ''
  const shared = pages.filter((t) => keyOf(t) === key)
  let prefix = shared[0]!
  for (const t of shared.slice(1)) {
    let i = 0
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i += 1
    prefix = prefix.slice(0, i)
  }
  const cut = prefix.lastIndexOf(' ')
  return cut > 0 ? prefix.slice(0, cut + 1) : ''
}

/**
 * The tags the file itself is sectioned by: a divider page reads "<tag> VENDOR PART
 * VENDOR DESCRIPTION PAGE" after the stamped header (the National Wholesale shape).
 * Normalized, longest first, so "WC 1 WC 2" is tried before "WC 1".
 */
export function fileSectionTags(texts: ReadonlyArray<string>, header: string): string[] {
  const out = new Set<string>()
  for (const raw of texts) {
    const text = normalizeText(raw)
    if (!text.startsWith(header)) continue
    const m = /^(.{2,40}?) VENDOR PART VENDOR DESCRIPTION PAGE /.exec(text.slice(header.length))
    // A tag carries a number; the table of contents carries the same column heads and is not one.
    if (m && /\d/.test(m[1]!) && !m[1]!.includes('TABLE OF CONTENTS')) out.add(m[1]!.trim())
  }
  return [...out].sort((a, b) => b.length - a.length)
}

/** The section tag stamped on this page — the one the text carries right after the shared header. */
function stampedTag(text: string, header: string, sectionTags: ReadonlyArray<string>): string | null {
  if (!header || !text.startsWith(header)) return null
  const rest = text.slice(header.length)
  return sectionTags.find((t) => rest.startsWith(`${t} `)) ?? null
}

function rowAnswersTo(row: WalkRow, stamped: string): boolean {
  const padded = ` ${stamped} `
  return tagTokens(row.tag).some((t) => padded.includes(t))
}

/**
 * Reads every page's text against the rows. Where the file stamps a section tag on the
 * page (`fileSectionTags`), that tag decides: the row that answers to it, or — a tag
 * with no row on this revision — *other*, not a cut sheet here. Otherwise a page names
 * the row whose longest model appears in it (ties: the earlier row); failing a model, a
 * tag with a number in it. A page that says "table of contents" or names four or more
 * rows is the index. Text under 20 characters is a scan or a blank and reads nothing.
 * `texts[0]` is page 1.
 */
export function readPages(texts: ReadonlyArray<string>, rows: ReadonlyArray<WalkRow>): PageReads {
  const out: Record<number, PageRead> = {}
  const header = commonHeader(texts)
  const sectionTags = header ? fileSectionTags(texts, header) : []
  const normalized = texts.map((raw) => normalizeText(raw))
  const stamps = normalized.map((text) => (text.trim().length >= 20 ? stampedTag(text, header, sectionTags) : null))
  // In a stamped file, the pages before the first stamp are the front matter: the cover, the table of contents.
  const firstStamp = stamps.findIndex((t) => t !== null)
  normalized.forEach((text, i) => {
    const page = i + 1
    if (text.trim().length < 20) return
    if (text.includes(' TABLE OF CONTENTS ') || (firstStamp > 0 && i < firstStamp)) {
      out[page] = { itemId: null, why: 'index' }
      return
    }
    const stamped = stamps[i]
    if (stamped) {
      const row = rows.find((r) => rowAnswersTo(r, stamped))
      out[page] = row ? { itemId: row.id, why: 'stamp' } : { itemId: null, why: 'other', tag: stamped.replace(/ (\d)/g, '-$1') }
      return
    }
    let best: { row: WalkRow; len: number; why: 'model' | 'tag' } | null = null
    let named = 0
    for (const row of rows) {
      let hit: { len: number; why: 'model' | 'tag' } | null = null
      for (const m of row.models) {
        if (textHasModel(text, m)) {
          hit = { len: m.length, why: 'model' }
          break
        }
      }
      if (!hit && tagTokens(row.tag).some((t) => text.includes(t))) hit = { len: 1, why: 'tag' }
      if (!hit) continue
      named += 1
      if (!best || hit.len > best.len) best = { row, len: hit.len, why: hit.why }
    }
    if (named >= 4) out[page] = { itemId: null, why: 'index' }
    else if (best) out[page] = { itemId: best.row.id, why: best.why }
  })
  return out
}

export type Suggestion = { value: Decision; why: 'kept' | 'read' | 'continue' | 'next' } | { value: null; why: 'none' }

/**
 * The answer the page arrives with: what is already on it (kept), what its text says
 * (read), the row the page before it is on (continue), or the first row in order with
 * no page yet after the last row placed (next) — the PDF follows the schedule.
 */
export function suggestFor(page: number, decisions: WalkDecisions, reads: PageReads, rows: ReadonlyArray<WalkRow>): Suggestion {
  const kept = decisions[page]
  if (kept !== undefined) return { value: kept, why: 'kept' }
  const read = reads[page]
  if (read) return { value: read.itemId ?? 'skip', why: 'read' }
  const prev = page > 1 ? decisions[page - 1] : undefined
  if (prev !== undefined && prev !== 'skip') return { value: prev, why: 'continue' }
  const placed = new Set(Object.values(decisions).filter((d) => d !== 'skip'))
  let lastIndex = -1
  rows.forEach((r, i) => {
    if (placed.has(r.id)) lastIndex = i
  })
  for (let i = lastIndex + 1; i < rows.length; i++) if (!placed.has(rows[i]!.id)) return { value: rows[i]!.id, why: 'next' }
  const first = rows.find((r) => !placed.has(r.id))
  return first ? { value: first.id, why: 'next' } : { value: null, why: 'none' }
}

export function decide(decisions: WalkDecisions, page: number, value: Decision): WalkDecisions {
  return { ...decisions, [page]: value }
}

export function clearDecision(decisions: WalkDecisions, page: number): WalkDecisions {
  const next = { ...decisions }
  delete next[page]
  return next
}

/** Each row's pages in this file, ascending; 'skip' is not a row. */
export function pagesByItem(decisions: WalkDecisions): Map<string, number[]> {
  const out = new Map<string, number[]>()
  for (const [p, d] of Object.entries(decisions)) {
    if (d === 'skip') continue
    const list = out.get(d) ?? []
    list.push(Number(p))
    out.set(d, list)
  }
  for (const list of out.values()) list.sort((a, b) => a - b)
  return out
}

/** The first page of the run of the same decision that ends at `page`. */
export function runStart(decisions: WalkDecisions, page: number): number {
  const d = decisions[page]
  if (d === undefined) return page
  let p = page
  while (p > 1 && decisions[p - 1] === d) p -= 1
  return p
}

/** The next page after `from` with no decision, or null when every page is decided. */
export function nextUndecided(decisions: WalkDecisions, pageCount: number, from: number): number | null {
  for (let p = from + 1; p <= pageCount; p++) if (decisions[p] === undefined) return p
  for (let p = 1; p <= from; p++) if (decisions[p] === undefined) return p
  return null
}

export type WalkSummary = {
  placed: number
  skipped: number
  undecided: number
  seen: number
  pageCount: number
  /** Rows with no page in this file (ids, in row order), counting only rows that want a sheet. */
  rowsWithout: string[]
  /** Every page seen and decided — Done may write. */
  done: boolean
}

export function walkSummary(decisions: WalkDecisions, seen: ReadonlySet<number>, pageCount: number, rows: ReadonlyArray<WalkRow>, wantsSheet: (id: string) => boolean = () => true): WalkSummary {
  let placed = 0
  let skipped = 0
  for (let p = 1; p <= pageCount; p++) {
    const d = decisions[p]
    if (d === undefined) continue
    if (d === 'skip') skipped += 1
    else placed += 1
  }
  const undecided = pageCount - placed - skipped
  const have = pagesByItem(decisions)
  const rowsWithout = rows.filter((r) => wantsSheet(r.id) && !have.has(r.id)).map((r) => r.id)
  let seenCount = 0
  for (let p = 1; p <= pageCount; p++) if (seen.has(p)) seenCount += 1
  return { placed, skipped, undecided, seen: seenCount, pageCount, rowsWithout, done: undecided === 0 && seenCount === pageCount }
}

/** "23 of 75 seen · 21 on rows · 2 not cut sheets" for the header; "Done — put 61 pages on 22 rows" once done. */
export function walkProgressText(s: WalkSummary): string {
  const bits = [`${s.seen} of ${s.pageCount} seen`, `${s.placed} on rows`]
  if (s.skipped) bits.push(`${s.skipped} not cut sheet${s.skipped === 1 ? '' : 's'}`)
  if (s.rowsWithout.length) bits.push(`${s.rowsWithout.length} row${s.rowsWithout.length === 1 ? '' : 's'} with nothing`)
  return bits.join(' · ')
}

export function doneButtonText(s: WalkSummary): string {
  if (s.done) return `Done — put ${s.placed} page${s.placed === 1 ? '' : 's'} on rows`
  return `Done — ${s.seen} of ${s.pageCount} seen`
}

/** The rows' pages in this file as the walk starts — what is already on rows is kept, and still seen. */
export function initialDecisions(items: ReadonlyArray<SubmittalItemRow>, fileIndex: number): WalkDecisions {
  const out: Record<number, Decision> = {}
  for (const it of items) {
    if (it.sheet_file !== fileIndex) continue
    for (const p of it.sheet_pages ?? []) out[p] = it.id
  }
  return out
}

/** The robot's sure guesses (page → tag) as reads, over rows matched by tag; unsure guesses are left to the reader. */
export function readsFromGuesses(guesses: ReadonlyMap<number, { tag: string; sure: boolean }> | undefined, rows: ReadonlyArray<WalkRow>): PageReads {
  const out: Record<number, PageRead> = {}
  if (!guesses) return out
  for (const [page, g] of guesses) {
    if (!g.sure) continue
    const want = normalizeText(g.tag).trim()
    const row = rows.find((r) => r.tag.toUpperCase() === g.tag.trim().toUpperCase() || tagTokens(r.tag).some((t) => t.trim() === want))
    if (row) out[page] = { itemId: row.id, why: 'tag' }
  }
  return out
}

export type ItemWrite = { itemId: string; fileIndex: number | null; pages: number[] }

/**
 * What Done writes: every row whose pages in this file changed. A row that had pages in
 * another file and now has pages here moves to this file (a row's sheet lives in one
 * file); a row that had pages here and now has none is cleared.
 */
export function decisionsToWrites(items: ReadonlyArray<SubmittalItemRow>, fileIndex: number, decisions: WalkDecisions): ItemWrite[] {
  const have = pagesByItem(decisions)
  const out: ItemWrite[] = []
  for (const it of items) {
    const next = have.get(it.id) ?? []
    const wasHere = it.sheet_file === fileIndex
    const before = wasHere ? [...(it.sheet_pages ?? [])].sort((a, b) => a - b) : []
    const same = before.length === next.length && before.every((p, i) => p === next[i])
    if (next.length > 0) {
      if (!wasHere || !same) out.push({ itemId: it.id, fileIndex, pages: next })
    } else if (wasHere && before.length > 0) {
      out.push({ itemId: it.id, fileIndex: null, pages: [] })
    }
  }
  return out
}

/** Pages whose text names the row — for Find on a row with nothing. */
export function findPagesForRow(texts: ReadonlyArray<string>, row: WalkRow): number[] {
  const out: number[] = []
  texts.forEach((raw, i) => {
    const text = normalizeText(raw)
    if (row.models.some((m) => textHasModel(text, m))) out.push(i + 1)
  })
  return out
}

const PALETTE = ['#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#f87171', '#2dd4bf', '#c084fc', '#fb923c', '#4ade80', '#38bdf8', '#e879f9', '#facc15', '#a3e635', '#f9a8d4', '#67e8f9']

/** The row's color on the strip and in the list — by its place in the row order. */
export function rowColor(index: number): string {
  return PALETTE[index % PALETTE.length]!
}
