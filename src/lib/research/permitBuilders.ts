/**
 * Permits, the four places and the builders (punch list #302, PR 6 to 8): the pure rules behind
 * the step strip, the lists of Kept, Pursuing and Closed, the close-out of a kept permit, the
 * Builders list and a builder's mark, the nudge and the count. No React, no Supabase.
 */
import { contactParts } from '../../../supabase/functions/_shared/permitLookup'
import { plumbingOnFile, rowsAboveFloor, type BuilderMarkValue, type PursueFor, type ResearchPermitRow, type ValueFloor } from './permitResearch'
import { daysBetween, type BuilderMark, type SkimAnswer, type SkimContext } from './permitSkim'

/** Where a permit sits. Every permit above the filter is in exactly one. */
export type PermitPlace = 'skim' | 'kept' | 'pursuing' | 'closed'
export const PLACE_WORDS: Record<PermitPlace, string> = { skim: 'Skim', kept: 'Kept', pursuing: 'Pursuing', closed: 'Closed' }

/** Why a permit is closed: passed on the skim, dropped after a closer look, or a plumber has it. */
export type ClosedWhy = 'passed' | 'not_pursuing' | 'plumber'
export const CLOSED_WORDS: Record<ClosedWhy, string> = { passed: 'Passed', not_pursuing: 'Not pursuing', plumber: 'Has a plumber' }

/** The reasons Not pursuing offers, one tap each. Their codes open on np_ so the count tells them from a skim's pass. */
export const NOT_PURSUING_REASONS = [
  { code: 'np_has_a_plumber', words: 'They have a plumber' },
  { code: 'np_no_answer', words: 'Could not reach anyone' },
  { code: 'np_too_far_along', words: 'Too far along' },
  { code: 'np_not_our_work', words: 'Not our kind of work' },
  { code: 'np_not_this_builder', words: 'Not this builder' },
] as const
export type NotPursuingCode = (typeof NOT_PURSUING_REASONS)[number]['code']

export function notPursuingVerdict(code: NotPursuingCode): { reason: string; reasonCode: NotPursuingCode } {
  const r = NOT_PURSUING_REASONS.find((x) => x.code === code)
  return { reason: `Not pursuing: ${(r?.words ?? 'no reason given').toLowerCase()}.`, reasonCode: code }
}

export const PURSUE_FOR_WORDS: Record<PursueFor, string> = { this_job: 'This job', next_jobs: 'Their next jobs', both: 'Both' }

/** The words a pursue is kept with, so the ledger and the lead say what it was for. */
export function pursueReason(pursueFor: PursueFor): string {
  return pursueFor === 'this_job' ? 'Pursued for this job.' : pursueFor === 'next_jobs' ? 'Pursued for their next jobs.' : 'Pursued for this job and their next ones.'
}

/**
 * Where a permit sits. A plumbing permit on the feed closes it whatever was said before, except a
 * pursue: a lead we are working stays ours to close. A kept permit that got a plumber is closed.
 */
export function placeOf(row: Pick<ResearchPermitRow, 'verdict' | 'plumber' | 'plumber_permit_on' | 'verdict_reason_code'>): { place: PermitPlace; why: ClosedWhy | null } {
  if (row.verdict === 'approach') return { place: 'pursuing', why: null }
  if (row.verdict === 'taken' || plumbingOnFile(row)) return { place: 'closed', why: 'plumber' }
  if (row.verdict === 'not_for_us') return { place: 'closed', why: (row.verdict_reason_code ?? '').startsWith('np_') ? 'not_pursuing' : 'passed' }
  if (row.verdict === 'look') return { place: 'kept', why: null }
  return { place: 'skim', why: null }
}

/** A kept permit that a plumber has since taken: it sits in Closed, and Kept says so once. */
export function tookPlumberSinceKept(row: Pick<ResearchPermitRow, 'verdict' | 'plumber' | 'plumber_permit_on'>): boolean {
  return row.verdict === 'look' && plumbingOnFile(row)
}

export type PlaceCounts = Record<PermitPlace, number>

/** The four counts on the step strip, over the rows above the value floor. They add up to those rows. */
export function placeCounts(rows: readonly ResearchPermitRow[], floor: ValueFloor): PlaceCounts {
  const out: PlaceCounts = { skim: 0, kept: 0, pursuing: 0, closed: 0 }
  for (const r of rowsAboveFloor(rows, floor)) out[placeOf(r).place]++
  return out
}

/** What the skim deck knows before the tab does: how many cards are left, and the answer it holds for Undo. */
export type SkimLive = { left: number; held: SkimAnswer | null }

/**
 * The strip's counts while the skim is open. The strip is the one count on the page, so Skim is
 * the deck's own number, and an answer still held for Undo already reads on Kept or on Closed.
 */
export function stripCounts(places: PlaceCounts, live: SkimLive | null): PlaceCounts {
  if (!live) return places
  return { ...places, skim: live.left, kept: places.kept + (live.held === 'keep' ? 1 : 0), closed: places.closed + (live.held === 'pass' ? 1 : 0) }
}

export type KeptShowing = 'everyone' | 'mine' | 'nobody' | 'again'

/** The kept permits, the ones to look at again today first, then the longest kept. */
export function keptRows(rows: readonly ResearchPermitRow[], floor: ValueFloor, showing: KeptShowing, me: string, todayYmd: string): ResearchPermitRow[] {
  const due = (r: ResearchPermitRow) => r.verdict_look_again_on != null && r.verdict_look_again_on <= todayYmd
  return rowsAboveFloor(rows, floor)
    .filter((r) => placeOf(r).place === 'kept')
    .filter((r) => (showing === 'mine' ? r.verdict_for_user === me : showing === 'nobody' ? !r.verdict_for_user : showing === 'again' ? due(r) : true))
    .sort((a, b) => Number(due(b)) - Number(due(a)) || (a.verdict_at ?? '').localeCompare(b.verdict_at ?? ''))
}

export function keptChipCounts(rows: readonly ResearchPermitRow[], floor: ValueFloor, me: string, todayYmd: string): Record<KeptShowing, number> {
  return {
    everyone: keptRows(rows, floor, 'everyone', me, todayYmd).length,
    mine: keptRows(rows, floor, 'mine', me, todayYmd).length,
    nobody: keptRows(rows, floor, 'nobody', me, todayYmd).length,
    again: keptRows(rows, floor, 'again', me, todayYmd).length,
  }
}

/** The pursued permits, the newest pursue first. */
export function pursuingRows(rows: readonly ResearchPermitRow[], floor: ValueFloor): ResearchPermitRow[] {
  return rowsAboveFloor(rows, floor)
    .filter((r) => placeOf(r).place === 'pursuing')
    .sort((a, b) => (b.verdict_at ?? '').localeCompare(a.verdict_at ?? ''))
}

/** The closed permits of one kind, the newest answer first, held to a search of the street, the builder or the number. */
export function closedRows(rows: readonly ResearchPermitRow[], floor: ValueFloor, why: ClosedWhy, search: string): ResearchPermitRow[] {
  const q = search.trim().toLowerCase()
  return rowsAboveFloor(rows, floor)
    .filter((r) => {
      const p = placeOf(r)
      return p.place === 'closed' && p.why === why
    })
    .filter((r) => q === '' || [r.address, r.contact, r.permit_number, r.project_name, r.plumber].some((t) => (t ?? '').toLowerCase().includes(q)))
    .sort((a, b) => (b.verdict_at ?? b.plumber_permit_on ?? b.filed_on ?? '').localeCompare(a.verdict_at ?? a.plumber_permit_on ?? a.filed_on ?? ''))
}

export function closedChipCounts(rows: readonly ResearchPermitRow[], floor: ValueFloor): Record<ClosedWhy, number> {
  return { passed: closedRows(rows, floor, 'passed', '').length, not_pursuing: closedRows(rows, floor, 'not_pursuing', '').length, plumber: closedRows(rows, floor, 'plumber', '').length }
}

/** Under a kept row: who kept it, for whom, and when. */
export function keptByWords(row: Pick<ResearchPermitRow, 'verdict_by_name' | 'verdict_for_name' | 'verdict_at'>, todayYmd: string): string {
  const day = row.verdict_at ? row.verdict_at.slice(0, 10) : null
  const days = daysBetween(day, todayYmd)
  const when = days == null ? '' : days <= 0 ? ', today' : days === 1 ? ', yesterday' : `, ${days} days ago`
  return `Kept by ${row.verdict_by_name ?? 'someone'}${row.verdict_for_name ? ` for ${row.verdict_for_name}` : ', for nobody yet'}${when}`
}

// ---------- builders ----------

export const BUILDER_KINDS = ['gc', 'owner', 'developer', 'architect', 'plumber', 'files_for_others', 'person'] as const
export type BuilderKind = (typeof BUILDER_KINDS)[number]
export const BUILDER_KIND_WORDS: Record<BuilderKind, string> = {
  gc: 'General contractor',
  owner: 'Owner',
  developer: 'Developer',
  architect: 'Architect or engineer',
  plumber: 'Plumber',
  files_for_others: 'Files for others',
  person: 'Person',
}
export function isBuilderKind(v: unknown): v is BuilderKind {
  return typeof v === 'string' && (BUILDER_KINDS as readonly string[]).includes(v)
}

/** One row of `research_builders`. */
export type BuilderRow = {
  key: string
  name: string | null
  sample_contact: string | null
  kind: string | null
  customer_id: string | null
  mark: BuilderMarkValue | null
  mark_reason: string | null
  mark_by_name: string | null
  mark_at: string | null
  permits: number
  open: number
  last_permit_on: string | null
  plumber: string | null
  plumber_jobs: number
  bids: number
  won: number
  last_bid_on: string | null
}

/** What to call a builder: the name the office gave it, else the company on its newest permit, else the line itself. */
export function builderName(row: Pick<BuilderRow, 'name' | 'sample_contact' | 'key'>): string {
  const given = (row.name ?? '').trim()
  if (given) return given
  const { person, company } = contactParts(row.sample_contact)
  return company ?? person ?? row.sample_contact ?? row.key
}

/** The same, from a permit row. */
export function builderNameOfPermit(row: Pick<ResearchPermitRow, 'builder_name' | 'contact'>): string | null {
  const given = (row.builder_name ?? '').trim()
  if (given) return given
  const { person, company } = contactParts(row.contact)
  return company ?? person ?? null
}

export type BuilderShowing = 'all' | 'good' | 'avoid' | 'unmarked' | 'never_bid'
export const BUILDER_SHOWING_WORDS: Record<BuilderShowing, string> = { all: 'All', good: 'Good', avoid: 'Avoid', unmarked: 'No mark', never_bid: '3 or more permits and never bid' }

/** Who to get to know: a name that keeps pulling permits and that we have never priced. Names that file for others are not builders. */
export function neverBid(row: Pick<BuilderRow, 'permits' | 'bids' | 'kind'>): boolean {
  return row.permits >= 3 && row.bids === 0 && row.kind !== 'files_for_others'
}

export function buildersShowing(rows: readonly BuilderRow[], showing: BuilderShowing, search: string): BuilderRow[] {
  const q = search.trim().toLowerCase()
  return rows
    .filter((r) => (showing === 'good' ? r.mark === 'good' : showing === 'avoid' ? r.mark === 'avoid' : showing === 'unmarked' ? r.mark == null : showing === 'never_bid' ? neverBid(r) : true))
    .filter((r) => q === '' || builderName(r).toLowerCase().includes(q) || (r.sample_contact ?? '').toLowerCase().includes(q) || (r.plumber ?? '').toLowerCase().includes(q))
}

export function builderChipCounts(rows: readonly BuilderRow[]): Record<BuilderShowing, number> {
  return { all: rows.length, good: rows.filter((r) => r.mark === 'good').length, avoid: rows.filter((r) => r.mark === 'avoid').length, unmarked: rows.filter((r) => r.mark == null).length, never_bid: rows.filter(neverBid).length }
}

/** "5 priced, 3 won" or "never". */
export function ourBidsWords(row: Pick<BuilderRow, 'bids' | 'won'>): string {
  if (row.bids === 0) return 'never'
  return `${row.bids} priced, ${row.won === 0 ? 'none won' : `${row.won} won`}`
}

/** "Blue Heron Plumbing on 2" or "nobody yet". */
export function plumberUsedWords(row: Pick<BuilderRow, 'plumber' | 'plumber_jobs'>): string {
  return row.plumber ? `${row.plumber} on ${row.plumber_jobs}` : 'nobody yet'
}

/** Under who pulled it on a card: how busy the builder is. Null until the builder's permits are counted. */
export function builderLine(row: Pick<ResearchPermitRow, 'builder_permits' | 'builder_open'>): string | null {
  const n = row.builder_permits ?? 0
  if (n <= 0) return null
  const open = row.builder_open ?? 0
  const first = n === 1 ? 'Their one permit this year.' : `${n} permits this year.`
  if (n === 1) return first
  return `${first} ${open === 0 ? 'A plumber is on every one.' : open === 1 ? '1 has no plumber yet.' : `${open} have no plumber yet.`}`
}

/** The hold on a mark: a good and an avoid say why; clearing a mark needs no words. */
export function markHold(mark: BuilderMarkValue | 'none', reason: string): string | null {
  return mark !== 'none' && reason.trim() === '' ? 'Say why in a line. Every estimator reads it on the card.' : null
}

/** What the skim's score reads from the rows themselves: each builder's mark, and the names that only file for others. */
export function skimBuilderContext(rows: readonly ResearchPermitRow[]): Pick<SkimContext, 'marks' | 'filesForOthers'> {
  const marks = new Map<string, BuilderMark>()
  const filesForOthers = new Set<string>()
  for (const r of rows) {
    if (r.builder_mark) marks.set(r.id, r.builder_mark)
    if (r.builder_kind === 'files_for_others') filesForOthers.add(r.id)
  }
  return { marks, filesForOthers }
}

// ---------- the nudge and the count ----------

/** The nudge's words: how many wait and how long the oldest has. Null when nothing waits. */
export function nudgeWords(waiting: number, oldestDays: number | null): { title: string; detail: string } | null {
  if (waiting <= 0) return null
  const title = `${waiting} permit${waiting === 1 ? '' : 's'} wait${waiting === 1 ? 's' : ''} on a skim`
  const waited = oldestDays == null ? '' : oldestDays <= 0 ? 'The oldest arrived today.' : `The oldest has waited ${oldestDays} day${oldestDays === 1 ? '' : 's'}.`
  return { title, detail: [waited, 'About a minute.'].filter(Boolean).join(' ') }
}

/** How long a permit may wait before the whole team is asked. */
export const NUDGE_WIDENS_AFTER_DAYS = 2

/**
 * Who the nudge asks. The Leader (and a dev) every day there is something to skim; the rest of
 * the people who may skim once a permit has waited two days. The owner's answer of 2026-11-10:
 * the Leader's in time, the assistants' and estimators' more likely.
 */
export function nudgeAsks(role: string | null | undefined, oldestDays: number | null): boolean {
  if (role === 'master_technician' || role === 'dev') return true
  return oldestDays != null && oldestDays >= NUDGE_WIDENS_AFTER_DAYS
}

/** One counted line of the funnel's lists. */
export type FunnelLine = { name?: string; code?: string; n: number }
/** `permit_funnel`'s answer. */
export type PermitFunnel = {
  since: string
  arrived: number
  skimmed: number
  kept: number
  passed: number
  pursuing: number
  has_plumber: number
  bid: number
  won: number
  by_person: FunnelLine[]
  pass_reasons: FunnelLine[]
  pursue_for: FunnelLine[]
}

const REASON_WORDS: Record<string, string> = {
  too_small: 'too small',
  too_far: 'too far',
  not_our_work: 'not our work',
  not_this_builder: 'not this builder',
  too_old: 'too old',
  np_has_a_plumber: 'they have a plumber',
  np_no_answer: 'could not reach anyone',
  np_too_far_along: 'too far along',
  np_not_our_work: 'not our kind of work',
  np_not_this_builder: 'not this builder, after a look',
  none: 'no reason given',
}
const PURSUE_WORDS: Record<string, string> = { this_job: 'this job', next_jobs: 'their next jobs', both: 'both', unsaid: 'not said' }

/** The six numbers of the count, in order. */
export function funnelTiles(f: PermitFunnel): Array<{ n: number; words: string }> {
  return [
    { n: f.arrived, words: 'arrived' },
    { n: f.skimmed, words: 'skimmed' },
    { n: f.kept, words: 'kept' },
    { n: f.pursuing, words: 'pursuing' },
    { n: f.bid, words: 'bid' },
    { n: f.won, words: 'won' },
  ]
}

function counted(lines: readonly FunnelLine[] | null | undefined, words: (l: FunnelLine) => string): string | null {
  const list = (lines ?? []).filter((l) => l.n > 0)
  return list.length === 0 ? null : list.map((l) => `${words(l)} ${l.n}`).join(' · ')
}

/** The lines under the six numbers: who skimmed, why permits were passed, what the pursues are for. */
export function funnelLines(f: PermitFunnel): Array<{ label: string; words: string }> {
  const out: Array<{ label: string; words: string }> = []
  const by = counted(f.by_person, (l) => l.name ?? 'someone')
  if (by) out.push({ label: 'Skimmed by', words: by })
  const why = counted(f.pass_reasons, (l) => REASON_WORDS[l.code ?? 'none'] ?? (l.code ?? 'no reason given'))
  if (why) out.push({ label: 'Passed, why', words: why })
  const what = counted(f.pursue_for, (l) => PURSUE_WORDS[l.code ?? 'unsaid'] ?? (l.code ?? 'not said'))
  if (what) out.push({ label: 'Pursued for', words: what })
  return out
}

/** What the count says in one line when nothing has been pursued: the skim is only worth it if permits become calls. */
export function funnelVerdict(f: PermitFunnel): string | null {
  if (f.skimmed === 0) return 'Nothing has been skimmed since then.'
  if (f.pursuing === 0) return 'Nothing skimmed has been pursued yet.'
  return null
}
