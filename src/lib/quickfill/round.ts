/**
 * Quickfill as a round (punch list #30, PR 3): the phone page is the sections' marks as rows,
 * each measured against the section's OWN rhythm — the median gap of its last five marks —
 * instead of the strip's flat 12 h / 30 h rule, which was written for Office Arriving and
 * turns Accounts payable red every morning. Pure: marks and mark events in, rows out.
 */

export type RoundState = 'fresh' | 'not_yet' | 'due_today' | 'due' | 'never'
export type RoundCountSource = 'open' | 'last_look' | 'none'

export type RoundEvent = { section_id: string; marked_at: string; outstanding_count: number | null }
export type RoundMark = { marked_at: string; marked_by_name?: string | null }
export type RoundSectionInput = { sectionId: string; label: string; personal: boolean; needsNote: boolean }

export type RoundRow = RoundSectionInput & {
  state: RoundState
  /** "every N days", from the section's own marks; null = fewer than three marks (the flat rule). */
  rhythmDays: number | null
  /** Whole days past the rhythm (due) — 0 = due since today. */
  overDays: number | null
  /** When the next look falls due (not_yet), epoch ms. */
  dueAtMs: number | null
  count: number | null
  countSource: RoundCountSource
  lastMarkedAt: string | null
  lastMarkedByName: string | null
}

/** Personal doors — no org mark: My Inbox, and the two schedule views that are pages of their own. */
export const QUICKFILL_PERSONAL_SECTIONS: ReadonlySet<string> = new Set(['my-inbox', 'schedule', 'tomorrow-schedule'])
/** Sections that ask for a note before marking (their own button inside the body). */
export const QUICKFILL_NOTE_FIRST_SECTIONS: ReadonlySet<string> = new Set(['email-inbox', 'texts', 'physical-inbox'])

export const ROUND_FRESH_HOURS = 12
export const ROUND_FLAT_DUE_HOURS = 30
export const ROUND_RHYTHM_MIN_MARKS = 3
export const ROUND_RHYTHM_WINDOW = 5

const DAY_MS = 86_400_000

/**
 * The section's own rhythm in whole days: the median gap between its last five marks, at
 * least one day. Null with fewer than three marks — not enough history to call a rhythm.
 */
export function sectionRhythmDays(markedAts: ReadonlyArray<string>): number | null {
  const ts = markedAts
    .map((s) => Date.parse(s))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
    .slice(0, ROUND_RHYTHM_WINDOW)
  if (ts.length < ROUND_RHYTHM_MIN_MARKS) return null
  const gaps: number[] = []
  for (let i = 0; i + 1 < ts.length; i++) gaps.push((ts[i]! - ts[i + 1]!) / DAY_MS)
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 === 1 ? gaps[mid]! : (gaps[mid - 1]! + gaps[mid]!) / 2
  return Math.max(1, Math.round(median))
}

export function roundState(
  lastMarkedAt: string | null | undefined,
  rhythmDays: number | null,
  now: Date,
): { state: RoundState; overDays: number | null; dueAtMs: number | null } {
  if (!lastMarkedAt) return { state: 'never', overDays: null, dueAtMs: null }
  const markedMs = Date.parse(lastMarkedAt)
  if (!Number.isFinite(markedMs)) return { state: 'never', overDays: null, dueAtMs: null }
  const hours = (now.getTime() - markedMs) / 3_600_000
  if (hours <= ROUND_FRESH_HOURS) return { state: 'fresh', overDays: null, dueAtMs: null }
  if (rhythmDays == null) {
    // The strip's flat rule, for sections with too little history.
    if (hours > ROUND_FLAT_DUE_HOURS) return { state: 'due', overDays: Math.floor((hours - ROUND_FLAT_DUE_HOURS) / 24), dueAtMs: null }
    return { state: 'due_today', overDays: null, dueAtMs: null }
  }
  const elapsedDays = (now.getTime() - markedMs) / DAY_MS
  const dueAtMs = markedMs + rhythmDays * DAY_MS
  if (elapsedDays >= rhythmDays + 1) return { state: 'due', overDays: Math.floor(elapsedDays - rhythmDays), dueAtMs }
  if (elapsedDays >= rhythmDays) return { state: 'due_today', overDays: null, dueAtMs }
  return { state: 'not_yet', overDays: null, dueAtMs }
}

const STATE_ORDER: Record<RoundState, number> = { never: 0, due: 0, due_today: 1, not_yet: 2, fresh: 3 }

export function roundRows(
  sections: ReadonlyArray<RoundSectionInput>,
  marks: Readonly<Record<string, RoundMark | undefined>>,
  events: ReadonlyArray<RoundEvent>,
  liveCount: (sectionId: string) => number | null,
  now: Date,
): RoundRow[] {
  const eventsBySection = new Map<string, RoundEvent[]>()
  for (const e of events) {
    if (!e || typeof e.section_id !== 'string') continue
    const arr = eventsBySection.get(e.section_id) ?? []
    arr.push(e)
    eventsBySection.set(e.section_id, arr)
  }
  const rows = sections.map((s, index) => {
    const mark = marks[s.sectionId]
    const own = (eventsBySection.get(s.sectionId) ?? []).slice().sort((a, b) => Date.parse(b.marked_at) - Date.parse(a.marked_at))
    const rhythmDays = s.personal ? null : sectionRhythmDays(own.map((e) => e.marked_at))
    const st = s.personal ? { state: 'never' as RoundState, overDays: null, dueAtMs: null } : roundState(mark?.marked_at ?? null, rhythmDays, now)
    const live = liveCount(s.sectionId)
    let count: number | null = null
    let countSource: RoundCountSource = 'none'
    if (typeof live === 'number') {
      count = live
      countSource = 'open'
    } else {
      const snap = own.find((e) => typeof e.outstanding_count === 'number')
      if (snap) {
        count = snap.outstanding_count
        countSource = 'last_look'
      }
    }
    return {
      ...s,
      ...st,
      rhythmDays,
      count,
      countSource,
      lastMarkedAt: mark?.marked_at ?? null,
      lastMarkedByName: mark?.marked_by_name ?? null,
      index,
    }
  })
  rows.sort((a, b) => {
    const pa = a.personal ? 9 : STATE_ORDER[a.state]
    const pb = b.personal ? 9 : STATE_ORDER[b.state]
    return pa - pb || a.index - b.index
  })
  return rows.map(({ index: _i, ...r }) => r)
}

/** The round: the due and due-today sections, in list order. */
export function roundQueue(rows: ReadonlyArray<RoundRow>): string[] {
  return rows.filter((r) => !r.personal && (r.state === 'due' || r.state === 'never' || r.state === 'due_today')).map((r) => r.sectionId)
}

/** The section after `currentId` in the round; null when the round is over. A section outside the round starts it. */
export function nextInRound(rows: ReadonlyArray<RoundRow>, currentId: string | null): string | null {
  const queue = roundQueue(rows)
  const i = currentId ? queue.indexOf(currentId) : -1
  if (i < 0) return queue[0] ?? null
  return queue[i + 1] ?? null
}

export function roundHeadline(rows: ReadonlyArray<RoundRow>): string {
  const tracked = rows.filter((r) => !r.personal)
  const due = tracked.filter((r) => r.state === 'due' || r.state === 'never').length
  const today = tracked.filter((r) => r.state === 'due_today').length
  const notYet = tracked.filter((r) => r.state === 'not_yet').length
  const fresh = tracked.filter((r) => r.state === 'fresh').length
  const parts: string[] = []
  parts.push(`${due} due`)
  if (today) parts.push(`${today} due today`)
  if (notYet) parts.push(`${notYet} not yet`)
  if (fresh) parts.push(`${fresh} fresh`)
  return parts.join(' · ')
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** The grey line under a row's name. */
export function describeRoundRow(row: RoundRow, now: Date): string {
  if (row.personal) return 'no mark · opens the page'
  if (row.state === 'never') return 'never marked'
  const parts: string[] = []
  if (row.rhythmDays != null) parts.push(row.rhythmDays === 1 ? 'every day' : `every ${row.rhythmDays} d`)
  if (row.state === 'due') parts.push(row.overDays != null && row.overDays > 0 ? `${row.overDays} d over` : 'due')
  else if (row.state === 'due_today') parts.push('due today')
  else if (row.state === 'not_yet' && row.dueAtMs != null) {
    const days = (row.dueAtMs - now.getTime()) / DAY_MS
    parts.push(days < 1 ? 'due tomorrow' : `due ${new Date(row.dueAtMs).toLocaleDateString('en-US', { weekday: 'short' })}`)
  } else if (row.state === 'fresh' && row.lastMarkedAt) parts.push(`marked ${timeOfDay(row.lastMarkedAt)}`)
  if (row.lastMarkedByName) parts.push(row.lastMarkedByName)
  if (row.needsNote) parts.push('needs a note')
  return parts.join(' · ')
}
