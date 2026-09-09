/**
 * Tap-answerable robot questions on the client (v2.3210): read the `choices` /
 * `recommended` columns a robot filed through ask_question and order them for
 * the buttons — the robot's pick first, so the common case is one tap on the
 * first button. Rows from before the columns (or robots that never gave
 * choices) return null and keep the free-text box.
 */

import { matchRecommended, normalizeTwinQuestionChoices } from '../../../supabase/functions/_shared/twinQuestionShape'

export type OrderedChoice = { label: string; recommended: boolean }

export type TwinQuestionChoiceFields = {
  choices?: unknown
  recommended?: string | null
}

export function orderedChoices(row: TwinQuestionChoiceFields): OrderedChoice[] | null {
  const choices = normalizeTwinQuestionChoices(row.choices)
  if (!choices) return null
  const rec = matchRecommended(row.recommended ?? null, choices)
  const list = choices.map((label) => ({ label, recommended: label === rec }))
  if (!rec) return list
  return [...list.filter((c) => c.recommended), ...list.filter((c) => !c.recommended)]
}

/** The saved answer when a choice is tapped — the label itself, so get_answers reads the same word the robot offered. */
export function answerFromChoice(choice: OrderedChoice): string {
  return choice.label
}
