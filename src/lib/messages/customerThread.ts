/**
 * Residential R2, PR 3b: where a customer's name opens their thread. The Messages page in the header (`/messages`,
 * R2 PR 1), with the thread window over it at its URL contract (`?thread=<contact id>`, cut 1's `useThreadWindow`).
 * The contact is the customer's own, which `contact_for_customer` finds or makes (`messagesIo.contactForCustomer`).
 */
import { THREAD_PARAM } from '../../components/gc/messages/useThreadWindow'

/** The Messages page's path. */
export const MESSAGES_PATH = '/messages'

/** A person's thread, open over the Messages page. */
export function messagesThreadHref(contactId: string): string {
  return `${MESSAGES_PATH}?${new URLSearchParams({ [THREAD_PARAM]: contactId }).toString()}`
}

/** The button's words: "Open Dana Whitfield's messages", or the customer's when the name is blank. */
export function messagesButtonLabel(customerName: string | null | undefined): string {
  const name = (customerName ?? '').trim()
  return name ? `Open ${name}’s messages` : 'Open the customer’s messages'
}
