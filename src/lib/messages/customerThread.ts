/**
 * Residential R2, PR 3b: where a customer's name opens their thread. The Messages page in the header (`/messages`,
 * R2 PR 1), with the thread window over it at its URL contract (`?thread=<contact id>&at=<message id>`, cut 1's
 * `useThreadWindow`). The contact is the customer's own, which `contact_for_customer` finds or makes
 * (`messagesIo.contactForCustomer`).
 *
 * A line in a Pipeline job's Job activity opens its thread by who it is with (`threadHrefByKind`): a trade partner's or
 * an architect's on GC projects' Messages, where the GC office works them (`gc/links.ts`), and everyone else's, the
 * job's customer first, on this page.
 */
import { THREAD_AT_PARAM, THREAD_PARAM } from '../../components/gc/messages/useThreadWindow'
import type { ContactKind } from '../contacts/kernel'
import { messagesThreadHref as gcMessagesThreadHref } from '../gc/links'

/** The Messages page's path. */
export const MESSAGES_PATH = '/messages'

/** A person's thread, open over the Messages page, at a line when one is named. */
export function messagesThreadHref(contactId: string, messageId?: string | null): string {
  const q = new URLSearchParams({ [THREAD_PARAM]: contactId })
  if (messageId) q.set(THREAD_AT_PARAM, messageId)
  return `${MESSAGES_PATH}?${q.toString()}`
}

/** The kinds whose threads open on GC projects' Messages: the GC flows' trade partners and architects. */
export const GC_THREAD_KINDS: ReadonlySet<ContactKind> = new Set<ContactKind>(['trade', 'arch'])

/**
 * Where a line's thread opens from Job activity: GC projects' Messages for a trade partner or an architect, and the
 * Messages page for anyone else on a Pipeline job, its customer, a lead, a sub or a number nobody has named.
 */
export function threadHrefByKind(kind: ContactKind, contactId: string, messageId?: string | null): string {
  return GC_THREAD_KINDS.has(kind) ? gcMessagesThreadHref(contactId, messageId) : messagesThreadHref(contactId, messageId)
}

/** The button's words: "Open Dana Whitfield's messages", or the customer's when the name is blank. */
export function messagesButtonLabel(customerName: string | null | undefined): string {
  const name = (customerName ?? '').trim()
  return name ? `Open ${name}’s messages` : 'Open the customer’s messages'
}
