/**
 * Punch list #140 PR 3: **Show: Mine · Everyone**, the lens beside the kind pills on Messages that narrows every lane
 * of Follow up (and the Sort desk, which walks the lane as drawn) to what I hold. Two values, not three: "Nobody's"
 * inside Needs a reply is empty by design, since a person nobody holds whose newest line is theirs sits in New (the
 * revision of decision 2, BUILD_PLAN § 0.3). Mine is `hasUserId === me.id`, the id and never the name. Written like
 * `queueForPill`: each lane keeps the rows of the people the lens holds, clause edits stay under Everyone, and the
 * count is recounted. Waiting on them and Went out carry no holder, so the lens leaves them alone. Pure; the choice is
 * kept per browser.
 */
import type { FollowUpQueue } from '../followUp/queue'

export type ShowLens = 'mine' | 'everyone'

export const SHOW_WORDS = {
  label: 'Show',
  mine: 'Mine',
  everyone: 'Everyone',
  mineTip: 'Only the people you hold, in every list. The Sort desk walks these too.',
  everyoneTip: 'Everyone Follow up holds, whoever has them.',
  /** Under Mine, the lists the lens leaves alone say so. */
  notNarrowed: 'Waiting on them and Went out show everyone. Nobody holds a send.',
} as const

export const SHOW_STORAGE_KEY = 'messages_show_lens'

/** The lens kept on this browser; Everyone when none is, or when the browser keeps nothing. */
export function readLens(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): ShowLens {
  try {
    return storage?.getItem(SHOW_STORAGE_KEY) === 'mine' ? 'mine' : 'everyone'
  } catch {
    return 'everyone'
  }
}

export function keepLens(lens: ShowLens, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(SHOW_STORAGE_KEY, lens)
  } catch {
    // A browser that keeps nothing starts on Everyone next time.
  }
}

/** Who the lens holds: the people whose holder is me. */
function heldBy(contacts: ReadonlyArray<{ id: string; hasUserId: string | null }>, meId: string): Set<string> {
  return new Set(contacts.filter((c) => meId !== '' && c.hasUserId === meId).map((c) => c.id))
}

/**
 * Follow up's queue under the lens: Everyone is the queue as built; Mine keeps the rows of the people I hold, with the
 * badge recounted. The nudges and the clause rows are nobody's and drop out under Mine.
 */
export function queueForShow<C, N extends { contactId: string }>(
  queue: FollowUpQueue<C, N>,
  contacts: ReadonlyArray<{ id: string; hasUserId: string | null }>,
  lens: ShowLens,
  meId: string,
): FollowUpQueue<C, N> {
  if (lens === 'everyone') return queue
  const mine = heldBy(contacts, meId)
  const keep = (row: { contactId: string }) => mine.has(row.contactId)
  const newLane = queue.newLane.filter(keep)
  const needsYou = queue.needsYou.filter(keep)
  const needsReply = queue.needsReply.filter(keep)
  const weOwe = queue.weOwe.filter(keep)
  const calls = queue.calls.filter(keep)
  const people = new Set<string>([...newLane, ...needsYou, ...needsReply, ...weOwe, ...calls].map((r) => r.contactId))
  return {
    newLane,
    needsYou,
    clauses: [],
    needsReply,
    weOwe,
    calls,
    nudges: queue.nudges.filter(keep),
    onPortal: queue.onPortal,
    count: people.size,
  }
}

/** The two counts for the lens's buttons: how many people I hold on Follow up, and everyone it counts. */
export function lensCounts<C, N extends { contactId: string }>(
  queue: FollowUpQueue<C, N>,
  contacts: ReadonlyArray<{ id: string; hasUserId: string | null }>,
  meId: string,
): { mine: number; everyone: number } {
  return { mine: queueForShow(queue, contacts, 'mine', meId).count, everyone: queue.count }
}
