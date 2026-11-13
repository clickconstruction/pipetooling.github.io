/**
 * Cutoffs coming (punch list #323, PR 5): the calendar of cutoffs for the Payment forecast.
 *
 * For every payer on a Pay calendar with work not yet billed: the next day a bill must be in
 * by, the day that makes it due, the dollars ready to send and the dollars still to bill on
 * jobs being worked. A bill in one day past the cutoff waits a whole month, so this is the
 * list that says what to get out, and by when. Pure: the caller hands in each ready bill and
 * each working job with its payer and its dollars.
 */
import { calendarSourceFor, nextCutoff, payCalendarMonthDay, payCalendarShort, PAY_CUTOFF_SOON_DAYS, type PayCalendarIndex } from './payCalendar'

/** One thing not yet billed: a bill waiting in Ready to Bill, or a job still being worked. */
export type CutoffWork = {
  payerId: string | null
  payerName: string | null
  jobId: string
  /** The job in a few words, its number or its name (punch list #341): a line that is one job's own calendar names it. */
  jobLabel?: string | null
  /** A ready bill's amount, or what is left to bill on a working job. */
  dollars: number
}

export type CutoffComing = {
  /** Stable key: the payer, the cutoff and the due day, and the job when the calendar is that job's own. */
  key: string
  /** The one job this line is for, when its calendar is the job's own and not the payer's (punch list #341); null on a payer's line. */
  ownJob: { id: string; label: string } | null
  payerId: string
  payerName: string
  cutoffYmd: string
  dueYmd: string
  nextDueYmd: string
  daysLeft: number
  /** Inside the cutoff's last week. */
  soon: boolean
  /** "Larkfield Construction · in by Nov 30, due Dec 10" */
  title: string
  /** "1 bill ready, $14,200. 3 jobs working, $38,000 still to bill." */
  detail: string
  /** The calendar in a few words, for the hover. */
  calendarShort: string
  ready: { count: number; dollars: number }
  working: { count: number; dollars: number }
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`
const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * The cutoffs ahead, nearest first, for payers that have work not yet billed. A payer with a
 * calendar and nothing ready or working is left out: there is nothing to get in by its cutoff.
 */
export function buildCutoffsComing(args: { todayYmd: string; calendars: PayCalendarIndex | null | undefined; ready: ReadonlyArray<CutoffWork>; working: ReadonlyArray<CutoffWork> }): CutoffComing[] {
  const { todayYmd, calendars } = args
  if (!calendars) return []
  const byKey = new Map<string, CutoffComing>()
  const add = (w: CutoffWork, kind: 'ready' | 'working') => {
    if (!w.payerId) return
    const read = calendarSourceFor(calendars, { payerId: w.payerId, jobId: w.jobId })
    const calendar = read.calendar
    const cut = calendar ? nextCutoff(todayYmd, calendar) : null
    if (!calendar || !cut) return
    // A job on its own calendar gets a line to itself, even when its days match the payer's: the line names the job.
    const ownJob = read.from === 'job' ? { id: w.jobId, label: (w.jobLabel ?? '').trim() || 'one job' } : null
    const key = `${w.payerId}|${cut.cutoffYmd}|${cut.dueYmd}${ownJob ? `|${ownJob.id}` : ''}`
    let line = byKey.get(key)
    if (!line) {
      line = {
        key,
        payerId: w.payerId,
        payerName: (w.payerName ?? '').trim() || 'A customer',
        ownJob,
        cutoffYmd: cut.cutoffYmd,
        dueYmd: cut.dueYmd,
        nextDueYmd: cut.nextDueYmd,
        daysLeft: cut.daysLeft,
        soon: cut.daysLeft <= PAY_CUTOFF_SOON_DAYS,
        title: '',
        detail: '',
        calendarShort: payCalendarShort(calendar),
        ready: { count: 0, dollars: 0 },
        working: { count: 0, dollars: 0 },
      }
      byKey.set(key, line)
    }
    line[kind].count += 1
    line[kind].dollars += Number.isFinite(w.dollars) && w.dollars > 0 ? w.dollars : 0
  }
  for (const w of args.ready) add(w, 'ready')
  for (const w of args.working) add(w, 'working')
  const out = [...byKey.values()]
  for (const line of out) {
    line.title = `${line.payerName}${line.ownJob ? ` · ${line.ownJob.label} only` : ''} · in by ${payCalendarMonthDay(line.cutoffYmd)}, due ${payCalendarMonthDay(line.dueYmd)}`
    const parts: string[] = []
    // A ready bill with no price yet has no dollars to say: the count alone, as with a working job.
    if (line.ready.count > 0) parts.push(`${counted(line.ready.count, 'bill', 'bills')} ready${line.ready.dollars > 0 ? `, ${usd(line.ready.dollars)}` : ''}.`)
    if (line.working.count > 0) parts.push(`${counted(line.working.count, 'job', 'jobs')} working${line.working.dollars > 0 ? `, ${usd(line.working.dollars)} still to bill` : ''}.`)
    line.detail = parts.join(' ')
  }
  return out.sort((a, b) => (a.cutoffYmd !== b.cutoffYmd ? (a.cutoffYmd < b.cutoffYmd ? -1 : 1) : a.payerName.localeCompare(b.payerName)))
}
