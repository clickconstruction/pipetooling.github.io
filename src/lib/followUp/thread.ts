/**
 * Messages, cut 2's screens, PR C1: Follow up's words inside one person's thread (the prototype's `statusPills` and the
 * ⋯ rows, v1.178). The pills' own words are `queue.ts`'s (`backPill`, `snoozedWords`); this adds the back pill's hover
 * and ⋯'s rows with the state each one sets.
 */
import type { ContactKind } from '../contacts/kernel'
import { contactFlowKind } from '../flows/facts'
import { SEED_FLOWS } from '../flows/seed'
import { flat } from '../flows/state'
import { dayLabel, owedWhatOptions, type OwedStep } from '../messages/owed'
import { stateAfter, stateMenu, type ContactState, type QueueMessage, type StateMove } from './queue'

/** The back pill's hover: when the row comes back, whose note brings it, and what × does. */
export function backPillTip(note: Pick<QueueMessage, 'backOn' | 'backBy'> & { backWords?: string | null }): string {
  const by = note.backBy?.trim() || 'the team'
  if (note.backOn) return `Comes back ${dayLabel(note.backOn)}. A note by ${by} brings this row back to Follow up that morning. × clears the day, and the note stays.`
  return `A note by ${by} gave it words, not a day, so it will not come back by itself. × clears the words, and the note stays.`
}

/** One of ⋯'s rows for the conversation's state. */
export interface ThreadStateRow {
  move: StateMove
  label: string
  /** The hover's words: what it does. */
  tip: string
  /** The state the press sets (`set_state`). */
  sets: ContactState
}

/** ⋯'s rows: close or snooze an open conversation, reopen any other (`stateMenu`), each with the state it sets. */
export function threadStateRows(state: ContactState, todayYmd: string): ThreadStateRow[] {
  return stateMenu(state).map((r) => ({ move: r.move, label: r.label, tip: r.words, sets: stateAfter(r.move, todayYmd).state }))
}

/**
 * The owed strip's what list for a person (C2): their flow's our-move steps in its words, then the usual asks
 * (`owedWhatOptions`). Read from the seeded flows (`SEED_FLOWS`, what cut 4's SQL seeds) until cut 4's flows are read live.
 */
export function owedChoices(kind: ContactKind): { flow: string[]; usual: string[] } {
  const steps: OwedStep[] = flat(SEED_FLOWS[contactFlowKind(kind)])
    .filter((s) => s.who === 'us')
    .map((s) => ({ name: s.name, owedWords: s.owedWords }))
  return owedWhatOptions(kind, steps)
}
