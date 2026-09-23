/**
 * The one line per job on the phone Pipeline (punch list #30, PR 2a). Nothing on the board
 * computed this before: "no bid value", "set % done", "quiet N d", "no contract", "draw 2
 * ready" each came from a different chip on a 600 px card. This kernel takes the readings
 * those chips already make and picks ONE — first match wins, in the order the owner took on
 * 2026-09-23 — plus the grey line under the name (the next block and crew, then one fact).
 * Pure: every input is a value another kernel produced.
 */
import type { ProgressPaymentView } from './progressPaymentCell'
import { crewClause } from './progressPaymentCell'
import type { StagesMoneyBarModel } from '../stagesMoneyBar'
import type { StagesBillSentPctAlert } from './stagesBillSentPctAlert'
import type { ExpectedPayModel } from './billedExpectedPay'
import { jobContractChipLabel, type JobContractCoverage } from './jobContractCoverage'
import type { JobCrewPosition } from './jobCrewPosition'
import { formatStagesCompactWindow, formatStagesNextDateLabel, type StagesUpcomingAppointment } from '../stagesUpcomingSchedule'
import { jobFollowupQuietSeverity } from './jobFollowupQueue'
import { formatTimeSince } from './jobFormatting'

export type JobNextStage = 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'collections'
export type JobNextTone = 'red' | 'amber' | 'green'
/** What a tap on the chip opens; the list maps each to a door it already has. */
export type JobNextChipAction = 'no-bid' | 'pct' | 'notes' | 'bill-row' | 'contract' | 'bill-stage' | 'advance'

export type JobNextChip = { label: string; tone: JobNextTone; action: JobNextChipAction; title: string }

export type JobNextLine = {
  /** The grey line under the name: the next block and crew, then one fact. Never empty. */
  line: string
  /** The one chip, or none when nothing is next or wrong. */
  chip: JobNextChip | null
  /** "Needs me" — the chip is red or amber. */
  needsMe: boolean
  /** "Today" — a block today, or someone on site today. */
  today: boolean
}

export type JobNextLineInput = {
  stage: JobNextStage
  view: ProgressPaymentView
  money: StagesMoneyBarModel
  billSentAlert: StagesBillSentPctAlert | null
  /** Days quiet from the follow-up queue; null = not in the queue. */
  quietDays: number | null
  /** Billed / Collections rows only. */
  expectedPay: ExpectedPayModel | null
  /** undefined = the viewer cannot see contracts (no chip, no fact). */
  contract: JobContractCoverage | null | undefined
  upcoming: StagesUpcomingAppointment | null
  crew: JobCrewPosition | null
  /** The billing clause as finished words — "billed 2 days ago" / "paid today" (v2.3792); null = none. */
  billDisplay: string | null
  createdAt: string | null
  todayYmd: string
  now?: Date
}

/** "24 minutes" → "24 min", "3 days" → "3 d", "2 hours" → "2 h" — the row has one line. */
export function abbreviateTimeSince(text: string): string {
  return text
    .replace(/\bminutes?\b/, 'min')
    .replace(/\bhours?\b/, 'h')
    .replace(/\bdays?\b/, 'd')
    .replace(/\bweeks?\b/, 'w')
    .replace(/\bmonths?\b/, 'mo')
    .replace(/\byears?\b/, 'y')
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function pickJobNextChip(input: JobNextLineInput): JobNextChip | null {
  const { view, money: bar, billSentAlert, quietDays, expectedPay, contract, stage } = input
  if (view.mode === 'nobid') {
    return { label: 'no bid value', tone: 'red', action: 'no-bid', title: 'No line items on the job — nothing to bill against. Tap to add them.' }
  }
  if (billSentAlert) {
    return { label: 'set % done', tone: 'red', action: 'pct', title: billSentAlert.title }
  }
  if (quietDays != null) {
    const sev = jobFollowupQuietSeverity(quietDays)
    return {
      label: `quiet ${quietDays} d`,
      tone: sev === 'red' ? 'red' : 'amber',
      action: 'notes',
      title: `Nothing on this job for ${quietDays} day${quietDays === 1 ? '' : 's'} — no note, work, bill or status change. Tap to open it.`,
    }
  }
  if (expectedPay && expectedPay.state === 'late') {
    return { label: `${expectedPay.daysLate} d past expected`, tone: 'amber', action: 'bill-row', title: expectedPay.title }
  }
  if (contract && contract.kind === 'none') {
    return { label: 'no contract', tone: 'amber', action: 'contract', title: 'No agreement on file for this job. Tap to get one signed, or say one is not needed.' }
  }
  if (view.stageBar) {
    const m = /draw (\d+) ready/i.exec(view.stageBar.caption)
    if (m) {
      return { label: `draw ${m[1]} ready`, tone: 'green', action: 'bill-stage', title: view.stageBar.caption }
    }
  }
  if (stage === 'working' && (bar.doneNotBilled ?? 0) > 0) {
    return { label: `${money(bar.doneNotBilled ?? 0)} done, not billed`, tone: 'green', action: 'advance', title: 'Work is finished that is on no bill yet. Swipe right to move the job to Ready to bill.' }
  }
  return null
}

export function jobNextLine(input: JobNextLineInput): JobNextLine {
  const { upcoming, crew, contract, billDisplay, createdAt, todayYmd } = input
  const now = input.now ?? new Date()
  const parts: string[] = []
  if (upcoming) {
    const who = upcoming.assigneeNames.length ? ` · ${upcoming.assigneeNames.join(', ')}` : ''
    parts.push(`NEXT ${formatStagesNextDateLabel(upcoming.ymd)} ${formatStagesCompactWindow(upcoming.timeStart, upcoming.timeEnd)}${who}`)
  } else if (crew && (crew.lastWorkYmd || crew.sheet)) {
    // Only when there is a crew to speak of — "nobody clocked in" on a Waiting job is noise.
    parts.push(crewClause(crew, todayYmd, { names: true }))
  }
  if (contract && contract.kind === 'signed') {
    parts.push(jobContractChipLabel(contract, now))
  } else if (billDisplay) {
    // The caller's finished words — "billed 2 days ago" / "paid today" (v2.3792; was "bill T+2 (mon)").
    parts.push(billDisplay)
  } else if (createdAt) {
    parts.push(`open ${abbreviateTimeSince(formatTimeSince(createdAt, now))}`)
  }
  const chip = pickJobNextChip(input)
  return {
    line: parts.slice(0, 2).join(' · ') || '—',
    chip,
    needsMe: chip != null && chip.tone !== 'green',
    today: upcoming?.ymd === todayYmd || !!crew?.onSiteToday,
  }
}

export type PhoneRowFilter = 'all' | 'needs' | 'today'

export function phoneRowPasses(next: JobNextLine, filter: PhoneRowFilter): boolean {
  if (filter === 'needs') return next.needsMe
  if (filter === 'today') return next.today
  return true
}

/**
 * The line on top of the confirmation when a swipe advances a job: the move, then the money,
 * the agreement and the schedule it leaves in place — the consequence written out (owner's
 * rule: no live status button on a touch screen; the gesture always confirms).
 */
export function advanceConsequence(
  stage: JobNextStage,
  input: Pick<JobNextLineInput, 'money' | 'contract' | 'upcoming'>,
): string {
  const move: Record<JobNextStage, string> = {
    waiting: 'Waiting → Working',
    working: 'Working → Ready to bill',
    ready_to_bill: 'Ready to bill → Billed',
    billed: 'Billed → Paid',
    collections: 'Collections → Paid',
  }
  const parts = [move[stage]]
  const bar = input.money
  if (stage === 'working' && bar.hasBar) {
    const capable = bar.doneNotBilled ?? 0
    parts.push(capable > 0 ? `${money(capable)} capable` : `${money(bar.total)} on the job, nothing done yet`)
  } else if ((stage === 'billed' || stage === 'collections') && bar.billedUnpaid > 0) {
    parts.push(`${money(bar.billedUnpaid)} open`)
  }
  if (input.contract && input.contract.kind === 'signed') parts.push(jobContractChipLabel(input.contract))
  else if (input.contract && input.contract.kind === 'none') parts.push('no contract on file')
  if (input.upcoming) {
    const who = input.upcoming.assigneeNames[0]
    parts.push(`${who ? `${who}'s` : 'the'} block ${formatStagesNextDateLabel(input.upcoming.ymd)} stays on the schedule`)
  }
  return parts.join(' · ')
}
