import type { ClockSessionRow } from '../types/clockSessions'
import { shortJobOrBidLabelFromEmbeds } from '../types/clockSessions'
import { MIN_SEGMENT_MS, normalizeDayEditorSession, type DayEditorSession } from './myTimeDayTimeline'

export function toDayEditorSession(row: {
  id: string
  clocked_in_at: string
  clocked_out_at: string | null
  work_date: string
  notes: string
  job_ledger_id: string | null
  bid_id: string | null
  approved_at: string | null
  origin?: string | null
  salary_segment_index?: number | null
}): DayEditorSession {
  return normalizeDayEditorSession(row)
}

export function collectPeopleHoursDaySessionsForScale(
  pending: ClockSessionRow[],
  approved: ClockSessionRow[],
  userId: string,
  workDate: string,
): ClockSessionRow[] {
  const all = [...pending, ...approved]
  return all.filter(
    (r) =>
      r.user_id === userId &&
      r.work_date === workDate &&
      !r.rejected_at &&
      !r.revoked_at,
  )
}

/**
 * Allocate targetTotalMs across n segments with minimum MIN_SEGMENT_MS each,
 * proportional to oldDurationsMs. Uses largest-remainder for exact integer ms sum.
 */
function scaleDurationsMs(oldDurationsMs: number[], targetTotalMs: number): number[] | null {
  const n = oldDurationsMs.length
  if (n === 0) return null
  const T = oldDurationsMs.reduce((s, x) => s + x, 0)
  if (T <= 0) return null
  if (n * MIN_SEGMENT_MS > targetTotalMs) return null

  const rem = targetTotalMs - n * MIN_SEGMENT_MS
  const additions: number[] = []
  const fractions: number[] = []
  let sumFloor = 0
  for (let i = 0; i < n; i++) {
    const raw = rem * (oldDurationsMs[i]! / T)
    const fl = Math.floor(raw)
    additions.push(fl)
    fractions.push(raw - fl)
    sumFloor += fl
  }
  const slack = rem - sumFloor
  const idx = [...Array(n).keys()].sort((a, b) => {
    const df = fractions[b]! - fractions[a]!
    if (df !== 0) return df
    return a - b
  })
  const result = additions.map((a) => MIN_SEGMENT_MS + a)
  for (let k = 0; k < slack; k++) {
    const j = idx[k]!
    result[j] = (result[j] ?? 0) + 1
  }
  return result
}

/**
 * Scale closed sessions' durations proportionally to targetHours, pack contiguously
 * from the earliest session's original clock-in. Returns null if nothing to scale.
 */
export function scaleClosedSessionsToTargetHours(
  sessions: DayEditorSession[],
  targetHours: number,
): DayEditorSession[] | null {
  if (!(targetHours > 0) || !Number.isFinite(targetHours)) return null

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.clocked_in_at).getTime() - new Date(b.clocked_in_at).getTime(),
  )
  const closed = sorted.filter((s): s is DayEditorSession & { clocked_out_at: string } => !!s.clocked_out_at)
  if (closed.length === 0) return null

  const oldDurationsMs = closed.map((s) => {
    const a = new Date(s.clocked_in_at).getTime()
    const b = new Date(s.clocked_out_at).getTime()
    return b - a
  })

  const targetTotalMs = Math.round(targetHours * 3600 * 1000)
  const scaledMs = scaleDurationsMs(oldDurationsMs, targetTotalMs)
  if (!scaledMs) return null

  const anchor = new Date(closed[0]!.clocked_in_at).getTime()
  let cursor = anchor
  return closed.map((s, i) => {
    const dur = scaledMs[i]!
    const newIn = cursor
    const newOut = cursor + dur
    cursor = newOut
    return {
      ...s,
      clocked_in_at: new Date(newIn).toISOString(),
      clocked_out_at: new Date(newOut).toISOString(),
    }
  })
}

export function buildJobBidLabelMapsFromClockRows(rows: ClockSessionRow[]): {
  jobLabels: Record<string, string>
  bidLabels: Record<string, string>
} {
  const jobLabels: Record<string, string> = {}
  const bidLabels: Record<string, string> = {}
  for (const r of rows) {
    const label = shortJobOrBidLabelFromEmbeds(r)
    if (!label) continue
    if (r.job_ledger_id) jobLabels[r.job_ledger_id] = label
    if (r.bid_id) bidLabels[r.bid_id] = label
  }
  return { jobLabels, bidLabels }
}
