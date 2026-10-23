/**
 * Quickfill → Percent complete (v2.5764): the open jobs whose stage facts or
 * paid money disagree with the % done, as cards an assistant fixes in place or
 * dismisses for a week.
 *
 * The owner, 2026-10-23, from Jobs → Pipeline: "I am noticing things like job
 * 892 and 879 where I think it is silly that a client has paid for the first
 * stage of their job, yet we report nothing has been done; or that a client has
 * paid for two stages of their job, but the first stage hasn't been fully
 * completed. These are things that only an assistant can go through and mark
 * correctly."
 *
 * The facts are the Pipeline row's own: the stage bar (`buildPipelineStageBar`,
 * a stage is ticked ✓ when its draw is paid), the paid share (the row's money
 * model, payments ÷ the bid) and `jobs_ledger.pct_complete`. Four cases are
 * kept, in this order:
 *
 *   paid-in-full       every dollar paid, the % under 100 → suggest 100.
 *   nothing-done       a stage ticked (or money paid), the % 0 or none → suggest
 *                      the ticked stages' share, else the paid share (job 879).
 *   behind-the-stages  the ticked stages' share above the % by more than 5
 *                      points → suggest the ticked share (job 892).
 *   behind-the-money   no ticked stage; the paid share above the % by more than
 *                      10 points → suggest the paid share.
 *
 * A Deposit stage or line never counts as work: a deposit ticked with 0% done is
 * a job that has not started, and its money is left out of the paid share.
 *
 * Dropped, and why: a % ahead of the ticked stages, or a % with no stage
 * ticked, is a bill that is behind, not a percent that is wrong, and the
 * Pipeline's amber "draw ready to bill" already says it; a job past its last
 * scheduled day says where the crew was, not whether the job is finished, and
 * the row's hollow tick already marks a percent older than the last day worked.
 *
 * Cards order newest money first: the job with the most recent payment is the
 * one whose facts changed last. Pure; the hook builds the Pipeline models and
 * reads the snoozes.
 */
import { stageShortLabel } from '../jobs/pipelineStageBar'
import type { ProgressPaymentView } from '../jobs/progressPaymentCell'
import type { StagesMoneyBarModel } from '../stagesMoneyBar'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'

export const PERCENT_COMPLETE_SNOOZE_KIND = 'percent-complete'
export const PERCENT_COMPLETE_SNOOZE_DAYS = 7
/** The ticked stages' share may run this many points over the % before the job is flagged. */
export const STAGES_TOLERANCE_POINTS = 5
/** The paid share may run this many points over the % before the job is flagged. */
export const MONEY_TOLERANCE_POINTS = 10

export type PercentCaseKind = 'paid-in-full' | 'nothing-done' | 'behind-the-stages' | 'behind-the-money'
export type PercentSuggestedFrom = 'stages' | 'paid'

export type PercentTick = { number: number; name: string; short: string; sharePct: number }

/** The facts one card is judged on, read off the Pipeline row's models. */
export type PercentCompleteFacts = {
  /** jobs_ledger.pct_complete; null when the job has no % yet. */
  pct: number | null
  /** Payments ÷ the bid, 0–100, with a paid Deposit left out; null when the job has no bid. */
  paidShare: number | null
  /** The stages ticked ✓ on the bar (draw paid), Deposit stages left out, in stage order. */
  ticked: PercentTick[]
  /** The ticked stages' shares summed and rounded, 0–100. */
  tickedShare: number
}

export type PercentCompleteJobInput = {
  id: string
  /** The number the card shows — `effectiveJobLedgerNumber(hcp_number, click_number)`. */
  jobNumber: string
  jobName: string | null
  status: string | null
  pct: number | null
  money: StagesMoneyBarModel
  view: ProgressPaymentView
  /** The newest payment's day (YYYY-MM-DD), for the order; null when nothing is paid. */
  newestPaidOn: string | null
}

export type PercentCompleteCard = {
  jobId: string
  /** The snooze row's key: the job id. */
  itemKey: string
  jobNumber: string
  jobName: string
  /** "879 · Hunter Homes, lot 12". */
  label: string
  kind: PercentCaseKind
  /** What disagrees, in plain words: "Rough is ticked and 40% is paid, but the job says 0% done." */
  sentence: string
  /** The same words for the job's activity after the save: "…but the job said 0% done." */
  noteWords: string
  pct: number | null
  paidShare: number | null
  ticked: PercentTick[]
  suggestedPct: number
  suggestedFrom: PercentSuggestedFrom
  /** "the ticked stages' share" / "the paid share" / "paid in full". */
  suggestedWords: string
  newestPaidOn: string | null
  /** The row's view, so the card draws the stage bar exactly as the Pipeline does. */
  view: ProgressPaymentView
  /** The numbers one press away on the card's slider (v2.5805): each stage's end, the paid share. */
  stops: PercentStop[]
}

export type PercentStopKind = 'stage' | 'paid'

/** A stop on the card's slider: the end of a stage, or the paid share when it is not one. */
export type PercentStop = {
  pct: number
  kind: PercentStopKind
  /** "Rough ✓" (a ticked stage) · "Top Out" · "Paid". */
  label: string
  /** The chip: "Rough ✓ 40%". */
  words: string
}

const isDeposit = (name: string | null | undefined): boolean => stageShortLabel(name ?? '') === 'Deposit'
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** True for the jobs the Pipeline still shows as open: anything not paid. */
export function isOpenJobStatus(status: string | null | undefined): boolean {
  return (status ?? 'working') !== 'paid'
}

/**
 * The facts from the row's models. The paid share is the money model's, less
 * what a Deposit stage or line took (its own money channel says how much of it
 * is paid); the ticks are the stage bar's done segments, Deposit left out.
 */
export function percentCompleteFacts(input: { pct: number | null; money: StagesMoneyBarModel; view: ProgressPaymentView }): PercentCompleteFacts {
  const pct = input.pct != null && Number.isFinite(Number(input.pct)) ? clampPct(Number(input.pct)) : null
  let paidShare: number | null = null
  if (input.money.hasBar) {
    let depositPaid = 0
    for (const seg of input.view.segments) if (isDeposit(seg.name)) depositPaid += (seg.sharePct / 100) * (seg.money.paidFrac ?? 0) * 100
    paidShare = clampPct(input.money.paidFrac * 100 - depositPaid)
  }
  const ticked: PercentTick[] = tickedStages(input.view)
  const tickedShare = clampPct(ticked.reduce((s, t) => s + t.sharePct, 0))
  return { pct, paidShare, ticked, tickedShare }
}

/**
 * A stage's share is the bar's own (v2.5805): the row's view segment at the same index, the
 * share the Pipeline's tick walks (`tickLeftPct`), so a ticked stage's share puts the tick
 * exactly at the end of its block. Before v2.5805 it was the stage's price over the bid: the
 * same number when the bid equals the stage prices' sum, and on a discounted bid or a job with
 * a plain line beside its stages a number that landed the suggestion short of or past the
 * stage's block. The stage bar's own share is the fallback.
 */
function stageShare(view: ProgressPaymentView, i: number, fallback: number): number {
  const seg = view.segments[i]
  return seg && seg.sharePct > 0 ? seg.sharePct : fallback
}

/** The bar's done segments, Deposit left out, each with the bar's own share. */
function tickedStages(view: ProgressPaymentView): PercentTick[] {
  const bar = view.stageBar
  if (!bar) return []
  const out: PercentTick[] = []
  bar.segments.forEach((s, i) => {
    if (s.state === 'done' && !isDeposit(s.name)) out.push({ number: s.number, name: s.name, short: s.short, sharePct: stageShare(view, i, s.sharePct) })
  })
  return out
}

/** "Rough" / "Rough and Top Out" / "Ground, Rough and Top Out" / "4 stages". */
export function tickedWords(ticked: ReadonlyArray<PercentTick>): string {
  const names = ticked.map((t) => t.short)
  if (names.length === 0) return 'no stage'
  if (names.length > 3) return `${names.length} stages`
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The slider's stops (v2.5805, punch list #154): the end of every stage, Deposit left out, on
 * the bar's own share (the same the ticks use, so each stop sits exactly at its block's end),
 * each a running total rounded as the % box would hold it; then the
 * paid share, when it is not already a stage's end. Sorted along the bar. A lines job has no
 * stages, so its only stop is the paid share. The card's suggestion is always one of them.
 */
export function percentStops(input: { view: ProgressPaymentView; paidShare: number | null }): PercentStop[] {
  const stops: PercentStop[] = []
  let cum = 0
  ;(input.view.stageBar?.segments ?? []).forEach((s, i) => {
    if (isDeposit(s.name)) return
    cum += stageShare(input.view, i, s.sharePct)
    const pct = clampPct(cum)
    if (stops.some((x) => x.pct === pct)) return
    const label = `${s.short}${s.state === 'done' ? ' ✓' : ''}`
    stops.push({ pct, kind: 'stage', label, words: `${label} ${pct}%` })
  })
  if (input.paidShare != null && input.paidShare > 0 && !stops.some((x) => x.pct === input.paidShare)) {
    stops.push({ pct: input.paidShare, kind: 'paid', label: 'Paid', words: `Paid ${input.paidShare}%` })
  }
  return stops.sort((a, b) => a.pct - b.pct)
}

/** A knob let go this close to a stop lands on it. */
export const PERCENT_SNAP_POINTS = 2

/**
 * Where a knob lands when it is let go (v2.5805): the nearest stop when one is within
 * `within` points, else the number itself. Only on release, never during a drag or on a key
 * press, so the knob never fights the hand and the arrow keys still step by one past a stop.
 */
export function snapPercentToStops(pct: number, stops: ReadonlyArray<number>, within: number = PERCENT_SNAP_POINTS): number {
  let best: number | null = null
  for (const stop of stops) {
    const d = Math.abs(stop - pct)
    if (d <= within && (best == null || d < Math.abs(best - pct))) best = stop
  }
  return best ?? pct
}

/**
 * The line that reads the move before Save writes it (v2.5805): "0% → 57%" with "▲ 57", or
 * "40% · no change" when the knob sits where the job already is. A job with no % yet reads
 * "No % → 40%", and every number is a move for it.
 */
export function percentMove(pct: number | null, draft: number): { from: string; to: string; delta: string | null; tone: 'up' | 'down' | 'none'; same: boolean } {
  const to = `${draft}%`
  if (pct == null) return { from: 'No %', to, delta: null, tone: 'up', same: false }
  const d = draft - pct
  if (d === 0) return { from: `${pct}%`, to, delta: null, tone: 'none', same: true }
  return { from: `${pct}%`, to, delta: d > 0 ? `▲ ${d}` : `▼ ${-d}`, tone: d > 0 ? 'up' : 'down', same: false }
}

export type PercentCase = {
  kind: PercentCaseKind
  suggestedPct: number
  suggestedFrom: PercentSuggestedFrom
  suggestedWords: string
  sentence: string
  noteWords: string
}

/** Null when the facts agree with the % (or say nothing). */
export function percentCompleteCase(f: PercentCompleteFacts): PercentCase | null {
  const pct = f.pct ?? 0
  const says = (tense: 'says' | 'said') => (f.pct == null ? (tense === 'says' ? 'the job has no % yet' : 'the job had no % yet') : `the job ${tense} ${f.pct}% done`)
  const words = (head: string): { sentence: string; noteWords: string } => ({ sentence: `${head}, but ${says('says')}.`, noteWords: `${head}, but ${says('said')}.` })

  if (f.paidShare != null && f.paidShare >= 100 && pct < 100) {
    return { kind: 'paid-in-full', suggestedPct: 100, suggestedFrom: 'paid', suggestedWords: 'paid in full', ...words('The bid is paid in full') }
  }
  if (f.tickedShare > 0) {
    const verb = f.ticked.length === 1 ? 'is' : 'are'
    const paid = f.paidShare != null && f.paidShare > 0 ? ` and ${f.paidShare}% is paid` : ''
    const head = `${tickedWords(f.ticked)} ${verb} ticked${paid}`
    const suggestion = { suggestedPct: f.tickedShare, suggestedFrom: 'stages' as const, suggestedWords: "the ticked stages' share" }
    if (pct <= 0) return { kind: 'nothing-done', ...suggestion, ...words(head) }
    if (pct < f.tickedShare - STAGES_TOLERANCE_POINTS) return { kind: 'behind-the-stages', ...suggestion, ...words(head) }
    return null
  }
  if (f.paidShare != null && f.paidShare >= MONEY_TOLERANCE_POINTS) {
    const head = `${f.paidShare}% of the bid is paid`
    const suggestion = { suggestedPct: f.paidShare, suggestedFrom: 'paid' as const, suggestedWords: 'the paid share' }
    if (pct <= 0) return { kind: 'nothing-done', ...suggestion, ...words(head) }
    if (pct < f.paidShare - MONEY_TOLERANCE_POINTS) return { kind: 'behind-the-money', ...suggestion, ...words(head) }
  }
  return null
}

/** The card for one open job, or null when its facts agree. */
export function percentCompleteCard(job: PercentCompleteJobInput): PercentCompleteCard | null {
  if (!isOpenJobStatus(job.status)) return null
  const facts = percentCompleteFacts(job)
  const c = percentCompleteCase(facts)
  if (!c) return null
  const jobName = (job.jobName ?? '').trim() || 'Job'
  return {
    jobId: job.id,
    itemKey: job.id,
    jobNumber: job.jobNumber || '—',
    jobName,
    label: `${job.jobNumber || '—'} · ${jobName}`,
    kind: c.kind,
    sentence: c.sentence,
    noteWords: c.noteWords,
    pct: facts.pct,
    paidShare: facts.paidShare,
    ticked: facts.ticked,
    suggestedPct: c.suggestedPct,
    suggestedFrom: c.suggestedFrom,
    suggestedWords: c.suggestedWords,
    newestPaidOn: job.newestPaidOn,
    view: job.view,
    stops: percentStops({ view: job.view, paidShare: facts.paidShare }),
  }
}

export type PercentCompleteList = {
  /** The cards to work, newest money first. */
  cards: PercentCompleteCard[]
  /** Cards hidden by a live dismissal. */
  snoozedCount: number
  /** The header's count. */
  count: number
  /** The header's line. */
  line: string
}

export const PERCENT_COMPLETE_ALL_AGREE_LINE = 'All agree. Every open job’s % done matches its stages and its money.'

/** True while the snooze holds: `until` is after `now`. */
export function snoozeHolds(untilIso: string | null | undefined, nowIso: string): boolean {
  if (!untilIso) return false
  const until = Date.parse(untilIso)
  const now = Date.parse(nowIso)
  return Number.isFinite(until) && Number.isFinite(now) && until > now
}

/** When a dismissal pressed at `nowIso` ends: one week on. */
export function snoozeUntilIso(nowIso: string): string {
  return new Date(Date.parse(nowIso) + PERCENT_COMPLETE_SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

const byNewestMoney = (a: PercentCompleteCard, b: PercentCompleteCard): number => {
  if (a.newestPaidOn !== b.newestPaidOn) {
    if (!a.newestPaidOn) return 1
    if (!b.newestPaidOn) return -1
    return b.newestPaidOn.localeCompare(a.newestPaidOn)
  }
  return b.jobNumber.localeCompare(a.jobNumber, undefined, { numeric: true })
}

/**
 * The section's list: every open job's card, the snoozed ones held back,
 * newest money first. `snoozedUntilByKey` is the office's live dismissals.
 */
export function percentCompleteList(jobs: ReadonlyArray<PercentCompleteJobInput>, snoozedUntilByKey: ReadonlyMap<string, string>, nowIso: string): PercentCompleteList {
  const cards: PercentCompleteCard[] = []
  let snoozedCount = 0
  for (const job of jobs) {
    const card = percentCompleteCard(job)
    if (!card) continue
    if (snoozeHolds(snoozedUntilByKey.get(card.itemKey), nowIso)) {
      snoozedCount += 1
      continue
    }
    cards.push(card)
  }
  cards.sort(byNewestMoney)
  const n = cards.length
  const line = n === 0 ? PERCENT_COMPLETE_ALL_AGREE_LINE : `${n} open ${n === 1 ? 'job' : 'jobs'} where the stages or the money disagree with the % done.`
  return { cards, snoozedCount, count: n, line }
}

/** The thread note the save posts, in the same shape the Pipeline's box writes: "40% complete — …". */
export function percentCompleteNoteBody(pct: number, card: Pick<PercentCompleteCard, 'noteWords'>): string {
  return `${pct}% complete — ${card.noteWords} Set in Quickfill.`
}

/** The green line after a save: "879 set to 40%. Was 0%." */
export function percentSavedWords(card: Pick<PercentCompleteCard, 'jobNumber' | 'pct'>, pct: number): string {
  const was = card.pct == null ? 'Had no % before.' : `Was ${card.pct}%.`
  return `${card.jobNumber} set to ${pct}%. ${was}`
}

/** The muted line after a dismissal: "879 dismissed until Oct 30." */
export function percentDismissedWords(card: Pick<PercentCompleteCard, 'jobNumber'>, untilIso: string): string {
  const day = Number.isFinite(Date.parse(untilIso)) ? formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(untilIso)) : 'next week'
  return `${card.jobNumber} dismissed until ${day}.`
}

/** A typed percent, or null when the box does not hold a whole number from 0 to 100. */
export function parsePercentInput(text: string): number | null {
  const t = text.trim().replace(/%$/, '')
  if (!/^\d{1,3}$/.test(t)) return null
  const n = Number(t)
  return n >= 0 && n <= 100 ? n : null
}
