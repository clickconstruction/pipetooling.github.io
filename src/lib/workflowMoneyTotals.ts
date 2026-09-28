/**
 * Workflow money totals: what a project's projections add up to, what its
 * line items have spent, and the margin and balance between the two.
 *
 * Two screens print these — the Workflow page's ledger rail (its sticky
 * "Project margin" card and the balance gutter beside every stage card) and
 * the Projects → Forecast Specific tab's margin / balance chips. Both used to
 * write the sums and the margin formula inline.
 *
 * The per-step running balance is `buildWorkflowMoneyFlow` (workflowMoneyFlow.ts);
 * this file is the whole-project roll-up beside it.
 */

type WithAmount = { amount: number | null }

/**
 * One amount as a number. Null, undefined and NaN count as 0.
 *
 * The two screens disagreed on paper: Workflow summed `amount || 0`, the
 * Forecast tab `Number(amount ?? 0)`. For every value the database sends (a
 * JSON number or null) the two agree. They part only on values it cannot
 * send — NaN (Workflow → 0, Forecast → NaN) and a numeric string (Workflow
 * would concatenate, Forecast → the number). This takes the sane half of each.
 */
export function moneyAmount(amount: number | null | undefined): number {
  return Number(amount ?? 0) || 0
}

/** The sum of `amount` over any rows — projections or line items. */
export function sumAmounts(rows: ReadonlyArray<WithAmount>): number {
  return rows.reduce((sum, r) => sum + moneyAmount(r.amount), 0)
}

/**
 * Line-item dollars per step, for the steps named — a step with no items
 * gets 0. The Workflow page feeds this to `buildWorkflowMoneyFlow` and to the
 * Money drawer.
 */
export function itemsTotalByStep(
  orderedStepIds: ReadonlyArray<string>,
  lineItemsByStepId: Readonly<Record<string, ReadonlyArray<WithAmount> | undefined>>,
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const stepId of orderedStepIds) {
    totals[stepId] = sumAmounts(lineItemsByStepId[stepId] ?? [])
  }
  return totals
}

/**
 * Line-item dollars across the steps named. Items filed under a step that is
 * not in the list are left out — the rail and the Forecast chips count only
 * the steps on screen.
 */
export function ledgerTotalForSteps(
  orderedStepIds: ReadonlyArray<string>,
  itemsTotalByStepId: Readonly<Record<string, number>>,
): number {
  return orderedStepIds.reduce((sum, id) => sum + (itemsTotalByStepId[id] ?? 0), 0)
}

export type WorkflowMoneyTotals = {
  projectionsTotal: number
  ledgerTotal: number
  /** (projections − ledger) ÷ projections × 100; null when projections are 0. */
  marginPct: number | null
  /** projections − ledger. */
  balance: number
  /** Either total is non-zero — the rail and the Forecast balance column show. */
  hasMoney: boolean
}

export function workflowMoneyTotals(projectionsTotal: number, ledgerTotal: number): WorkflowMoneyTotals {
  return {
    projectionsTotal,
    ledgerTotal,
    marginPct: projectionsTotal !== 0 ? ((projectionsTotal - ledgerTotal) / projectionsTotal) * 100 : null,
    balance: projectionsTotal - ledgerTotal,
    hasMoney: projectionsTotal !== 0 || ledgerTotal !== 0,
  }
}

/**
 * A signed whole-dollar figure: `+$1,235`, `-$400`, `$0`. Rounds to the
 * dollar, so anything under 50¢ either way prints `$0` while keeping its sign.
 */
export function formatSignedWholeDollars(n: number): string {
  return `${n < 0 ? '-' : n > 0 ? '+' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`
}

/** Green above zero, red below, muted inside a ±0.004 dead band (float dust). */
export function balanceColor(n: number): string {
  return n > 0.004 ? 'var(--text-green-700)' : n < -0.004 ? 'var(--text-red-700)' : 'var(--text-muted)'
}
