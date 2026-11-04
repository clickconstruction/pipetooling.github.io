/**
 * Messages, cut 1: opening a person's thread on /gc, over whatever view is open. The URL holds it (`?thread=<contact
 * id>&at=<message id>`), so a link opens it and Back closes it; the page draws one thread window for it. Follow up's
 * rows, the Messages list and anything else on the page open a thread with `openThread`. Since punch list #140 PR 4 the
 * URL may carry a nudge too (`?nudge=text|email`): the box opens with the step's reminder written and the send window
 * open (`reply/NudgedReplyBox.tsx`); it goes with the thread, so Back and the next thread start clean. Since v2.6513 a
 * reply kind too (`?reply=text|email`): a press on a number or an address in an email's words opens the thread with
 * the box woken on that kind (`startKind`), the same thread or another person's.
 */
import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { nudgeKindOf, type NudgeKind } from '../../../lib/messages/nudgeDraft'
import type { ReplyKind } from '../../../lib/messages/compose'

export const THREAD_PARAM = 'thread'
export const THREAD_AT_PARAM = 'at'
export const THREAD_NUDGE_PARAM = 'nudge'
export const THREAD_REPLY_PARAM = 'reply'

/** The kinds a press may open the box on: a text or an email, the two that go to a number or an address. */
export type StartReplyKind = Extract<ReplyKind, 'text' | 'email'>

/** The URL's reply kind, or null for none or a word it does not know. */
export function startReplyKindOf(raw: string | null | undefined): StartReplyKind | null {
  return raw === 'text' || raw === 'email' ? raw : null
}

/** What an opener may ask of the thread besides the line to show: the nudge, written and ready to send, or the box woken on a kind. */
export interface OpenThreadMore {
  nudge?: NudgeKind | null
  reply?: StartReplyKind | null
}

/** The thread the URL holds open, the line to show, and the nudge asked when one is. Null: none. */
export function threadFromSearch(search: URLSearchParams): { contactId: string; at: string | null; nudge?: NudgeKind; reply?: StartReplyKind } | null {
  const contactId = search.get(THREAD_PARAM)?.trim()
  if (!contactId) return null
  const nudge = nudgeKindOf(search.get(THREAD_NUDGE_PARAM))
  const reply = startReplyKindOf(search.get(THREAD_REPLY_PARAM))
  return { contactId, at: search.get(THREAD_AT_PARAM)?.trim() || null, ...(nudge ? { nudge } : {}), ...(reply ? { reply } : {}) }
}

/** The search with a thread open (its line, the nudge or the reply kind when asked), every other param kept. */
export function withThread(search: URLSearchParams, contactId: string, at?: string | null, nudge?: NudgeKind | null, reply?: StartReplyKind | null): URLSearchParams {
  const next = new URLSearchParams(search)
  next.set(THREAD_PARAM, contactId)
  if (at) next.set(THREAD_AT_PARAM, at)
  else next.delete(THREAD_AT_PARAM)
  if (nudge) next.set(THREAD_NUDGE_PARAM, nudge)
  else next.delete(THREAD_NUDGE_PARAM)
  if (reply) next.set(THREAD_REPLY_PARAM, reply)
  else next.delete(THREAD_REPLY_PARAM)
  return next
}

/** The search with no thread open, every other param kept. */
export function withoutThread(search: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(search)
  next.delete(THREAD_PARAM)
  next.delete(THREAD_AT_PARAM)
  next.delete(THREAD_NUDGE_PARAM)
  next.delete(THREAD_REPLY_PARAM)
  return next
}

/** The open thread, and the presses that open and close one. */
export function useThreadWindow(): {
  contactId: string | null
  at: string | null
  /** The nudge the opener asked for, or null: the box reads it once, when the thread opens. */
  nudge: NudgeKind | null
  /** The kind a press asked the box to wake on (v2.6513), or null. */
  reply: StartReplyKind | null
  openThread: (contactId: string, at?: string | null, more?: OpenThreadMore) => void
  closeThread: () => void
} {
  const [search, setSearch] = useSearchParams()
  const open = threadFromSearch(search)
  const openThread = useCallback(
    (contactId: string, at?: string | null, more?: OpenThreadMore) => setSearch((prev) => withThread(prev, contactId, at, more?.nudge, more?.reply)),
    [setSearch],
  )
  const closeThread = useCallback(() => setSearch((prev) => withoutThread(prev)), [setSearch])
  return { contactId: open?.contactId ?? null, at: open?.at ?? null, nudge: open?.nudge ?? null, reply: open?.reply ?? null, openThread, closeThread }
}
