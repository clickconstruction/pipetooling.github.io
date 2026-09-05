import { dayNumberToYmd, mondayOfYmd, ymdToDayNumber } from './jobRunningTimeline'
import type { JobSummaryEnrichedRow } from './jobSummaryLedgerView'

/**
 * The Ahead view kernel (v2.2830): what's coming. Three sources already in the
 * app — open jobs carry remaining contract value (contract − earned), won bids
 * carry an estimated start date, and the schedule has field days booked ahead.
 * Expected true profit applies the window's margin (and the target) to what's
 * booked. Pure.
 */
export type AheadBid = {
  id: string
  bid_number: string | null
  project_name: string | null
  bid_value: number | null
  agreed_value: number | null
  estimated_job_start_date: string | null
  outcome: string | null
}

export type AheadScheduleBlock = { work_date: string; assignee_user_id: string; job_id: string | null; bid_id: string | null }

export type AheadWeek = {
  weekStartYmd: string
  /** Distinct (day, person) pairs on the schedule that week. */
  personDays: number
  jobsBooked: number
  /** Field days the roster could supply (crew × weekdays). */
  capacityDays: number
  /** Won bids whose estimated start falls in the week. */
  bidStarts: Array<{ id: string; label: string; valueUsd: number }>
}

export type AheadSeries = {
  openJobs: number
  remainingUsd: number
  wonNotStarted: number
  wonNotStartedUsd: number
  wonNoDate: number
  wonStartPassed: number
  backlogUsd: number
  /** Backlog ÷ the window's revenue per week; null without revenue. */
  backlogWeeks: number | null
  expectedTrueProfitUsd: number | null
  expectedAtTargetUsd: number | null
  weeks: AheadWeek[]
  bookedDaysNext4: number
  capacityDaysNext4: number
  notStarted: Array<{ id: string; label: string; valueUsd: number; startYmd: string | null }>
}

export const AHEAD_WEEKS = 8

export function bidValueUsd(b: Pick<AheadBid, 'bid_value' | 'agreed_value'>): number {
  return b.agreed_value ?? b.bid_value ?? 0
}

export function buildAheadSeries(args: {
  rows: readonly JobSummaryEnrichedRow[]
  bids: readonly AheadBid[]
  linkedBidIds: ReadonlySet<string>
  blocks: readonly AheadScheduleBlock[]
  todayYmd: string
  crewNow: number
  windowRevenueUsd: number
  windowDays: number
  trueMarginPct: number | null
  targetTrueMarginPct: number
}): AheadSeries {
  const { rows, bids, linkedBidIds, blocks, todayYmd, crewNow, windowRevenueUsd, windowDays, trueMarginPct, targetTrueMarginPct } = args
  // Open jobs: not finished, not billed/paid, with contract left to earn.
  let openJobs = 0
  let remainingUsd = 0
  for (const r of rows) {
    const status = r.row.job.status
    if (r.finished || status === 'billed' || status === 'paid' || !(r.contractUsd > 0)) continue
    const remaining = Math.max(0, r.contractUsd - r.revenueUsd)
    if (remaining <= 0) continue
    openJobs += 1
    remainingUsd += remaining
  }
  // Won bids with no job yet.
  const notStarted: AheadSeries['notStarted'] = []
  let wonNoDate = 0
  let wonStartPassed = 0
  for (const b of bids) {
    if ((b.outcome ?? '').trim().toLowerCase() !== 'won' || linkedBidIds.has(b.id)) continue
    const startYmd = b.estimated_job_start_date?.slice(0, 10) ?? null
    if (!startYmd) wonNoDate += 1
    else if (startYmd < todayYmd) wonStartPassed += 1
    notStarted.push({ id: b.id, label: `${b.bid_number ? `${b.bid_number} ` : ''}${(b.project_name ?? '').trim() || 'Untitled bid'}`, valueUsd: bidValueUsd(b), startYmd })
  }
  notStarted.sort((a, b) => (a.startYmd ?? '9999').localeCompare(b.startYmd ?? '9999') || b.valueUsd - a.valueUsd)
  const wonNotStartedUsd = notStarted.reduce((a, b) => a + b.valueUsd, 0)
  // Weeks ahead.
  const firstMonday = mondayOfYmd(todayYmd)
  const weeks: AheadWeek[] = []
  for (let i = 0; i < AHEAD_WEEKS; i++) {
    const weekStartYmd = dayNumberToYmd(ymdToDayNumber(firstMonday) + 7 * i)
    weeks.push({ weekStartYmd, personDays: 0, jobsBooked: 0, capacityDays: crewNow * 5, bidStarts: [] })
  }
  const weekIndex = (ymd: string) => Math.floor((ymdToDayNumber(ymd) - ymdToDayNumber(firstMonday)) / 7)
  const seenPersonDay = new Set<string>()
  const jobsByWeek = weeks.map(() => new Set<string>())
  for (const b of blocks) {
    const d = b.work_date.slice(0, 10)
    if (d < todayYmd) continue
    const i = weekIndex(d)
    if (i < 0 || i >= AHEAD_WEEKS) continue
    const key = `${d}|${b.assignee_user_id}`
    if (!seenPersonDay.has(key)) {
      seenPersonDay.add(key)
      weeks[i]!.personDays += 1
    }
    const jobKey = b.job_id ?? (b.bid_id ? `bid:${b.bid_id}` : null)
    if (jobKey) jobsByWeek[i]!.add(jobKey)
  }
  weeks.forEach((w, i) => {
    w.jobsBooked = jobsByWeek[i]!.size
  })
  for (const b of notStarted) {
    if (!b.startYmd) continue
    const i = weekIndex(b.startYmd)
    if (i >= 0 && i < AHEAD_WEEKS) weeks[i]!.bidStarts.push({ id: b.id, label: b.label, valueUsd: b.valueUsd })
  }
  const backlogUsd = remainingUsd + wonNotStartedUsd
  const revenuePerWeek = windowDays > 0 ? windowRevenueUsd / (windowDays / 7) : 0
  return {
    openJobs,
    remainingUsd,
    wonNotStarted: notStarted.length,
    wonNotStartedUsd,
    wonNoDate,
    wonStartPassed,
    backlogUsd,
    backlogWeeks: revenuePerWeek > 0 ? backlogUsd / revenuePerWeek : null,
    expectedTrueProfitUsd: trueMarginPct == null ? null : (backlogUsd * trueMarginPct) / 100,
    expectedAtTargetUsd: targetTrueMarginPct > 0 ? (backlogUsd * targetTrueMarginPct) / 100 : null,
    weeks,
    bookedDaysNext4: weeks.slice(0, 4).reduce((a, w) => a + w.personDays, 0),
    capacityDaysNext4: weeks.slice(0, 4).reduce((a, w) => a + w.capacityDays, 0),
    notStarted,
  }
}
