/**
 * Typed hours (docs/recent-features/v2.4242.md): a clock session is either punched or typed. The
 * database records typed hours in `clock_typed_entries` and says, per session, whether the viewer
 * is held from approving it. This is what the screens read those answers through — the words on
 * the stamp, and which rows an "Approve all" may take.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, formatDenverDateTimeShort, formatDenverTimeOnly, ymdDaysBetween } from '../../utils/dateUtils'

/** `added`: time the clock had not recorded. `trimmed`: punched time that stopped existing. */
export type TypedEntryKind = 'added' | 'trimmed'

export type TypedEntry = {
  id: string
  kind: TypedEntryKind
  typedBy: string | null
  typedByName: string
  typedAt: string
  seconds: number
  daySecondsBefore: number
  daySecondsAfter: number
  /** The person typed their own hours (a late entry), not someone else's. */
  self: boolean
  confirmedByName: string | null
  confirmedAt: string | null
}

/** `own`: the viewer's own hours. `typed`: the viewer typed hours onto it and nobody else has looked. */
export type ApprovalHold = 'own' | 'typed'

export type TypedStamp = {
  hold: ApprovalHold | null
  entries: TypedEntry[]
}

export const NO_TYPED_STAMP: TypedStamp = { hold: null, entries: [] }

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : 0
}

function parseEntry(raw: unknown): TypedEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id)
  const typedAt = str(r.typed_at)
  if (!id || !typedAt) return null
  if (r.kind !== 'added' && r.kind !== 'trimmed') return null
  return {
    id,
    kind: r.kind,
    typedBy: str(r.typed_by),
    typedByName: str(r.typed_by_name) ?? 'Someone',
    typedAt,
    seconds: num(r.seconds),
    daySecondsBefore: num(r.day_seconds_before),
    daySecondsAfter: num(r.day_seconds_after),
    self: r.self === true,
    confirmedByName: str(r.confirmed_by_name),
    confirmedAt: str(r.confirmed_at),
  }
}

/** One row of `clock_typed_stamps` → the session id and its stamp; null for a row that is not one. */
export function parseTypedStampRow(raw: unknown): { sessionId: string; stamp: TypedStamp } | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const sessionId = str(r.session_id)
  if (!sessionId) return null
  const hold: ApprovalHold | null = r.hold === 'own' || r.hold === 'typed' ? r.hold : null
  const entries = Array.isArray(r.entries)
    ? r.entries.map(parseEntry).filter((e): e is TypedEntry => e !== null)
    : []
  return { sessionId, stamp: { hold, entries } }
}

/** The added hours the stamp speaks for: the newest still waiting on a second look, else the newest. */
export function addedEntry(stamp: TypedStamp | null | undefined): TypedEntry | null {
  const added = (stamp?.entries ?? []).filter((e) => e.kind === 'added')
  if (added.length === 0) return null
  const waiting = added.filter((e) => !e.confirmedAt)
  const pool = waiting.length > 0 ? waiting : added
  return pool.reduce((a, b) => (a.typedAt >= b.typedAt ? a : b))
}

/** The newest trim, when the session has no added hours to speak for. */
export function trimmedEntry(stamp: TypedStamp | null | undefined): TypedEntry | null {
  const trimmed = (stamp?.entries ?? []).filter((e) => e.kind === 'trimmed')
  if (trimmed.length === 0) return null
  return trimmed.reduce((a, b) => (a.typedAt >= b.typedAt ? a : b))
}

/** Someone typed time onto this session. */
export function isTypedByHand(stamp: TypedStamp | null | undefined): boolean {
  return addedEntry(stamp) !== null
}

/** Typed time nobody other than the typist has looked at yet. */
export function needsSecondLook(stamp: TypedStamp | null | undefined): boolean {
  return (stamp?.entries ?? []).some((e) => e.kind === 'added' && !e.confirmedAt)
}

/** 39600 → "11.0h"; under six minutes it says minutes ("1 min"), so a sliver never reads "0.0h". */
export function typedHoursShort(seconds: number): string {
  const s = Math.max(0, seconds)
  if (s > 0 && s < 360) return `${Math.max(1, Math.round(s / 60))} min`
  return `${(s / 3600).toFixed(1)}h`
}

/** "Wed 9:40 AM" in the company's time zone; "Sep 22, 9:40 AM" once the weekday alone would be ambiguous. */
export function typedWhenWords(typedAtIso: string, nowMs: number = Date.now()): string {
  const ms = new Date(typedAtIso).getTime()
  if (!Number.isFinite(ms)) return ''
  if (Math.abs(nowMs - ms) >= 6 * 24 * 60 * 60 * 1000) return formatDenverDateTimeShort(ms)
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short' }).format(new Date(ms))
  return `${weekday} ${formatDenverTimeOnly(ms)}`
}

/** Whole days between the day worked and the day it was typed; 0 when typed the same day (or unknown). */
export function typedLateDays(workDateYmd: string | null | undefined, typedAtIso: string): number {
  if (!workDateYmd) return 0
  const typedYmd = calendarYmdInAppTzFromIso(typedAtIso)
  const days = ymdDaysBetween(workDateYmd, typedYmd)
  return days != null && days > 0 ? days : 0
}

/**
 * The stamp's sentence. Someone else's typing: "typed by Taunya · Wed 9:40 AM". A person's own
 * late entry: "typed by Michael A · own entry · 5 days late". A trim: "trimmed by Taunya · …".
 */
export function typedByWords(entry: TypedEntry, workDateYmd?: string | null, nowMs: number = Date.now()): string {
  const verb = entry.kind === 'trimmed' ? 'trimmed by' : 'typed by'
  const parts = [`${verb} ${entry.typedByName}`]
  if (entry.self && entry.kind === 'added') {
    parts.push('own entry')
    const late = typedLateDays(workDateYmd, entry.typedAt)
    if (late > 0) parts.push(`${late} ${late === 1 ? 'day' : 'days'} late`)
    else {
      const when = typedWhenWords(entry.typedAt, nowMs)
      if (when) parts.push(when)
    }
    return parts.join(' · ')
  }
  const when = typedWhenWords(entry.typedAt, nowMs)
  if (when) parts.push(when)
  return parts.join(' · ')
}

/** What the day read before and after: { was: "Nothing recorded", now: "11.0h" }. */
export function dayChangeWords(entry: TypedEntry): { was: string; now: string } {
  return {
    was: entry.daySecondsBefore < 60 ? 'Nothing recorded' : typedHoursShort(entry.daySecondsBefore),
    now: typedHoursShort(entry.daySecondsAfter),
  }
}

/** The second look, once given: "looked at by Cora". */
export function secondLookWords(entry: TypedEntry): string | null {
  if (!entry.confirmedAt) return null
  return `looked at by ${entry.confirmedByName ?? 'someone else'}`
}

/** Why the viewer has no Approve on this row. */
export function holdWords(hold: ApprovalHold): string {
  return hold === 'own'
    ? 'Your own hours — someone else approves them'
    : 'You typed these — waiting on a second person'
}

export type ApproveAllSplit = {
  /** What an "Approve all" may take: not held, and not typed hours still waiting on a look. */
  punchIds: string[]
  /** Typed by someone else, waiting on this viewer's look: approved one at a time, never swept in. */
  typedIds: string[]
  /** The viewer cannot approve these at all. */
  heldIds: string[]
}

/** One row of `list_typed_hours_waiting`: added hours nobody other than the typist has looked at. */
export type TypedWaitingRow = {
  entryId: string
  userId: string
  personName: string
  workDate: string
  typedBy: string | null
  typedByName: string
  typedAt: string
  seconds: number
  daySecondsBefore: number
  daySecondsAfter: number
  selfTyped: boolean
  /** `pending`: a session under it still waits for approval. `approved`: every session under it is approved. */
  state: 'pending' | 'approved'
  sessionIds: string[]
  /** The viewer may give the second look: they did not type it and the hours are not their own. */
  canAct: boolean
}

export function parseTypedWaitingRow(raw: unknown): TypedWaitingRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const entryId = str(r.entry_id)
  const userId = str(r.user_id)
  const workDate = str(r.work_date)
  const typedAt = str(r.typed_at)
  if (!entryId || !userId || !workDate || !typedAt) return null
  return {
    entryId,
    userId,
    personName: str(r.person_name) ?? 'Someone',
    workDate,
    typedBy: str(r.typed_by),
    typedByName: str(r.typed_by_name) ?? 'Someone',
    typedAt,
    seconds: num(r.typed_seconds),
    daySecondsBefore: num(r.day_seconds_before),
    daySecondsAfter: num(r.day_seconds_after),
    selfTyped: r.self_typed === true,
    state: r.state === 'approved' ? 'approved' : 'pending',
    sessionIds: Array.isArray(r.session_ids) ? r.session_ids.filter((x): x is string => typeof x === 'string') : [],
    canAct: r.can_act === true,
  }
}

/** A waiting row as the stamp's entry, so the same words and the same chip draw it. */
export function typedWaitingAsEntry(row: TypedWaitingRow): TypedEntry {
  return {
    id: row.entryId,
    kind: 'added',
    typedBy: row.typedBy,
    typedByName: row.typedByName,
    typedAt: row.typedAt,
    seconds: row.seconds,
    daySecondsBefore: row.daySecondsBefore,
    daySecondsAfter: row.daySecondsAfter,
    self: row.selfTyped,
    confirmedByName: null,
    confirmedAt: null,
  }
}

export type TypedWaitingSummary = {
  /** Entries the viewer can give the second look to. */
  count: number
  seconds: number
  people: number
  /** Of `count`, the ones typed onto hours that are already approved (and so already count in pay). */
  approvedCount: number
  /** "Taunya typed 11.0h for Michael A" — the first entry, for a card that has room for one sentence. */
  firstLine: string | null
}

/** What the Needs You card says: only the rows the viewer can act on count. */
export function summarizeTypedWaiting(rows: readonly TypedWaitingRow[]): TypedWaitingSummary {
  const mine = rows.filter((r) => r.canAct)
  const first = mine[0]
  return {
    count: mine.length,
    seconds: mine.reduce((s, r) => s + r.seconds, 0),
    people: new Set(mine.map((r) => r.userId)).size,
    approvedCount: mine.filter((r) => r.state === 'approved').length,
    firstLine: first
      ? first.selfTyped
        ? `${first.personName} typed ${typedHoursShort(first.seconds)} onto their own day`
        : `${first.typedByName} typed ${typedHoursShort(first.seconds)} for ${first.personName}`
      : null,
  }
}

/**
 * A string that changes when any row's times or approval change — what `useTypedStamps` watches,
 * so typing new times onto a row re-reads its stamp without the list changing its ids.
 */
export function typedStampsVersion(
  rows: readonly { clocked_in_at: string; clocked_out_at: string | null; approved_at?: string | null }[],
): string {
  return rows.map((r) => `${r.clocked_in_at}|${r.clocked_out_at ?? ''}|${r.approved_at ?? ''}`).join(',')
}

/** Sorts a batch for an "Approve all": a hand-typed row is never swept in with the punches. */
export function splitForApproveAll(
  ids: readonly string[],
  stamps: ReadonlyMap<string, TypedStamp>,
): ApproveAllSplit {
  const out: ApproveAllSplit = { punchIds: [], typedIds: [], heldIds: [] }
  for (const id of ids) {
    const stamp = stamps.get(id)
    if (stamp?.hold) out.heldIds.push(id)
    else if (needsSecondLook(stamp)) out.typedIds.push(id)
    else out.punchIds.push(id)
  }
  return out
}

/**
 * What an approve left behind, in words for a toast; null when it left nothing.
 * "1 left for someone else: you typed it." · "2 left for someone else: your own hours."
 */
export function describeHeld(heldOwn: number, heldTyped: number): string | null {
  const total = heldOwn + heldTyped
  if (total <= 0) return null
  const why: string[] = []
  if (heldTyped > 0) why.push(heldOwn > 0 ? `you typed ${heldTyped}` : total === 1 ? 'you typed it' : 'you typed them')
  if (heldOwn > 0) why.push(heldTyped > 0 ? `${heldOwn} ${heldOwn === 1 ? 'is' : 'are'} your own hours` : 'your own hours')
  return `${total} left for someone else: ${why.join(', ')}.`
}
