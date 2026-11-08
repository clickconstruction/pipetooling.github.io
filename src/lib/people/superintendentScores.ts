/**
 * The scoreboard (punch list #234, PR 4), on the owner's three calls of 2026-11-07: the office's
 * sign-off is the certified percent, the bonus is a share of the labor kept (hours saved, in dollars),
 * a stage a sub performs counts on the sub's sheet hours. `superintendent_scores` does the arithmetic
 * inside the database and lets out only what the caller may see; this kernel parses what comes back,
 * folds the rows into one line per superintendent for a period, and words them. Pure.
 */
import { ymdAddDays } from '../../utils/dateUtils'

export type ScoreRow = {
  userId: string
  userName: string
  jobId: string
  jobLabel: string
  status: string | null
  awardedKind: 'bid' | 'typed' | 'book' | null
  awardedAt: string | null
  plannedFinish: string | null
  awardedHours: number
  certifiedPct: number | null
  signedOn: string | null
  signedBy: string | null
  teamHours: number
  subHours: number
  /** Awarded hours × certified % − team − sub hours; null when the job is not scored. */
  hoursUnder: number | null
  scored: boolean
  signedInPeriod: boolean
  /** The dollars, only to payroll access. */
  earnedUsd: number | null
  actualUsd: number | null
  keptUsd: number | null
  /** The bonus: labor kept × the share, floored at zero; to payroll access and to the row's own superintendent. */
  bonusUsd: number | null
}

export type ScoreRead = { readsWages: boolean; sharePct: number; burden: number; fromYmd: string; toYmd: string; rows: ScoreRow[] }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const usd0 = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const h0 = (n: number): string => `${Math.round(Math.abs(n)).toLocaleString('en-US')} h`

export function jobLabelOf(r: { hcp_number?: unknown; click_number?: unknown; job_name?: unknown }): string {
  const hcp = str(r.hcp_number)?.trim()
  const click = str(r.click_number)?.trim()
  const name = str(r.job_name)?.trim()
  const number = hcp || (click ? `#${click}` : '')
  return [number, name].filter(Boolean).join(' ') || 'A project'
}

export function parseScoreRead(raw: unknown): ScoreRead {
  const o = obj(raw)
  const rows = Array.isArray(o.rows) ? o.rows : []
  return {
    readsWages: o.reads_wages === true,
    sharePct: num(o.share_pct) ?? 10,
    burden: num(o.burden) ?? 1.2,
    fromYmd: str(o.from) ?? '',
    toYmd: str(o.to) ?? '',
    rows: rows.flatMap((x) => {
      const r = obj(x)
      const userId = str(r.user_id)
      const jobId = str(r.job_id)
      if (!userId || !jobId) return []
      const kind = r.awarded_kind
      return [
        {
          userId,
          userName: str(r.user_name) ?? '',
          jobId,
          jobLabel: jobLabelOf(r),
          status: str(r.status),
          awardedKind: kind === 'bid' || kind === 'typed' || kind === 'book' ? kind : null,
          awardedAt: str(r.awarded_at),
          plannedFinish: str(r.planned_finish),
          awardedHours: num(r.awarded_hours) ?? 0,
          certifiedPct: num(r.certified_pct),
          signedOn: str(r.signed_on),
          signedBy: str(r.signed_by),
          teamHours: num(r.team_hours) ?? 0,
          subHours: num(r.sub_hours) ?? 0,
          hoursUnder: num(r.hours_under),
          scored: r.scored === true,
          signedInPeriod: r.signed_in_period === true,
          earnedUsd: num(r.earned_usd),
          actualUsd: num(r.actual_usd),
          keptUsd: num(r.kept_usd),
          bonusUsd: num(r.bonus_usd),
        } satisfies ScoreRow,
      ]
    }),
  }
}

/* ---------- the period ---------- */

/** A calendar month as the period (the owner's rule setting names it): `YYYY-MM`. */
export function monthOf(ymd: string): string {
  return ymd.slice(0, 7)
}
export function monthRange(month: string): { fromYmd: string; toYmd: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const next = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`
  return { fromYmd: from, toYmd: ymdAddDays(next, -1) }
}
export function monthWords(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export function monthShift(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/* ---------- one line per superintendent ---------- */

export type SuperintendentScore = {
  userId: string
  userName: string
  /** The jobs signed off in the period, scored. */
  jobs: ScoreRow[]
  /** The jobs that could not score, each with its reason. */
  held: Array<{ row: ScoreRow; why: string }>
  hoursUnder: number
  awardedHours: number
  usedHours: number
  keptUsd: number | null
  bonusUsd: number | null
  /** The days against the plan across the scored jobs, as the line reads them; null while nothing can be read. */
  daysVsPlan: number | null
  /** Why the days read nothing, when they read nothing: the scored jobs have no plan, or a plan waits on hours or a sign-off. */
  daysHold: DaysVsPlanHold | null
}

/** What stops a job's days from reading: no planned finish, no sign-off to pace from, or no hours in yet. */
export type DaysVsPlanHold = 'no-plan' | 'no-sign-off' | 'no-hours'

export function daysVsPlanHoldOf(r: ScoreRow): DaysVsPlanHold | null {
  if (!r.plannedFinish) return 'no-plan'
  if (r.certifiedPct == null || r.certifiedPct <= 0) return 'no-sign-off'
  if (r.teamHours + r.subHours <= 0) return 'no-hours'
  return null
}

/** The strongest reason first: a plan waiting on hours outranks a job with no plan at all. */
const HOLD_RANK: Record<DaysVsPlanHold, number> = { 'no-hours': 0, 'no-sign-off': 1, 'no-plan': 2 }

export function holdReason(r: ScoreRow): string | null {
  if (r.awardedKind === 'book') return "awarded on the book's hours, a guess; the score waits for a bid or typed baseline"
  if (r.awardedHours <= 0) return 'no hours on the award'
  if (r.certifiedPct == null) return 'no office sign-off on the percent yet'
  if (!r.signedInPeriod) return `signed off ${r.signedOn ? dayWords(r.signedOn) : 'outside this period'}, not in this period`
  return null
}

const dayWords = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * Days against the plan, read the line's way: the planned finish against the finish at this pace, where the pace is
 * the hours used over the percent done at the crew day. Positive = ahead. Null without a plan, a percent or hours.
 */
export function daysVsPlanOf(r: ScoreRow, todayYmd: string, crewHoursPerDay = 24): number | null {
  if (!r.plannedFinish || r.certifiedPct == null || r.certifiedPct <= 0) return null
  const used = r.teamHours + r.subHours
  if (used <= 0) return null
  const totalAtPace = used / (r.certifiedPct / 100)
  const leftHours = Math.max(0, totalAtPace - used)
  const leftCalendarDays = Math.ceil((leftHours / crewHoursPerDay) * (7 / 5))
  const finishAtPace = ymdAddDays(todayYmd, leftCalendarDays)
  return Math.round((Date.parse(`${r.plannedFinish}T12:00:00Z`) - Date.parse(`${finishAtPace}T12:00:00Z`)) / 86_400_000)
}

export function superintendentScores(read: ScoreRead, todayYmd: string): SuperintendentScore[] {
  const byUser = new Map<string, SuperintendentScore>()
  for (const r of read.rows) {
    const s = byUser.get(r.userId) ?? { userId: r.userId, userName: r.userName, jobs: [], held: [], hoursUnder: 0, awardedHours: 0, usedHours: 0, keptUsd: read.readsWages ? 0 : null, bonusUsd: null, daysVsPlan: null, daysHold: null }
    byUser.set(r.userId, s)
    const why = holdReason(r)
    if (why) {
      s.held.push({ row: r, why })
      continue
    }
    s.jobs.push(r)
    s.hoursUnder += r.hoursUnder ?? 0
    s.awardedHours += (r.awardedHours * (r.certifiedPct ?? 0)) / 100
    s.usedHours += r.teamHours + r.subHours
    if (read.readsWages && r.keptUsd != null) s.keptUsd = (s.keptUsd ?? 0) + r.keptUsd
    if (r.bonusUsd != null) s.bonusUsd = (s.bonusUsd ?? 0) + r.bonusUsd
    const d = daysVsPlanOf(r, todayYmd)
    if (d != null) s.daysVsPlan = (s.daysVsPlan ?? 0) + d
    else {
      const hold = daysVsPlanHoldOf(r)
      if (hold && (s.daysHold == null || HOLD_RANK[hold] < HOLD_RANK[s.daysHold])) s.daysHold = hold
    }
  }
  return [...byUser.values()].sort((a, b) => (b.bonusUsd ?? -1) - (a.bonusUsd ?? -1) || b.hoursUnder - a.hoursUnder || a.userName.localeCompare(b.userName))
}

/* ---------- words ---------- */

/** "42 h under the baseline" / "18 h over the baseline" / "on the baseline". */
export function hoursUnderWords(h: number): string {
  if (Math.round(h) === 0) return 'on the baseline'
  return `${h0(h)} ${h > 0 ? 'under' : 'over'} the baseline`
}

/** "3 days ahead of the plan" / "4 days behind the plan" / "on the plan"; '' with no plan. */
export function daysWords(d: number | null): string {
  if (d == null) return ''
  if (d === 0) return 'on the plan'
  return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ${d > 0 ? 'ahead of' : 'behind'} the plan`
}

/**
 * The Days column: the days when they read, else why they do not — "no plan", "waits on hours" (a plan with
 * nothing clocked yet; the second walk read *no plan* here), "waits on a sign-off"; "—" with nothing scored.
 */
export function daysColumnWords(s: Pick<SuperintendentScore, 'jobs' | 'daysVsPlan' | 'daysHold'>): string {
  if (s.jobs.length === 0) return '—'
  const words = daysWords(s.daysVsPlan)
  if (words) return words
  return s.daysHold === 'no-hours' ? 'waits on hours' : s.daysHold === 'no-sign-off' ? 'waits on a sign-off' : 'no plan'
}

/** "$2,130 kept" / "−$1,420, nothing owed back"; '' without payroll access. */
export function keptWords(kept: number | null): string {
  if (kept == null) return ''
  return kept >= 0 ? `${usd0(kept)} kept` : `−${usd0(kept)}, nothing owed back`
}

/** "Bonus $213 · 10% of the labor kept" / "$0 · nothing kept this period". */
export function bonusWords(bonus: number | null, sharePct: number): string {
  if (bonus == null) return ''
  return bonus > 0 ? `${usd0(bonus)} · ${sharePct}% of the labor kept` : '$0 · nothing kept this period'
}

/** One job's line: "J1042 Harbor Lane · 48% signed off Oct 30 by Taunya · 412 h of 516 h · 42 h under the baseline". */
export function jobScoreWords(r: ScoreRow): string {
  const pct = r.certifiedPct != null ? `${Math.round(r.certifiedPct)}% signed off${r.signedOn ? ` ${dayWords(r.signedOn)}` : ''}${r.signedBy ? ` by ${r.signedBy}` : ''}` : 'no sign-off yet'
  const hours = `${h0(r.teamHours + r.subHours)} of ${h0((r.awardedHours * (r.certifiedPct ?? 0)) / 100)} earned`
  return [r.jobLabel, pct, hours, r.hoursUnder != null ? hoursUnderWords(r.hoursUnder) : null].filter(Boolean).join(' · ')
}

/** The rule card's lines, the owner's three calls in order. */
export const SCORE_RULE_LINES: readonly string[] = [
  "Percent: the office's own sign-off on the job's percent. The crew's percent is provisional and never scores.",
  'Baseline: the hours and labor dollars frozen at award. Refresh from bid never moves the score.',
  "Hours: the team's clock hours at the burden factor, and a sub-performed stage on the sub's sheet hours.",
  'Kept: the labor budget earned at the signed-off percent minus the actual labor cost. The bonus is a share of it; a job over its baseline pays nothing and owes nothing back.',
  "Days: the planned finish frozen at award against the finish at this pace. Its own figure, never paid on.",
  "A project awarded on the book's hours is a guess and is not scored until a bid or typed baseline replaces it.",
]
