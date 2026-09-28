/**
 * What the Workflow page's stage list draws, in order: every step, or — with
 * "Hide Old Steps" on — one summary row standing in for the finished steps
 * except the most recent one.
 */

type StepForDisplay = {
  id: string
  status: string
  sequence_order: number | null
  started_at: string | null
}

export type StageDisplayItem<S> =
  | { type: 'step'; step: S }
  | { type: 'summary'; count: number; firstStarted: string | null }

/**
 * Finished means completed, approved or skipped. By `sequence_order`, the
 * last finished step stays on screen and the ones before it are "old". The
 * summary row sits where the first old step was, carries how many it stands
 * for and when the earliest of them (by order) started. With fewer than two
 * finished steps there is nothing to hide and every step is drawn.
 */
export function buildStageDisplayItems<S extends StepForDisplay>(
  steps: ReadonlyArray<S>,
  oldStagesCollapsed: boolean,
): Array<StageDisplayItem<S>> {
  const completedSteps = steps
    .filter(s => s.status === 'completed' || s.status === 'approved' || s.status === 'skipped')
    .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
  const oldCompletedSteps = completedSteps.slice(0, -1)
  const oldStepIds = new Set(oldCompletedSteps.map(s => s.id))
  const displayItems: Array<StageDisplayItem<S>> = []
  if (!oldStagesCollapsed || oldCompletedSteps.length === 0) {
    displayItems.push(...steps.map(s => ({ type: 'step' as const, step: s })))
  } else {
    let summaryEmitted = false
    for (const s of steps) {
      if (oldStepIds.has(s.id)) {
        if (!summaryEmitted) {
          displayItems.push({
            type: 'summary',
            count: oldCompletedSteps.length,
            firstStarted: oldCompletedSteps[0]?.started_at ?? null,
          })
          summaryEmitted = true
        }
      } else {
        displayItems.push({ type: 'step', step: s })
      }
    }
  }
  return displayItems
}
