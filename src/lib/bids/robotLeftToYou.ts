/**
 * Left to you (v2.5751, punch list #142): the mark the Bid Board card wears in the robot icon's
 * place once a person pressed Leave this one to me on the status sheet or ticked Don't let robots
 * shadow this bid on the form (`bids.robot_opt_out`), and the words of the sheet behind it, whose
 * one button, Let the robot back in, clears the flag so the next round may claim the bid. Before
 * this the card drew a faint robot nobody could press and the only way back was the Edit tab.
 *
 * Pure module — no React, no Supabase.
 */
import type { RobotRowState } from './robotRowState'

/** The letters inside the dashed ring. */
export const ROBOT_LEFT_MARK_TEXT = 'you'

export const LET_ROBOT_BACK_IN_LABEL = 'Let the robot back in'

/** The toast once the flag is cleared. */
export const LET_ROBOT_BACK_IN_TOAST = 'The robot may pick this bid up on its next round.'

/** True when the card wears the mark: the bid is left to a person and not yet decided. */
export function robotLeftToYou(state: RobotRowState): boolean {
  return state.kind === 'off' && state.reason === 'opt-out'
}

/** The card's tooltip for the mark. */
export function robotLeftTitle(project: string): string {
  return `Left to you. Robots leave ${project} alone. Tap to let the robot back in.`
}

/** The sheet's heading line under the title: "b510 · AutoZone New Braunfels". */
export function robotLeftLabel(bid: { bid_number: string | null; project_name: string | null }): string {
  return `b${bid.bid_number ?? '?'} · ${bid.project_name?.trim() || 'bid'}`
}

/** One plain sentence per state, in the order the sheet prints them. */
export const ROBOT_LEFT_SHEET_SENTENCES: readonly [left: string, back: string] = [
  'Left to you means no robot touches this bid.',
  'Let the robot back in means the next round may claim it again.',
]
