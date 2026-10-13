/**
 * Residential build, R8 · 14: the three counts on the Dashboard's Customers line (`dashboardNeedsYou.ts` →
 * `customer-messages`), read off Follow up's own queue (`followUpQueue`) so the line and the page say the same thing.
 * The after state is card 14 of `customer-messages-integrations-mockups.html` on branch spike/gc-mode. Pure:
 * `customerCountsIo.ts` loads the rows.
 */
import type { FollowUpQueue, QueueContact } from './queue'

/** What the Customers line says: "3 need a reply, 1 we owe, 2 to sort". */
export interface CustomerMessagesCounts {
  /** Customers waiting on our answer, each person once: Needs a reply, and a customer who wrote on their portal page. */
  needReply: number
  /** Customers we owe something: their rows on We owe them. */
  weOwe: number
  /**
   * Senders nobody has named yet: the Who is this? rows of Needs a reply. They are not customers yet, so `needReply`
   * never counts them too. R7's `followUp/newLane.ts` replaces this with the New lane's count.
   */
  toSort: number
}

export function customerMessageCounts(
  queue: Pick<FollowUpQueue<unknown, { contactId: string }>, 'needsYou' | 'needsReply' | 'weOwe'>,
  contacts: ReadonlyArray<Pick<QueueContact, 'id' | 'kind'>>,
): CustomerMessagesCounts {
  const kind = new Map(contacts.map((c) => [c.id, c.kind]))
  const isCustomer = (id: string) => kind.get(id) === 'customer'
  const replying = new Set<string>()
  for (const r of queue.needsReply) if (isCustomer(r.contactId)) replying.add(r.contactId)
  // A customer who wrote on their page waits on us as a text does (`portalNeeds`). A paper left unsigned waits on them.
  for (const r of queue.needsYou) if (r.kind === 'portal' && r.landOnId && isCustomer(r.contactId)) replying.add(r.contactId)
  return {
    needReply: replying.size,
    weOwe: queue.weOwe.filter((r) => isCustomer(r.contactId)).length,
    toSort: queue.needsReply.filter((r) => kind.get(r.contactId) === 'unknown').length,
  }
}
