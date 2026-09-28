/**
 * The Workflow page's Projections & Ledger panel: the rows of its unified
 * table (projections beside the line items actually spent, stage by stage) and
 * the three figures on its summary bar — Projections, Ledger and Left.
 */

import { moneyAmount, sumAmounts } from '../workflowMoneyTotals'

export type UnifiedProjectionInput = {
  stage_name: string
  memo: string | null
  amount: number | null
  sequence_order: number | null
}

export type UnifiedLineItemInput = {
  memo: string | null
  amount: number | null
}

export type UnifiedStepInput = {
  id: string
  name: string
}

export type UnifiedFinancialRow<P extends UnifiedProjectionInput, L extends UnifiedLineItemInput> = {
  /** The stage's name on its first row, '' on the rows under it. */
  stageName: string
  memo: string
  projectionAmount: number | null
  projection: P | null
  ledgerAmount: number | null
  ledgerItem: L | null
  ledgerStepName: string | null
}

/**
 * One block of rows per stage name, names in sort order. Inside a block the
 * projections (by `sequence_order`) and the line items pair up by position,
 * and the shorter side is padded with nulls.
 *
 * A projection's stage name is trimmed; a step's name is not — a step saved
 * as "Rough " sits in its own block, apart from the projections for "Rough".
 * Two steps with the same name share a block, their items in step order.
 */
export function buildUnifiedFinancialRows<
  P extends UnifiedProjectionInput,
  L extends UnifiedLineItemInput,
>(
  projections: ReadonlyArray<P>,
  steps: ReadonlyArray<UnifiedStepInput>,
  lineItemsByStepId: Readonly<Record<string, ReadonlyArray<L> | undefined>>,
): Array<UnifiedFinancialRow<P, L>> {
  const stageNames = new Set<string>([
    ...projections.map((p) => p.stage_name.trim()),
    ...steps.filter((s) => (lineItemsByStepId[s.id]?.length ?? 0) > 0).map((s) => s.name),
  ])
  const rows: Array<UnifiedFinancialRow<P, L>> = []
  for (const stageName of [...stageNames].sort()) {
    const projLines = projections
      .filter((p) => p.stage_name.trim() === stageName)
      .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
    const ledgerSteps = steps.filter((s) => s.name === stageName)
    const ledgerLines: Array<{ item: L; stepName: string }> = []
    ledgerSteps.forEach((s) => {
      ;(lineItemsByStepId[s.id] || []).forEach((item) => ledgerLines.push({ item, stepName: s.name }))
    })
    const maxRows = Math.max(projLines.length, ledgerLines.length) || 1
    for (let i = 0; i < maxRows; i++) {
      const proj = projLines[i] ?? null
      const ledger = ledgerLines[i] ?? null
      const memo = [proj?.memo, ledger?.item?.memo].filter(Boolean).join(' / ') || '—'
      rows.push({
        stageName: i === 0 ? stageName : '',
        memo,
        projectionAmount: proj?.amount ?? null,
        projection: proj,
        ledgerAmount: ledger?.item?.amount ?? null,
        ledgerItem: ledger?.item ?? null,
        ledgerStepName: ledger?.stepName ?? null,
      })
    }
  }
  return rows
}

export type PanelMoneyTotals = {
  projectionsTotal: number
  ledgerTotal: number
  /** projections − ledger. */
  left: number
}

/**
 * The summary bar's figures. The ledger side sums every loaded line item,
 * whatever step it is filed under — the ledger rail's total
 * (`ledgerTotalForSteps`) counts only the steps on screen.
 */
export function panelMoneyTotals(
  projections: ReadonlyArray<{ amount: number | null }>,
  lineItemsByStepId: Readonly<Record<string, ReadonlyArray<{ amount: number | null }> | undefined>>,
): PanelMoneyTotals {
  const projectionsTotal = sumAmounts(projections)
  // One running total, item by item — summing per step first would round
  // differently in the last float bit and could flip Left's sign at zero.
  let ledgerTotal = 0
  Object.values(lineItemsByStepId).forEach((items) => {
    ;(items ?? []).forEach((item) => {
      ledgerTotal += moneyAmount(item.amount)
    })
  })
  return { projectionsTotal, ledgerTotal, left: projectionsTotal - ledgerTotal }
}
