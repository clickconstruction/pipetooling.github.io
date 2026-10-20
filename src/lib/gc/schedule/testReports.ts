/**
 * Test data only: the app never reads it. A line's report on the test state, as the GC mode prototype's reducer made one
 * (`tradeReport` and `selfReportStage`, branch spike/gc-mode): a trade's line at its percent, never below billed, or our
 * own crew's stage, and on a job being built the line's real start and finish (`withReportedActuals`, G-55). On main a
 * trade's report comes from its portal (the Portal's P5c) and our crew's from its Pipeline job (PR 16), so the schedule's
 * tests play it here.
 */
import { crewPctFromStages } from '../building'
import type { GcState } from '../types'
import { withReportedActuals } from './actualDates'

/** The state with one line reported at `pct`. Unchanged when the job, the trade or the line is not there. */
export function withLineReported(state: GcState, projectId: string, packageId: string, lineId: string, pct: number): GcState {
  return {
    ...state,
    projects: state.projects.map((p) => {
      if (p.id !== projectId) return p
      const pkg = p.packages.find((k) => k.id === packageId)
      if (!pkg) return p
      const sowLine = pkg.sow?.sov.find((l) => l.id === lineId)
      const self = pkg.selfPerform
      if (!sowLine && !(self && pkg.scope.some((l) => l.id === lineId))) return p
      const at = sowLine ? Math.max(sowLine.pctBilled, Math.min(100, pct)) : Math.max(0, Math.min(100, Math.round(pct)))
      const schedule = p.stage === 'building' ? withReportedActuals(p.schedule, lineId, at, state.today) : p.schedule
      const packages = p.packages.map((k) => {
        if (k.id !== packageId) return k
        if (sowLine && k.sow) return { ...k, sow: { ...k.sow, sov: k.sow.sov.map((l) => (l.id === lineId ? { ...l, pctReported: at } : l)) } }
        if (k.selfPerform) {
          const pctByLine = { ...Object.fromEntries(k.scope.map((l) => [l.id, k.selfPerform?.pctByLine?.[l.id] ?? 0])), [lineId]: at }
          return { ...k, selfPerform: { ...k.selfPerform, pctByLine, pctDone: Math.round(crewPctFromStages(k, pctByLine)) } }
        }
        return k
      })
      return { ...p, packages, ...(schedule ? { schedule } : {}) }
    }),
  }
}
