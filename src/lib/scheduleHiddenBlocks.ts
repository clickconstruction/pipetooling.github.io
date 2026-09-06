/**
 * RLS-hidden schedule blocks (journey map Tier-2 #23, J18-F2): `job_schedule_blocks_select`
 * scopes a superintendent's reads to assigned projects, so people booked elsewhere looked
 * free and Expected Manpower understated. The `schedule_hidden_block_counts` RPC returns,
 * per person/day, how many blocks the caller cannot see and their summed hours — nothing
 * else — and this kernel shapes those rows into grey "busy" placeholders and manpower totals.
 */
import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { hubPersonDayKey } from './scheduleDispatchHub'

/** One RPC row: blocks on `day` for `user_id` that the caller's RLS excludes. */
export type ScheduleHiddenBlockCount = {
  user_id: string
  /** `YYYY-MM-DD` */
  day: string
  hidden_count: number
  hidden_hours: number
}

/** Per person-day placeholder info (keyed by `hubPersonDayKey`). */
export type ScheduleHiddenCell = {
  count: number
  hours: number
}

export type ScheduleHiddenManpower = {
  /** Hidden blocks in the selection. */
  count: number
  /** Summed hidden person-hours in the selection. */
  hours: number
  /** Distinct people with at least one hidden block in the selection. */
  people: number
}

const RPC_NAME = 'schedule_hidden_block_counts'

function toNumber(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : 0
}

/** Normalize raw RPC rows (numeric comes back as a string from PostgREST). Drops junk rows. */
export function normalizeScheduleHiddenBlockRows(raw: unknown): ScheduleHiddenBlockCount[] {
  if (!Array.isArray(raw)) return []
  const out: ScheduleHiddenBlockCount[] = []
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r !== 'object') continue
    const userId = typeof r.user_id === 'string' ? r.user_id : null
    const day = typeof r.day === 'string' ? r.day.slice(0, 10) : null
    const count = Math.max(0, Math.trunc(toNumber(r.hidden_count)))
    if (!userId || !day || count === 0) continue
    out.push({ user_id: userId, day, hidden_count: count, hidden_hours: Math.max(0, toNumber(r.hidden_hours)) })
  }
  return out
}

export async function fetchScheduleHiddenBlockCounts(
  startYmd: string,
  endYmd: string,
): Promise<{ data: ScheduleHiddenBlockCount[]; error: string | null }> {
  try {
    const data = await withSupabaseRetry(
      // Not in the generated types yet (types are regenerated in their own PRs).
      async () => (supabase as any).rpc(RPC_NAME, { p_start: startYmd, p_end: endYmd }),
      'fetchScheduleHiddenBlockCounts',
    )
    return { data: normalizeScheduleHiddenBlockRows(data), error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** Placeholder shaping: rows → `hubPersonDayKey(user, day)` → `{count, hours}` (same-cell rows merge). */
export function buildScheduleHiddenByCell(
  rows: readonly ScheduleHiddenBlockCount[],
): Map<string, ScheduleHiddenCell> {
  const m = new Map<string, ScheduleHiddenCell>()
  for (const r of rows) {
    if (r.hidden_count <= 0) continue
    const key = hubPersonDayKey(r.user_id, r.day)
    const prev = m.get(key)
    if (prev) {
      prev.count += r.hidden_count
      prev.hours += r.hidden_hours
    } else {
      m.set(key, { count: r.hidden_count, hours: r.hidden_hours })
    }
  }
  return m
}

/** Distinct people with any hidden block in the rows (roster completion for the board). */
export function scheduleHiddenUserIds(rows: readonly ScheduleHiddenBlockCount[]): string[] {
  return [...new Set(rows.filter((r) => r.hidden_count > 0).map((r) => r.user_id))]
}

/** Manpower roll-up of hidden blocks whose `day` is in `dayKeys` (e.g. one day, or the visible week). */
export function scheduleHiddenManpowerForDayKeys(
  rows: readonly ScheduleHiddenBlockCount[],
  dayKeys: readonly string[],
): ScheduleHiddenManpower {
  const set = new Set(dayKeys)
  let count = 0
  let hours = 0
  const people = new Set<string>()
  for (const r of rows) {
    if (!set.has(r.day) || r.hidden_count <= 0) continue
    count += r.hidden_count
    hours += r.hidden_hours
    people.add(r.user_id)
  }
  return { count, hours, people: people.size }
}

/** Total hidden blocks across all rows — the telemetry count (`schedule_hidden_blocks{count}`). */
export function scheduleHiddenBlocksTotal(rows: readonly ScheduleHiddenBlockCount[]): number {
  let n = 0
  for (const r of rows) n += Math.max(0, r.hidden_count)
  return n
}

/**
 * The manpower headline: true total first, then what the viewer can actually see.
 * `formatHours` is the board's person-hours formatter (kept injectable for tests).
 *   visible 38, hidden 45 → "83 · 38 on your projects"
 *   visible 38, hidden 0  → "38"
 */
export function formatManpowerWithHidden(
  visibleHours: number,
  hiddenHours: number,
  formatHours: (h: number) => string,
): { total: string; detail: string | null } {
  if (hiddenHours <= 0) return { total: formatHours(visibleHours), detail: null }
  return {
    total: formatHours(visibleHours + hiddenHours),
    detail: `${formatHours(visibleHours)} on your projects`,
  }
}

/** Busy-placeholder tooltip: what the grey block means, in the super's words. */
export function scheduleHiddenPlaceholderTitle(cell: ScheduleHiddenCell): string {
  const blocks = cell.count === 1 ? '1 block' : `${cell.count} blocks`
  return `Busy on work outside your projects (${blocks}) — details are hidden`
}
