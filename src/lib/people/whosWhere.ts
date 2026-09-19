/**
 * People → Who's where (to-dos/whos-where, PR 1): the kernel.
 *
 * The page is a projection of two tables the app already fills — `clock_sessions`
 * (what happened) and `job_schedule_blocks` (what Dispatch meant to happen) — onto
 * one moment of one day: one island per job with a head per person. Solid heads are
 * clocked in at that minute; hollow heads are listed for that job and time but not
 * clocked in anywhere. Nothing here is typed by anyone and nothing is written back.
 *
 * Pure: no React, no supabase, no clock. Every time is a minute of the company wall
 * clock (America/Chicago), 0–1440; cross-midnight work clamps to 1440 on its clock-in
 * date, the app's rule (see `teamBoard.ts` `sessionWindow`). Open sessions (no
 * clock-out yet) count as "in" from their clock-in onward — the Dashboard clock strip
 * reads them the same way, and this page must agree with it at *now*.
 */
import { formatHourLabel, targetKeyFor, wallClockHours } from '../teamBoard'
import { initialsFor } from '../checklistTeamBoard'

export const WW_NONE_TARGET = 'none'
export const WW_MINUTES_IN_DAY = 1440

export type WwPerson = { id: string; name: string; role: string | null }

export type WwTarget = {
  key: string
  /** "J258 · Oak St" — the ledger short line; "Office" for the overhead job. */
  label: string
  /** The customer when it is not already the job name; null otherwise. */
  detail: string | null
  address: string | null
  isOffice: boolean
}

export type WwSession = {
  id: string
  userId: string
  workDate: string
  startMin: number
  /** null = still clocked in (or the clock-out was never recorded). */
  endMin: number | null
  targetKey: string
}

export type WwBlock = {
  id: string
  userId: string
  workDate: string
  startMin: number
  endMin: number
  targetKey: string
  /** Rows sharing a non-null group id are one linked crew block (Dispatch's own crew). */
  groupId: string | null
}

export type WhosWhereData = {
  sessions: WwSession[]
  blocks: WwBlock[]
  roster: WwPerson[]
  targets: Record<string, WwTarget>
}

export type WwHeadState = 'in' | 'listed'

export type WwHead = {
  person: WwPerson
  state: WwHeadState
  /** 'in': the clock-in minute; 'listed': the block's start. */
  startMin: number
  /** 'in': the clock-out minute or null while open; 'listed': the block's end. */
  endMin: number | null
  /** For an 'in' head: the label of the job they were listed at instead, when it differs. */
  listedAt: string | null
}

export type WwIsland = { target: WwTarget; heads: WwHead[] }

export type WwMoment = {
  minute: number
  islands: WwIsland[]
  /** Clocked in at the moment with no job or bid on the session. */
  noJob: WwHead[]
  /** Roster people with no session and no block on the day at all. */
  notIn: WwPerson[]
  /** Distinct people on an island or in the no-job rail at the moment. */
  present: number
}

export type WwLaneBar = {
  person: WwPerson
  kind: WwHeadState
  startMin: number
  endMin: number | null
  /** "never clocked" · "clocked at J273 · Lamar" · "listed at J258 · Oak St" */
  note: string | null
}

export type WwLane = { target: WwTarget; bars: WwLaneBar[] }

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Minute of the company wall-clock day (0–1439) for an ISO instant. */
export function wallClockMinutes(iso: string): number {
  return Math.round(wallClockHours(iso) * 60) % WW_MINUTES_IN_DAY
}

/**
 * A session's window on its clock-in date. An out time past midnight clamps to
 * 1440; an out time earlier than in (clock drift) is treated as still open so the
 * head is not lost. Returns null only when the clock-in cannot be read.
 */
export function sessionMinutes(clockedInAt: string, clockedOutAt: string | null): { startMin: number; endMin: number | null } | null {
  const inMs = Date.parse(clockedInAt)
  if (!Number.isFinite(inMs)) return null
  const startMin = wallClockMinutes(clockedInAt)
  if (!clockedOutAt) return { startMin, endMin: null }
  const outMs = Date.parse(clockedOutAt)
  if (!Number.isFinite(outMs) || outMs <= inMs) return { startMin, endMin: null }
  const endMin = Math.min(WW_MINUTES_IN_DAY, startMin + Math.round((outMs - inMs) / 60_000))
  return { startMin, endMin }
}

/** "07:00", "07:00:00", "7:00:00.5" → minutes past midnight; anything unreadable → 0. */
export function pgTimeMinutes(pgTime: string | null | undefined): number {
  if (!pgTime) return 0
  const m = /^(\d{1,2}):(\d{2})/.exec(pgTime.trim())
  if (!m) return 0
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return 0
  return Math.max(0, Math.min(WW_MINUTES_IN_DAY, h * 60 + min))
}

/** "10:40a" / "3p" — the team board's compact clock label, from a minute. */
export function formatMinuteLabel(minute: number): string {
  return formatHourLabel(Math.max(0, Math.min(WW_MINUTES_IN_DAY, minute)) / 60)
}

/** "7:02a–3:20p" / "7:02a–" while open. */
export function formatMinuteWindow(startMin: number, endMin: number | null): string {
  return `${formatMinuteLabel(startMin)}–${endMin == null ? '' : formatMinuteLabel(endMin)}`
}

export { targetKeyFor as wwTargetKeyFor, initialsFor as wwInitials }

// ---------------------------------------------------------------------------
// Roles → rings
// ---------------------------------------------------------------------------

export type WwRing = { color: string; label: string }

const RING_MASTER: WwRing = { color: 'var(--text-link)', label: 'master' }
const RING_SUB: WwRing = { color: '#7c5cff', label: 'sub' }
const RING_HELPER: WwRing = { color: '#16a34a', label: 'helper' }
const RING_OFFICE: WwRing = { color: '#14b8a6', label: 'office' }
const RING_OTHER: WwRing = { color: 'var(--text-faint)', label: 'other' }

/** The ring a head wears: master · sub · helper · office. Saturated status colours stay literal (repo rule). */
export function roleRing(role: string | null | undefined): WwRing {
  switch (role) {
    case 'master_technician':
      return RING_MASTER
    case 'subcontractor':
      return RING_SUB
    case 'helpers':
      return RING_HELPER
    case 'dev':
    case 'assistant':
    case 'controller':
    case 'estimator':
    case 'primary':
    case 'superintendent':
      return RING_OFFICE
    default:
      return RING_OTHER
  }
}

export const WW_RING_LEGEND: readonly WwRing[] = [RING_MASTER, RING_SUB, RING_HELPER, RING_OFFICE]

// ---------------------------------------------------------------------------
// The moment
// ---------------------------------------------------------------------------

function unknownTarget(key: string): WwTarget {
  return { key, label: key === WW_NONE_TARGET ? 'No job' : 'Unknown job', detail: null, address: null, isOffice: false }
}

function targetOf(data: WhosWhereData, key: string): WwTarget {
  return data.targets[key] ?? unknownTarget(key)
}

function personOf(byId: Map<string, WwPerson>, userId: string): WwPerson {
  return byId.get(userId) ?? { id: userId, name: 'Unknown', role: null }
}

function rosterById(data: WhosWhereData): Map<string, WwPerson> {
  return new Map(data.roster.map((p) => [p.id, p]))
}

function sessionSpans(s: WwSession, minute: number): boolean {
  return s.startMin <= minute && (s.endMin == null || minute < s.endMin)
}

function blockSpans(b: WwBlock, minute: number): boolean {
  return b.startMin <= minute && minute < b.endMin
}

function compareIslands(a: WwIsland, b: WwIsland): number {
  if (a.target.isOffice !== b.target.isOffice) return a.target.isOffice ? 1 : -1
  if (a.heads.length !== b.heads.length) return b.heads.length - a.heads.length
  return a.target.label.localeCompare(b.target.label)
}

function compareHeads(a: WwHead, b: WwHead): number {
  if (a.state !== b.state) return a.state === 'in' ? -1 : 1
  if (a.startMin !== b.startMin) return a.startMin - b.startMin
  return a.person.name.localeCompare(b.person.name)
}

/**
 * The picture at one minute of one day: islands with heads, the no-job rail, and
 * who was not in at all. A person clocked in anywhere is never also a hollow head;
 * a person listed on two blocks at once appears on both islands, hollow.
 */
export function islandsAt(data: WhosWhereData, dayYmd: string, minute: number): WwMoment {
  const byId = rosterById(data)
  const daySessions = data.sessions.filter((s) => s.workDate === dayYmd)
  const dayBlocks = data.blocks.filter((b) => b.workDate === dayYmd)

  const inNow = daySessions.filter((s) => sessionSpans(s, minute))
  const inUserIds = new Set(inNow.map((s) => s.userId))
  const listedNow = dayBlocks.filter((b) => blockSpans(b, minute))

  const islands = new Map<string, WwIsland>()
  const noJob: WwHead[] = []
  const ensure = (key: string): WwIsland => {
    let island = islands.get(key)
    if (!island) {
      island = { target: targetOf(data, key), heads: [] }
      islands.set(key, island)
    }
    return island
  }

  for (const s of inNow) {
    const person = personOf(byId, s.userId)
    const elsewhere = listedNow.find((b) => b.userId === s.userId && b.targetKey !== s.targetKey)
    const head: WwHead = { person, state: 'in', startMin: s.startMin, endMin: s.endMin, listedAt: elsewhere ? targetOf(data, elsewhere.targetKey).label : null }
    if (s.targetKey === WW_NONE_TARGET) noJob.push(head)
    else {
      const island = ensure(s.targetKey)
      // Two open sessions on one job for one person (a re-clock) draw one head.
      if (!island.heads.some((h) => h.person.id === person.id && h.state === 'in')) island.heads.push(head)
    }
  }

  for (const b of listedNow) {
    if (inUserIds.has(b.userId)) continue
    if (b.targetKey === WW_NONE_TARGET) continue
    const island = ensure(b.targetKey)
    if (island.heads.some((h) => h.person.id === b.userId)) continue
    island.heads.push({ person: personOf(byId, b.userId), state: 'listed', startMin: b.startMin, endMin: b.endMin, listedAt: null })
  }

  const seenToday = new Set<string>()
  for (const s of daySessions) seenToday.add(s.userId)
  for (const b of dayBlocks) seenToday.add(b.userId)
  const notIn = data.roster.filter((p) => !seenToday.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))

  const list = [...islands.values()]
  for (const island of list) island.heads.sort(compareHeads)
  list.sort(compareIslands)
  noJob.sort(compareHeads)

  const present = new Set<string>()
  for (const island of list) for (const h of island.heads) present.add(h.person.id)
  for (const h of noJob) present.add(h.person.id)

  return { minute, islands: list, noJob, notIn, present: present.size }
}

// ---------------------------------------------------------------------------
// The day as lanes
// ---------------------------------------------------------------------------

/**
 * One row per job with anyone clocked or listed that day; bars from in to out,
 * listed-not-clocked as a hollow bar. Where the plan and the clock disagree the bar
 * says so: a listed bar with no session anywhere that day reads "never clocked", one
 * whose person clocked a different job reads "clocked at …", and a session bar whose
 * person was listed only elsewhere reads "listed at …".
 */
export function dayLanes(data: WhosWhereData, dayYmd: string): WwLane[] {
  const byId = rosterById(data)
  const daySessions = data.sessions.filter((s) => s.workDate === dayYmd)
  const dayBlocks = data.blocks.filter((b) => b.workDate === dayYmd)

  const sessionTargetsByUser = new Map<string, Set<string>>()
  for (const s of daySessions) {
    const set = sessionTargetsByUser.get(s.userId) ?? new Set<string>()
    set.add(s.targetKey)
    sessionTargetsByUser.set(s.userId, set)
  }
  const blockTargetsByUser = new Map<string, Set<string>>()
  for (const b of dayBlocks) {
    const set = blockTargetsByUser.get(b.userId) ?? new Set<string>()
    set.add(b.targetKey)
    blockTargetsByUser.set(b.userId, set)
  }

  const lanes = new Map<string, WwLane>()
  const ensure = (key: string): WwLane => {
    let lane = lanes.get(key)
    if (!lane) {
      lane = { target: targetOf(data, key), bars: [] }
      lanes.set(key, lane)
    }
    return lane
  }

  for (const s of daySessions) {
    const blocksFor = blockTargetsByUser.get(s.userId)
    let note: string | null = null
    const other = blocksFor && !blocksFor.has(s.targetKey) ? [...blocksFor][0] : undefined
    if (other) note = `listed at ${targetOf(data, other).label}`
    ensure(s.targetKey).bars.push({ person: personOf(byId, s.userId), kind: 'in', startMin: s.startMin, endMin: s.endMin, note })
  }

  for (const b of dayBlocks) {
    const sessionsFor = sessionTargetsByUser.get(b.userId)
    if (sessionsFor?.has(b.targetKey)) continue
    const other = sessionsFor ? [...sessionsFor][0] : undefined
    const note = other ? `clocked at ${targetOf(data, other).label}` : 'never clocked'
    ensure(b.targetKey).bars.push({ person: personOf(byId, b.userId), kind: 'listed', startMin: b.startMin, endMin: b.endMin, note })
  }

  const list = [...lanes.values()]
  for (const lane of list) {
    lane.bars.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'in' ? -1 : 1
      if (a.startMin !== b.startMin) return a.startMin - b.startMin
      return a.person.name.localeCompare(b.person.name)
    })
  }
  list.sort((a, b) => {
    if (a.target.isOffice !== b.target.isOffice) return a.target.isOffice ? 1 : -1
    if (a.bars.length !== b.bars.length) return b.bars.length - a.bars.length
    return a.target.label.localeCompare(b.target.label)
  })
  return list
}

// ---------------------------------------------------------------------------
// The strip and the scrubber
// ---------------------------------------------------------------------------

/** Distinct people with a session or a block on each day. */
export function dayHeadCounts(data: WhosWhereData, ymds: readonly string[]): Record<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const y of ymds) sets.set(y, new Set())
  for (const s of data.sessions) sets.get(s.workDate)?.add(s.userId)
  for (const b of data.blocks) sets.get(b.workDate)?.add(b.userId)
  const out: Record<string, number> = {}
  for (const y of ymds) out[y] = sets.get(y)?.size ?? 0
  return out
}

export const WW_SCRUBBER_DEFAULT = { startMin: 5 * 60, endMin: 19 * 60 } as const

/**
 * The scrubber's range for a day: 5 am–7 pm, widened to whole hours when the day's
 * sessions or blocks fall outside it. An open session widens to the end of the day.
 */
export function scrubberDomain(data: WhosWhereData, dayYmd: string): { startMin: number; endMin: number } {
  let startMin: number = WW_SCRUBBER_DEFAULT.startMin
  let endMin: number = WW_SCRUBBER_DEFAULT.endMin
  for (const s of data.sessions) {
    if (s.workDate !== dayYmd) continue
    startMin = Math.min(startMin, s.startMin)
    endMin = Math.max(endMin, s.endMin ?? WW_MINUTES_IN_DAY)
  }
  for (const b of data.blocks) {
    if (b.workDate !== dayYmd) continue
    startMin = Math.min(startMin, b.startMin)
    endMin = Math.max(endMin, b.endMin)
  }
  startMin = Math.max(0, Math.floor(startMin / 60) * 60)
  endMin = Math.min(WW_MINUTES_IN_DAY, Math.ceil(endMin / 60) * 60)
  if (endMin <= startMin) endMin = Math.min(WW_MINUTES_IN_DAY, startMin + 60)
  return { startMin, endMin }
}

/** The number of people on an island or in the no-job rail at a minute. */
export function presentAt(data: WhosWhereData, dayYmd: string, minute: number): number {
  return islandsAt(data, dayYmd, minute).present
}

/**
 * The minute with the most people placed, sampled every 15 minutes across the
 * domain; the earliest such minute on a tie. The domain's start when the day is empty.
 */
export function busiestMinute(data: WhosWhereData, dayYmd: string, domain: { startMin: number; endMin: number } = scrubberDomain(data, dayYmd)): number {
  let best = domain.startMin
  let bestCount = -1
  for (let m = domain.startMin; m <= domain.endMin; m += 15) {
    const n = presentAt(data, dayYmd, m)
    if (n > bestCount) {
      bestCount = n
      best = m
    }
  }
  return best
}

/**
 * Where the scrubber lands when a day opens: *now* for today while someone is on a
 * job, else the day's busiest minute — so an evening visit does not open on an
 * empty board. `nowMinute` is null for any day but today.
 */
export function defaultMinute(data: WhosWhereData, dayYmd: string, nowMinute: number | null): number {
  const domain = scrubberDomain(data, dayYmd)
  if (nowMinute != null && nowMinute >= domain.startMin && nowMinute <= domain.endMin && presentAt(data, dayYmd, nowMinute) > 0) return nowMinute
  return busiestMinute(data, dayYmd, domain)
}

/** Hour tick marks for a domain, every `stepHours` hours, as minutes. */
export function scrubberTicks(domain: { startMin: number; endMin: number }, stepHours = 2): number[] {
  const out: number[] = []
  for (let m = domain.startMin; m <= domain.endMin; m += stepHours * 60) out.push(m)
  return out
}

/** Where a minute sits on a track, 0–100. */
export function trackPercent(minute: number, domain: { startMin: number; endMin: number }): number {
  const span = domain.endMin - domain.startMin
  if (span <= 0) return 0
  return Math.max(0, Math.min(100, ((minute - domain.startMin) / span) * 100))
}
