/**
 * The shape of a question a robot may put in front of the estimator (v2.3210).
 *
 * Standing rulings drowned: one robot parked three decisions, a dozen
 * percentages and a book-entry request in a single card, and the estimator
 * had to read a wall to answer any of it. The contract already said "one
 * decision, two sentences"; nothing enforced it. Now `ask_question` refuses an
 * estimator-audience question that is not tap-answerable:
 *
 *   - under TWIN_QUESTION_MAX_CHARS, at most one question mark, no "(1) … (2) …"
 *   - 2–4 `choices` the estimator can tap (short, distinct)
 *   - `recommended` — the robot's own pick, one of the choices (optional)
 *
 * The operator lane is unconstrained: machine problems are messy by nature.
 * Shared by the edge function (Deno) and the client (choice rendering).
 */

export const TWIN_QUESTION_MAX_CHARS = 320
export const TWIN_QUESTION_CHOICES_MIN = 2
export const TWIN_QUESTION_CHOICES_MAX = 4
export const TWIN_QUESTION_CHOICE_MAX_CHARS = 40

export const TWIN_QUESTION_SHAPE_HINT =
  'Split it: one ask_question per decision, under 320 characters, with 2–4 short choices the estimator can tap and your recommended pick. Put the working detail (numbers, sheet references, the pattern you saw) in add_bid_note on your shell and name the topic there; the question itself is the decision.'

/** A robot enumerating decisions: "(1) … (2) …", "1) … 2)", "Also confirm:". */
const MULTI_DECISION = /\(\s*[1-9a-c]\s*\)|\b[1-3]\)\s|\balso confirm\b|\bsecond(?:ly)?,|\bthird(?:ly)?,/i

/**
 * Trim, drop blanks, dedupe case-insensitively, keep order. Returns null when
 * nothing usable was passed (undefined, not an array, or all blank).
 */
export function normalizeTwinQuestionChoices(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const s = typeof item === 'string' ? item.trim().replace(/\s+/g, ' ') : ''
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out.length ? out : null
}

/** The recommended pick, matched case-insensitively against the choices; null if absent or not among them. */
export function matchRecommended(raw: unknown, choices: readonly string[]): string | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  const hit = choices.find((c) => c.toLowerCase() === s.toLowerCase())
  return hit ?? null
}

export type TwinQuestionShapeResult =
  | { ok: true; choices: string[]; recommended: string | null }
  | { ok: false; problems: string[]; hint: string }

/**
 * Estimator-lane gate. `problems` are written for the robot that has to fix
 * the ask; `hint` is the same every time so the fix pattern is learnable.
 */
export function checkEstimatorQuestionShape(input: { question: string; choices?: unknown; recommended?: unknown }): TwinQuestionShapeResult {
  const q = input.question.trim()
  const problems: string[] = []
  if (q.length > TWIN_QUESTION_MAX_CHARS) problems.push(`the question is ${q.length} characters — keep it under ${TWIN_QUESTION_MAX_CHARS}`)
  const marks = (q.match(/\?/g) ?? []).length
  if (marks > 1) problems.push(`it carries ${marks} question marks — one decision per ask`)
  if (MULTI_DECISION.test(q)) problems.push('it reads as a numbered list of decisions — one decision per ask')

  const choices = normalizeTwinQuestionChoices(input.choices)
  if (!choices) {
    problems.push(`no choices — give ${TWIN_QUESTION_CHOICES_MIN}–${TWIN_QUESTION_CHOICES_MAX} short options the estimator can tap`)
  } else {
    if (choices.length < TWIN_QUESTION_CHOICES_MIN) problems.push(`only ${choices.length} distinct choice — give at least ${TWIN_QUESTION_CHOICES_MIN}`)
    if (choices.length > TWIN_QUESTION_CHOICES_MAX) problems.push(`${choices.length} choices — at most ${TWIN_QUESTION_CHOICES_MAX}`)
    const long = choices.filter((c) => c.length > TWIN_QUESTION_CHOICE_MAX_CHARS)
    if (long.length) problems.push(`choice "${long[0]}" is over ${TWIN_QUESTION_CHOICE_MAX_CHARS} characters — choices are labels, not sentences`)
  }
  const recRaw = typeof input.recommended === 'string' ? input.recommended.trim() : ''
  const recommended = choices ? matchRecommended(recRaw, choices) : null
  if (recRaw && choices && !recommended) problems.push(`recommended "${recRaw}" is not one of the choices`)

  if (problems.length || !choices) return { ok: false, problems, hint: TWIN_QUESTION_SHAPE_HINT }
  return { ok: true, choices, recommended }
}
