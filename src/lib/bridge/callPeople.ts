import type { CallMove } from './calls'

/**
 * The people a thing on the Bridge can go to, and the marks on calls already on record.
 *
 * From v2.6864 (punch list #303, PR 4) a call named a person on each move, that person read their own moves on the
 * Needs you card and their Done press stamped the move. The call came off the Bridge with punch list #334, PR 7:
 * the page records no call, and the Needs you line and its two database functions are no longer called. What is left
 * here is the list of accounts, and the shape of a recorded move and of a Done stamp, which the Monday email still
 * reads from calls on record.
 *
 * `calls.ts` is copied to the edge functions and knows none of this: a move's extra fields ride in the same jsonb.
 * Pure: no React, no Supabase (the read is `callPeopleIo.ts`).
 */

/** A move as the Bridge writes it since v2.6864: `whoId` is the person's account, null for a name typed with no account. */
export type RecordedMove = CallMove & { whoId: string | null }

/** A teammate's own account. */
export type CallPerson = { id: string; name: string }

/** An account as the list reads it. */
export type CallPersonRow = { userId: string; name: string; archived: boolean; role?: string | null; twin?: boolean; readOnly?: boolean }

/**
 * The accounts the list holds, by name: no archived account, no subcontractor, no
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

/** A person's Done press on one move of a call on record, read back for the Monday email. */
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
