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
import type { PipelineStageBar } from '../jobs/pipelineStageBar'
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
  const ticked: PercentTick[] = tickedStages(input.view.stageBar, input.money.hasBar ? input.money.total : 0)
  const tickedShare = clampPct(ticked.reduce((s, t) => s + t.sharePct, 0))
  return { pct, paidShare, ticked, tickedShare }
}

/**
 * The bar's done segments, Deposit left out. A stage's share is its price over the whole
 * bid when the bid is known (a plain line beside the stages, a change order, keeps the
 * ticked stages honest); the bar's own share of the stage money otherwise.
 */
function tickedStages(bar: PipelineStageBar | null, bidTotal: number): PercentTick[] {
  if (!bar) return []
  return bar.segments
    .filter((s) => s.state === 'done' && !isDeposit(s.name))
    .map((s) => ({ number: s.number, name: s.name, short: s.short, sharePct: bidTotal > 0 ? (Math.max(0, s.amount) / bidTotal) * 100 : s.sharePct }))
}

/** "Rough" / "Rough and Top Out" / "Ground, Rough and Top Out" / "4 stages". */
export function tickedWords(ticked: ReadonlyArray<PercentTick>): string {
  const names = ticked.map((t) => t.short)
  if (names.length === 0) return 'no stage'
  if (names.length > 3) return `${names.length} stages`
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
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
