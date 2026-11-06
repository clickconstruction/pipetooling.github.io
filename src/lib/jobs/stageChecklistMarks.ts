/**
 * A checklist per stage (punch list #164, PR 4): the Pipeline's one more state. On a job drawn as stages, a stage
 * whose checklist is not filled reads *not ready* under the bar: an amber mark before its name, and the words in the
 * name's title, *Rough In · checklist 2 of 3 answered · not ready*. A stage whose kind has no questions carries no
 * mark, so the row reads as before until the office types the questions or adds a check for the stage (#237). While a
 * check on the stage is with Dispatch (#245, PR 3) the mark is a flag instead of the box and the title ends *with
 * Dispatch*, so the office reads from the row that the crew is waiting on them. Pure; `useStageChecklistStates` reads
 * the rows the board needs and each row calls `stageChecklistMarks` over its own line items.
 */
import { stageChecklistState, type StageChecklistAnswer, type StageChecklistQuestion, type StageChecklistState } from './stageChecklist'

/** A row's line item, as the Pipeline row holds it: the id and the name are all the mark needs. */
export type MarkFixture = { id: string; name: string | null }

/** No open request anywhere: the map the board passes while nothing is with Dispatch. */
export const NO_WITH_DISPATCH: ReadonlyMap<string, number> = new Map()

/**
 * Each stage's standing by fixture id, or null when no question exists anywhere, so nothing is drawn or computed.
 * `withDispatch` counts the open requests on each stage's checks; a stage with one carries the count on its state.
 */
export function stageChecklistMarks(
  fixtures: ReadonlyArray<MarkFixture>,
  questions: readonly StageChecklistQuestion[],
  answersByFixture: ReadonlyMap<string, readonly StageChecklistAnswer[]>,
  withDispatch: ReadonlyMap<string, number> = NO_WITH_DISPATCH,
): ReadonlyMap<string, StageChecklistState> | null {
  if (questions.length === 0) return null
  const out = new Map<string, StageChecklistState>()
  for (const f of fixtures) {
    const state = stageChecklistState({ stageName: f.name, fixtureId: f.id, questions, answers: answersByFixture.get(f.id) ?? [] })
    if (state.standing === 'none') continue
    const open = withDispatch.get(f.id) ?? 0
    out.set(f.id, open > 0 ? { ...state, withDispatch: open } : state)
  }
  return out
}

/** The open stage-check requests by fixture id, from the rows the board read: one count per stage. */
export function withDispatchCounts(rows: ReadonlyArray<{ fixture_id: string | null }>): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.fixture_id) continue
    out.set(r.fixture_id, (out.get(r.fixture_id) ?? 0) + 1)
  }
  return out
}

/** The glyph before a stage's name on the bar: the empty box while a question is left, nothing otherwise. */
export const NOT_READY_GLYPH = '☐'

/** The glyph in the box's place while a check on the stage is with Dispatch (#245, PR 3). */
export const WITH_DISPATCH_GLYPH = '⚑'

/** The title's tail while a check is with Dispatch: *with Dispatch*, or *2 with Dispatch* for more than one. */
export function withDispatchMarkWords(state: Pick<StageChecklistState, 'withDispatch'> | undefined): string {
  const n = state?.withDispatch ?? 0
  if (n <= 0) return ''
  return n === 1 ? 'with Dispatch' : `${n} with Dispatch`
}

/**
 * The words on the name's title: *checklist 2 of 3 answered · not ready*, *checklist 2 of 3 answered · not ready ·
 * with Dispatch*, *checklist filled*, or '' for no checklist.
 */
export function checklistMarkWords(state: StageChecklistState | undefined): string {
  if (!state || state.standing === 'none') return ''
  if (state.standing === 'ready') return 'checklist filled'
  const tail = withDispatchMarkWords(state)
  return `checklist ${state.answered} of ${state.asked} answered · not ready${tail ? ` · ${tail}` : ''}`
}

/** True when the name wears the mark. */
export function stageNotReady(state: StageChecklistState | undefined): boolean {
  return state?.standing === 'not_ready'
}

/** True when the mark is the flag: a question left, and one of the stage's checks with Dispatch. */
export function stageWithDispatch(state: StageChecklistState | undefined): boolean {
  return stageNotReady(state) && (state?.withDispatch ?? 0) > 0
}

/** The glyph the mark wears: the flag over the box. */
export function markGlyph(state: StageChecklistState | undefined): string {
  return stageWithDispatch(state) ? WITH_DISPATCH_GLYPH : NOT_READY_GLYPH
}
