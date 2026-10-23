/**
 * What each lane holds (punch list #151 PR 3, v2.5802): the card behind the ? on Messages' bar. The six lanes in the
 * strip's order, each with the sentence its heading printed under its name until this PR (the queue lanes' from
 * `followUp/laneNotes.ts`, Waiting on them's and Went out's from their own words). Needs you's sentence leaves out the
 * clause rows, which `/messages` never draws. Pure.
 */
import { LANE_NOTES } from '../followUp/laneNotes'
import { JUMP_LANE_LABEL, JUMP_LANE_ORDER, type JumpLane } from './jumpStrip'
import { WAITING_WORDS } from './waitingOnThem'
import { WENT_OUT_WORDS } from './wentOut'

export const LEGEND_WORDS = {
  button: '?',
  label: 'What each lane holds',
  tip: 'Opens a card that says what each lane holds.',
  closeTip: 'Closes the card.',
  close: 'Close',
} as const

export interface LegendRow {
  key: JumpLane
  label: string
  note: string
}

const NOTE: Record<JumpLane, string> = {
  new: LANE_NOTES.new,
  needsYou: LANE_NOTES.needsYou(false),
  needsReply: LANE_NOTES.needsReply,
  weOwe: LANE_NOTES.weOwe,
  waiting: WAITING_WORDS.note,
  wentOut: WENT_OUT_WORDS.note,
}

/** The six lanes in page order, each with what it holds. */
export function laneLegend(): LegendRow[] {
  return JUMP_LANE_ORDER.map((key) => ({ key, label: JUMP_LANE_LABEL[key], note: NOTE[key] }))
}
