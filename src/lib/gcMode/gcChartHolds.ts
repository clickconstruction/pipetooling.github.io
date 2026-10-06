/**
 * GC mode design spike: what holds a bar on the chart, in one place. Moved unchanged out of the
 * Schedule tab (its private `holdsOf`, then G-77's `withNotReady`) for G-118, so the Daily log tab's
 * morning list reads the very holds the chart draws.
 *
 * A submittal not yet approved (owner, 2026-10-04), or a question about the plans not yet answered
 * (the Gantt, G-71); a submittal wins when both hold one line. Then a delivery, a decision, a permit
 * or the utility (G-73 to G-75) where nothing else holds the line. Last, a trade not ready to start
 * (G-77): its papers, read on each bar's start day.
 *
 * Its own file, out of the barrel: it reads the RFIs, the submittals, the waits and the trades' papers.
 */
import type { GcProject, GcState } from './gcTypes'
import type { GanttHold } from './gcGantt'
import { rfiRows } from './gcBuildingRfis'
import { submittalHolding, submittalNeededBy } from './gcBuildingSubmittals'
import { waitHolds } from './gcScheduleWaits'
import { withNotReady } from './gcNotReady'

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
