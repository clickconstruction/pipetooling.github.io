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

/**
 * No dollar figures on a sealed shadow (v2.5020; the owner's call of 2026-10-09). A question a robot
 * raises on a SEALED shadow — a live bid the human has not priced yet, its shadow run not scored —
 * must not carry the robot's size guess: b499's travel-bands ask about the unsent b494 said "an $800k
 * restroom fit-out", and the figure reached the estimator through the question although the takeoff
 * rows were sealed. `ask_question` scrubs the question and its choices before they are filed.
 *
 * What counts as money: a `$` amount (`$800k`, `$1.2M`, `$12,500.00`, `$ 800 thousand`); digits with a
 * money word (`800 dollars`, `12 grand`, `2 million`) or a k / M suffix not followed by a unit (`800k`,
 * but not `12k sf`); and spelled-out sums (`eight hundred thousand`, `two million dollars`, `fifty grand`).
 * Over-scrubbing is safe; a leak is not.
 */
const UNIT_AFTER = '(?!\\s*(?:sf|sq|ft|feet|lf|gal|gallons?|gpm|psi|mi|miles?|lbs?|cy|yd|in|inch|inches|amp|amps|a\\b|v\\b|w\\b|kw|btu))'
const DIGITS = '\\d[\\d,]*(?:\\.\\d+)?'
const MAGNITUDE = '(?:k|m|mm|b|bn|thousand|million|billion)'
const NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|half)'
const MONEY = new RegExp(
  [
    `\\$\\s?${DIGITS}(?:\\s?${MAGNITUDE}\\b)?`,
    `\\b${DIGITS}\\s?(?:thousand|million|billion)(?:\\s+dollars)?\\b`,
    `\\b${DIGITS}\\s?(?:dollars|bucks|grand)\\b`,
    `\\b${DIGITS}\\s?(?:k|m|mm)\\b${UNIT_AFTER}`,
    `\\b(?:${NUMBER_WORD}[\\s-]+(?:and\\s+)?)*${NUMBER_WORD}\\s+(?:thousand|million|billion|grand)(?:\\s+dollars)?\\b`,
    `\\b(?:${NUMBER_WORD}[\\s-]+(?:and\\s+)?)*${NUMBER_WORD}\\s+dollars\\b`,
  ].join('|'),
  'gi',
)

export const TWIN_MONEY_WITHHELD = '[amount withheld]'

/** The question with its money taken out, and how many figures went. "an $800k restroom" reads "a restroom". */
export function scrubMoney(text: string): { text: string; removed: number } {
  let removed = 0
  // An article before an adjectival figure: drop the figure and re-pick the article for the next word.
  let out = text.replace(new RegExp(`\\b(a|an)\\s+(?:${MONEY.source})\\s+(?=([A-Za-z]))`, 'gi'), (_m, article: string, next: string) => {
    removed += 1
    const an = /[aeiou]/i.test(next)
    const word = an ? 'an' : 'a'
    return `${article[0] === article[0]!.toUpperCase() ? word[0]!.toUpperCase() + word.slice(1) : word} `
  })
  out = out.replace(MONEY, () => {
    removed += 1
    return TWIN_MONEY_WITHHELD
  })
  return { text: removed ? out.replace(/[ \t]{2,}/g, ' ').trim() : text, removed }
}

/** A live bid's open shadow run: the twin's shell and the bid it shadows, while the run is not scored. */
export type SealedShadow = { shadowBidId: string; referenceBidId: string; shadowNumber: string | null; referenceNumber: string | null }

/**
 * Is this question raised on a sealed shadow? Its bid is the shell or the reference of an unscored
 * shadow run, or its words name one of their bid numbers ("b494", "bid 494", "#499"). Any twin's run counts:
 * the risk is the human seeing a robot's size guess for a bid nobody has priced.
 */
export function questionTouchesSealedShadow(input: { aboutBidId: string | null; texts: readonly string[] }, sealed: readonly SealedShadow[]): boolean {
  if (sealed.length === 0) return false
  if (input.aboutBidId && sealed.some((s) => s.shadowBidId === input.aboutBidId || s.referenceBidId === input.aboutBidId)) return true
  const numbers = new Set(sealed.flatMap((s) => [s.shadowNumber, s.referenceNumber]).filter((n): n is string => Boolean(n)))
  for (const t of input.texts) {
    for (const m of t.matchAll(/(?:\bbid\s*#?\s*|\bbp?\s?|#)(\d{2,6})\b/gi)) if (numbers.has(m[1]!)) return true
  }
  return false
}
