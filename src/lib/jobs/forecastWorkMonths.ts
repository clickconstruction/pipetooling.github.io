import { daysBetweenYmd } from './billedExpectedPay'
import { filingDeadlineForMonth, noticeDeadlineForMonth } from './lienDeadlines'

/**
 * Work months under a Payment forecast row (pure kernel).
 *
 * Texas Property Code ch. 53 counts from the MONTH labor was furnished, never
 * the invoice date: a sub job needs one § 53.056 notice per unpaid month
 * (15th of the 3rd month after; 2nd month residential), and one affidavit
 * from the LAST month worked (§ 53.052). The forecast is where the office
 * looks at the money, so this kernel turns a job's clock sessions into the
 * month-by-month evidence beside it: the weeks as bars (people + hours), the
 * month's totals, and that month's notice with its state. Only approved
 * sessions count toward the lien clock — pending hours are carried
 * separately so the UI can hatch them.
 */

export type WorkSessionInput = {
  jobId: string
  userId: string
  /** 'YYYY-MM-DD' (company calendar). */
  workDate: string
  clockedInAt: string
  clockedOutAt: string | null
  approved: boolean
}

export type WorkMonthJobContext = {
  jobId: string
  /** A GC is on the job — we are a derivative claimant with a monthly notice duty. */
  isSub: boolean
  /** `customer_addresses.property_kind` ('residential' shortens both clocks); '' when unknown. */
  propertyKind: string
  /** 'YYYY-MM' months already named by a live § 53.056 notice on the job. */
  noticedMonths: ReadonlySet<string>
}

export type WorkWeek = {
  /** Monday of the week, 'YYYY-MM-DD'. */
  start: string
  /** Whole days from the week's Monday to today. */
  daysSince: number
  /** Display names, deduped, in first-seen order. */
  people: string[]
  hours: number
  /** Hours from sessions not yet approved (a subset of `hours`). */
  pendingHours: number
  dayCount: number
}

export type NoticeState = 'sent' | 'closed' | 'due' | 'closing' | 'open'

export type MonthNotice = {
  /** Statutory deadline, weekend-rolled, 'YYYY-MM-DD'. */
  due: string
  /** Whole days from today to `due` (negative once past). */
  daysLeft: number
  state: NoticeState
}

export type WorkMonth = {
  /** 'YYYY-MM' */
  key: string
  /** 'Jun 2026' */
  label: string
  weeks: WorkWeek[]
  people: string[]
  hours: number
  pendingHours: number
  dayCount: number
  /** This month's share of the job's hours, 0–100 — a proxy for how much of the open balance the month represents. */
  hoursShare: number
  /** Null on direct-with-owner jobs (no monthly notice). */
  notice: MonthNotice | null
}

export type JobWorkMonths = {
  jobId: string
  role: 'sub' | 'direct'
  propertyKind: string
  /** Chronological, every month with a session. */
  months: WorkMonth[]
  totalHours: number
  sessionCount: number
  pendingSessions: number
  /** 'YYYY-MM' the affidavit clock keys on. */
  lastMonthKey: string
  /** § 53.052 affidavit deadline from the last month worked. */
  affidavitDue: string
}

export const NOTICE_DUE_DAYS = 7
export const NOTICE_CLOSING_DAYS = 14
/** Months shown before the panel folds the rest into "+ N earlier". */
export const WORK_MONTHS_SHOWN = 6

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export function workMonthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key)
  if (!m) return key
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

/** 'Jun' from 'YYYY-MM'. */
export function workMonthShort(key: string): string {
  const m = /^\d{4}-(\d{2})/.exec(key)
  return (m && MONTHS[Number(m[1]) - 1]) || key
}

function ymdToUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)
}

/** Monday of the week containing `ymd` (the crew's week; the forecast's own buckets stay Sunday-based). */
export function mondayOf(ymd: string): string {
  const ms = ymdToUtcMs(ymd)
  if (ms == null) return ymd
  const d = new Date(ms)
  const back = (d.getUTCDay() + 6) % 7
  return new Date(ms - back * 86_400_000).toISOString().slice(0, 10)
}

function sessionHours(s: WorkSessionInput): number {
  if (!s.clockedOutAt) return 0
  const a = Date.parse(s.clockedInAt)
  const b = Date.parse(s.clockedOutAt)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  return (b - a) / 3_600_000
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function noticeStateFor(daysLeft: number, sent: boolean): NoticeState {
  if (sent) return 'sent'
  if (daysLeft < 0) return 'closed'
  if (daysLeft <= NOTICE_DUE_DAYS) return 'due'
  if (daysLeft <= NOTICE_CLOSING_DAYS) return 'closing'
  return 'open'
}

/** "due tomorrow" / "due in 5d" / "closes in 12d" / "sent" / "window closed" — the chip words. */
export function noticeStateText(n: MonthNotice): string {
  switch (n.state) {
    case 'sent':
      return 'notice sent'
    case 'closed':
      return 'window closed'
    case 'due':
      if (n.daysLeft === 0) return 'due today'
      if (n.daysLeft === 1) return 'due tomorrow'
      return `due in ${n.daysLeft}d`
    case 'closing':
      return `closes in ${n.daysLeft}d`
    default:
      return ''
  }
}

/**
 * Group one job's sessions into months and Monday weeks. Returns null when
 * the job has no sessions (nothing to show, no chevron). `userNames` maps
 * user id → display name; unknown ids show as "Someone".
 */
export function buildJobWorkMonths(
  sessions: ReadonlyArray<WorkSessionInput>,
  ctx: WorkMonthJobContext,
  userNames: Readonly<Record<string, string>>,
  todayYmd: string,
): JobWorkMonths | null {
  const own = sessions.filter((s) => s.jobId === ctx.jobId && /^\d{4}-\d{2}-\d{2}/.test(s.workDate))
  if (own.length === 0) return null
  type Acc = { people: string[]; hours: number; pendingHours: number; days: Set<string>; weeks: Map<string, WorkWeek & { dayKeys: Set<string> }> }
  const byMonth = new Map<string, Acc>()
  let pendingSessions = 0
  for (const s of own) {
    const key = s.workDate.slice(0, 7)
    const acc: Acc = byMonth.get(key) ?? { people: [], hours: 0, pendingHours: 0, days: new Set(), weeks: new Map() }
    byMonth.set(key, acc)
    const name = (userNames[s.userId] ?? '').trim() || 'Someone'
    const h = sessionHours(s)
    if (!s.approved) pendingSessions++
    acc.hours += h
    if (!s.approved) acc.pendingHours += h
    acc.days.add(s.workDate.slice(0, 10))
    if (!acc.people.includes(name)) acc.people.push(name)
    const wk = mondayOf(s.workDate)
    const week = acc.weeks.get(wk) ?? { start: wk, daysSince: daysBetweenYmd(wk, todayYmd) ?? 0, people: [], hours: 0, pendingHours: 0, dayCount: 0, dayKeys: new Set<string>() }
    acc.weeks.set(wk, week)
    week.hours += h
    if (!s.approved) week.pendingHours += h
    week.dayKeys.add(s.workDate.slice(0, 10))
    if (!week.people.includes(name)) week.people.push(name)
  }
  const totalHours = [...byMonth.values()].reduce((s, m) => s + m.hours, 0)
  const keys = [...byMonth.keys()].sort()
  const months: WorkMonth[] = keys.map((key) => {
    const acc = byMonth.get(key)!
    const weeks: WorkWeek[] = [...acc.weeks.values()]
      .sort((a, b) => (a.start < b.start ? -1 : 1))
      .map((w) => ({ start: w.start, daysSince: w.daysSince, people: w.people, hours: round1(w.hours), pendingHours: round1(w.pendingHours), dayCount: w.dayKeys.size }))
    let notice: MonthNotice | null = null
    if (ctx.isSub) {
      const due = noticeDeadlineForMonth(key, ctx.propertyKind)
      const daysLeft = due ? daysBetweenYmd(todayYmd, due) ?? 0 : 0
      notice = due ? { due, daysLeft, state: noticeStateFor(daysLeft, ctx.noticedMonths.has(key)) } : null
    }
    return {
      key,
      label: workMonthLabel(key),
      weeks,
      people: acc.people,
      hours: round1(acc.hours),
      pendingHours: round1(acc.pendingHours),
      dayCount: acc.days.size,
      hoursShare: totalHours > 0 ? Math.round((100 * acc.hours) / totalHours) : 0,
      notice,
    }
  })
  const lastMonthKey = keys[keys.length - 1] ?? ''
  return {
    jobId: ctx.jobId,
    role: ctx.isSub ? 'sub' : 'direct',
    propertyKind: ctx.propertyKind,
    months,
    totalHours: round1(totalHours),
    sessionCount: own.length,
    pendingSessions,
    lastMonthKey,
    affidavitDue: lastMonthKey ? filingDeadlineForMonth(lastMonthKey, ctx.propertyKind) : '',
  }
}

/** Build every job's months from one sessions fetch. Jobs with no sessions are left out. */
export function buildWorkMonthsByJob(
  sessions: ReadonlyArray<WorkSessionInput>,
  contexts: ReadonlyArray<WorkMonthJobContext>,
  userNames: Readonly<Record<string, string>>,
  todayYmd: string,
): Record<string, JobWorkMonths> {
  const byJob = new Map<string, WorkSessionInput[]>()
  for (const s of sessions) {
    const list = byJob.get(s.jobId) ?? []
    list.push(s)
    byJob.set(s.jobId, list)
  }
  const out: Record<string, JobWorkMonths> = {}
  for (const ctx of contexts) {
    const built = buildJobWorkMonths(byJob.get(ctx.jobId) ?? [], ctx, userNames, todayYmd)
    if (built) out[ctx.jobId] = built
  }
  return out
}

/**
 * The month whose notice needs attention first (due or closing), for the
 * collapsed row's chip. Sent, closed and far-off months never surface.
 */
export function nearestOpenNotice(job: JobWorkMonths | null | undefined): { month: WorkMonth; notice: MonthNotice } | null {
  if (!job || job.role !== 'sub') return null
  let best: { month: WorkMonth; notice: MonthNotice } | null = null
  for (const m of job.months) {
    const n = m.notice
    if (!n || (n.state !== 'due' && n.state !== 'closing')) continue
    if (!best || n.due < best.notice.due) best = { month: m, notice: n }
  }
  return best
}

export type NoticeMonthsSummary = {
  monthCount: number
  jobCount: number
  /** Open dollars on the jobs concerned (from `openByJob`). */
  dollars: number
  /** The earliest one, for the line's example: "J650 June work, due tomorrow". */
  first: { jobId: string; month: WorkMonth; notice: MonthNotice } | null
}

/** Every due/closing month across the forecast, for the one quiet line above the buckets. */
export function summarizeNoticeMonths(
  byJob: Readonly<Record<string, JobWorkMonths>>,
  openByJob: Readonly<Record<string, number>>,
): NoticeMonthsSummary {
  let monthCount = 0
  const jobs = new Set<string>()
  let first: NoticeMonthsSummary['first'] = null
  for (const job of Object.values(byJob)) {
    if (job.role !== 'sub') continue
    for (const m of job.months) {
      const n = m.notice
      if (!n || (n.state !== 'due' && n.state !== 'closing')) continue
      monthCount++
      jobs.add(job.jobId)
      if (!first || n.due < first.notice.due) first = { jobId: job.jobId, month: m, notice: n }
    }
  }
  let dollars = 0
  for (const id of jobs) dollars += openByJob[id] ?? 0
  return { monthCount, jobCount: jobs.size, dollars, first }
}

/** First word of a display name — "Tristen" from "Tristen Vela" — for the tight people lists. */
export function firstName(name: string): string {
  const t = name.trim()
  if (!t) return t
  return t.split(/\s+/)[0] ?? t
}
