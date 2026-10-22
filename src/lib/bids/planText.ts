/**
 * The Plans panel's words and search (Robot rounds PR 6, punch list #142, decision 9): the plans
 * answer first, at once, from the page text the round wrote and the robot's read; the robot is
 * asked only when that is not enough. Pure: no React, no Supabase, no pdf.js.
 */

/** One row of `bids_plan_pages`. */
export type PlanPageRow = {
  page: number
  sheet_no: string | null
  title: string | null
  text: string | null
  has_text: boolean
  source: string
}

/** The robot's read, the parts the panel shows (docs/twins/SUBSTRATE.md, read loosely). */
export type PlanSubstrate = {
  sheets?: Array<{ page?: number; sheet_no?: { value?: string | null } | string | null; title?: { value?: string | null } | string | null; discipline?: string | null; schedules?: PlanSchedule[]; notes?: PlanNote[] }>
  rollup?: { sheet_inventory?: { total?: number; in_trade?: string[] } }
}
export type PlanSchedule = { schedule_type?: string; rows?: Array<Record<string, unknown>>; sheet_no?: string }
export type PlanNote = { category?: string; text?: { value?: string | null } | string | null; flags?: string[]; sheet_no?: string }

export type PlanHit = { page: number; sheet: string; title: string | null; snippet: string; count: number }
export type PlanNoteLine = { sheet: string | null; text: string; flags: string[] }
export type PlanScheduleTable = { type: string; sheet: string | null; columns: string[]; rows: string[][] }

const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'there', 'any', 'on', 'in', 'of', 'this', 'that', 'job', 'bid', 'plans', 'plan', 'set', 'does', 'do', 'it', 'have', 'has', 'with', 'for', 'to', 'and', 'or', 'at', 'how', 'many', 'much', 'what', 'where', 'which', 'who', 'we', 'i', 'be', 'show', 'me'])

/** The typed words to search terms: lower-case, stop words out, sheet numbers kept whole ("P-401"). */
export function searchTerms(q: string): string[] {
  const words = q.toLowerCase().replace(/[?!.,;:]+/g, ' ').split(/\s+/).map((w) => w.trim()).filter(Boolean)
  const terms = words.filter((w) => !STOP.has(w) && (w.length > 1 || /^\d$/.test(w)))
  return [...new Set(terms)]
}

function valueOf(v: { value?: string | null } | string | null | undefined): string | null {
  if (v == null) return null
  return typeof v === 'string' ? v : (v.value ?? null)
}

/** A page's sheet label: its number, else "page N". */
export function sheetLabel(p: Pick<PlanPageRow, 'page' | 'sheet_no'>): string {
  return p.sheet_no?.trim() || `page ${p.page}`
}

function snippetAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 60)
  const end = Math.min(text.length, idx + len + 80)
  const raw = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${raw}${end < text.length ? '…' : ''}`
}

/** The hits by sheet, most hits first: every page whose text holds every term. */
export function searchPlanPages(pages: readonly PlanPageRow[], q: string): PlanHit[] {
  const terms = searchTerms(q)
  if (!terms.length) return []
  const out: PlanHit[] = []
  for (const p of pages) {
    const text = p.text ?? ''
    const lower = text.toLowerCase()
    const positions = terms.map((t) => lower.indexOf(t))
    if (positions.some((i) => i < 0)) continue
    let count = 0
    for (const t of terms) {
      let i = lower.indexOf(t)
      while (i >= 0 && count < 99) { count++; i = lower.indexOf(t, i + t.length) }
    }
    const first = Math.min(...positions)
    out.push({ page: p.page, sheet: sheetLabel(p), title: p.title, snippet: snippetAround(text, first, terms[0]!.length), count })
  }
  return out.sort((a, b) => b.count - a.count || a.page - b.page)
}

/** The notes of the robot's read, flattened, with the flag words a person reads. */
export function substrateNotes(sub: PlanSubstrate | null | undefined): PlanNoteLine[] {
  const out: PlanNoteLine[] = []
  for (const s of sub?.sheets ?? []) {
    const sheet = valueOf(s.sheet_no)
    for (const n of s.notes ?? []) {
      const text = valueOf(n.text)
      if (!text) continue
      out.push({ sheet, text: text.trim(), flags: (n.flags ?? []).map(flagWords) })
    }
  }
  return out
}

/** The schedules of the robot's read as tables: the union of the rows' keys as columns. */
export function substrateSchedules(sub: PlanSubstrate | null | undefined): PlanScheduleTable[] {
  const out: PlanScheduleTable[] = []
  for (const s of sub?.sheets ?? []) {
    const sheet = valueOf(s.sheet_no)
    for (const sch of s.schedules ?? []) {
      const rows = sch.rows ?? []
      if (!rows.length) continue
      const columns: string[] = []
      for (const r of rows) for (const k of Object.keys(r)) if (!columns.includes(k)) columns.push(k)
      out.push({
        type: (sch.schedule_type ?? 'schedule').replace(/_/g, ' '),
        sheet,
        columns,
        rows: rows.map((r) => columns.map((c) => cellWords(r[c]))),
      })
    }
  }
  return out
}

function cellWords(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { value?: unknown }
    return o.value == null ? '' : String(o.value)
  }
  return String(v)
}

/** The plain word for a note's flag. */
export function flagWords(flag: string): string {
  switch (flag) {
    case 'exclusion_candidate': return 'exclusion'
    case 'scope_commitment': return 'scope'
    case 'certification_required': return 'certification'
    case 'coordination': return 'coordination'
    case 'alternate_invited': return 'alternate'
    case 'rfi_candidate': return 'RFI'
    default: return flag.replace(/_/g, ' ')
  }
}

/** The notes and schedule rows that hold every term, for the answer card. */
export function searchRead(sub: PlanSubstrate | null | undefined, q: string): { notes: PlanNoteLine[]; scheduleRows: Array<{ type: string; sheet: string | null; words: string }> } {
  const terms = searchTerms(q)
  if (!terms.length) return { notes: [], scheduleRows: [] }
  const holds = (s: string) => { const l = s.toLowerCase(); return terms.every((t) => l.includes(t)) }
  const notes = substrateNotes(sub).filter((n) => holds(n.text))
  const scheduleRows: Array<{ type: string; sheet: string | null; words: string }> = []
  for (const t of substrateSchedules(sub)) for (const r of t.rows) { const words = r.filter(Boolean).join(', '); if (holds(words)) scheduleRows.push({ type: t.type, sheet: t.sheet, words }) }
  return { notes, scheduleRows }
}

/**
 * The plans' answer, in one or two sentences, from the hits and the read. Never a count of the
 * robot's own: it names sheets and quotes what the plans say.
 */
export function answerWords(q: string, hits: readonly PlanHit[], read: ReturnType<typeof searchRead>, hasText: boolean): string {
  const terms = searchTerms(q)
  if (!terms.length) return 'Type a word or a question.'
  const asked = terms.join(' ')
  const sheets = hits.slice(0, 3).map((h) => h.sheet)
  const parts: string[] = []
  if (hits.length) {
    parts.push(hits.length === 1 ? `${capitalize(asked)} is on ${sheets[0]}.` : `${capitalize(asked)} is on ${hits.length} sheets${sheets.length ? `, first ${sheets.join(', ')}` : ''}.`)
  } else if (hasText) {
    parts.push(`No sheet mentions ${asked}.`)
  } else {
    parts.push('This set has no text to search.')
  }
  const row = read.scheduleRows[0]
  if (row) parts.push(`The ${row.type}${row.sheet ? ` on ${row.sheet}` : ''} lists ${row.words}.`)
  const note = read.notes[0]
  if (note) parts.push(`${note.sheet ? `A note on ${note.sheet}` : 'A note'} says ${trimNote(note.text)}`)
  return parts.join(' ')
}

function trimNote(t: string): string {
  const s = t.trim().replace(/\s+/g, ' ')
  const cut = s.length > 140 ? `${s.slice(0, 137).trim()}…` : s
  return /[.!?…]$/.test(cut) ? cut : `${cut}.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** The panel's first line about the set. */
export function setWords(pages: readonly PlanPageRow[], inTrade: number | null, readAt: string | null, source: string | null): string {
  if (!pages.length) return 'No page text yet.'
  const withText = pages.filter((p) => p.has_text).length
  const head = `${pages.length} sheet${pages.length === 1 ? '' : 's'}${inTrade ? `, ${inTrade} plumbing` : ''}.`
  if (withText === 0) return `${head} No text to search. The robot read these sheets by eye.`
  const by = source === 'browser' ? 'read in this browser' : 'text from the round'
  return `${head} ${capitalize(by)}${readAt ? ` ${readAt}` : ''}. Type a word or a question.`
}
