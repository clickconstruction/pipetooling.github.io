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
import { createElement, Fragment, type ReactNode } from 'react'
import { useChangeOrderThreadSlots } from '../../changeOrders/useChangeOrderThreadSlots'
import type { Contact } from '../../../lib/contacts/kernel'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { FlowTab } from '../../flows/FlowTab'
import { useFollowUpThreadSlots } from '../../followUp/useFollowUpThreadSlots'

/** A row of the header's ⋯ menu. The window's own rows (Show all text, Open their record) come first. */
export interface ThreadMenuRow {
  key: string
  label: string
  /** The hover card's words: what it does and what it changes. */
  tip?: string
  disabled?: boolean
  onPress: () => void
}

/** How the window draws the header just now: folded for a narrow column (cut 10, `threadFold.ts`). */
export interface ThreadLook {
  /** The header is folded. A slot in it draws its narrow form: the who-has-it pill as a face only. */
  folded: boolean
}

export interface ThreadSlots {
  /** The header's corner, beside ☎ ⋯: cut 2's who-has-it pill. Folded, the window puts it before ☎. */
  headerRight?: (c: Contact, look?: ThreadLook) => ReactNode
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

/** What a shared slot draws: nothing when every cut draws nothing, one cut's node as itself, else each in order. */
function drawEach(nodes: readonly ReactNode[]): ReactNode {
  const drawn = nodes.filter((n) => n !== null && n !== undefined && n !== false)
  if (drawn.length === 0) return null
  if (drawn.length === 1) return drawn[0]
  return createElement(Fragment, null, ...drawn.map((n, i) => createElement(Fragment, { key: i }, n)))
}

/** One slot that draws a node, filled by any number of cuts. */
function eachNode<A extends unknown[]>(fs: ReadonlyArray<((...a: A) => ReactNode) | undefined>): ((...a: A) => ReactNode) | undefined {
  const filled = fs.filter((f): f is (...a: A) => ReactNode => f !== undefined)
  if (filled.length < 2) return filled[0]
  return (...a: A) => drawEach(filled.map((f) => f(...a)))
}

/**
 * Several cuts' slots as one, in the order given (cut 2 first): a key two cuts fill draws both, the first cut's first;
 * ⋯'s rows join; a line's body is the first cut's that gives one. A key every cut leaves empty stays empty. A key added
 * later adds its rule here: a node draws each cut's, facts (cut 2's `court`) merge field by field, the later cut's
 * winning.
 */
export function mergeThreadSlots(...parts: readonly ThreadSlots[]): ThreadSlots {
  const merged: ThreadSlots = {}
  const headerRight = eachNode(parts.map((p) => p.headerRight))
  if (headerRight) merged.headerRight = headerRight
  const statusRow = eachNode(parts.map((p) => p.statusRow))
  if (statusRow) merged.statusRow = statusRow
  const aboveBox = eachNode(parts.map((p) => p.aboveBox))
  if (aboveBox) merged.aboveBox = aboveBox
  const box = eachNode(parts.map((p) => p.box))
  if (box) merged.box = box
  const underLine = eachNode(parts.map((p) => p.underLine))
  if (underLine) merged.underLine = underLine
  const messageWindowFirst = eachNode(parts.map((p) => p.messageWindowFirst))
  if (messageWindowFirst) merged.messageWindowFirst = messageWindowFirst
  const side = eachNode(parts.map((p) => p.side))
  if (side) merged.side = side
  const menus = parts.flatMap((p) => (p.menuRows ? [p.menuRows] : []))
  if (menus.length > 0) merged.menuRows = (c) => menus.flatMap((rows) => rows(c))
  const bodies = parts.flatMap((p) => (p.lineBody ? [p.lineBody] : []))
  if (bodies.length > 0)
    merged.lineBody = (m, c) => {
      for (const body of bodies) {
        const drawn = body(m, c)
        if (drawn !== null && drawn !== undefined) return drawn
      }
      return null
    }
  return merged
}

/**
 * The slots every thread window draws. Each cut adds its own lines here, as `mergeThreadSlots(followUp, …)`. The thread
 * window calls it, under the page's providers and only while a thread is open, so a cut's hook here may read the open
 * thread (`useThreadWindow`) and ask for the read again after its own write (`useMessagesReread`).
 */
export function useThreadSlots(): ThreadSlots {
  // Cut 2 (Follow up): who has it, the back and snoozed pills, and ⋯'s state rows.
  const followUp = useFollowUpThreadSlots()
  // Cut 4: their flow, a rail beside the thread that opens to the panel. A new person starts it fresh.
  const flow: ThreadSlots = { side: (c) => <FlowTab key={c.id} at={{ contactId: c.id }} side /> }
  // Cut 4b: a change order from a customer's message, after cut 2's in both slots it shares.
  const changeOrders = useChangeOrderThreadSlots()
  return mergeThreadSlots(followUp, flow, changeOrders)
}
