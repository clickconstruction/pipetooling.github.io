/**
 * Activity-tab week report (v2.2456).
 *
 * Turns the raw rows the page already records — call comments
 * (didnt_answer / answered / converted), timer events, callbacks — into a
 * per-person weekly summary: calls made, answer rate, time on the phone,
 * callbacks set, conversions.
 *
 * Day/week boundaries use browser-local time, matching the existing
 * Marked/Updated tables on the same tab (see prospectTeamActivity.ts).
 * Callers filter rows to the week range query-side; this module only
 * aggregates.
 */

const DAY_MS = 86_400_000

export type WeekRange = {
  /** Inclusive start (local Monday 00:00). */
  startMs: number
  /** Exclusive end (the following Monday 00:00). */
  endMs: number
  /** e.g. "Aug 24 – Aug 30" */
  label: string
}

/** The week containing `nowMs`, shifted back `offsetWeeks` (0 = this week). Weeks start Monday. */
export function weekRange(nowMs: number, offsetWeeks: number): WeekRange {
  const now = new Date(nowMs)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = today.getDay() // 0 = Sunday
  const daysSinceMonday = (dow + 6) % 7
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday - offsetWeeks * 7)
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const sunday = new Date(nextMonday.getTime() - DAY_MS)
  return {
    startMs: monday.getTime(),
    endMs: nextMonday.getTime(),
    label: `${fmt(monday)} – ${fmt(sunday)}`,
  }
}

export type WeekCallRow = { created_by: string; interaction_type: string; created_at: string | null }
export type WeekTimerRow = { user_id: string; timer_seconds: number; created_at: string | null }
export type WeekCallbackRow = { user_id: string; created_at: string | null }
export type WeekUser = { id: string; name: string }

export type WeekUserStats = {
  userId: string
  name: string
  calls: number
  answered: number
  /** 0..1, or null when no calls were made. */
  answerRate: number | null
  timerSeconds: number
  callbacks: number
  conversions: number
}

export type WeekDailyRow = {
  dateKey: string
  userId: string
  name: string
  calls: number
  answered: number
  timerSeconds: number
  callbacks: number
}

export type WeekReport = {
  perUser: WeekUserStats[]
  team: WeekUserStats
  daily: WeekDailyRow[]
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildProspectWeekReport(
  calls: readonly WeekCallRow[],
  timers: readonly WeekTimerRow[],
  callbacks: readonly WeekCallbackRow[],
  users: readonly WeekUser[],
): WeekReport {
  const nameById = new Map(users.map((u) => [u.id, u.name]))
  const blank = (userId: string): WeekUserStats => ({
    userId,
    name: nameById.get(userId) ?? 'Unknown',
    calls: 0,
    answered: 0,
    answerRate: null,
    timerSeconds: 0,
    callbacks: 0,
    conversions: 0,
  })
  const byUser = new Map<string, WeekUserStats>()
  const dailyMap = new Map<string, WeekDailyRow>()
  const stat = (userId: string): WeekUserStats => {
    let s = byUser.get(userId)
    if (!s) {
      s = blank(userId)
      byUser.set(userId, s)
    }
    return s
  }
  const dayStat = (userId: string, iso: string): WeekDailyRow => {
    const dateKey = localDateKey(iso)
    const k = `${dateKey}|${userId}`
    let row = dailyMap.get(k)
    if (!row) {
      row = { dateKey, userId, name: nameById.get(userId) ?? 'Unknown', calls: 0, answered: 0, timerSeconds: 0, callbacks: 0 }
      dailyMap.set(k, row)
    }
    return row
  }

  for (const c of calls) {
    if (!c.created_at) continue
    if (c.interaction_type === 'converted') {
      stat(c.created_by).conversions += 1
      continue
    }
    const s = stat(c.created_by)
    s.calls += 1
    const d = dayStat(c.created_by, c.created_at)
    d.calls += 1
    if (c.interaction_type === 'answered') {
      s.answered += 1
      d.answered += 1
    }
  }
  for (const t of timers) {
    if (!t.created_at) continue
    stat(t.user_id).timerSeconds += t.timer_seconds
    dayStat(t.user_id, t.created_at).timerSeconds += t.timer_seconds
  }
  for (const cb of callbacks) {
    if (!cb.created_at) continue
    stat(cb.user_id).callbacks += 1
    dayStat(cb.user_id, cb.created_at).callbacks += 1
  }

  const perUser = [...byUser.values()]
    .map((s) => ({ ...s, answerRate: s.calls > 0 ? s.answered / s.calls : null }))
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))

  const team = perUser.reduce(
    (acc, s) => ({
      ...acc,
      calls: acc.calls + s.calls,
      answered: acc.answered + s.answered,
      timerSeconds: acc.timerSeconds + s.timerSeconds,
      callbacks: acc.callbacks + s.callbacks,
      conversions: acc.conversions + s.conversions,
    }),
    { ...blank('team'), name: 'Team' },
  )
  team.answerRate = team.calls > 0 ? team.answered / team.calls : null

  const daily = [...dailyMap.values()].sort(
    (a, b) => b.dateKey.localeCompare(a.dateKey) || a.name.localeCompare(b.name),
  )

  return { perUser, team, daily }
}

export function formatWeekHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}
