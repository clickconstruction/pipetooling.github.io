/**
 * The pricing robot's scorecard (Price Matrix PR 5 — docs/PRICE_MATRIX_PLAN.md).
 * Pure: from finished requests, the estimator's corrections and the rulebook,
 * the numbers the Scoreboard card and the Console receipts read — how often
 * her final picks were the robot's, how often she overruled it, how many
 * rows it had to ask about, what it learned.
 */

export type PricingRequestRow = {
  id: string
  status: string
  finished_at: string | null
  result: { rows_priced?: number; rows_asked?: number; rows_total?: number; houses_read?: number; total_cents_at_counts?: number; expired_houses?: string[] } | null
}

export type PricingCorrectionRow = {
  id: string
  action: 'move' | 'unpick' | 'repick' | 'not_a_component' | 'choose_option' | string
  digested_at: string | null
  created_at: string
}

export type PricingRuleRow = {
  id: string
  rule: string
  kind: string
  source: 'human' | 'robot' | string
  active: boolean
  times_used: number
  created_at: string
  mirror_note: string | null
}

export type PricingScorecard = {
  requestsFinished: number
  housesRead: number
  rowsTotal: number
  rowsPricedByRobot: number
  rowsAsked: number
  /** Rows she overruled (unpick + repick) — the disagreement count. */
  overrules: number
  /** Options she settled (the robot asked instead of guessing). */
  choicesMade: number
  /** 0–100: robot picks she left alone over rows the robot priced. Null before any pick. */
  agreementPct: number | null
  rulesActive: number
  rulesFromRobot: number
  correctionsUndigested: number
  expiredQuotesSeen: number
}

export function buildPricingScorecard(
  requests: ReadonlyArray<PricingRequestRow>,
  corrections: ReadonlyArray<PricingCorrectionRow>,
  rules: ReadonlyArray<PricingRuleRow>,
): PricingScorecard {
  const finished = requests.filter((r) => r.status === 'ready' || r.status === 'done')
  let housesRead = 0
  let rowsTotal = 0
  let rowsPriced = 0
  let rowsAsked = 0
  let expired = 0
  for (const r of finished) {
    housesRead += r.result?.houses_read ?? 0
    rowsTotal += r.result?.rows_total ?? 0
    rowsPriced += r.result?.rows_priced ?? 0
    rowsAsked += r.result?.rows_asked ?? 0
    expired += r.result?.expired_houses?.length ?? 0
  }
  const overrules = corrections.filter((c) => c.action === 'unpick' || c.action === 'repick').length
  const choicesMade = corrections.filter((c) => c.action === 'choose_option').length
  const agreementPct = rowsPriced > 0 ? Math.max(0, Math.round(((rowsPriced - Math.min(overrules, rowsPriced)) / rowsPriced) * 100)) : null
  return {
    requestsFinished: finished.length,
    housesRead,
    rowsTotal,
    rowsPricedByRobot: rowsPriced,
    rowsAsked,
    overrules,
    choicesMade,
    agreementPct,
    rulesActive: rules.filter((r) => r.active).length,
    rulesFromRobot: rules.filter((r) => r.active && r.source === 'robot').length,
    correctionsUndigested: corrections.filter((c) => c.digested_at == null).length,
    expiredQuotesSeen: expired,
  }
}

/** "kept 22 of 23 picks · 96%" — the one line under the card title. */
export function describeAgreement(s: PricingScorecard): string {
  if (s.rowsPricedByRobot === 0) return s.requestsFinished === 0 ? 'no requests finished yet' : 'nothing picked yet — every row waited on a choice'
  const kept = Math.max(0, s.rowsPricedByRobot - Math.min(s.overrules, s.rowsPricedByRobot))
  return `kept ${kept} of ${s.rowsPricedByRobot} robot pick${s.rowsPricedByRobot === 1 ? '' : 's'}${s.agreementPct != null ? ` · ${s.agreementPct}%` : ''}`
}
