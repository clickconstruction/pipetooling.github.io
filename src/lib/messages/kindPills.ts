/**
 * Messages in the header (residential R2, `RESIDENTIAL_BUILD_PLAN.md` on branch spike/gc-mode): the kind pills over
 * Follow up on `/messages`. Lifted from the residential prototype (`customer-messages-prototype.html` v0.8, the
 * Messages page's `kf` row and `fitsKind`): Customers, Trade partners, Architects, Leads, Subs and Our team (v2.5546) filter
 * one list, and Supply houses and candidates sit under one more pill. Follow up never holds those two kinds (`OFF_FOLLOW_UP`), so
 * that pill shows the people themselves, newest conversation first, and never counts. *New* is R7's lane, not here.
 *
 * The pill lives in the URL (`?kind=customer`), so the Dashboard's Customers line and a link land filtered. Pure.
 */
import type { ContactKind } from '../contacts/kernel'
import { onFollowUp, type FollowUpQueue } from '../followUp/queue'

export type KindPill = 'all' | 'customer' | 'trade' | 'arch' | 'lead' | 'sub' | 'team' | 'more'

export const KIND_PARAM = 'kind'

/** The pill row, in the prototype's order, with each pill's hover words. */
export const KIND_PILLS: ReadonlyArray<{ key: KindPill; label: string; title: string }> = [
  { key: 'all', label: 'All', title: 'Everyone Follow up holds. Supply houses and candidates are under their own pill.' },
  { key: 'customer', label: 'Customers', title: 'The customers, ours and a GC project’s owner.' },
  { key: 'trade', label: 'Trade partners', title: 'The trade partners and the people at them.' },
  { key: 'arch', label: 'Architects', title: 'The architects on our jobs.' },
  { key: 'lead', label: 'Leads', title: 'People who wrote to us and have not booked yet.' },
  { key: 'sub', label: 'Subs', title: 'The subs on our roster.' },
  { key: 'team', label: 'Our team', title: 'The people on our roster who are not subs. Their lines count on Follow up like anyone’s.' },
  {
    key: 'more',
    label: 'Supply houses and candidates',
    title: 'Supply houses and people we may hire. They never count on Follow up, so this shows each one by their last line.',
  },
]

const PILL_KINDS: Record<Exclude<KindPill, 'all'>, ReadonlySet<ContactKind>> = {
  customer: new Set<ContactKind>(['customer']),
  trade: new Set<ContactKind>(['trade']),
  arch: new Set<ContactKind>(['arch']),
  lead: new Set<ContactKind>(['lead']),
  sub: new Set<ContactKind>(['sub']),
  team: new Set<ContactKind>(['team']),
  more: new Set<ContactKind>(['supply_house', 'candidate']),
}

const PILL_KEYS: ReadonlySet<string> = new Set(KIND_PILLS.map((p) => p.key))

/** The pill a URL asks for; All when it asks for none, or for one there is no pill for. */
export function pillOf(search: URLSearchParams): KindPill {
  const raw = search.get(KIND_PARAM)?.trim() ?? ''
  return PILL_KEYS.has(raw) ? (raw as KindPill) : 'all'
}

/** The search with a pill picked, every other param kept. All takes the param away. */
export function withPill(search: URLSearchParams, pill: KindPill): URLSearchParams {
  const next = new URLSearchParams(search)
  if (pill === 'all') next.delete(KIND_PARAM)
  else next.set(KIND_PARAM, pill)
  return next
}

/** Whether a person of this kind shows under a pill. A number nobody has named shows under All alone. */
export function inPill(kind: ContactKind, pill: KindPill): boolean {
  return pill === 'all' || PILL_KINDS[pill].has(kind)
}

/** Whether Follow up holds anyone under a pill. The last pill's kinds are all off Follow up. */
export function pillOnFollowUp(pill: KindPill): boolean {
  return pill === 'all' || [...PILL_KINDS[pill]].some(onFollowUp)
}

/**
 * Follow up's queue under a pill: each section keeps the rows of the people the pill holds, and the badge counts them
 * once each. Clause edits are not a person, so they stay under All. Under All the queue is as the kernel built it.
 */
export function queueForPill<C, N extends { contactId: string }>(
  queue: FollowUpQueue<C, N>,
  contacts: ReadonlyArray<{ id: string; kind: ContactKind }>,
  pill: KindPill,
): FollowUpQueue<C, N> {
  if (pill === 'all') return queue
  const kindById = new Map(contacts.map((c) => [c.id, c.kind]))
  const keep = (row: { contactId: string }) => {
    const kind = kindById.get(row.contactId)
    return kind !== undefined && inPill(kind, pill)
  }
  const newLane = queue.newLane.filter(keep)
  const needsYou = queue.needsYou.filter(keep)
  const needsReply = queue.needsReply.filter(keep)
  const weOwe = queue.weOwe.filter(keep)
  const people = new Set<string>([...newLane, ...needsYou, ...needsReply, ...weOwe].map((r) => r.contactId))
  return {
    newLane,
    needsYou,
    clauses: [],
    needsReply,
    weOwe,
    nudges: queue.nudges.filter(keep),
    onPortal: queue.onPortal,
    count: people.size,
  }
}

/** The people a pill holds, for the list under a pill Follow up never fills. */
export function peopleForPill<T extends { kind: ContactKind }>(contacts: readonly T[], pill: KindPill): T[] {
  return contacts.filter((c) => inPill(c.kind, pill))
}
