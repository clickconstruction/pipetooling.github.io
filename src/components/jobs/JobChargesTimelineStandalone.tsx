/** Self-fetching "Cost breakdown" timeline for one job — the Costs tab's chart (and the
 * read-only Job Detail's). Since v2.3189 the fetch lives in `useJobChargesTimelineInputs`
 * so the Burn section above it shares one load: pass `inputsState` from a host that
 * already ran the hook, or omit it and this component runs the hook itself. Streams a
 * role can't read simply don't chart (RLS returns nothing). Renders the shared
 * `JobChargesTimelineChartView`. */
import { useMemo } from 'react'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { useJobChargesTimelineInputs, type JobChargesTimelineInputsState } from '../../hooks/useJobChargesTimelineInputs'
import { buildJobChargesTimelineChartData } from '../../lib/jobChargesTimeline'
import { JobChargesTimelineChartView } from './JobSummaryChargesTimelineChart'
import type { JobWithDetails } from '../../types/jobWithDetails'

export default function JobChargesTimelineStandalone({
  job,
  includeTeamLabor,
  inputsState,
}: {
  job: JobWithDetails
  /** Gate per-person hours × wage events (see `showJobCostBreakdownTeamLabor`) — when false
   * the team-labor fetch never runs, so wage-derived dollars don't reach the browser here. */
  includeTeamLabor: boolean
  /** Preloaded by the host (the Costs tab runs the hook once for Burn + chart). */
  inputsState?: JobChargesTimelineInputsState
}) {
  const ownState = useJobChargesTimelineInputs(job, includeTeamLabor, !inputsState)
  const state = inputsState ?? ownState
  const isNarrow = useIsNarrowScreen()

  const data = useMemo(() => {
    if (state.kind !== 'ready') return null
    const i = state.inputs
    return buildJobChargesTimelineChartData(i.chargeEvents, i.valueEvents, i.revenue, i.paymentEvents, i.fallbackPercent)
  }, [state])

  return (
    <div style={{ marginTop: '1rem' }}>
      {state.kind !== 'ready' || !data || data.chartRows.length === 0 ? (
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.35rem' }}>Cost Timeline</div>
      ) : null}
      {state.kind === 'loading' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Loading charge timeline…</p>
      ) : state.kind === 'error' ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>Could not load the charge timeline.</p>
      ) : !data || data.chartRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>No dated cost events or reports yet.</p>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Title floats centered over the chart's top so the chart keeps the full
              block height — desktop only: on phones it collided with the right-aligned
              "Value created (right axis)" toggle, so it drops into normal flow (v2.1751). */}
          <div
            style={
              isNarrow
                ? { fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.2rem' }
                : {
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    zIndex: 1,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }
            }
          >
            Cost Timeline
          </div>
          <JobChargesTimelineChartView
            teamLaborIncluded={includeTeamLabor}
            data={data}
            revenue={job.revenue != null ? Number(job.revenue) : null}
            cardChargesExcluded={state.inputs.cardChargesExcluded}
          />
        </div>
      )}
    </div>
  )
}
