import type { Database } from '../../types/database'

/**
 * The Chapter 53 deadline clock (v2.2645, Lien Instruments phase 4).
 *
 * Legal frame (verified against the post-HB 2237 statute):
 * - § 53.056(a-1): a SUB's notice of claim is due by the 15th day of the 2nd
 *   (residential) / 3rd (non-residential) month after each month labor or
 *   materials were provided. Original contractors send no monthly notice.
 * - § 53.052: the lien affidavit files by the 15th day of the 3rd (res) / 4th
 *   (non-res) month after the last month of the claimant's work.
 * - § 53.055: a copy of the filed affidavit is served by the 5th CALENDAR day
 *   after filing.
 * - § 53.003: a deadline on a Saturday/Sunday/legal holiday rolls to the next
 *   business day (holidays are not modeled — a holiday 15th shows the earlier,
 *   safe date).
 *
 * Honest approximation, stated in the UI: the app does not track per-month
 * billing, so the clock keys on the job's LAST work month; the recorded
 * notice's `months_covered` is what the office attests it covers.
 */

export type JobLienFilingRow = Database['public']['Tables']['job_lien_filings']['Row']

function rollWeekend(d: Date): Date {
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

/** 15th of the Nth month after the furnishing month, weekend-rolled. */
export function statutoryFifteenth(furnishYmd: string, monthsAfter: number): string {
  const d = (furnishYmd ?? '').trim()
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(d)) return ''
  const base = new Date(d.slice(0, 7) + '-15T12:00:00')
  if (Number.isNaN(base.getTime())) return ''
  base.setMonth(base.getMonth() + monthsAfter)
  return rollWeekend(base).toISOString().slice(0, 10)
}

export function noticeDeadlineForMonth(furnishYmd: string, propertyKind: string): string {
  return statutoryFifteenth(furnishYmd, propertyKind === 'residential' ? 2 : 3)
}

export function filingDeadlineForMonth(furnishYmd: string, propertyKind: string): string {
  return statutoryFifteenth(furnishYmd, propertyKind === 'residential' ? 3 : 4)
}

/** 5th calendar day after filing (§ 53.055), weekend-rolled per § 53.003. */
export function serveDueForFiling(filedYmd: string): string {
  const d = (filedYmd ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ''
  const base = new Date(d + 'T12:00:00')
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + 5)
  return rollWeekend(base).toISOString().slice(0, 10)
}

export type JobLienClock = {
  /** 'YYYY-MM' the clock keys on (the job's last work month) — '' when unknown. */
  workMonth: string
  /** '' for original contractors (no monthly notice) or when unknown. */
  noticeDeadline: string
  filingDeadline: string
}

export function computeJobLienClock(params: {
  lastWorkYmd: string | null | undefined
  propertyKind: string
  isSub: boolean
}): JobLienClock {
  const d = (params.lastWorkYmd ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { workMonth: '', noticeDeadline: '', filingDeadline: '' }
  return {
    workMonth: d.slice(0, 7),
    noticeDeadline: params.isSub ? noticeDeadlineForMonth(d, params.propertyKind) : '',
    filingDeadline: filingDeadlineForMonth(d, params.propertyKind),
  }
}

// ---------- company-wide watch assessment ----------

export function liveFilings(rows: JobLienFilingRow[]): JobLienFilingRow[] {
  return rows.filter((r) => r.voided_at == null)
}

export type LienWatchJob = {
  id: string
  isSub: boolean
  lastWorkYmd: string | null
  openBalance: number
  propertyKind: string
}

export type LienWatchResult = {
  /** Sub jobs whose work-month notice window is open and closing, no notice recorded. */
  noticeDue: { jobId: string; deadline: string; openBalance: number }[]
  /** Noticed (or original-contractor) unpaid jobs whose filing window is closing. */
  filingDue: { jobId: string; deadline: string; openBalance: number }[]
  /** Filed affidavits not yet served — due (or overdue). */
  serveDue: { jobId: string; filingId: string; serveDue: string }[]
}

export const LIEN_WATCH_MIN_OPEN_BALANCE = 500
export const LIEN_NOTICE_WATCH_WINDOW_DAYS = 14
export const LIEN_FILING_WATCH_WINDOW_DAYS = 21

function ymdAddDays(ymd: string, days: number): string {
  const base = new Date(ymd + 'T12:00:00')
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

export function assessLienWatch(
  jobs: LienWatchJob[],
  filings: JobLienFilingRow[],
  todayYmd: string,
): LienWatchResult {
  const live = liveFilings(filings)
  const byJob = new Map<string, JobLienFilingRow[]>()
  for (const f of live) {
    const list = byJob.get(f.job_id)
    if (list) list.push(f)
    else byJob.set(f.job_id, [f])
  }
  const noticeDue: LienWatchResult['noticeDue'] = []
  const filingDue: LienWatchResult['filingDue'] = []
  for (const j of jobs) {
    if (j.openBalance < LIEN_WATCH_MIN_OPEN_BALANCE) continue
    const clock = computeJobLienClock({ lastWorkYmd: j.lastWorkYmd, propertyKind: j.propertyKind, isSub: j.isSub })
    if (!clock.workMonth) continue
    const jobFilings = byJob.get(j.id) ?? []
    const noticeCoveringMonth = jobFilings.some(
      (f) => f.kind === 'notice_53_056' && (f.months_covered ?? []).includes(clock.workMonth),
    )
    const anyAffidavit = jobFilings.some((f) => f.kind === 'affidavit')
    if (j.isSub && clock.noticeDeadline && !noticeCoveringMonth) {
      // Actionable while the window is open; a missed window is dropped (can't fix).
      if (todayYmd <= clock.noticeDeadline && clock.noticeDeadline <= ymdAddDays(todayYmd, LIEN_NOTICE_WATCH_WINDOW_DAYS)) {
        noticeDue.push({ jobId: j.id, deadline: clock.noticeDeadline, openBalance: j.openBalance })
      }
    }
    const noticeSatisfied = !j.isSub || noticeCoveringMonth
    if (noticeSatisfied && !anyAffidavit && clock.filingDeadline) {
      if (todayYmd <= clock.filingDeadline && clock.filingDeadline <= ymdAddDays(todayYmd, LIEN_FILING_WATCH_WINDOW_DAYS)) {
        filingDue.push({ jobId: j.id, deadline: clock.filingDeadline, openBalance: j.openBalance })
      }
    }
  }
  const serveDue: LienWatchResult['serveDue'] = []
  for (const f of live) {
    if (f.kind !== 'affidavit' || !f.filed_at || f.served_at || !f.serve_due) continue
    // Show from 3 days out and keep showing until served (missing service has remedies).
    if (f.serve_due <= ymdAddDays(todayYmd, 3)) {
      serveDue.push({ jobId: f.job_id, filingId: f.id, serveDue: f.serve_due })
    }
  }
  return { noticeDue, filingDue, serveDue }
}
