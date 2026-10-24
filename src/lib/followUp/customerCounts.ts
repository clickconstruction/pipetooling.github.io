/**
 * Residential build, R8 · 14: the three counts on the Dashboard's Customers line (`dashboardNeedsYou.ts` →
 * `customer-messages`), read off Follow up's own queue (`followUpQueue`) so the line and the page say the same thing.
 * The after state is card 14 of `customer-messages-integrations-mockups.html` on branch spike/gc-mode. Pure:
 * `customerCountsIo.ts` loads the rows.
 *
 * Every count is the people of the pill the line's press opens (`CUSTOMER_MESSAGES_HREF`, `?kind=customer`). Since R7
 * the queue carries the New lane, whose people leave Needs a reply, so *to sort* is the lane under that pill
 * (`newLaneCount`): the line, the New the press lands on, and Sort all there say one number, each person once.
 *
 * On Quickfill the Texts station holds every text waiting on a reply (v2.5823, punch list #157's decision 3), so the
 * line there leaves out a customer whose waiting line is a text (`textsElsewhere`, the ids of the lines that are
 * texts) and keeps the emails, the calls, the voicemails and the portal; each text counts once in the round's *left
 * with work*. The Dashboard's line is unchanged.
 */
import { inPill } from '../messages/kindPills'
import { newLaneCount } from './newLane'
import type { FollowUpQueue, QueueContact } from './queue'

/** The pill the Customers line's press opens: its counts are this pill's people. */
export const CUSTOMERS_PILL = 'customer' as const

/** What the Customers line says: "3 need a reply, 1 we owe, 2 to sort". */
export interface CustomerMessagesCounts {
  /** Customers waiting on our answer, each person once: Needs a reply, and a customer who wrote on their portal page. */
  needReply: number
  /** Customers we owe something: their rows on We owe them. */
  weOwe: number
  /**
   * Customers in New, waiting to be sorted: *Which job?* or *Who has it?*. A sender nobody has named is under All
   * alone, as the Customers pill hides them, so the line never counts them.
   */
  toSort: number
}

export interface CustomerCountsOptions {
  /** The ids of the lines that are texts, when another station holds them: a Needs a reply row landing on one is left out. */
  textsElsewhere?: ReadonlySet<string>
}

export function customerMessageCounts(
  queue: Pick<FollowUpQueue<unknown, { contactId: string }>, 'newLane' | 'needsYou' | 'needsReply' | 'weOwe' | 'calls'>,
  contacts: ReadonlyArray<Pick<QueueContact, 'id' | 'kind'>>,
  opts: CustomerCountsOptions = {},
): CustomerMessagesCounts {
  const kind = new Map(contacts.map((c) => [c.id, c.kind]))
  const isCustomer = (id: string) => {
    const k = kind.get(id)
    return k !== undefined && inPill(k, CUSTOMERS_PILL)
  }
  const replying = new Set<string>()
  for (const r of queue.needsReply) {
    if (!isCustomer(r.contactId)) continue
    if (opts.textsElsewhere && r.landOnId && opts.textsElsewhere.has(r.landOnId)) continue
    replying.add(r.contactId)
  }
  // A customer who wrote on their page waits on us as a text does (`portalNeeds`). A paper left unsigned waits on them.
  for (const r of queue.needsYou) if (r.kind === 'portal' && r.landOnId && isCustomer(r.contactId)) replying.add(r.contactId)
  return {
    needReply: replying.size,
    // A customer we owe something, or a call to make (v2.5596): each person once.
    weOwe: new Set([...queue.weOwe, ...queue.calls].filter((r) => isCustomer(r.contactId)).map((r) => r.contactId)).size,
    toSort: newLaneCount(queue.newLane.filter((r) => isCustomer(r.contactId))),
  }
}
