import type { TodaySessionStripRow } from '../hooks/useDashboardMyTeamSectionState'
import { formatClockSessionJobOrBidLabelFromEmbeds } from '../types/clockSessions'

/** Same second math as strip / useDashboardMyTeamSectionState.sessionDurationSeconds */
export function dayMixSessionDurationSeconds(
  clockedIn: string,
  clockedOut: string | null,
  nowMs: number
): number {
  const inMs = new Date(clockedIn).getTime()
  const outMs = clockedOut ? new Date(clockedOut).getTime() : nowMs
  return Math.max(0, Math.floor((outMs - inMs) / 1000))
}

export function dayJobMixAllocationKey(job_ledger_id: string | null, bid_id: string | null): string {
  if (job_ledger_id) return `job:${job_ledger_id}`
  if (bid_id) return `bid:${bid_id}`
  return 'unassigned'
}

export type DayJobMixRow = {
  key: string
  job_ledger_id: string | null
  bid_id: string | null
  label: string
  seconds: number
  pct: number
}

function stripSessionEligible(s: Pick<TodaySessionStripRow, 'rejected_at' | 'revoked_at'>): boolean {
  return !s.rejected_at && !s.revoked_at
}

/**
 * Duration-weighted job/bid mix for strip sessions (excludes rejected/revoked, same as Clocked in today aggregates).
 */
export function sessionsToMixRows(sessions: readonly TodaySessionStripRow[], nowMs: number): DayJobMixRow[] {
  const byKey = new Map<
    string,
    { job_ledger_id: string | null; bid_id: string | null; label: string; seconds: number }
  >()

  for (const s of sessions) {
    if (!stripSessionEligible(s)) continue
    const sec = dayMixSessionDurationSeconds(s.clocked_in_at, s.clocked_out_at, nowMs)
    if (sec <= 0) continue
    const job_ledger_id = s.job_ledger_id
    const bid_id = s.bid_id
    const key = dayJobMixAllocationKey(job_ledger_id, bid_id)
    const label = formatClockSessionJobOrBidLabelFromEmbeds(s) ?? 'Unassigned'
    const cur = byKey.get(key)
    if (cur) {
      cur.seconds += sec
    } else {
      byKey.set(key, { job_ledger_id, bid_id, label, seconds: sec })
    }
  }

  const total = [...byKey.values()].reduce((a, v) => a + v.seconds, 0)
  if (total <= 0) return []

  const rows: DayJobMixRow[] = []
  for (const [key, v] of byKey) {
    rows.push({
      key,
      job_ledger_id: v.job_ledger_id,
      bid_id: v.bid_id,
      label: v.label,
      seconds: v.seconds,
      pct: v.seconds / total,
    })
  }
  rows.sort((a, b) => b.seconds - a.seconds)
  return rows
}

export function totalMixSeconds(rows: readonly Pick<DayJobMixRow, 'seconds'>[]): number {
  return rows.reduce((a, r) => a + r.seconds, 0)
}

/** Normalize mix rows to pct summing to 1 (e.g. after filtering). */
export function normalizeMixRowPercents(rows: readonly DayJobMixRow[]): { pct: number }[] {
  const t = rows.reduce((a, r) => a + r.seconds, 0)
  if (t <= 0) return rows.map(() => ({ pct: 0 }))
  return rows.map((r) => ({ pct: r.seconds / t }))
}

export function allocateSecondsForPercents(totalSec: number, pcts: readonly number[]): number[] {
  const n = pcts.length
  if (n === 0) return []
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < n - 1; i++) {
    const s = Math.floor(totalSec * pcts[i]!)
    out.push(s)
    sum += s
  }
  out.push(Math.max(0, totalSec - sum))
  return out
}
