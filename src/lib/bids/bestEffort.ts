/**
 * Best effort before the envelope (v2.3234).
 *
 * After pricing, on the Cover Letter, the estimator records the number they
 * would send right now. That record is the blind human reference the shadow
 * scores against; the robot's envelope opens against it; and the value that
 * actually goes out afterwards is a second number whose gap from the first is
 * the robot's measured influence on the bid.
 *
 * The record lives in `bid_best_efforts` — a table the robots cannot read,
 * insert-only for staff (first record wins). This module decides what the card
 * on the Cover Letter says, what the ledger notes say, and how the gap reads.
 *
 * Pure module — no React, no Supabase.
 */

export interface BestEffortRecord {
  bid_id: string
  value: number | string
  recorded_at: string
  recorded_by: string | null
  note?: string | null
}

export interface BestEffortBid {
  id: string
  bid_number: string | null
  bid_date_sent: string | null
  bid_value: number | string | null
  robot_opt_out?: boolean | null
}

/** The bid's shadow run, as far as the card needs to know. */
export interface BestEffortRun {
  status: string
  locked_at: string | null
}

export type BestEffortCardMode =
  /** Show the record button with the letter's amount. */
  | { kind: 'record'; amount: number; robot: 'sealed' | 'estimating' | 'none' }
  /** Already recorded: the stamp, and the envelope door when a scored run exists. */
  | { kind: 'recorded'; value: number; recordedAt: string; envelope: 'open' | 'waiting' | 'none' }
  /** Nothing to show: sent already, opted out, or no amount to record. */
  | { kind: 'hidden'; why: 'sent' | 'opted-out' | 'no-amount' }

const num = (v: number | string | null | undefined): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * What the Cover Letter card shows for this bid right now. A sent bid shows
 * nothing (the send-time envelope covers it); an opted-out bid shows nothing;
 * otherwise the record button with the letter's amount, or the stamp once
 * recorded — with the envelope door when the run has scored.
 */
export function bestEffortCardMode(args: {
  bid: BestEffortBid
  amount: number | null | undefined
  record: BestEffortRecord | null
  run: BestEffortRun | null
}): BestEffortCardMode {
  const { bid, record, run } = args
  if (bid.robot_opt_out === true) return { kind: 'hidden', why: 'opted-out' }
  if (record) {
    const value = num(record.value) ?? 0
    const envelope = run?.status === 'scored' ? 'open' : run && (run.status === 'locked' || run.status === 'open') ? 'waiting' : 'none'
    return { kind: 'recorded', value, recordedAt: record.recorded_at, envelope }
  }
  if (bid.bid_date_sent) return { kind: 'hidden', why: 'sent' }
  const amount = num(args.amount)
  if (amount == null || amount <= 0) return { kind: 'hidden', why: 'no-amount' }
  const robot = run?.status === 'locked' || run?.status === 'scored' ? 'sealed' : run?.status === 'open' ? 'estimating' : 'none'
  return { kind: 'record', amount, robot }
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`

/** The ledger line the record leaves on the bid. */
export function bestEffortRecordNote(args: { actorDisplayName: string; value: number; robot: 'sealed' | 'estimating' | 'none' }): string {
  const tail =
    args.robot === 'sealed'
      ? " The robot's sealed number opens against it."
      : args.robot === 'estimating'
        ? ' The robot is still estimating; its envelope opens when it locks.'
        : ' No robot on this bid yet; the score lands if one locks.'
  return `[best effort] ${args.actorDisplayName} recorded ${money(args.value)} as the number we would send right now, before seeing the robot.${tail}`
}

/**
 * Best effort → sent value. Null when either is missing or they agree within a
 * dollar. `pct` is the move relative to the best effort.
 */
export function bestEffortGap(best: number | string | null | undefined, sent: number | string | null | undefined): { best: number; sent: number; diff: number; pct: number } | null {
  const a = num(best)
  const b = num(sent)
  if (a == null || b == null || a <= 0 || b <= 0 || Math.abs(a - b) < 1) return null
  return { best: a, sent: b, diff: b - a, pct: Math.round(((b - a) / a) * 1000) / 10 }
}

/** The ledger line at send when the sent value moved off the best effort. */
export function bestEffortGapNote(gap: NonNullable<ReturnType<typeof bestEffortGap>>, robotTotal: number | null): string {
  const dir = gap.diff > 0 ? `+${money(gap.diff)}` : `−${money(Math.abs(gap.diff))}`
  const robot = robotTotal != null && robotTotal > 0 ? ` · robot had ${money(robotTotal)}` : ''
  return `[best effort gap] Sent ${money(gap.sent)} against a best effort of ${money(gap.best)} (${dir}, ${gap.pct > 0 ? '+' : ''}${gap.pct}%) — the change after the robot's envelope.${robot}`
}

/** 'best effort 9/10' — the short stamp under a number. */
export function bestEffortStamp(record: Pick<BestEffortRecord, 'recorded_at'>, recorderName?: string | null): string {
  const d = new Date(record.recorded_at)
  const when = Number.isNaN(d.getTime()) ? '' : ` ${d.getMonth() + 1}/${d.getDate()}`
  return `best effort${when}${recorderName ? ` · ${recorderName}` : ''}`
}

/**
 * The strip's summary: how many sent bids moved off their best effort, and by
 * how much in total (absolute dollars) — the robot's worth, summed.
 */
export function summarizeBestEffortMoves(rows: ReadonlyArray<{ best: number | string | null | undefined; sent: number | string | null | undefined }>): { moved: number; total: number } {
  let moved = 0
  let total = 0
  for (const r of rows) {
    const gap = bestEffortGap(r.best, r.sent)
    if (!gap) continue
    moved++
    total += Math.abs(gap.diff)
  }
  return { moved, total }
}
