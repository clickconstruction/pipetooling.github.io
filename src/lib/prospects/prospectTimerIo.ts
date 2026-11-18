import { supabase } from '../supabase'
import { myTimeWindows, sumTimerSeconds } from './prospectTimerSums'

/**
 * The reads behind the Follow Up card's two time windows, Timer history and My time. Moved out of
 * `src/pages/Prospects.tsx` with the windows; the queries are unchanged.
 */

export type ProspectTimerEvent = {
  id: string
  created_at: string | null
  timer_seconds: number
  button_name: string
  prospect: { company_name: string | null } | null
}

type RawTimerEvent = Omit<ProspectTimerEvent, 'prospect'> & { prospect: { company_name: string | null } | { company_name: string | null }[] | null }

/** The rows as the window draws them: an embedded prospect that came back as a list is its first row. */
export function timerEventRows(raw: readonly RawTimerEvent[]): ProspectTimerEvent[] {
  return raw.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    timer_seconds: r.timer_seconds,
    button_name: r.button_name,
    prospect: Array.isArray(r.prospect) ? r.prospect[0] ?? null : r.prospect,
  }))
}

/** A caller's last hundred timed presses, newest first. A refused read is no rows. */
export async function loadProspectTimerEvents(userId: string): Promise<ProspectTimerEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the cast the page carried (the map's quirk 1): removed in a types pass, never in a move
  const { data, error } = await (supabase as any)
    .from('prospect_timer_events')
    .select('id, created_at, timer_seconds, button_name, prospect:prospects(company_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return []
  return timerEventRows((data ?? []) as RawTimerEvent[])
}

export type MyTimeStats = { today: number; yesterday: number; last7Days: number; lifetime: number }

/** A caller's seconds on calls: today, yesterday, the last seven days and all of it, by the reader's own midnight. */
export async function loadMyTimeStats(userId: string, now: Date = new Date()): Promise<MyTimeStats> {
  const { startOfToday, endOfToday, startOfYesterday, sevenDaysAgo } = myTimeWindows(now)
  const sum = sumTimerSeconds
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as above
  const db = supabase as any

  const [todayRes, yesterdayRes, last7Res, lifetimeRes] = await Promise.all([
    db.from('prospect_timer_events').select('timer_seconds').eq('user_id', userId).gte('created_at', startOfToday.toISOString()).lte('created_at', endOfToday.toISOString()),
    db.from('prospect_timer_events').select('timer_seconds').eq('user_id', userId).gte('created_at', startOfYesterday.toISOString()).lt('created_at', startOfToday.toISOString()),
    db.from('prospect_timer_events').select('timer_seconds').eq('user_id', userId).gte('created_at', sevenDaysAgo.toISOString()),
    db.from('prospect_timer_events').select('timer_seconds').eq('user_id', userId),
  ])

  return {
    today: sum((todayRes.data ?? []) as { timer_seconds: number }[]),
    yesterday: sum((yesterdayRes.data ?? []) as { timer_seconds: number }[]),
    last7Days: sum((last7Res.data ?? []) as { timer_seconds: number }[]),
    lifetime: sum((lifetimeRes.data ?? []) as { timer_seconds: number }[]),
  }
}
