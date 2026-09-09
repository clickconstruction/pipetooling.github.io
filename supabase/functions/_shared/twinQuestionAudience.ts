/**
 * Which human a robot's question is for (v2.3186).
 *
 * `ask_question` was the robot's only outlet when it got stuck, so every
 * infrastructure failure ("the sandbox blocked the substrate insert", "the
 * write fence denied cost_estimate_labor_rows") landed on the estimator's
 * Standing rulings panel wearing the same 🤖 as a real doctrine question.
 * Wendi: "this robot is talking to you not me, quite a few of them are like that."
 *
 * Two lanes:
 *   - `estimator` — a judgment about the job: scope, counts, pricing, packages,
 *     which sheet governs. Answered on Bids → Audits.
 *   - `operator`  — the machine is in the robot's way: sandbox, sign-in, the
 *     write fence, a table it can't write, a file the service account can't
 *     read, a verb that doesn't exist. Answered by whoever runs the fleet, on
 *     Settings → Digital twins.
 *
 * The robot names the lane on `ask_question`; when it doesn't, the text
 * decides. Shared by the edge function (Deno) and the client — the same
 * signals classify a stored row whose `audience` column hasn't landed yet.
 */

export type TwinQuestionAudience = 'estimator' | 'operator'

export const TWIN_QUESTION_AUDIENCES: readonly TwinQuestionAudience[] = ['estimator', 'operator']

export function isTwinQuestionAudience(v: unknown): v is TwinQuestionAudience {
  return v === 'estimator' || v === 'operator'
}

/**
 * Machine-side vocabulary. A robot describing the job says "restroom", "4in
 * sanitary", "sheet P2.01"; a robot describing its environment says these.
 * Each entry is [label, pattern]; the label is what a human sees in a tooltip.
 */
const OPERATOR_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['sandbox', /\bsandbox(?:es|ed)?\b/i],
  ['sign-in', /\bsign-?in\b/i],
  ['write fence', /\b(?:write[- ])?fence\b/i],
  ['RLS', /\bRLS\b/],
  ['service account', /\bservice account\b/i],
  ['API key', /\bapi ?key\b/i],
  ['substrate row', /\bsubstrate\b/i],
  ['harness', /\bharness\b/i],
  ['twin-mcp', /\btwin[- ]mcp\b/i],
  ['MCP verb', /\b(?:mcp|harness) verb\b|\badd a (?:harness|twin-mcp)? ?verb\b|\bverb for\b/i],
  ['run workspace', /\b(?:run )?work(?:space| folder)\b/i],
  ['permission layer', /\bpermission (?:layer|denied)\b/i],
  ['DB lane', /\b(?:db|database) (?:lane|insert|row)\b/i],
  ['JSON', /\bJSON\b/],
  ['HTTP 403', /\b403s?\b/],
  ['tool name', /\b(?:get|put|open|lock|score|file|paste|submit|mint)_[a-z_]+\b/],
  ['table name', /\b[a-z]+(?:_[a-z0-9]+)+\b/],
  ['parked answer', /^\s*answer parked\b/i],
]

export type TwinQuestionClassification = {
  audience: TwinQuestionAudience
  /** The signals that fired, in list order — empty for an estimator question. */
  signals: string[]
}

/** Text → lane. Estimator unless the robot is plainly talking about its machine. */
export function classifyTwinQuestionAudience(text: string): TwinQuestionClassification {
  const signals: string[] = []
  for (const [label, re] of OPERATOR_SIGNALS) if (re.test(text)) signals.push(label)
  return { audience: signals.length > 0 ? 'operator' : 'estimator', signals }
}

/**
 * The lane a stored row is in: the column when it is present (the robot's
 * choice, or a human's bounce), else the text. A row read through
 * `select('*')` before the migration lands simply has no `audience` key.
 */
export function effectiveTwinQuestionAudience(row: { audience?: string | null; question: string }): TwinQuestionAudience {
  return isTwinQuestionAudience(row.audience) ? row.audience : classifyTwinQuestionAudience(row.question).audience
}

/** Whether the rows came back with an `audience` column at all (bounce buttons need one to write). */
export function twinQuestionAudienceColumnPresent(rows: ReadonlyArray<Record<string, unknown>>): boolean {
  return rows.length > 0 && rows.every((r) => 'audience' in r)
}

export const TWIN_QUESTION_AUDIENCE_LABEL: Readonly<Record<TwinQuestionAudience, string>> = {
  estimator: 'For the estimator',
  operator: 'For the operator',
}
