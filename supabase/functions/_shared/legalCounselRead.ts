/**
 * The attorney's read of how a case tries (punch list #218, direction C, PR 2). The owner's words of
 * 2026-10-30: some cases are hard to try and some are easy, the attorney settles for what can be
 * had, and we get what we get. The read is the attorney's word in two values and a sentence — easy
 * or hard, with the costs to try it, the months to a judgment and one line of why — and it is what
 * the desk's paths kernel (PR 3) weighs a settlement against.
 *
 * A READ is a `legal_matter_entries` row of kind `note` whose `meta.read` carries it
 * (`{ tries, why, cost_to_try, months }`): the firm writes one from its portal (`submit-legal-portal`
 * kind `read`, via_portal true, `meta.recordedBy` the name it picked), the office through
 * `legal_set_counsel_read` (in house, or when counsel said it by phone). The current read is the
 * latest one not undone; `legal_void_entry` is the way back, as for every entry. No column and no
 * new kind, so no table changes and the read travels, prints and undoes like any entry.
 *
 * Pure and shared: the function validates and words the entry with it, the desk and the portal read
 * it with it, so the two sides never disagree on what a read is.
 */

export type CounselTries = 'easy' | 'hard'
export type CounselReadMeta = { tries: CounselTries; why: string; costToTry: number | null; months: number | null }
export type CounselRead = CounselReadMeta & { entryId: string; ymd: string; by: 'firm' | 'office'; byName: string }

export const COUNSEL_READ_WHY_MAX = 2000
export const COUNSEL_READ_MONTHS_MAX = 120
export const COUNSEL_READ_COST_MAX = 1_000_000

type EntryLike = { id: string; kind: string; meta: unknown; occurred_on: string; created_at: string; via_portal: boolean; voided_at?: string | null; created_by?: string | null }

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

export function isCounselTries(v: unknown): v is CounselTries {
  return v === 'easy' || v === 'hard'
}

/** The read inside an entry's meta, read defensively; null when the entry is not a read. */
export function counselReadMetaOf(meta: unknown): CounselReadMeta | null {
  if (!isRecord(meta) || !isRecord(meta.read)) return null
  const r = meta.read
  const tries = r.tries
  if (!isCounselTries(tries)) return null
  const cost = num(r.cost_to_try)
  const months = num(r.months)
  return {
    tries,
    why: typeof r.why === 'string' ? r.why : '',
    costToTry: cost != null && cost >= 0 ? Math.round(cost * 100) / 100 : null,
    months: months != null && months >= 0 ? Math.round(months) : null,
  }
}

export function isCounselReadEntry(e: Pick<EntryLike, 'kind' | 'meta'>): boolean {
  return e.kind === 'note' && counselReadMetaOf(e.meta) != null
}

/** What the firm's act carries as `meta.read`, and what the office's RPC writes: the same four keys. */
export function counselReadMetaForDb(m: CounselReadMeta): Record<string, unknown> {
  return { tries: m.tries, why: m.why, cost_to_try: m.costToTry, months: m.months }
}

/**
 * The current read: the latest read entry not undone, by the day it was given and then by when it was
 * written. The firm's carries the name it picked under Recorded by; the office's the user's name, through
 * `nameOf`, else *the office*.
 */
export function currentCounselRead(entries: ReadonlyArray<EntryLike>, nameOf: (userId: string | null | undefined) => string | null = () => null): CounselRead | null {
  const reads = entries.filter((e) => !e.voided_at && isCounselReadEntry(e)).slice().sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))
  const e = reads[0]
  if (!e) return null
  const meta = counselReadMetaOf(e.meta)!
  const recordedBy = isRecord(e.meta) && isRecord(e.meta.recordedBy) && typeof e.meta.recordedBy.name === 'string' ? e.meta.recordedBy.name : ''
  return { ...meta, entryId: e.id, ymd: e.occurred_on, by: e.via_portal ? 'firm' : 'office', byName: e.via_portal ? recordedBy : (nameOf(e.created_by) ?? '') }
}

export type CounselReadDraft = { tries: CounselTries | ''; why: string; costText: string; monthsText: string }

/** "2,800" → 2800; null when blank; NaN-ish when not a number (the problem names it). */
export function counselReadCostOf(text: string): number | null | 'bad' {
  const t = text.replace(/[$,\s]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= COUNSEL_READ_COST_MAX ? Math.round(n * 100) / 100 : 'bad'
}

export function counselReadMonthsOf(text: string): number | null | 'bad' {
  const t = text.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isInteger(n) && n >= 0 && n <= COUNSEL_READ_MONTHS_MAX ? n : 'bad'
}

/** Why the draft cannot be saved; null when it can. The function and the RPC hold the same rules. */
export function counselReadDraftProblem(d: CounselReadDraft): string | null {
  if (!isCounselTries(d.tries)) return 'Say whether the case is easy or hard to try.'
  if (counselReadCostOf(d.costText) === 'bad') return 'The costs to try it are a dollar amount under a million, or blank.'
  if (counselReadMonthsOf(d.monthsText) === 'bad') return `Months to a judgment is a whole number up to ${COUNSEL_READ_MONTHS_MAX}, or blank.`
  if (d.why.trim().length > COUNSEL_READ_WHY_MAX) return `Keep the why under ${COUNSEL_READ_WHY_MAX.toLocaleString('en-US')} characters.`
  return null
}

/** The draft as the meta it saves; null when the draft has a problem. */
export function counselReadMetaFromDraft(d: CounselReadDraft): CounselReadMeta | null {
  if (counselReadDraftProblem(d) || !isCounselTries(d.tries)) return null
  const cost = counselReadCostOf(d.costText)
  const months = counselReadMonthsOf(d.monthsText)
  return { tries: d.tries, why: d.why.trim(), costToTry: cost === 'bad' ? null : cost, months: months === 'bad' ? null : months }
}

function usd(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** *hard to try* · *easy to try* — the chip on *Can we sue?* and the firm's card. */
export function counselTriesWords(t: CounselTries): string {
  return t === 'hard' ? 'hard to try' : 'easy to try'
}

/** The facts beside the chip: *Costs to try it $2,800.00. 9 months to a judgment.*; '' when neither was given. */
export function counselReadFacts(m: Pick<CounselReadMeta, 'costToTry' | 'months'>): string {
  const parts: string[] = []
  if (m.costToTry != null) parts.push(`Costs to try it ${usd(m.costToTry)}.`)
  if (m.months != null) parts.push(`${m.months} month${m.months === 1 ? '' : 's'} to a judgment.`)
  return parts.join(' ')
}

/** The entry's body, the same from the portal and the desk: *How this case tries: hard. Costs to try it $2,800.00. 9 months to a judgment. The GC's counter…* */
export function counselReadEntryBody(m: CounselReadMeta): string {
  const facts = counselReadFacts(m)
  return `How this case tries: ${m.tries}.${facts ? ` ${facts}` : ''}${m.why ? ` ${m.why}` : ''}`
}

/**
 * Whose read, when, and why, from the reader's side: the office reads *The firm's read, Oct 22: …* or *Our read,
 * Oct 22: …*; the firm reads *Your read, Oct 22: …* or *The office's read, Oct 22: …*. With no why, the sentence
 * stops at the day.
 */
export function counselReadLine(read: CounselRead, formatDay: (ymd: string) => string, reader: 'office' | 'firm'): string {
  const whose = read.by === 'firm' ? (reader === 'firm' ? 'Your read' : `The firm's read`) : reader === 'office' ? 'Our read' : "The office's read"
  const day = formatDay(read.ymd)
  return `${whose}, ${day}${read.why ? `: ${read.why}` : '.'}`
}
