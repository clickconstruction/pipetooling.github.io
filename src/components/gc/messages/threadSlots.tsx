/**
 * Messages, cut 1: what later cuts draw inside the thread window, as slots. The window (`ThreadWindow.tsx`, cut 1's
 * screens) owns the layout; each slot is a function of the person or the line that returns what to draw there, and an
 * empty slot draws nothing. Every cut adds its own lines to `useThreadSlots` below and to nothing else, so the page
 * (`GcProjects`) never changes for a slot.
 *
 * Who fills what, as agreed on 2026-10-12: cut 2 (Follow up) the who-has-it pill, the state rows of ⋯, the owed strip,
 * the settling note and a note's back day above the box, a heard day's offer under a line, a highlighted body and the
 * message window's highlight slot; cut 3 the reply box; cut 4 the flow panel at the side; cut 8 the portal pill in the
 * status row; cut 6 a paper's offer under its line; residential R7 the sort card above the lines.
 */
import { createElement, Fragment, type ReactNode } from 'react'
import { useChangeOrderThreadSlots } from '../../changeOrders/useChangeOrderThreadSlots'
import { useEstimateDoorThreadSlots } from '../../estimates/useEstimateDoorThreadSlots'
import { useEstimateLineThreadSlots } from '../../estimates/useEstimateLineThreadSlots'
import type { Contact } from '../../../lib/contacts/kernel'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { FlowTab } from '../../flows/FlowTab'
import { useFollowUpThreadSlots } from '../../followUp/useFollowUpThreadSlots'
import type { CourtFacts } from '../../../lib/followUp/courtFacts'
import { useNewLaneThreadSlots } from '../../followUp/useNewLaneThreadSlots'
import { useLeadDoorThreadSlots } from '../../messages/useLeadDoorThreadSlots'
import { hasPaperOffer } from '../../../lib/messages/lineFiles'
import { PaperOffers } from './PaperOffers'
import { NudgedReplyBox } from './reply/NudgedReplyBox'

/** A row of the header's ⋯ menu. The window's own rows (Show all text, Open their record) come first. */
export interface ThreadMenuRow {
  key: string
  label: string
  /** The hover card's words: what it does and what it changes. */
  tip?: string
  disabled?: boolean
  onPress: () => void
}

/** What the window lends a slot above the lines: its own *Who is this?* window, and a move to the thread a fold kept. */
/** What the window gives the side (spike): a way to say whether it has anything to show, so an empty side folds. */
export interface SideActs {
  has: (has: boolean) => void
}

export interface AboveLinesActs {
  openWho: () => void
  showContact: (contactId: string) => void
  /** The card is drawing *Who is this?* itself (spike): the header drops its own button while true. */
  whoDrawn?: (shown: boolean) => void
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
  /** Over the lines, under the header: residential R7's sort card, while the person waits in the New lane. */
  aboveLines?: (c: Contact, acts: AboveLinesActs) => ReactNode
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
  /** The window's right side, its full height: cut 4's flow panel, a rail that opens to a panel; nothing while the sender is unnamed (v2.5797). */
  side?: (c: Contact, acts?: SideActs) => ReactNode
  /**
   * What cut 2 knows about whose move it is (punch list #140 PR 7): what we owe them and a written promise's day, which
   * the window merges into the header's move chip (`courtOf`'s options). Facts, not a node: later cuts win field by field.
   */
  court?: (c: Contact) => CourtFacts | null
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
  const aboveLines = eachNode(parts.map((p) => p.aboveLines))
  if (aboveLines) merged.aboveLines = aboveLines
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
  const courts = parts.flatMap((p) => (p.court ? [p.court] : []))
  if (courts.length > 0)
    merged.court = (c) => {
      let facts: CourtFacts | null = null
      for (const court of courts) {
        const got = court(c)
        if (got) facts = { ...(facts ?? {}), ...got }
      }
      return facts
    }
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
  // Every slot keys on the person with its own prefix: the slots sit side by side in the thread column, and two bare
  // `c.id` keys there (the New lane card above the lines and the box) logged a duplicate-key warning on every open.
  // Cut 3: the reply box, one per person, so a draft never crosses to the next thread. It reads the open thread itself
  // (`useOpenThread`), under the window's provider; since #140 PR 4 the URL's nudge too (`NudgedReplyBox`).
  const replyBox: ThreadSlots = { box: (c) => <NudgedReplyBox key={`reply:${c.id}`} contact={c} /> }
  // Cut 4: their flow, a rail beside the thread that opens to the panel. A new person starts it fresh. A sender nobody
  // has named has no flow of their own, only the placeholder whose one step asks what the pill beside their name and
  // the sort card already ask, so the rail waits until *Who is this?* names them (punch list #149 PR 3, v2.5797).
  const flow: ThreadSlots = { side: (c, acts) => (c.kind === 'unknown' ? null : <FlowTab key={`flow:${c.id}`} at={{ contactId: c.id }} side onHas={acts?.has} />) }
  // Cut 4b: a change order from a customer's message, after cut 2's in both slots it shares.
  const changeOrders = useChangeOrderThreadSlots()
  // Cut 6: a file that reads as a trade partner's paper, offered under its line until someone answers it.
  const email: ThreadSlots = { underLine: (m, c) => (hasPaperOffer(m.files, c) ? <PaperOffers key={m.id} message={m} contact={c} /> : null) }
  // R8 · 8: a customer's line on a Pipeline job goes on its estimate, after cut 4b's in both slots it shares.
  const estimateLines = useEstimateLineThreadSlots()
  // #139 PR 7: our estimate email's line opens the estimate; where its words only repeat the subject, the door is the body.
  const estimateDoor = useEstimateDoorThreadSlots()
  // Residential R7: the sort card above the lines, while the person waits in Follow up's New lane.
  const newLane = useNewLaneThreadSlots()
  // #140 PR 8: a lead's doors above the lines, Book a visit and Start an estimate, once they are named a lead.
  const leadDoors = useLeadDoorThreadSlots()
  // By cut number: cut 2's Follow up, cut 3's reply box, cut 4's flow, cut 4b's change orders, R8 · 8's estimate lines,
  // #139's estimate door, cut 6's paper offer, R7's sort card.
  return mergeThreadSlots(followUp, replyBox, flow, changeOrders, estimateLines, estimateDoor, email, leadDoors, newLane)
}
