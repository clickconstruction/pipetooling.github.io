/**
 * The robot's envelope, opened at send (v2.3222).
 *
 * The seal exists so a robot's number never anchors ours. The trigger
 * `bids_score_shadow_on_send_trg` (v2.3126) scores a locked shadow the instant
 * a bid saves with BOTH bid_date_sent and bid_value — so from that save on, the
 * score is on the ledger and nothing the estimator sees can move it. That is
 * the moment to show the envelope: the bid is still in the estimator's head,
 * and judging "robot carried four roof drains we didn't" takes seconds now and
 * minutes a week later (audit throughput is the program's named bottleneck).
 *
 * This module decides WHEN the envelope may open and WHICH rows it leads with;
 * the modal does the rendering and the writes.
 *
 * Pure module — no React, no Supabase.
 */
import type { DiffEntry, TakeoffDiff, DiffBucketKey } from './takeoffDiff'
import { canWorkRobotAudits } from './bidAudits'

export interface EnvelopeBid {
  id: string
  bid_number: string | null
  estimator_id: string | null
  bid_date_sent: string | null
  bid_value: number | string | null
  /** v2.3234: the recorded best effort (bid_best_efforts.value) — the blind human number that opens the envelope before send. */
  best_effort_value?: number | string | null
}

export interface EnvelopeViewer {
  userId: string | null
  role: string | null
}

export type EnvelopeRefusal =
  | 'not-sent'
  | 'no-value'
  | 'no-record'
  | 'no-scored-run'
  | 'not-auditor'
  | 'not-estimator'
  | 'already-offered'

/**
 * May the envelope open for this viewer on this bid right now?
 *
 *  - the human number must be on record: a best effort (v2.3234, the earlier door)
 *    or a send WITH a value (what the trigger scores against otherwise)
 *  - a shadow run on the bid must be scored (never open on a sealed run)
 *  - the viewer must be in the robot-audit audience
 *  - the viewer is the bid's estimator (the teacher the trigger named) — or a dev,
 *    who runs the robots; anyone else gets the Dashboard nudge instead
 *  - once per bid per session: an autosave that touches the row again must not
 *    re-open a modal the person already closed
 */
export function envelopeRefusal(
  bid: EnvelopeBid,
  viewer: EnvelopeViewer,
  runStatus: string | null,
  offered: ReadonlySet<string>,
): EnvelopeRefusal | null {
  const best = Number(bid.best_effort_value)
  const recorded = Number.isFinite(best) && best > 0
  if (!recorded) {
    if (!bid.bid_date_sent) return 'not-sent'
    const value = Number(bid.bid_value)
    if (!(Number.isFinite(value) && value > 0)) return 'no-value'
  }
  if (runStatus !== 'scored') return 'no-scored-run'
  if (!canWorkRobotAudits(viewer.role)) return 'not-auditor'
  if (viewer.role !== 'dev' && bid.estimator_id && bid.estimator_id !== viewer.userId) return 'not-estimator'
  if (offered.has(bid.id)) return 'already-offered'
  return null
}

/**
 * What the envelope needs to know about the run it opens on — a scored shadow
 * (list_shadow_runs) at send, or a mirror row's run (a scored or audited backtest)
 * when the estimator opens it from the Robot Board later.
 */
export interface EnvelopeRun {
  kind: 'shadow' | 'backtest'
  shellNumber: string | null
  robotTotal: number | null
  ourValue: number | null
  deltaPct: number | null
  /** When the robot locked (shadow) or scored (backtest) — the KPI's date. */
  at: string | null
  teacherName: string | null
  practice: boolean
  /** v2.3234: which human number the run scored against; null when unknown (pre-migration rows). */
  scoredAgainst?: 'best_effort' | 'sent' | null
}

export function envelopeRunFromShadow(r: {
  shadow_bid_number: string | null
  locked_total: number | null
  reference_value: number | null
  delta_pct: number | null
  locked_at: string | null
  teacher_name?: string | null
  teacher_standard?: boolean | null
  reference_kind?: string | null
}): EnvelopeRun {
  return {
    kind: 'shadow',
    shellNumber: r.shadow_bid_number,
    robotTotal: r.locked_total == null ? null : Number(r.locked_total),
    ourValue: r.reference_value == null ? null : Number(r.reference_value),
    deltaPct: r.delta_pct == null ? null : Number(r.delta_pct),
    at: r.locked_at,
    teacherName: r.teacher_name ?? null,
    practice: r.teacher_standard === false,
    scoredAgainst: r.reference_kind === 'best_effort' || r.reference_kind === 'sent' ? r.reference_kind : null,
  }
}

export interface EnvelopeRow {
  bucket: DiffBucketKey
  entry: DiffEntry
  /** Signed dollars: robot minus ours (the waterfall's sign). */
  impact: number
}

export const ENVELOPE_ROW_CAP = 6

/**
 * The few rows worth the estimator's minute: every bucket pooled, biggest
 * dollar distance first, capped. A missed row (ours the robot lacks) ties
 * ahead of the others — that is the dangerous kind.
 */
export function pickEnvelopeRows(diff: TakeoffDiff, cap = ENVELOPE_ROW_CAP): { rows: EnvelopeRow[]; hidden: number } {
  const pool: EnvelopeRow[] = []
  const buckets: DiffBucketKey[] = ['missed', 'added', 'gaps', 'rates']
  for (const bucket of buckets) {
    for (const entry of diff[bucket]) pool.push({ bucket, entry, impact: entry.robotExt - entry.ourExt })
  }
  const rank = (r: EnvelopeRow) => (r.bucket === 'missed' ? 1 : 0)
  pool.sort((a, b) => {
    const d = Math.abs(b.impact) - Math.abs(a.impact)
    if (Math.abs(d) > 0.5) return d
    return rank(b) - rank(a)
  })
  return { rows: pool.slice(0, cap), hidden: Math.max(0, pool.length - cap) }
}

/**
 * Bid value changed AFTER the robot's number was in view. Not contamination —
 * the score stays as taken — but it goes on the ledger by name, so a pattern of
 * "anchored down after reveal" is auditable later, and a robot that caught a
 * miss gets the credit.
 */
export function robotReviewRevisionNote(prev: number | string | null, next: number | string | null, robotTotal: number | null): string | null {
  const a = Number(prev)
  const b = Number(next)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0 || Math.round(a) === Math.round(b)) return null
  const diff = b - a
  const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`
  const dir = diff > 0 ? `+${money(diff)}` : `−${money(diff)}`
  const robot = robotTotal != null && robotTotal > 0 ? ` · robot had ${money(robotTotal)}` : ''
  return `[robot review] Bid value revised after seeing the robot's number: ${money(a)} → ${money(b)} (${dir})${robot}`
}

/** Was this bid update a revision after the reveal? Needs: already sent before, value changed, and a scored run on the bid. */
export function isRevisionAfterReveal(args: {
  wasSentBefore: boolean
  prevValue: number | string | null
  nextValue: number | string | null | undefined
  runStatus: string | null
}): boolean {
  if (!args.wasSentBefore || args.runStatus !== 'scored' || args.nextValue === undefined) return false
  return robotReviewRevisionNote(args.prevValue, args.nextValue, null) != null
}
