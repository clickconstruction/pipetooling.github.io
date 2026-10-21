/**
 * Messages, cut 1: opening a person's thread on /gc, over whatever view is open. The URL holds it (`?thread=<contact
 * id>&at=<message id>`), so a link opens it and Back closes it; the page draws one thread window for it. Follow up's
 * rows, the Messages list and anything else on the page open a thread with `openThread`. Since punch list #140 PR 4 the
 * URL may carry a nudge too (`?nudge=text|email`): the box opens with the step's reminder written and the send window
 * open (`reply/NudgedReplyBox.tsx`); it goes with the thread, so Back and the next thread start clean.
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { nudgeKindOf, type NudgeKind } from '../../../lib/messages/nudgeDraft'

export const THREAD_PARAM = 'thread'
export const THREAD_AT_PARAM = 'at'
export const THREAD_NUDGE_PARAM = 'nudge'

/** What an opener may ask of the thread besides the line to show: the nudge, written and ready to send. */
export interface OpenThreadMore {
  nudge?: NudgeKind | null
}

/** The thread the URL holds open, the line to show, and the nudge asked when one is. Null: none. */
export function threadFromSearch(search: URLSearchParams): { contactId: string; at: string | null; nudge?: NudgeKind } | null {
  const contactId = search.get(THREAD_PARAM)?.trim()
  if (!contactId) return null
  const nudge = nudgeKindOf(search.get(THREAD_NUDGE_PARAM))
  return { contactId, at: search.get(THREAD_AT_PARAM)?.trim() || null, ...(nudge ? { nudge } : {}) }
}

/** The search with a thread open (its line, and the nudge when asked), every other param kept. */
export function withThread(search: URLSearchParams, contactId: string, at?: string | null, nudge?: NudgeKind | null): URLSearchParams {
  const next = new URLSearchParams(search)
  next.set(THREAD_PARAM, contactId)
  if (at) next.set(THREAD_AT_PARAM, at)
  else next.delete(THREAD_AT_PARAM)
  if (nudge) next.set(THREAD_NUDGE_PARAM, nudge)
  else next.delete(THREAD_NUDGE_PARAM)
  return next
}

/** The search with no thread open, every other param kept. */
export function withoutThread(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search)
  next.delete(THREAD_PARAM)
  next.delete(THREAD_AT_PARAM)
  next.delete(THREAD_NUDGE_PARAM)
  return next
}

/** The open thread, and the presses that open and close one. */
export function useThreadWindow(): {
  contactId: string | null
  at: string | null
  /** The nudge the opener asked for, or null: the box reads it once, when the thread opens. */
  nudge: NudgeKind | null
  openThread: (contactId: string, at?: string | null, more?: OpenThreadMore) => void
  closeThread: () => void
} {
  const [search, setSearch] = useSearchParams()
  const open = threadFromSearch(search)
  const openThread = useCallback(
    (contactId: string, at?: string | null, more?: OpenThreadMore) => setSearch((prev) => withThread(prev, contactId, at, more?.nudge)),
    [setSearch],
  )
  const closeThread = useCallback(() => setSearch((prev) => withoutThread(prev)), [setSearch])
  return { contactId: open?.contactId ?? null, at: open?.at ?? null, nudge: open?.nudge ?? null, openThread, closeThread }
}
