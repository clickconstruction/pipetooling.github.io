/**
 * The shade is the share (punch list #221, PR 2): a count row whose `source_shares` name the bid's robot source
 * is the robot's, drawn shaded with a rule at its left on the Counts sheet, the Pricing tab and the Takeoff,
 * for the life of the bid. This kernel says which rows those are, what the From pill reads on one (*Robot*,
 * or *Robot 2 → yours 3* once she changed the count), and the words of the sheet's set-aside fold line. Pure.
 */
import { parseSourceShares } from './countSources'
import { SET_ASIDE_REASON_WORDS, type SetAsideReason } from './robotFixtures'

export const ROBOT_SOURCE_LABEL = 'Robot'

/** The ids of the bid's robot sources (`bid_count_sources.source_kind = 'robot'`; one per bid in practice). */
export function robotSourceIds(sources: ReadonlyArray<{ id: string; source_kind?: string | null }>): Set<string> {
  return new Set(sources.filter((s) => s.source_kind === 'robot').map((s) => s.id))
}

/** The robot's share of a row, or null when the row carries none. */
export function robotShareOf(shares: unknown, robotIds: ReadonlySet<string>): number | null {
  const parsed = parseSourceShares(shares)
  for (const [k, v] of Object.entries(parsed)) if (robotIds.has(k)) return v
  return null
}

/** True when the row is the robot's: its shares name a robot source. */
export function isRobotRow(shares: unknown, robotIds: ReadonlySet<string>): boolean {
  return robotShareOf(shares, robotIds) != null
}

export type RobotRowPill = {
  /** *Robot*, or *Robot 2 → yours 3* when her count differs from the robot's. */
  words: string
  /** The hover. */
  title: string
  edited: boolean
}

/** The From pill on a robot row; null on a row that is not the robot's. */
export function robotRowPill(shares: unknown, robotIds: ReadonlySet<string>, count: number | string | null | undefined, fmt: (n: number) => string = (x) => String(x)): RobotRowPill | null {
  const share = robotShareOf(shares, robotIds)
  if (share == null) return null
  const c = count == null ? NaN : Number(count)
  const edited = Number.isFinite(c) && Math.abs(c - share) > 1e-9
  if (!edited) return { words: ROBOT_SOURCE_LABEL, title: 'The robot counted this row. You took it as it was.', edited: false }
  return { words: `${ROBOT_SOURCE_LABEL} ${fmt(share)} → yours ${fmt(c)}`, title: `The robot counted ${fmt(share)}. You made it ${fmt(c)}.`, edited: true }
}

export type SetAsideFold = {
  /** *Robot · 2 set aside* */
  head: string
  /** *BFP-1 by others, HB-2 none drawn* */
  list: string
  n: number
}

/** The fold line under the Counts sheet for the robot fixtures she set aside; null with none. */
export function setAsideFoldWords(rows: ReadonlyArray<{ tag: string; reason: string | null | undefined }>): SetAsideFold | null {
  if (rows.length === 0) return null
  const list = rows
    .map((r) => {
      const key = r.reason as SetAsideReason | null | undefined
      const why = key && key in SET_ASIDE_REASON_WORDS ? SET_ASIDE_REASON_WORDS[key] : null
      return why ? `${r.tag} ${why}` : r.tag
    })
    .join(', ')
  return { head: `${ROBOT_SOURCE_LABEL} · ${rows.length} set aside`, list, n: rows.length }
}

/** The words on a shaded row's trash can and its confirm: Set aside, never delete. */
export const SET_ASIDE_WORDS = {
  button: 'Set aside',
  putBack: 'Put back',
  confirm: 'Set aside',
  why: 'The row leaves your count and waits in the robot’s list with your reason. Put back returns it.',
} as const
