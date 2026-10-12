/**
 * Messages, cut 1: what later cuts draw inside the thread window, as slots. The window (`ThreadWindow.tsx`, cut 1's
 * screens) owns the layout; each slot is a function of the person or the line that returns what to draw there, and an
 * empty slot draws nothing. Every cut adds its own lines to `useThreadSlots` below and to nothing else, so the page
 * (`GcProjects`) never changes for a slot.
 *
 * Who fills what, as agreed on 2026-10-12: cut 2 (Follow up) the who-has-it pill, the state rows of ⋯, the owed strip,
 * the settling note and a note's back day above the box, a heard day's offer under a line, a highlighted body and the
 * message window's highlight slot; cut 3 the reply box; cut 4 the flow panel at the side; cut 8 the portal pill in the
 * status row.
 */
import type { ReactNode } from 'react'
import type { Contact } from '../../../lib/contacts/kernel'
import type { ThreadMessage } from '../../../lib/messages/thread'

/** A row of the header's ⋯ menu. The window's own rows (Show all text, Open their record) come first. */
export interface ThreadMenuRow {
  key: string
  label: string
  /** The hover card's words: what it does and what it changes. */
  tip?: string
  disabled?: boolean
  onPress: () => void
}

export interface ThreadSlots {
  /** The header's right end, beside ☎ ⋯: cut 2's who-has-it pill. */
  headerRight?: (c: Contact) => ReactNode
  /** The status row after the move strip: cut 2's back pill, cut 8's portal pill. */
  statusRow?: (c: Contact) => ReactNode
  /** Rows for ⋯ after the window's own: cut 2's No reply needed, Remind me Monday, Reopen. */
  menuRows?: (c: Contact) => ThreadMenuRow[]
  /** Between the lines and the box: cut 2's owed strip, its settling note and a note's back day. */
  aboveBox?: (c: Contact) => ReactNode
  /** The reply box at the foot of the thread: cut 3's. */
  box?: (c: Contact) => ReactNode
  /** Under a line: cut 2's offer for a heard day. */
  underLine?: (m: ThreadMessage, c: Contact) => ReactNode
  /** A line's body in place of the window's own (four lines, or all text): cut 2's highlighted body. Null keeps it. */
  lineBody?: (m: ThreadMessage, c: Contact) => ReactNode | null
  /** The message window's first button, given the words selected in its full text: cut 2's highlight slot. */
  messageWindowFirst?: (m: ThreadMessage, selection: string) => ReactNode
  /** The window's right side, its full height: cut 4's flow panel, a rail that opens to a panel. */
  side?: (c: Contact) => ReactNode
}

/** The slots every thread window draws. Each cut adds its own lines here. */
export function useThreadSlots(): ThreadSlots {
  return {}
}
