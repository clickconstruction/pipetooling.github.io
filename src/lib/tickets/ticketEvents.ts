/**
 * Counter tickets (punch list #295, PR 2): how a list hears that a ticket was saved, changed or landed from the
 * phone's queue. A window event, as the task photos use: a list that is not mounted hears nothing and loses nothing,
 * since it reads on its next open.
 */
export const TICKETS_CHANGED_EVENT = 'counter-tickets-changed'

export function announceTickets(ids: ReadonlyArray<string>): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TICKETS_CHANGED_EVENT, { detail: [...ids] }))
}

/** Hear every change until the returned function is called. */
export function onTicketsChanged(listener: (ids: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const handler = (e: Event) => listener(Array.isArray((e as CustomEvent).detail) ? ((e as CustomEvent).detail as string[]) : [])
  window.addEventListener(TICKETS_CHANGED_EVENT, handler)
  return () => window.removeEventListener(TICKETS_CHANGED_EVENT, handler)
}
