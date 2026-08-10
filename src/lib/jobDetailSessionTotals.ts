/**
 * Job Detail modal: clock sessions grouped per person with recorded-time totals.
 * Rejected sessions stay visible in the group's rows but contribute no hours;
 * still-open sessions are counted but contribute no hours.
 */

import type { JobDetailClockSessionRow } from './fetchClockSessionsForJobLedger'

export type JobDetailSessionGroup = {
  name: string
  sessions: JobDetailClockSessionRow[]
  totalHours: number
  openCount: number
}

export function formatJobDetailTotalHours(hours: number): string {
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} h`
}

export function computeJobDetailSessionGroups(
  sessions: JobDetailClockSessionRow[],
): JobDetailSessionGroup[] {
  const byName = new Map<string, JobDetailSessionGroup>()
  for (const s of sessions) {
    const name = (s.users?.name ?? '').trim() || s.user_id
    let entry = byName.get(name)
    if (!entry) {
      entry = { name, sessions: [], totalHours: 0, openCount: 0 }
      byName.set(name, entry)
    }
    entry.sessions.push(s)
    if (s.rejected_at) continue
    if (s.clocked_in_at && s.clocked_out_at) {
      const a = new Date(s.clocked_in_at).getTime()
      const b = new Date(s.clocked_out_at).getTime()
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
        entry.totalHours += (b - a) / 3600000
        continue
      }
    }
    if (s.clocked_in_at && !s.clocked_out_at) entry.openCount += 1
  }
  return [...byName.values()].sort(
    (x, y) => y.totalHours - x.totalHours || x.name.localeCompare(y.name),
  )
}
