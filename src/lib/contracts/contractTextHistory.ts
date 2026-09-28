/**
 * Contracts & terms, history and reviews: when a contract text last changed and who changed it,
 * what it said before, what it said on a given day, and when the office last read it.
 *
 * The rows come from `contract_text_versions` (written by database triggers on every change to
 * a customer-facing Settings text or a customer Contract Book document) and
 * `contract_text_reviews` (the office's *Mark reviewed*). Pure: the tab reads the rows, this
 * decides what to say.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdFriendly } from '../../utils/dateUtils'
import type { ContractCatalogEntry, ResolvedContractText } from './customerContractCatalog'

export type ContractTextVersion = {
  id: string
  source_kind: string
  source_key: string
  name: string | null
  body: string
  body_format: string
  version_date: string | null
  change_kind: string
  changed_at: string
  changed_by: string | null
}

export type ContractTextReview = {
  id: string
  entry_id: string
  reviewed_on: string
  note: string | null
  reviewed_by: string
  created_at: string
}

export type ContractSourceRef = { kind: 'app_setting' | 'contract_book'; key: string }

/** Where a card's history is kept; null for wording that has none (fixed in the app, typed each time, the built-in). */
export function contractSourceRef(entry: ContractCatalogEntry, text: ResolvedContractText): ContractSourceRef | null {
  if (entry.source.kind === 'app_setting') return { kind: 'app_setting', key: entry.source.key }
  if (entry.source.kind === 'contract_book' && text.doc) return { kind: 'contract_book', key: text.doc.id }
  return null
}

/** A source's versions, newest first. */
export function versionsFor(ref: ContractSourceRef | null, rows: ReadonlyArray<ContractTextVersion>): ContractTextVersion[] {
  if (!ref) return []
  return rows.filter((r) => r.source_kind === ref.kind && r.source_key === ref.key).sort((a, b) => b.changed_at.localeCompare(a.changed_at))
}

export function versionYmd(v: Pick<ContractTextVersion, 'changed_at'>): string {
  return calendarYmdInAppTzFromIso(v.changed_at)
}

function friendly(ymd: string): string {
  return ymd ? formatWorkDateYmdFriendly(ymd) : 'an unknown day'
}

/** What a history row was: the first record, a change, or the wording taken away. */
export type VersionKind = 'first' | 'changed' | 'cleared'

export function versionKind(v: Pick<ContractTextVersion, 'change_kind' | 'body'>): VersionKind {
  if (v.change_kind === 'baseline') return 'first'
  if (v.change_kind === 'removed' || v.body.trim() === '') return 'cleared'
  return 'changed'
}

export type NameOf = (userId: string | null) => string | null

/**
 * One history row in words. A Settings text's first record is stamped at the day the history
 * began, which says nothing about when the wording was written — so it says that. A Book
 * document's first record carries the day the document was last saved.
 */
export function versionLine(v: ContractTextVersion, nameOf: NameOf): string {
  const kind = versionKind(v)
  const when = friendly(versionYmd(v))
  if (kind === 'first') {
    return v.source_kind === 'contract_book' ? `${when} — as it stood when the history began.` : `On record since ${when}. Changes before that were not kept.`
  }
  const who = nameOf(v.changed_by)
  return `${kind === 'cleared' ? 'Cleared' : 'Changed'} ${when}${who ? ` by ${who}` : ''}.`
}

export type LastChanged = { line: string; ymd: string | null }

/** The card's *Last changed* line; null when there is no history to read. */
export function lastChanged(versions: ReadonlyArray<ContractTextVersion>, nameOf: NameOf): LastChanged | null {
  const newest = versions[0]
  if (!newest) return null
  const kind = versionKind(newest)
  // A Settings text's first record dates the history, not the wording.
  const dated = !(kind === 'first' && newest.source_kind === 'app_setting')
  return { line: versionLine(newest, nameOf), ymd: dated ? versionYmd(newest) : null }
}

/** The wording in force on a day: the newest record made on or before it. Null when the history starts later. */
export function wordingInForceOn(versions: ReadonlyArray<ContractTextVersion>, ymd: string): ContractTextVersion | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return versions.find((v) => versionYmd(v) <= ymd) ?? null
}

/** What to say about a day the office asked about. */
export function inForceLine(versions: ReadonlyArray<ContractTextVersion>, ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return 'Pick a day.'
  const oldest = versions[versions.length - 1]
  if (!oldest) return 'No history is kept for this wording.'
  const v = wordingInForceOn(versions, ymd)
  if (!v) return `The history starts ${friendly(versionYmd(oldest))}. What it said on ${friendly(ymd)} was not kept.`
  if (versionKind(v) === 'cleared') return `On ${friendly(ymd)} nothing was set — it had been cleared ${friendly(versionYmd(v))}.`
  return `On ${friendly(ymd)} it read as recorded ${friendly(versionYmd(v))}.`
}

export function versionCompareKey(versionId: string): string {
  return `version:${versionId}`
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** How long a contract text goes before the office should read it again. */
export const REVIEW_EVERY_MONTHS = 12

/** `YYYY-MM-DD` plus n months, civil arithmetic; a day past the month's end lands on its last day. */
export function ymdAddMonths(ymd: string, months: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  const y = Number(m[1])
  const mo = Number(m[2]) - 1 + months
  const d = Number(m[3])
  const year = y + Math.floor(mo / 12)
  const month = ((mo % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

export type ReviewStatus = 'never' | 'due' | 'ok'

export type ReviewState = {
  status: ReviewStatus
  /** The newest review, or null. */
  last: ContractTextReview | null
  /** The day the next review is due; null when it has never been read or changed on record. */
  dueOn: string | null
  line: string
}

/** The newest review of an entry. */
export function lastReview(entryId: string, reviews: ReadonlyArray<ContractTextReview>): ContractTextReview | null {
  const mine = reviews.filter((r) => r.entry_id === entryId).sort((a, b) => b.reviewed_on.localeCompare(a.reviewed_on) || b.created_at.localeCompare(a.created_at))
  return mine[0] ?? null
}

/**
 * When an entry is next due. The clock starts at the later of the last review and the last
 * change on record — whoever changed the wording read it. With neither, it has never been read.
 */
export function reviewState(input: { entryId: string; reviews: ReadonlyArray<ContractTextReview>; lastChangedYmd: string | null; todayYmd: string; nameOf: NameOf; everyMonths?: number }): ReviewState {
  const last = lastReview(input.entryId, input.reviews)
  const every = input.everyMonths ?? REVIEW_EVERY_MONTHS
  const changed = input.lastChangedYmd
  const anchor = [last?.reviewed_on ?? '', changed ?? ''].sort().pop() ?? ''
  if (!anchor) return { status: 'never', last: null, dueOn: null, line: 'Never reviewed.' }
  const dueOn = ymdAddMonths(anchor, every)
  const due = input.todayYmd >= dueOn
  const who = last ? input.nameOf(last.reviewed_by) : null
  const read = last ? `Reviewed ${friendly(last.reviewed_on)}${who ? ` by ${who}` : ''}.` : 'Not reviewed since it changed.'
  // A change after the last review restarts the clock, and says why.
  const restarted = last && changed && changed > last.reviewed_on ? ` Changed since, ${friendly(changed)}.` : ''
  const next = due ? ` Due since ${friendly(dueOn)}.` : ` Next by ${friendly(dueOn)}.`
  return { status: due ? 'due' : 'ok', last, dueOn, line: `${read}${restarted}${next}` }
}

export type ReviewCounts = { never: number; due: number }

export function reviewCounts(states: ReadonlyArray<ReviewState>): ReviewCounts {
  return { never: states.filter((s) => s.status === 'never').length, due: states.filter((s) => s.status === 'due').length }
}

/** "3 due for review · 12 never reviewed", or null when every card is in date. */
export function reviewCountsLine(c: ReviewCounts): string | null {
  const parts: string[] = []
  if (c.due > 0) parts.push(`${c.due} due for review`)
  if (c.never > 0) parts.push(`${c.never} never reviewed`)
  return parts.length > 0 ? parts.join(' · ') : null
}
