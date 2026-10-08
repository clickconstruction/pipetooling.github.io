/**
 * GC mode, the real build, the schedule's PR 7a: what holds a bar on the chart, in one place: a
 * question, a submittal, a wait, a trade's papers (G-71, G-73 to G-77). Moved word for word from
 * the GC mode prototype (branch spike/gc-mode, `gcChartHolds.ts`); the plan is
 * to-dos/gc-mode/mockups/schedule-pr7.md on that branch.
 */
import type { GcProject, GcState } from '../types'
import type { GanttHold } from './gantt'
import { rfiRows } from '../buildingRfis'
import { submittalHolding, submittalNeededBy } from '../buildingSubmittals'
import { waitHolds } from './waits'
import { withNotReady } from './notReady'

/** What holds each line on the chart, as the Schedule tab draws it. */
export function chartHolds(state: GcState, project: GcProject): Map<string, GanttHold> {
  const holds = new Map<string, GanttHold>()
  for (const r of rfiRows(state, project)) {
    if (r.state === 'answered') continue
    for (const h of r.holds) holds.set(h.lineId, { kind: 'rfi', words: `${r.label}, ${r.stateWords}`, late: r.late })
  }
  for (const a of project.schedule?.activities ?? []) {
    const s = submittalHolding(project, a.lineId)
    if (!s) continue
    const needed = submittalNeededBy(project, s)
    holds.set(a.lineId, { kind: 'submittal', words: `submittal ${s.number}`, late: needed !== null && needed < state.today })
  }
  // A delivery, a decision, a permit or the utility (G-73 to G-75), where nothing else holds the line.
  for (const [lineId, hold] of waitHolds(state, project)) if (!holds.has(lineId)) holds.set(lineId, hold)
  return withNotReady(holds, state, project)
}
