/**
 * The team scores on the wire (punch list #360, PR 4): what the edge function `team-scores` answers and how the
 * Scores tab reads it back. The read is the browser loader's own shape (`ScorecardRead`); its one map travels as
 * pairs. Also the function's two small rules: which windows it takes, and who it answers.
 *
 * Pure: no React, no supabase. The function reads it from the kernel copy; the tab from here.
 */
import type { FieldOwner } from './fieldScore'
import type { EstimatorScore } from './estimatorScore'
import type { EstimatorScoresRead, ScorecardRead } from './scorecardReads'

export const TEAM_SCORES_FUNCTION = 'team-scores'

/** The windows the tab offers. The function refuses any other, so nobody can ask it for a five-year scan. */
export const TEAM_SCORES_WINDOW_DAYS: readonly number[] = [28, 56, 90]

export function teamScoresWindowDays(raw: unknown): number | null {
  const n = Number(raw)
  return TEAM_SCORES_WINDOW_DAYS.includes(n) ? n : null
}

/**
 * Who the function answers in full: the scoreboard's gate (`canSeeScoreboardTab`), read on the server: a dev, the
 * owner, or anyone with payroll access. The scores carry no person's wage, but they carry every job's labor dollars.
 */
export function mayReadTeamScores(args: { role: string | null | undefined; payrollAccess: boolean }): boolean {
  return args.role === 'dev' || args.role === 'master_technician' || args.payrollAccess
}

export type ScorecardWire = Omit<ScorecardRead, 'ownersByJob'> & { ownersByJob: Array<[string, FieldOwner[]]> }

export function scorecardToWire(read: ScorecardRead): ScorecardWire {
  return { ...read, ownersByJob: [...read.ownersByJob.entries()] }
}

/** The read back from the wire; null when the answer is not a scorecard (an old function, a proxy's error page). */
export function scorecardFromWire(raw: unknown): ScorecardRead | null {
  if (raw == null || typeof raw !== 'object') return null
  const w = raw as Partial<ScorecardWire>
  if (typeof w.fromYmd !== 'string' || typeof w.toYmd !== 'string' || typeof w.windowDays !== 'number') return null
  if (w.field == null || w.estimator == null || w.hurdle == null || w.setting == null) return null
  const pairs = Array.isArray(w.ownersByJob) ? w.ownersByJob.filter((p): p is [string, FieldOwner[]] => Array.isArray(p) && typeof p[0] === 'string' && Array.isArray(p[1])) : []
  return { ...(w as ScorecardWire), ownersByJob: new Map(pairs) }
}

/** Where the scores were read, said on the tab under The hurdle. */
export const SCORES_SOURCE_WORDS = {
  server: 'Read on the server. The hours and the dollars come to this page; nobody’s wage does.',
  browser: 'Read in this browser, as before: the server’s read is not switched on yet.',
} as const

// ---------- the estimating score alone (punch list #360, PR 5) ----------

/**
 * What the caller asks for. `full` is the Scores tab's read. `bids` is the estimating score alone, everyone's, for
 * the Bid Board's closeout chips. `mine` is one person's own row: the bids they estimated or manage.
 */
export type TeamScoresView = 'full' | 'bids' | 'mine'

export function teamScoresView(raw: unknown): TeamScoresView {
  return raw === 'bids' || raw === 'mine' ? raw : 'full'
}

/** `full` and `bids` are the scoreboard's gate; `mine` is anyone's, since it answers with their own bids alone. */
export function teamScoresViewAllowed(view: TeamScoresView, gate: boolean): boolean {
  return view === 'mine' || gate
}

/**
 * The estimating score on the wire. The hurdle travels as its one figure and the target: an estimator prices against
 * the hurdle, so they are told it, but not the overhead dollars and the hours it was divided from.
 */
export type EstimatorScoresWire = {
  view: 'bids' | 'mine'
  fromYmd: string
  toYmd: string
  todayYmd: string
  windowDays: number
  hurdlePerHourUsd: number | null
  targetProfitPerHourUsd: number
  estimator: EstimatorScore
  actualsUnread: number
}

export function estimatorScoresToWire(read: EstimatorScoresRead, view: 'bids' | 'mine'): EstimatorScoresWire {
  return { view, fromYmd: read.fromYmd, toYmd: read.toYmd, todayYmd: read.todayYmd, windowDays: read.windowDays, hurdlePerHourUsd: read.hurdle.hurdlePerHourUsd, targetProfitPerHourUsd: read.hurdle.targetProfitPerHourUsd, estimator: read.estimator, actualsUnread: read.actualsUnread }
}

export function estimatorScoresFromWire(raw: unknown): EstimatorScoresWire | null {
  if (raw == null || typeof raw !== 'object') return null
  const w = raw as Partial<EstimatorScoresWire>
  if ((w.view !== 'bids' && w.view !== 'mine') || typeof w.fromYmd !== 'string' || typeof w.windowDays !== 'number') return null
  const e = w.estimator as Partial<EstimatorScore> | null | undefined
  if (!e || !Array.isArray(e.awarded) || !Array.isArray(e.closeouts) || !Array.isArray(e.toFinish) || !Array.isArray(e.waiting) || !Array.isArray(e.underHurdle) || e.coverage == null) return null
  return w as EstimatorScoresWire
}
