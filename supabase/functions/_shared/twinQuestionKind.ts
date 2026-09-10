/**
 * What kind of thing a robot is asking for (v2.3212).
 *
 * Two of the three cards on the Standing rulings panel one afternoon were not
 * rulings at all: "the file on the bid is the electrical set — attach the
 * plumbing sheets?" That is a plans task on ONE bid, fixed on the Edit form or
 * by sharing the right file, not a doctrine the estimator rules on for every
 * robot. Mixed in with real rulings it costs the same reading for none of the
 * leverage.
 *
 * Two kinds:
 *   - `decision` — a judgment (scope, a count, a tier, a package, which sheet
 *     governs). Lives on Standing rulings; a topic dedupes it across bids.
 *   - `plans`    — the robot needs a different or additional plan set on this
 *     bid. Lives on the bid's robot needs sheet (the amber icon on the Bid
 *     Board), beside Copy intake address and Edit bid, and the Standing
 *     rulings panel only points at it.
 *
 * The robot names the kind on `ask_question`; when it doesn't, the text
 * decides. Shared by the edge function (Deno) and the client, so a stored row
 * whose `kind` column hasn't landed classifies the same way everywhere.
 */

export type TwinQuestionKind = 'decision' | 'plans'

export const TWIN_QUESTION_KINDS: readonly TwinQuestionKind[] = ['decision', 'plans']

export function isTwinQuestionKind(v: unknown): v is TwinQuestionKind {
  return v === 'decision' || v === 'plans'
}

/** The tap answers a plans ask gets when the robot offers none — each one a complete instruction back to it. */
export const PLANS_ASK_DEFAULT_CHOICES: readonly string[] = ['Attached — rerun', 'Use what is on the bid', 'Skip this bid']
export const PLANS_ASK_DEFAULT_RECOMMENDED = 'Attached — rerun'

const PLAN_NOUN = String.raw`(?:plans?|plan (?:set|file|link)|drawing set|drawings?|sheets?|pdf|fit-?out (?:set|drawings?|package)|construction set)`

/** Each entry is [label, pattern]; the label is what a human sees in a tooltip. */
const PLANS_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['asks to attach plans', new RegExp(String.raw`\b(?:attach|share|upload|re-?link|link|send|add)\b[^.?!]{0,80}\b${PLAN_NOUN}\b`, 'i')],
  ['wrong set on the bid', new RegExp(String.raw`\b(?:wrong|different|not the (?:right|plumbing|correct)|only the|is the (?:electrical|mechanical|shell|civil|architectural|structural))\b[^.?!]{0,60}\b${PLAN_NOUN}\b`, 'i')],
  ['plan file on this bid', new RegExp(String.raw`\b(?:the )?(?:plan (?:set|file)|plans link|file|drawing set) on (?:this|the) bid\b`, 'i')],
  ['no plumbing sheets', new RegExp(String.raw`\bno (?:plumbing|P-?series|P\d) sheets?\b|\bplumbing sheets? (?:are|is) missing\b`, 'i')],
  ['cannot open the plans', new RegExp(String.raw`\b(?:can(?:no|')t|could not|couldn't|unable to) (?:open|read|fetch|download)\b[^.?!]{0,40}\b${PLAN_NOUN}\b`, 'i')],
]

export type TwinQuestionKindClassification = {
  kind: TwinQuestionKind
  /** The signals that fired, in list order — empty for a decision. */
  signals: string[]
}

export function classifyTwinQuestionKind(text: string): TwinQuestionKindClassification {
  const signals: string[] = []
  for (const [label, re] of PLANS_SIGNALS) if (re.test(text)) signals.push(label)
  return { kind: signals.length ? 'plans' : 'decision', signals }
}

/** The stored kind when the column has landed and holds a value; else the text decides. */
export function effectiveTwinQuestionKind(row: { kind?: string | null; question: string }): TwinQuestionKind {
  return isTwinQuestionKind(row.kind) ? row.kind : classifyTwinQuestionKind(row.question).kind
}
