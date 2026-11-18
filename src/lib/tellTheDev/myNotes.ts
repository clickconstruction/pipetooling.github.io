/**
 * Tell the dev (punch list #380): a person's own notes, and the answer coming back.
 *
 * The answer is the line the owner or a dev types when closing a note. The sender reads it in
 * the box under *Your notes*, and the wrench shows a dot while an answer is unread, so the answer
 * finds the sender and they are not left to wonder whether anyone read it.
 *
 * Unread is kept per person per device: the time the box last showed the notes. A device that
 * has never sent a note or opened the box asks for nothing, so the wrench costs no read at boot.
 */
import { wordlessNoteLine } from './starts'

export type MyNote = {
  id: string
  kind: string
  body: string
  status: string
  created_at: string | null
  closed_at: string | null
  closed_note: string | null
}

/** How many of a person's notes the box lists. */
export const MY_NOTES_SHOWN = 6

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function notesSeenStorageKey(userId: string): string {
  return `pt_dev_notes_seen_${userId}`
}

/** Set once this device has sent a note or listed some, after which the wrench looks for answers. */
export function notesKnownStorageKey(userId: string): string {
  return `pt_dev_notes_known_${userId}`
}

function safeGet(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: StorageLike | null | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Storage switched off: the dot shows again next time, which is the safe way to be wrong.
  }
}

export function readNotesSeenAt(storage: StorageLike | null | undefined, userId: string | null | undefined): string | null {
  return userId ? safeGet(storage, notesSeenStorageKey(userId)) : null
}

export function writeNotesSeenAt(storage: StorageLike | null | undefined, userId: string | null | undefined, iso: string): void {
  if (userId) safeSet(storage, notesSeenStorageKey(userId), iso)
}

export function readNotesKnown(storage: StorageLike | null | undefined, userId: string | null | undefined): boolean {
  return userId ? safeGet(storage, notesKnownStorageKey(userId)) === '1' : false
}

export function writeNotesKnown(storage: StorageLike | null | undefined, userId: string | null | undefined): void {
  if (userId) safeSet(storage, notesKnownStorageKey(userId), '1')
}

/** A note is answered when it was closed with words for the sender. */
export function isAnswered(note: MyNote): boolean {
  return note.status === 'closed' && !!note.closed_note?.trim()
}

/** How many answers this person has not seen: closed with words since the box last listed the notes. */
export function unreadAnswerCount(notes: readonly MyNote[], seenAtIso: string | null): number {
  return notes.filter((n) => isAnswered(n) && !!n.closed_at && (!seenAtIso || n.closed_at > seenAtIso)).length
}

function shortDay(iso: string | null, locale?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export type MyNoteLine = {
  id: string
  words: string
  /** True when the note was sent with none, so the line is drawn as a stand-in. */
  wordless: boolean
  chip: string
  state: 'answered' | 'closed' | 'sent'
  answer: string | null
  /** True for an answer the person has not seen yet. */
  fresh: boolean
}

/** A note as the box lists it: its words, where it stands, and the answer when there is one. */
export function myNoteLine(note: MyNote, seenAtIso: string | null, locale?: string): MyNoteLine {
  const words = note.body?.trim() ?? ''
  const answered = isAnswered(note)
  const state: MyNoteLine['state'] = answered ? 'answered' : note.status === 'closed' ? 'closed' : 'sent'
  const day = shortDay(state === 'sent' ? note.created_at : note.closed_at, locale)
  const verb = state === 'answered' ? 'Answered' : state === 'closed' ? 'Closed' : 'Sent'
  return {
    id: note.id,
    words: words || wordlessNoteLine(note.kind),
    wordless: !words,
    chip: day ? `${verb} ${day}` : verb,
    state,
    answer: answered ? note.closed_note!.trim() : null,
    fresh: answered && !!note.closed_at && (!seenAtIso || note.closed_at > seenAtIso),
  }
}
