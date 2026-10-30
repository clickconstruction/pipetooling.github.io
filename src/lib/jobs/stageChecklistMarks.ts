/**
 * A checklist per stage (punch list #164, PR 4): the Pipeline's one more state. On a job drawn as stages, a stage
 * whose checklist is not filled reads *not ready* under the bar: an amber mark before its name, and the words in the
 * name's title, *Rough In · checklist 2 of 3 answered · not ready*. A stage whose kind has no questions carries no
 * mark, so the row reads as before until the office types the questions. Pure; `useStageChecklistStates` reads the
 * rows the board needs and each row calls `stageChecklistMarks` over its own line items.
 */
import { stageChecklistState, type StageChecklistAnswer, type StageChecklistQuestion, type StageChecklistState } from './stageChecklist'

/** A row's line item, as the Pipeline row holds it: the id and the name are all the mark needs. */
export type MarkFixture = { id: string; name: string | null }

/** Each stage's standing by fixture id, or null when no question exists anywhere, so nothing is drawn or computed. */
export function stageChecklistMarks(
  fixtures: ReadonlyArray<MarkFixture>,
  questions: readonly StageChecklistQuestion[],
  answersByFixture: ReadonlyMap<string, readonly StageChecklistAnswer[]>,
): ReadonlyMap<string, StageChecklistState> | null {
  if (questions.length === 0) return null
  const out = new Map<string, StageChecklistState>()
  for (const f of fixtures) {
    const state = stageChecklistState({ stageName: f.name, questions, answers: answersByFixture.get(f.id) ?? [] })
    if (state.standing !== 'none') out.set(f.id, state)
  }
  return out
}

/** The glyph before a stage's name on the bar: the empty box while a question is left, nothing otherwise. */
export const NOT_READY_GLYPH = '☐'

/** The words on the name's title: *checklist 2 of 3 answered · not ready*, *checklist filled*, or '' for no checklist. */
export function checklistMarkWords(state: StageChecklistState | undefined): string {
  if (!state || state.standing === 'none') return ''
  if (state.standing === 'ready') return 'checklist filled'
  return `checklist ${state.answered} of ${state.asked} answered · not ready`
}

/** True when the name wears the mark. */
export function stageNotReady(state: StageChecklistState | undefined): boolean {
  return state?.standing === 'not_ready'
}
