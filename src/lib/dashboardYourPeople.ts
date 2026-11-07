/**
 * Your people on the Dashboard (punch list #273, PR 3c). The office's morning read of the people's open one-off cards:
 * one row per person, their newest-moved card with its ring, and whether they moved today, this week, or are stuck
 * (Review's own age rule, amber after a week and red after a month, so the Dashboard and Review never disagree). The
 * headline counts the cards done this week, the people who moved and the people stuck. Pure: the hook reads the rows.
 */
import { ONE_OFF_TASK_AGE, ageStateForDays } from './ageState'
import { ringState, type RingState } from './taskProgress'

export type YourPeopleInstance = {
  id: string
  title: string
  /** YYYY-MM-DD */
  scheduledDate: string
  completedAt: string | null
  percentComplete: number | null | undefined
  assigneeIds: string[]
  lines?: number
  ticked?: number
}

/** The newest move on a card: a progress line, a tick, a reopen. */
export type YourPeopleMove = { instanceId: string; at: string }

export type YourPersonState = 'moved_today' | 'moved_week' | 'stuck' | 'quiet'

export type YourPersonRow = {
  userId: string
  name: string
  openCount: number
  /** The card that moved last, else the oldest open one. */
  card: { instanceId: string; title: string; ring: RingState; movedAt: string | null } | null
  oldestAgeDays: number
  state: YourPersonState
  /** *moved today* · *moved Wed* · *stuck 32 days* · *nothing moved · oldest 12 days* */
  words: string
}

const DAY_MS = 86_400_000

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`)
  const b = Date.parse(`${toYmd}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / DAY_MS))
}

/** The app-zone day of an instant as YYYY-MM-DD, from the caller's formatter. */
export type DayOf = (iso: string) => string

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function movedWords(state: YourPersonState, movedAt: string | null, oldestAgeDays: number): string {
  if (state === 'moved_today') return 'moved today'
  if (state === 'moved_week' && movedAt) {
    const d = new Date(movedAt)
    return Number.isNaN(d.getTime()) ? 'moved this week' : `moved ${WEEKDAYS[d.getDay()]}`
  }
  if (state === 'stuck') return `stuck ${oldestAgeDays} days`
  return oldestAgeDays > 0 ? `nothing moved · oldest ${oldestAgeDays} days` : 'nothing moved'
}

export function yourPeopleRows(args: {
  open: YourPeopleInstance[]
  moves: YourPeopleMove[]
  nameById: ReadonlyMap<string, string>
  todayYmd: string
  dayOf: DayOf
  /** The viewer, whose own cards sit on My Inbox. */
  excludeUserId: string | null
}): YourPersonRow[] {
  const { open, moves, nameById, todayYmd, dayOf, excludeUserId } = args
  const newestMove = new Map<string, string>()
  for (const m of moves) {
    const prev = newestMove.get(m.instanceId)
    if (!prev || m.at > prev) newestMove.set(m.instanceId, m.at)
  }
  const byUser = new Map<string, YourPeopleInstance[]>()
  for (const inst of open) {
    if (inst.completedAt) continue
    for (const uid of inst.assigneeIds) {
      if (!uid || uid === excludeUserId) continue
      byUser.set(uid, [...(byUser.get(uid) ?? []), inst])
    }
  }
  const weekAgoYmd = ymdDaysAgo(todayYmd, 7)
  const rows: YourPersonRow[] = []
  for (const [userId, cards] of byUser) {
    let newest: YourPeopleInstance | null = null
    let newestAt: string | null = null
    let oldest = 0
    for (const c of cards) {
      const age = daysBetween(c.scheduledDate, todayYmd)
      if (age > oldest) oldest = age
      const at = newestMove.get(c.id) ?? null
      if (at && (!newestAt || at > newestAt)) {
        newestAt = at
        newest = c
      }
    }
    if (!newest) {
      newest = [...cards].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null
    }
    const movedDay = newestAt ? dayOf(newestAt) : null
    const severity = ageStateForDays(oldest, ONE_OFF_TASK_AGE)
    const state: YourPersonState =
      movedDay === todayYmd ? 'moved_today' : movedDay && movedDay >= weekAgoYmd ? 'moved_week' : severity === 'red' ? 'stuck' : 'quiet'
    rows.push({
      userId,
      name: nameById.get(userId) ?? 'Someone',
      openCount: cards.length,
      card: newest
        ? {
            instanceId: newest.id,
            title: newest.title,
            ring: ringState({ completedAt: null, percentComplete: newest.percentComplete, lines: newest.lines ?? 0, ticked: newest.ticked ?? 0 }),
            movedAt: newestAt,
          }
        : null,
      oldestAgeDays: oldest,
      state,
      words: movedWords(state, newestAt, oldest),
    })
  }
  // The people who moved last lead; the quiet and the stuck follow, oldest first; a tie reads by name.
  return rows.sort((a, b) => {
    const am = a.card?.movedAt ?? ''
    const bm = b.card?.movedAt ?? ''
    if (am !== bm) return bm.localeCompare(am)
    if (a.oldestAgeDays !== b.oldestAgeDays) return b.oldestAgeDays - a.oldestAgeDays
    return a.name.localeCompare(b.name)
  })
}

function ymdDaysAgo(todayYmd: string, n: number): string {
  const t = Date.parse(`${todayYmd}T00:00:00Z`)
  if (!Number.isFinite(t)) return todayYmd
  return new Date(t - n * DAY_MS).toISOString().slice(0, 10)
}

/** *3 cards done this week · 2 moved · 1 stuck*, the card's headline. */
export function yourPeopleHeadline(rows: YourPersonRow[], doneThisWeek: number): string {
  const moved = rows.filter((r) => r.state === 'moved_today' || r.state === 'moved_week').length
  const stuck = rows.filter((r) => r.state === 'stuck').length
  const parts = [`${doneThisWeek} card${doneThisWeek === 1 ? '' : 's'} done this week`, `${moved} moved`]
  if (stuck > 0) parts.push(`${stuck} stuck`)
  return parts.join(' · ')
}

/** The reminder's words, Review's own (Checklist → Review → 🔔 Remind). */
export function reminderBody(titles: string[]): string {
  const n = titles.length
  if (n === 1) return `You have 1 outstanding task: ${titles[0]}`
  if (n <= 3) return `You have ${n} outstanding tasks: ${titles.join(', ')}`
  return `You have ${n} outstanding tasks: ${titles.slice(0, 3).join(', ')} and ${n - 3} more`
}
