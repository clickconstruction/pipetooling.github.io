/**
 * Messages, cut 1: opening a person's thread on /gc, over whatever view is open. The URL holds it (`?thread=<contact
 * id>&at=<message id>`), so a link opens it and Back closes it; the page draws one thread window for it. Follow up's
 * rows, the Messages list and anything else on the page open a thread with `openThread`.
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export const THREAD_PARAM = 'thread'
export const THREAD_AT_PARAM = 'at'

/** The thread the URL holds open, and the line to show. Null: none. */
export function threadFromSearch(search: URLSearchParams): { contactId: string; at: string | null } | null {
  const contactId = search.get(THREAD_PARAM)?.trim()
  if (!contactId) return null
  return { contactId, at: search.get(THREAD_AT_PARAM)?.trim() || null }
}

/** The search with a thread open (and its line), every other param kept. */
export function withThread(search: URLSearchParams, contactId: string, at?: string | null): URLSearchParams {
  const next = new URLSearchParams(search)
  next.set(THREAD_PARAM, contactId)
  if (at) next.set(THREAD_AT_PARAM, at)
  else next.delete(THREAD_AT_PARAM)
  return next
}

/** The search with no thread open, every other param kept. */
export function withoutThread(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search)
  next.delete(THREAD_PARAM)
  next.delete(THREAD_AT_PARAM)
  return next
}

/** The open thread, and the presses that open and close one. */
export function useThreadWindow(): {
  contactId: string | null
  at: string | null
  openThread: (contactId: string, at?: string | null) => void
  closeThread: () => void
} {
  const [search, setSearch] = useSearchParams()
  const open = threadFromSearch(search)
  const openThread = useCallback(
    (contactId: string, at?: string | null) => setSearch((prev) => withThread(prev, contactId, at)),
    [setSearch],
  )
  const closeThread = useCallback(() => setSearch((prev) => withoutThread(prev)), [setSearch])
  return { contactId: open?.contactId ?? null, at: open?.at ?? null, openThread, closeThread }
}
