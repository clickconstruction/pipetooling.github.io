import { calendarYmdInAppTzFromIso, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { buildEvenSortModeSplit, type SortModeSplitLine } from './sortModeSplit'

/**
 * Where each card charge on a person's day probably goes, and why (punch list #72, PR 1).
 *
 * A person's day is the unit: the office sorts days, not rows. For one holder-day the kernel
 * returns the day's chips in a fixed order and capped, each charge's best suggestion and its
 * own (category, store), and the even and by-hours splits on a day with several clocked jobs.
 * Every suggestion is data: a stable rule id, the rule's one confidence, and the facts behind it
 * (hours, store, count, category, days). `tallySuggestionWords.ts` is the one place that turns
 * the facts into words, so the office queue and the holder's phone say the same sentence.
 *
 * Confidence is a measured level, not a screen decision. `sure` would let a whole day go in one
 * press; `likely` is the best guess, right about three times in four; `none` is offered only.
 * Whether a likely chip arrives selected is the screen's call.
 *
 * ## Rule set v1, measured
 *
 * Replayed 2026-10-05 over 90 days of sorted card charges (839 charges in 500 sorting visits):
 * each day rebuilt as it stood when it was sorted, the history only what was sorted before it.
 *
 * | Rule | Level | n | Right | Precision | Where the misses went |
 * |---|---|---|---|---|---|
 * | `clock-one-job` (a field job) | likely | 370 | 268 | 72% | 42 split, 16 Office, 16 a job clocked the day before or after, 15 a job scheduled that day, 13 another job |
 * | `schedule-one-job` | likely | 30 | 22 | 73% | 5 another job, 2 Office, 1 a job clocked nearby |
 * | `clock-one-job-mixed` | likely | 9 | 9 | n too small | none |
 * | `office-category` (3 categories) | likely | 16 | 14 | n too small | 2 to jobs |
 * | `clock-office`, as if it were likely | none | 103 | 45 | 44% | 54 to jobs, 4 split |
 *
 * Nothing is `sure` in v1. A rule earns it at 95% or better on 40 or more charges, measured
 * the same way. Two limits sit beside every number: the truth is one sorter's final choice
 * (one person sorted 98.6% of the 839), so a precision is agreement with that sorter, not
 * correctness; and clock sessions are read as stored today, after any later corrections, not
 * as the sorter saw them. Both make `sure` harder to earn. Rules built from the sorter's own
 * past sorts (the store runs, the day's sorted charges) can only echo the sorter's habits, so
 * they stay offered whatever they score.
 *
 * The day's chips held the answer for 640 of the 839 at the cap of 5: 647 uncapped, 612 without
 * the scheduled-but-not-clocked and neighbouring-day chips, 625 at a cap of 4, 643 at 6. The
 * median day shows 4 chips; a day never shows more than the cap.
 *
 * What the data overruled in the to-do and the drawing, each measured on the same replay:
 * - The only job clocked that day is a guess, not an answer. On a day clocked only on Office it
 *   is 44%: office staff buy for jobs. So that day gets `clock-office`, offered only.
 * - A store's run does not beat the clock. Against a clocked job it was right 2 times in 12.
 *   Store rules are offered on the line, never chosen. Fuel gets none: it follows the job.
 * - Of the six office-type Mercury categories, only Advertising, Insurance and Internet and
 *   telephone went to Office (14 of 16). Software and Utilities mostly went to jobs.
 * - The splits the office made across a day's clocked jobs were even 35 times and by hours
 *   0 times. Even leads; by hours stays the last chip.
 * - The holder's previous charge went to the same job 32% of the time (232 of 729): no rule.
 * - Saturday's neighbours are Friday and Monday, so the reach is 3 days, not 1.
 *
 * Pure: no Supabase, no React. Days are company days (`calendarYmdInAppTzFromIso`), the
 * calendar `clock_sessions.work_date` uses, so an evening charge keeps its day. Amounts are
 * SIGNED dollars as Mercury stores them (a purchase is negative); every split is whole cents
 * summing to the charge, in the `SortModeSplitLine` shape the Sort modal and both split RPCs take.
 */

/** Bump when a rule's meaning or level changes, so a measured precision names the rule set it measured. */
export const TALLY_SUGGESTION_RULES_VERSION = 1

/** How far back the holder's charges at a store count. */
export const TALLY_STORE_LOOKBACK_DAYS = 30
/** A run of this many charges at one store, all to one job, is a streak. */
export const TALLY_STORE_STREAK = 3
/** How far each side of a day with no work the nearest worked day is looked for. */
export const TALLY_NEIGHBOUR_REACH_DAYS = 3
/** At most this many chips on a day; the rest are behind "Another job…". */
export const TALLY_DAY_CHIP_CAP = 5
/** Mercury's category for fuel: it follows the day's job, never the store's last job. */
export const TALLY_FUEL_CATEGORY = 'FuelAndGas'
/**
 * The Mercury categories that went to Office in practice: a measured subset of People → Review's
 * `OFFICE_LIKE_MERCURY_CATEGORIES`. Software, Utilities, Education and Medical are office-type
 * by that list, but the office sorted most of them to jobs.
 */
export const TALLY_OFFICE_CATEGORIES: readonly string[] = ['Advertising', 'Insurance', 'InternetAndTelephone']

export type TallyConfidence = 'sure' | 'likely' | 'none'

export type TallyRuleId =
  /** Line: Mercury's category is one that goes to Office. */
  | 'office-category'
  /** Line: the holder's last 3+ charges at this store went wholly to one job. */
  | 'store-streak'
  /** Line: the holder's last 1–2 charges at this store went wholly to one job. */
  | 'store-last'
  /** Day: the only job clocked that day, a field job, and no other clocked time. */
  | 'clock-one-job'
  /** Day: the only job clocked that day, plus time on a bid or with no job. */
  | 'clock-one-job-mixed'
  /** Day: the only job clocked that day is Office. */
  | 'clock-office'
  /** Day: one of two or more jobs clocked that day. */
  | 'clock-job'
  /** Day: split evenly across the jobs clocked that day. */
  | 'split-even'
  /** Day: split across the jobs clocked that day by their clocked hours. */
  | 'split-by-hours'
  /** Day: nothing clocked; the only job scheduled that day. */
  | 'schedule-one-job'
  /** Day: a job on the holder's schedule that day (several scheduled, or scheduled but not clocked). */
  | 'schedule-job'
  /** Day: where the holder's charges already sorted that day went. */
  | 'same-day-sorted'
  /** Day: a job worked the day before or after, or the nearest worked day each side of an empty day. */
  | 'neighbour-day'
  /** Day: Office. */
  | 'office'

/** Each rule's one level. A rule moves level only with a new rules version and a new measurement. */
export const TALLY_RULE_CONFIDENCE: Readonly<Record<TallyRuleId, TallyConfidence>> = {
  'office-category': 'likely',
  'store-streak': 'none',
  'store-last': 'none',
  'clock-one-job': 'likely',
  'clock-one-job-mixed': 'likely',
  'clock-office': 'none',
  'clock-job': 'none',
  'split-even': 'none',
  'split-by-hours': 'none',
  'schedule-one-job': 'likely',
  'schedule-job': 'none',
  'same-day-sorted': 'none',
  'neighbour-day': 'none',
  office: 'none',
}

/** One unsorted card charge (the staff RPC's row, or the holder's own). */
export type TallyCharge = {
  id: string
  /** The card holder (`mercury_debit_card_user_links.user_id`). */
  holderId: string
  postedAt: string
  /** Signed dollars as stored (a purchase is negative). */
  amount: number
  counterparty: string
  /** Mercury's category (`raw.mercuryCategory`, e.g. `FuelAndGas`), or null. */
  category: string | null
}

/** One of the holder's charges that already has its job split. */
export type TallySortedCharge = {
  id: string
  postedAt: string
  counterparty: string
  splits: ReadonlyArray<{ jobId: string; amount: number }>
}

/** One of the holder's clock sessions (not rejected, not revoked). */
export type TallyClockSession = {
  /** `clock_sessions.work_date`, a company day. */
  workDate: string
  /** Null for time on a bid or with no job. */
  jobId: string | null
  clockedInAt: string
  clockedOutAt: string | null
}

/** One job on the holder's schedule (`job_schedule_blocks`). */
export type TallyScheduledJob = {
  workDate: string
  jobId: string
}

export type TallyDayInput = {
  holderId: string
  /** The company day (`tallyDayKey` of the charges' posted time). */
  ymd: string
  /** The day's unsorted charges. */
  charges: readonly TallyCharge[]
  /** The holder's sessions from `ymd` − 3 to `ymd` + 3. */
  sessions: readonly TallyClockSession[]
  /** The holder's scheduled jobs from `ymd` − 3 to `ymd` + 3, in schedule order. */
  scheduled: readonly TallyScheduledJob[]
  /** The holder's sorted charges from `ymd` − 30 through `ymd`; later ones are ignored. */
  history: readonly TallySortedCharge[]
  /** `overhead_office_job_ledger_id_v1`; null turns off the Office rules and chip. */
  officeJobId: string | null
  /** Open sessions on today's date count hours up to now. */
  nowMs: number
  /** Chips kept on the day; defaults to `TALLY_DAY_CHIP_CAP`. */
  chipCap?: number
}

export type TallyChoice =
  | { kind: 'job'; jobId: string }
  | { kind: 'split'; how: 'even' | 'hours'; jobIds: string[] }

/** The facts behind a suggestion; `tallySuggestionWords.ts` turns them into words. */
export type TallyFacts = {
  /** Clocked hours, one per job of the choice; null where a session is still open on a past day. */
  hours?: Array<number | null>
  /** The store as the charge names it. */
  store?: string
  /** How many of the holder's latest charges at the store went to the job. */
  count?: number
  /** Mercury's category. */
  category?: string
  /** The company days the job was worked. */
  days?: string[]
  /** When the day's already-sorted charges that went to the job were posted, newest first. */
  postedAt?: string[]
}

export type TallySuggestion = {
  choice: TallyChoice
  rule: TallyRuleId
  confidence: TallyConfidence
  facts: TallyFacts
}

export type TallyLineSuggestion = {
  chargeId: string
  amount: number
  /** The line's strongest suggestion at `likely` or above: its own, else the day's. */
  best: TallySuggestion | null
  /** The line's own suggestions (category, store), strongest first. */
  own: TallySuggestion[]
  /** On a day with two or more clocked jobs: the charge split evenly, in clock order. */
  even: SortModeSplitLine[] | null
  /** On a day with two or more clocked jobs that all have hours: the charge split by hours. */
  byHours: SortModeSplitLine[] | null
}

export type TallyClockedJob = {
  jobId: string
  /** Clocked hours that day; null when a session is still open on a past day. */
  hours: number | null
}

export type TallyDaySuggestion = {
  holderId: string
  ymd: string
  /** The day's chips in the fixed order, at most the cap; each job appears once. */
  chips: TallySuggestion[]
  /** The first chip when it is `likely` or above. */
  best: TallySuggestion | null
  /** One per charge, in posted order. */
  lines: TallyLineSuggestion[]
  /** Every line's best is `sure`: the day could go in one press. Never true in rule set v1. */
  allSure: boolean
  /** The jobs clocked that day in clock-in order, with their hours. */
  clockedJobs: TallyClockedJob[]
}

export type TallyChargeDay<T> = {
  holderId: string
  ymd: string
  /** The day's charges in posted order. */
  charges: T[]
}

const HOUR_MS = 3_600_000

function suggestion(choice: TallyChoice, rule: TallyRuleId, facts: TallyFacts = {}): TallySuggestion {
  return { choice, rule, confidence: TALLY_RULE_CONFIDENCE[rule], facts }
}

function jobChoice(jobId: string): TallyChoice {
  return { kind: 'job', jobId }
}

function byPostedAt(a: { postedAt: string }, b: { postedAt: string }): number {
  return Date.parse(a.postedAt) - Date.parse(b.postedAt)
}

/** The company day a charge belongs to, or null for an unreadable time. */
export function tallyDayKey(postedAt: string): string | null {
  return calendarYmdInAppTzFromIso(postedAt) || null
}

/**
 * A store's name reduced so the same store matches itself: "The Pipe Depot #6542" and
 * "PIPE DEPOT" are both `pipedepot`. Empty for no name (no store rule).
 */
export function tallyStoreKey(counterparty: string | null | undefined): string {
  return (counterparty ?? '')
    .toLowerCase()
    .replace(/^\s*the\s+/, '')
    .replace(/#\s*\d+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/(\s+\d+)+$/, '')
    .replace(/\s+/g, '')
}

/**
 * Group charges into person-days: one group per holder per company day, newest day first,
 * then by holder; each day's charges in posted order. Unreadable times are left out.
 */
export function groupTallyChargesByDay<T extends { holderId: string; postedAt: string }>(
  charges: readonly T[],
): TallyChargeDay<T>[] {
  const byKey = new Map<string, TallyChargeDay<T>>()
  for (const c of charges) {
    const ymd = tallyDayKey(c.postedAt)
    if (!ymd) continue
    const key = `${c.holderId}|${ymd}`
    const day = byKey.get(key)
    if (day) day.charges.push(c)
    else byKey.set(key, { holderId: c.holderId, ymd, charges: [c] })
  }
  const days = [...byKey.values()]
  for (const d of days) d.charges.sort(byPostedAt)
  return days.sort((a, b) =>
    a.ymd !== b.ymd ? (a.ymd < b.ymd ? 1 : -1) : a.holderId < b.holderId ? -1 : a.holderId > b.holderId ? 1 : 0,
  )
}

/**
 * Split a signed amount across jobs by their hours, in whole cents summing to the amount exactly
 * (largest remainder; a tie goes to the earlier job). Null when any job has no positive hours.
 */
export function splitTallyAmountByHours(
  amount: number,
  jobs: ReadonlyArray<{ jobId: string; hours: number }>,
): SortModeSplitLine[] | null {
  if (jobs.length === 0 || !Number.isFinite(amount)) return null
  if (jobs.some((j) => !Number.isFinite(j.hours) || j.hours <= 0)) return null
  const sign = amount < 0 ? -1 : 1
  const cents = Math.round(Math.abs(amount) * 100)
  // Whole seconds as integer weights, so the shares and remainders are exact integer math.
  const weights = jobs.map((j) => Math.max(1, Math.round(j.hours * 3600)))
  const total = weights.reduce((s, w) => s + w, 0)
  const shares = weights.map((w) => {
    const n = cents * w
    const q = Math.floor(n / total)
    return { q, r: n - q * total }
  })
  let left = cents - shares.reduce((s, x) => s + x.q, 0)
  const order = shares.map((x, i) => ({ i, r: x.r })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const o of order) {
    if (left <= 0) break
    shares[o.i]!.q += 1
    left -= 1
  }
  return jobs.map((j, i) => ({ jobId: j.jobId, amount: (sign * shares[i]!.q) / 100 }))
}

/** The split rows to write for a line under a choice; null when that split cannot be made. */
export function tallyRowsForChoice(line: TallyLineSuggestion, choice: TallyChoice): SortModeSplitLine[] | null {
  if (choice.kind === 'job') return [{ jobId: choice.jobId, amount: line.amount }]
  return choice.how === 'even' ? line.even : line.byHours
}

/** A sorted charge counts as history when some of it went to a job. */
function hasJobSplit(c: TallySortedCharge): boolean {
  return c.splits.some((s) => s.amount !== 0 && Boolean(s.jobId))
}

/** The one job a sorted charge went to, or null when it was split across jobs. */
function wholeJobOf(c: TallySortedCharge): string | null {
  const jobs = new Set(c.splits.filter((s) => s.amount !== 0).map((s) => s.jobId))
  return jobs.size === 1 ? [...jobs][0]! : null
}

function clockDay(
  sessions: readonly TallyClockSession[],
  ymd: string,
  todayYmd: string,
  nowMs: number,
): { jobs: TallyClockedJob[]; otherTime: boolean } {
  const byJob = new Map<string, { firstIn: number; hours: number | null }>()
  let otherTime = false
  for (const s of sessions) {
    if (s.workDate !== ymd) continue
    if (!s.jobId) {
      otherTime = true
      continue
    }
    const inMs = Date.parse(s.clockedInAt)
    // A session still open counts to now on today; on a past day its hours are unknown.
    const outMs = s.clockedOutAt ? Date.parse(s.clockedOutAt) : s.workDate === todayYmd ? nowMs : Number.NaN
    const hours = Number.isFinite(inMs) && Number.isFinite(outMs) ? Math.max(0, (outMs - inMs) / HOUR_MS) : null
    const firstIn = Number.isFinite(inMs) ? inMs : Number.POSITIVE_INFINITY
    const cur = byJob.get(s.jobId)
    if (!cur) byJob.set(s.jobId, { firstIn, hours })
    else {
      cur.firstIn = Math.min(cur.firstIn, firstIn)
      cur.hours = cur.hours == null || hours == null ? null : cur.hours + hours
    }
  }
  const jobs = [...byJob.entries()]
    .sort((a, b) => a[1].firstIn - b[1].firstIn || (a[0] < b[0] ? -1 : 1))
    .map(([jobId, v]) => ({ jobId, hours: v.hours }))
  return { jobs, otherTime }
}

function clockedJobsOn(sessions: readonly TallyClockSession[], ymd: string): string[] {
  return [...new Set(sessions.filter((s) => s.workDate === ymd && s.jobId).map((s) => s.jobId!))]
}

function scheduledJobsOn(scheduled: readonly TallyScheduledJob[], ymd: string): string[] {
  return [...new Set(scheduled.filter((s) => s.workDate === ymd).map((s) => s.jobId))]
}

/** The holder's run at a store: how many of the latest charges there went wholly to the same job. */
function storeRun(history: readonly TallySortedCharge[], storeKey: string): { jobId: string; count: number } | null {
  if (!storeKey) return null
  let jobId: string | null = null
  let count = 0
  for (const h of history) {
    if (tallyStoreKey(h.counterparty) !== storeKey) continue
    const j = wholeJobOf(h)
    if (jobId == null) {
      if (j == null) return null
      jobId = j
      count = 1
    } else if (j === jobId) count += 1
    else break
  }
  return jobId == null ? null : { jobId, count }
}

/**
 * The day's chips and each charge's suggestions for one holder-day.
 *
 * Chip order, fixed: the day's likely chip; the jobs clocked that day; the even split; the jobs
 * scheduled but not clocked; the jobs worked on the neighbouring days; where the day's sorted
 * charges went; Office; the split by hours. A job appears once, at its first place. The cap cuts
 * the tail, which stays behind "Another job…".
 */
export function suggestTallyDay(input: TallyDayInput): TallyDaySuggestion {
  const { holderId, ymd, officeJobId, nowMs } = input
  const todayYmd = todayYmdInAppTz(new Date(nowMs))
  const charges = [...input.charges].sort(byPostedAt)
  const chargeIds = new Set(charges.map((c) => c.id))

  const clock = clockDay(input.sessions, ymd, todayYmd, nowMs)
  const clockedIds = clock.jobs.map((j) => j.jobId)
  const scheduledToday = scheduledJobsOn(input.scheduled, ymd)

  // The holder's sorted charges in the lookback, newest first; nothing after the day.
  const since = ymdAddDays(ymd, -TALLY_STORE_LOOKBACK_DAYS)
  const history = input.history
    .filter((h) => {
      if (chargeIds.has(h.id) || !hasJobSplit(h)) return false
      const d = tallyDayKey(h.postedAt)
      return d != null && d >= since && d <= ymd
    })
    .sort((a, b) => byPostedAt(b, a))

  const ordered: TallySuggestion[] = []
  const offered = new Set<string>()
  const add = (s: TallySuggestion) => {
    if (s.choice.kind === 'job') {
      if (offered.has(s.choice.jobId)) return
      offered.add(s.choice.jobId)
    }
    ordered.push(s)
  }

  // 1. The day's likely chip.
  const only = clock.jobs.length === 1 ? clock.jobs[0]! : null
  if (only && only.jobId !== officeJobId) {
    add(suggestion(jobChoice(only.jobId), clock.otherTime ? 'clock-one-job-mixed' : 'clock-one-job', { hours: [only.hours] }))
  } else if (clock.jobs.length === 0 && scheduledToday.length === 1) {
    add(suggestion(jobChoice(scheduledToday[0]!), 'schedule-one-job'))
  }

  // 2. The jobs clocked that day.
  for (const j of clock.jobs) {
    add(suggestion(jobChoice(j.jobId), only && j.jobId === officeJobId ? 'clock-office' : 'clock-job', { hours: [j.hours] }))
  }

  // 3. The even split across the clocked jobs (by hours comes last: the office never used it).
  if (clock.jobs.length > 1) add(suggestion({ kind: 'split', how: 'even', jobIds: clockedIds }, 'split-even'))

  // 4. The jobs scheduled that day.
  for (const jobId of scheduledToday) add(suggestion(jobChoice(jobId), 'schedule-job'))

  // 5. The neighbouring days: the day before and after a worked day, or the nearest worked day
  //    each side of an empty one (a Saturday reaches Friday and Monday).
  const neighbourDays = new Map<string, string[]>()
  const noteDay = (jobId: string, day: string) => {
    const list = neighbourDays.get(jobId)
    if (list) list.push(day)
    else neighbourDays.set(jobId, [day])
  }
  if (clock.jobs.length === 0 && scheduledToday.length === 0) {
    for (const step of [-1, 1]) {
      for (let k = 1; k <= TALLY_NEIGHBOUR_REACH_DAYS; k++) {
        const d = ymdAddDays(ymd, step * k)
        const clocked = clockedJobsOn(input.sessions, d)
        const jobs = clocked.length > 0 ? clocked : scheduledJobsOn(input.scheduled, d)
        if (jobs.length === 0) continue
        for (const jobId of jobs) noteDay(jobId, d)
        break
      }
    }
  } else {
    for (const d of [ymdAddDays(ymd, -1), ymdAddDays(ymd, 1)]) {
      for (const jobId of clockedJobsOn(input.sessions, d)) noteDay(jobId, d)
    }
  }
  for (const [jobId, days] of neighbourDays) add(suggestion(jobChoice(jobId), 'neighbour-day', { days }))

  // 6. Where the day's already-sorted charges went.
  const sortedToday = new Map<string, string[]>()
  for (const h of history) {
    if (tallyDayKey(h.postedAt) !== ymd) continue
    const j = wholeJobOf(h)
    if (!j) continue
    const list = sortedToday.get(j)
    if (list) list.push(h.postedAt)
    else sortedToday.set(j, [h.postedAt])
  }
  for (const [jobId, postedAt] of sortedToday) add(suggestion(jobChoice(jobId), 'same-day-sorted', { postedAt }))

  // 7. Office.
  if (officeJobId) add(suggestion(jobChoice(officeJobId), 'office'))

  // 8. The split by clocked hours.
  if (clock.jobs.length > 1 && clock.jobs.every((j) => j.hours != null && j.hours > 0)) {
    add(
      suggestion({ kind: 'split', how: 'hours', jobIds: clockedIds }, 'split-by-hours', {
        hours: clock.jobs.map((j) => j.hours),
      }),
    )
  }

  const chips = ordered.slice(0, Math.max(1, input.chipCap ?? TALLY_DAY_CHIP_CAP))
  const best = chips[0] && chips[0].confidence !== 'none' ? chips[0] : null

  const multi = clock.jobs.length > 1
  const lines: TallyLineSuggestion[] = charges.map((c) => {
    const own: TallySuggestion[] = []
    if (officeJobId && c.category && TALLY_OFFICE_CATEGORIES.includes(c.category)) {
      own.push(suggestion(jobChoice(officeJobId), 'office-category', { category: c.category }))
    }
    if (c.category !== TALLY_FUEL_CATEGORY) {
      const run = storeRun(history, tallyStoreKey(c.counterparty))
      if (run && !own.some((o) => o.choice.kind === 'job' && o.choice.jobId === run.jobId)) {
        own.push(
          suggestion(jobChoice(run.jobId), run.count >= TALLY_STORE_STREAK ? 'store-streak' : 'store-last', {
            store: c.counterparty.trim(),
            count: run.count,
          }),
        )
      }
    }
    return {
      chargeId: c.id,
      amount: c.amount,
      best: own.find((o) => o.confidence !== 'none') ?? best,
      own,
      even: multi ? buildEvenSortModeSplit(c.amount, clockedIds) : null,
      byHours: multi
        ? splitTallyAmountByHours(
            c.amount,
            clock.jobs.map((j) => ({ jobId: j.jobId, hours: j.hours ?? 0 })),
          )
        : null,
    }
  })

  return {
    holderId,
    ymd,
    chips,
    best,
    lines,
    allSure: lines.length > 0 && lines.every((l) => l.best?.confidence === 'sure'),
    clockedJobs: clock.jobs,
  }
}
