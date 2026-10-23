/**
 * Messages' jump strip (punch list #151 PR 1, v2.5799): the Pipeline's stage bar over the lanes of `/messages` —
 * New · Needs you · Needs a reply · We owe them · Waiting on them · Went out — one segment a lane with the count its
 * heading shows, pinned while the page scrolls, the lane being read lit in its color, a press scrolling to its
 * section. Pure: the rows from the counts, the lit lane from the headers' tops (`stagesActiveSection`, the Pipeline's
 * own rule), each lane's color and the id of the section a press lands on. The counts come in already narrowed by the
 * pill and the Show lens, the same numbers the headings print; the strip reads nothing of its own.
 */
import { stagesActiveSection } from '../jobs/stagesStageBar'

export type JumpLane = 'new' | 'needsYou' | 'needsReply' | 'weOwe' | 'waiting' | 'wentOut'

/** The lanes in the page's order. */
export const JUMP_LANE_ORDER: readonly JumpLane[] = ['new', 'needsYou', 'needsReply', 'weOwe', 'waiting', 'wentOut']

/** A lane's name, as its heading prints it. */
export const JUMP_LANE_LABEL: Record<JumpLane, string> = {
  new: 'New',
  needsYou: 'Needs you',
  needsReply: 'Needs a reply',
  weOwe: 'We owe them',
  waiting: 'Waiting on them',
  wentOut: 'Went out',
}

/** The id of the section a press lands on: the four queue lanes inside `#queues` (`FollowUpSections`), the two sections' own ids. */
export const JUMP_LANE_ANCHOR: Record<JumpLane, string> = {
  new: 'new-lane',
  needsYou: 'needs-you',
  needsReply: 'needs-reply',
  weOwe: 'we-owe-them',
  waiting: 'waiting-on-them',
  wentOut: 'went-out',
}

/**
 * A lane's color: New the *Who is this?* pill's blue, Needs you the ring's red, Needs a reply the customer's orange,
 * We owe them amber (our move), Waiting on them violet (their move), Went out green (a send's ✓).
 */
export const JUMP_LANE_COLOR: Record<JumpLane, string> = {
  new: '#3b82f6',
  needsYou: '#dc2626',
  needsReply: '#ea580c',
  weOwe: '#d97706',
  waiting: '#7c3aed',
  wentOut: '#059669',
}

/** The lanes that live in Follow up's queue: on a phone they fold to one line when nothing waits (`queuesFold.ts`), so a press unfolds them first. */
export const QUEUE_LANES: ReadonlySet<JumpLane> = new Set<JumpLane>(['new', 'needsYou', 'needsReply', 'weOwe'])

/** Each lane's count as its heading shows it; `null` while the lane has not read yet, which the segment prints as "…". */
export type JumpCounts = Record<JumpLane, number | null>

/** What a lane counts, for the aria-label: people in New, Needs a reply and Waiting on them; rows in Needs you and We owe them; sends in Went out. */
const NOUN: Record<JumpLane, readonly [one: string, many: string]> = {
  new: ['person', 'people'],
  needsYou: ['row', 'rows'],
  needsReply: ['person', 'people'],
  weOwe: ['row', 'rows'],
  waiting: ['person', 'people'],
  wentOut: ['send', 'sends'],
}

export interface JumpStripItem {
  key: JumpLane
  label: string
  /** The heading's count, or "…" while the lane has not read. */
  count: string
  noun: string
  /** The id of the section a press lands on. */
  anchor: string
  /** The lane's color, for `--stage-color`. */
  color: string
  /** Nothing in the lane: the segment stays in place, greyed. */
  empty: boolean
}

/**
 * The strip's segments in page order. Needs you shows only while it has rows, as its heading does (and as Collections
 * joins the Pipeline's bar); every other lane keeps its place when empty so the bar never shifts.
 */
export function jumpStripItems(counts: JumpCounts): JumpStripItem[] {
  return JUMP_LANE_ORDER.filter((key) => key !== 'needsYou' || (counts.needsYou ?? 0) > 0).map((key) => {
    const n = counts[key]
    return {
      key,
      label: JUMP_LANE_LABEL[key],
      count: n === null ? '…' : String(n),
      noun: n === 1 ? NOUN[key][0] : NOUN[key][1],
      anchor: JUMP_LANE_ANCHOR[key],
      color: JUMP_LANE_COLOR[key],
      empty: n === 0,
    }
  })
}

/**
 * The lane being scrolled through: the last section, in page order, whose top edge has reached the line under the
 * pinned bar; none above the line (the top of the page) → null. The Pipeline's own rule, so the two bars move alike.
 */
export function jumpStripActive(tops: ReadonlyArray<{ key: JumpLane; top: number | null }>, line: number): JumpLane | null {
  return stagesActiveSection(tops, line)
}
