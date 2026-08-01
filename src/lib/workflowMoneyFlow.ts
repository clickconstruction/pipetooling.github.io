/**
 * Workflow money flow (v2.1194): projections anchored to workflow steps
 * (before/after) rendered as inline markers with running totals.
 *
 * Running semantics:
 * - runningProjected — cumulative anchored-projection dollars in flow order
 *   (befores of step 1, afters of step 1, befores of step 2, …) INCLUDING the
 *   marker itself. Unanchored projections (step_id null / unknown) are excluded
 *   — they live in the top Projections panel only.
 * - runningSpent — actual line-item dollars for every step FULLY BEFORE the
 *   marker: a "before" marker of step N sums steps 1..N-1; an "after" marker
 *   sums steps 1..N.
 */

export type MoneyFlowProjectionInput = {
  id: string
  step_id: string | null
  placement: string | null
  amount: number | null
  sequence_order: number | null
}

export type WorkflowMoneyMarker<P extends MoneyFlowProjectionInput> = {
  projection: P
  runningProjected: number
  runningSpent: number
}

export type WorkflowMoneyFlow<P extends MoneyFlowProjectionInput> = {
  beforeByStep: Record<string, Array<WorkflowMoneyMarker<P>>>
  afterByStep: Record<string, Array<WorkflowMoneyMarker<P>>>
  /** Drawer rollup: total anchored-projection dollars per step (before + after). */
  stepProjectedTotal: Record<string, number>
}

function groupSort<P extends MoneyFlowProjectionInput>(list: P[]): P[] {
  return [...list].sort((a, b) => {
    const sa = a.sequence_order ?? Number.MAX_SAFE_INTEGER
    const sb = b.sequence_order ?? Number.MAX_SAFE_INTEGER
    if (sa !== sb) return sa - sb
    return a.id.localeCompare(b.id)
  })
}

export function buildWorkflowMoneyFlow<P extends MoneyFlowProjectionInput>(
  orderedStepIds: string[],
  projections: P[],
  itemsTotalByStepId: Record<string, number>,
): WorkflowMoneyFlow<P> {
  const known = new Set(orderedStepIds)
  const beforeRaw = new Map<string, P[]>()
  const afterRaw = new Map<string, P[]>()
  for (const p of projections) {
    if (!p.step_id || !known.has(p.step_id)) continue
    const bucket = p.placement === 'before' ? beforeRaw : afterRaw
    const arr = bucket.get(p.step_id) ?? []
    arr.push(p)
    bucket.set(p.step_id, arr)
  }

  const beforeByStep: Record<string, Array<WorkflowMoneyMarker<P>>> = {}
  const afterByStep: Record<string, Array<WorkflowMoneyMarker<P>>> = {}
  const stepProjectedTotal: Record<string, number> = {}

  let runningProjected = 0
  let runningSpent = 0
  for (const stepId of orderedStepIds) {
    let stepTotal = 0
    const befores = groupSort(beforeRaw.get(stepId) ?? [])
    if (befores.length > 0) {
      beforeByStep[stepId] = befores.map((p) => {
        runningProjected += Number(p.amount ?? 0)
        stepTotal += Number(p.amount ?? 0)
        return { projection: p, runningProjected, runningSpent }
      })
    }
    runningSpent += Number(itemsTotalByStepId[stepId] ?? 0)
    const afters = groupSort(afterRaw.get(stepId) ?? [])
    if (afters.length > 0) {
      afterByStep[stepId] = afters.map((p) => {
        runningProjected += Number(p.amount ?? 0)
        stepTotal += Number(p.amount ?? 0)
        return { projection: p, runningProjected, runningSpent }
      })
    }
    if (stepTotal !== 0) stepProjectedTotal[stepId] = stepTotal
  }

  return { beforeByStep, afterByStep, stepProjectedTotal }
}
