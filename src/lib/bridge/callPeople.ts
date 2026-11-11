import type { CallLink, CallMove, MoveKey } from './calls'
import { THIS_WEEK_DOORS } from './thisWeek'

/**
 * The call reaches its people (v2.6864, punch list #303, PR 4).
 *
 * A call names the week's moves and a person on each. Until this version the person was a word
 * in a box, and the people named are mostly office accounts that cannot open the Bridge. Now a
 * move carries the person's account (`whoId`), that person reads their own moves on the Needs
 * you card through `bridge_my_moves`, and their Done press stamps the move
 * (`bridge_mark_my_move_done`), which the Bridge's card shows beside what the numbers say.
 *
 * `calls.ts` is copied to the edge functions and knows none of this: a move's extra fields ride
 * in the same jsonb, written and read here. Pure: no React, no Supabase (the reads and the
 * write are `callPeopleIo.ts`).
 */

/** A move as the Bridge writes it since v2.6864: `whoId` is the person's account, null for a name typed with no account. */
export type RecordedMove = CallMove & { whoId: string | null }

/** Someone the card can put on a move: a teammate's own account, with a Needs you card to land on. */
export type CallPerson = { id: string; name: string }

/** An account as the picker reads it. */
export type CallPersonRow = { userId: string; name: string; archived: boolean; role?: string | null; twin?: boolean; readOnly?: boolean }

/**
 * The accounts the picker lists, by name: no archived account, no subcontractor (their app has no Needs you card), no
 * digital twin, no training account, no one twice, no one with no name.
 */
export function callPeople(people: ReadonlyArray<CallPersonRow>): CallPerson[] {
  const seen = new Set<string>()
  const out: CallPerson[] = []
  for (const p of people) {
    const name = p.name.trim()
    if (p.archived || p.twin || p.readOnly || p.role === 'subcontractor' || !name || name === 'Unnamed' || seen.has(p.userId)) continue
    seen.add(p.userId)
    out.push({ id: p.userId, name })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
}

/** The name the chip prints for a person: the first name, or the whole name when another on the list shares it. */
export function chipName(person: CallPerson, people: ReadonlyArray<CallPerson>): string {
  const first = person.name.split(/\s+/)[0] ?? person.name
  const shared = people.some((p) => p.id !== person.id && (p.name.split(/\s+/)[0] ?? p.name).toLowerCase() === first.toLowerCase())
  return shared ? person.name : first
}

/** A person's Done press on one move of a call, read back for the Bridge's card. */
export type MoveMark = { callId: string; idx: number; doneBy: string }

/** Pure: the calls' raw `moves` → the Done stamps on them. */
export function parseMoveMarks(rows: ReadonlyArray<{ id: string; moves: unknown }>): MoveMark[] {
  const out: MoveMark[] = []
  for (const r of rows) {
    if (!Array.isArray(r.moves)) continue
    r.moves.forEach((m, idx) => {
      const move = (m ?? {}) as Record<string, unknown>
      if (typeof move.doneAt === 'string' && move.doneAt) out.push({ callId: r.id, idx, doneBy: typeof move.doneBy === 'string' ? move.doneBy.trim() : '' })
    })
  }
  return out
}

/** One of the viewer's own open moves, as `bridge_my_moves` hands it over. */
export type MyMove = { callId: string; idx: number; key: MoveKey; title: string; link: CallLink; calledByName: string }

const KEYS: ReadonlyArray<MoveKey> = ['bill', 'chase', 'approve', 'price', 'pct', 'other']

/** Pure: the function's rows → the viewer's moves, in the call's order. Anything that does not read is left out. */
export function parseMyMoves(rows: unknown): MyMove[] {
  if (!Array.isArray(rows)) return []
  const out: MyMove[] = []
  for (const row of rows) {
    const r = (row ?? {}) as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    if (typeof r.call_id !== 'string' || typeof r.idx !== 'number' || !title) continue
    const key = KEYS.includes(r.move_key as MoveKey) ? (r.move_key as MoveKey) : 'other'
    out.push({ callId: r.call_id, idx: r.idx, key, title, link: (typeof r.link === 'string' ? r.link : 'bill') as CallLink, calledByName: typeof r.called_by_name === 'string' ? r.called_by_name.trim() : '' })
  }
  return out.sort((a, b) => a.idx - b.idx)
}

/** Where a move's work is done; null for a move the app has no page for. */
export function moveDoor(key: MoveKey): { to: string; label: string } | null {
  if (key === 'bill') return THIS_WEEK_DOORS.stages
  if (key === 'chase') return THIS_WEEK_DOORS.billing
  if (key === 'approve') return THIS_WEEK_DOORS.approvals
  if (key === 'price' || key === 'pct') return THIS_WEEK_DOORS.jobs
  return null
}

export const MY_MOVES_WORDS = { kicker: 'The week’s call', done: 'Done', markDone: 'Mark it done' } as const

/** The Needs you line for the viewer's moves: the first move is the one its button works. */
export type MyMovesNeed = {
  count: number
  title: string
  detail: string
  first: MyMove
  /** The first move's page; null when the app has none, and the button marks it done. */
  door: { to: string; label: string } | null
}

export function myMovesNeed(moves: ReadonlyArray<MyMove>): MyMovesNeed | null {
  const first = moves[0]
  if (!first) return null
  const by = first.calledByName ? `${first.calledByName} put it on the week’s call.` : 'It is on the week’s call.'
  const rest = moves.length - 1
  return {
    count: moves.length,
    title: first.title,
    detail: rest > 0 ? `${by} ${rest === 1 ? 'One more move is yours after it.' : `${rest} more moves are yours after it.`}` : `${by} Friday asks if it moved.`,
    first,
    door: moveDoor(first.key),
  }
}
