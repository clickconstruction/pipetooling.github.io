/**
 * An answer to a press (`job_movement_answers`): what taking presses back would do to the numbers,
 * worked out before anything is written. Pure: the rows are the on-site store's, and the sums are
 * `containerLines`, the one arithmetic every screen reads.
 *
 * A press taken back is closed to every read, so the plan is the ledger summed twice: as it stands,
 * and without the rows picked. A row whose removal changes no number is said so. A later count by
 * someone else has usually reset its line, and taking it back would only strike it from History.
 */
import { containerLines, type Movement } from './onSite'
import type { ActKind } from './sitePersonActs'

export type AnswerChoice = 'take_back' | 'mark' | 'second_count' | 'leave'

/** One line a take-back moves: the box, the part, what it reads now and what it would read. */
export type LineChange = { containerId: string; partKey: string; partName: string; before: number; after: number }

export type TakeBackPlan = {
  /** The lines whose number moves, in the order the lines are listed. */
  changes: LineChange[]
  /** The picked rows whose removal, alone, moves no number. */
  noEffect: string[]
  /** The picked ids that are not rows of this ledger: already taken back, or another job's. */
  notFound: string[]
}

function onHandByLine(movements: ReadonlyArray<Movement>): Map<string, { containerId: string; partKey: string; partName: string; onHand: number }> {
  const out = new Map<string, { containerId: string; partKey: string; partName: string; onHand: number }>()
  for (const l of containerLines(movements)) out.set(`${l.containerId}\u0000${l.partKey}`, { containerId: l.containerId, partKey: l.partKey, partName: l.partName, onHand: l.onHand })
  return out
}

function diff(before: ReadonlyArray<Movement>, after: ReadonlyArray<Movement>): LineChange[] {
  const a = onHandByLine(before)
  const b = onHandByLine(after)
  const out: LineChange[] = []
  for (const [key, line] of a) {
    const next = b.get(key)?.onHand ?? 0
    if (next !== line.onHand) out.push({ containerId: line.containerId, partKey: line.partKey, partName: line.partName, before: line.onHand, after: next })
  }
  return out
}

/** What taking the picked rows back would do to one job's ledger. */
export function takeBackPlan(movements: ReadonlyArray<Movement>, ids: ReadonlyArray<string>): TakeBackPlan {
  const have = new Set(movements.map((m) => m.id))
  const picked = new Set(ids.filter((id) => have.has(id)))
  const notFound = ids.filter((id) => !have.has(id))
  const changes = diff(movements, movements.filter((m) => !picked.has(m.id)))
  const noEffect = [...picked].filter((id) => diff(movements, movements.filter((m) => m.id !== id)).length === 0)
  return { changes, noEffect, notFound }
}

/** The answer the window offers first for a kind of press. A box change is put back, not answered. */
export function suggestedAnswer(kind: ActKind): AnswerChoice {
  switch (kind) {
    case 'counted':
      return 'second_count'
    case 'delivered':
    case 'moved':
      return 'take_back'
    case 'taken':
    case 'used':
    case 'returned':
    case 'damaged':
    case 'cannot_find':
      return 'mark'
    default:
      return 'leave'
  }
}

/** May this kind of act be answered at all: a ledger row is, a box change or an answer taken off is not. */
export function isAnswerable(kind: ActKind): boolean {
  return suggestedAnswer(kind) !== 'leave'
}

export const ANSWER_WORDS: Record<AnswerChoice, { pick: string; does: string }> = {
  take_back: { pick: 'Take it back', does: 'The press is struck through and every number reads as if it was never made.' },
  mark: { pick: 'Mark it as not allowed', does: 'The numbers keep it, and it joins the tally of material taken outside the process.' },
  second_count: { pick: 'Ask for a second count', does: 'A task goes to the person you pick, and the gap between the two counts is kept.' },
  leave: { pick: 'Leave it', does: 'Nothing changes.' },
}

function n(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
}

/** The confirm press, naming each act with its count: *Take back 1, mark 2, ask for 1 count*. Null when nothing is picked. */
export function answerPressWords(counts: { takeBack: number; mark: number; secondCount: number }): string | null {
  const parts: string[] = []
  if (counts.takeBack > 0) parts.push(`take back ${counts.takeBack.toLocaleString('en-US')}`)
  if (counts.mark > 0) parts.push(`mark ${counts.mark.toLocaleString('en-US')}`)
  if (counts.secondCount > 0) parts.push(`ask for ${n(counts.secondCount, 'count', 'counts')}`)
  if (parts.length === 0) return null
  const words = parts.join(', ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
