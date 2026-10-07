/**
 * Who made up a period on the Man hours card: one row per person with their
 * hours on each side, from the same entries the periods are folded from, so
 * the rows add up to the period's row on the card.
 *
 * Pure: no React, no Supabase.
 */

import type { ManHoursEntry, ManHoursPeriod, ManHoursSession } from './manHoursByPeriod'

export type ManHoursWhoRow = {
  userId: string
  name: string
  fieldHours: number
  officeHours: number
  bidHours: number
  unassignedHours: number
  totalHours: number
  /** Recorded and not yet approved. Already inside the hours above. */
  pendingHours: number
}

/** `users.id` → display name, from the names the sessions carry. A session with no name leaves no entry. */
export function buildManHoursNames(sessions: readonly ManHoursSession[]): Map<string, string> {
  const names = new Map<string, string>()
  for (const s of sessions) {
    const name = (s.users?.name ?? '').trim()
    if (name && !names.has(s.user_id)) names.set(s.user_id, name)
  }
  return names
}

/** The people with counted time inside the period, most hours first, then by name. */
export function buildManHoursWho(
  entries: readonly ManHoursEntry[],
  period: Pick<ManHoursPeriod, 'start' | 'end'>,
  nameByUserId: ReadonlyMap<string, string>,
): ManHoursWhoRow[] {
  const byUser = new Map<string, ManHoursWhoRow>()
  for (const e of entries) {
    if (e.workDate < period.start || e.workDate > period.end) continue
    let row = byUser.get(e.userId)
    if (!row) {
      row = { userId: e.userId, name: nameByUserId.get(e.userId) ?? 'Unknown', fieldHours: 0, officeHours: 0, bidHours: 0, unassignedHours: 0, totalHours: 0, pendingHours: 0 }
      byUser.set(e.userId, row)
    }
    if (e.side === 'field') row.fieldHours += e.hours
    else if (e.side === 'office') row.officeHours += e.hours
    else if (e.side === 'bid') row.bidHours += e.hours
    else row.unassignedHours += e.hours
    row.totalHours += e.hours
    if (e.pending) row.pendingHours += e.hours
  }
  return [...byUser.values()].sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name))
}
