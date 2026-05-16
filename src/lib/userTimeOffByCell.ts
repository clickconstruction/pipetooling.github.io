import { supabase } from './supabase'
import type { Database } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { NOT_COMING_IN_NOTE } from './notComingInTimeOff'

export type UserTimeOffRow = Pick<
  Database['public']['Tables']['user_time_off']['Row'],
  'id' | 'user_id' | 'start_date' | 'end_date' | 'kind' | 'note'
>

export type UserTimeOffCellVariant = 'not_coming_in' | 'time_off'

export type UserTimeOffCellInfo = {
  variant: UserTimeOffCellVariant
  /** Short label for chip (e.g. 'Not coming in', 'Off'). */
  label: string
  /** Original note from the row, if any (used for tooltip / aria). */
  note: string | null
  /** Original `kind` (e.g. `unpaid`); pass-through for callers that care. */
  kind: string
}

export function userTimeOffCellKey(userId: string, workDateYmd: string): string {
  return `${userId}\t${workDateYmd}`
}

function isSingleDayRow(row: UserTimeOffRow): boolean {
  return row.start_date === row.end_date
}

function rowOverlapsDate(row: UserTimeOffRow, dayKey: string): boolean {
  return row.start_date <= dayKey && dayKey <= row.end_date
}

/**
 * Pick the most specific overlapping row for a person/day. When more than one
 * `user_time_off` row overlaps the same day:
 *   1. prefer rows whose note matches `NOT_COMING_IN_NOTE` (the action we add
 *      from Schedule Dispatch);
 *   2. then prefer single-day rows over multi-day ranges (more specific intent);
 *   3. otherwise fall back to the first match.
 */
export function pickUserTimeOffRowForCell(rows: UserTimeOffRow[]): UserTimeOffRow | null {
  if (rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => {
    const aIsNci = (a.note ?? '').trim() === NOT_COMING_IN_NOTE
    const bIsNci = (b.note ?? '').trim() === NOT_COMING_IN_NOTE
    if (aIsNci !== bIsNci) return aIsNci ? -1 : 1
    const aSingle = isSingleDayRow(a)
    const bSingle = isSingleDayRow(b)
    if (aSingle !== bSingle) return aSingle ? -1 : 1
    return 0
  })
  return sorted[0] ?? null
}

export function userTimeOffInfoFromRow(row: UserTimeOffRow): UserTimeOffCellInfo {
  const note = (row.note ?? '').trim()
  const isNci = note === NOT_COMING_IN_NOTE && isSingleDayRow(row)
  return {
    variant: isNci ? 'not_coming_in' : 'time_off',
    label: isNci ? 'Not coming in' : 'Off',
    note: row.note ?? null,
    kind: row.kind,
  }
}

/**
 * Build a per-cell time-off map keyed by `${userId}\t${workDateYmd}`.
 * Pure function — safe to unit-test.
 */
export function buildUserTimeOffByCell(
  rows: UserTimeOffRow[],
  dayKeys: string[],
): Map<string, UserTimeOffCellInfo> {
  const out = new Map<string, UserTimeOffCellInfo>()
  if (rows.length === 0 || dayKeys.length === 0) return out

  const rowsByUser = new Map<string, UserTimeOffRow[]>()
  for (const r of rows) {
    const list = rowsByUser.get(r.user_id) ?? []
    list.push(r)
    rowsByUser.set(r.user_id, list)
  }

  for (const [userId, userRows] of rowsByUser) {
    for (const dk of dayKeys) {
      const matches = userRows.filter((r) => rowOverlapsDate(r, dk))
      const picked = pickUserTimeOffRowForCell(matches)
      if (picked) {
        out.set(userTimeOffCellKey(userId, dk), userTimeOffInfoFromRow(picked))
      }
    }
  }
  return out
}

/** Fetch `user_time_off` rows for the given users that overlap `[startYmd, endYmd]`. */
export async function fetchUserTimeOffForUsersInRange(
  userIds: string[],
  startYmd: string,
  endYmd: string,
): Promise<{ data: UserTimeOffRow[]; error: string | null }> {
  if (userIds.length === 0 || !startYmd || !endYmd) {
    return { data: [], error: null }
  }
  try {
    const data = await withSupabaseRetry(
      async () =>
        await supabase
          .from('user_time_off')
          .select('id, user_id, start_date, end_date, kind, note')
          .in('user_id', userIds)
          .lte('start_date', endYmd)
          .gte('end_date', startYmd),
      'fetchUserTimeOffForUsersInRange',
    )
    return { data: (data ?? []) as UserTimeOffRow[], error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e, 'Failed to load time off') }
  }
}
