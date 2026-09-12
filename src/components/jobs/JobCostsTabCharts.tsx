import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useBidCrewRate } from '../../hooks/useBidCrewRate'
import { useJobBaseline } from '../../hooks/useJobBaseline'
import { useJobBudget } from '../../hooks/useJobBudget'
import { useJobBurnOverhead } from '../../hooks/useJobBurnOverhead'
import { useJobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'
import { resolveJobBudget, spendByComponent } from '../../lib/jobs/jobBudget'
import { buildCostsVerdict } from '../../lib/jobs/jobCostsVerdict'
import { JOB_SUMMARY_VIEW_STORAGE_KEY, readJobSummaryViewPrefs } from '../../lib/jobs/jobSummaryLedgerView'
import { resolveJobCurrentPercentFallback } from '../../lib/jobSummaryPercentComplete'
import { newestPercentEvent } from '../../lib/jobChargesTimeline'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { JobBudgetCard } from './JobBudgetCard'
import { JobCostsVerdict } from './JobCostsVerdict'
import { buildBurnForVerdict, firstEventYmdOf, JobCostsBurnSection } from './JobCostsBurnSection'

/**
 * The Costs tab (v2.3361 — the honest tab): the verdict (true margin · spent ·
 * earned off the price · time left, with the by-section build-up and the
 * baseline strip) above one chart (cost against value earned) above the folded
 * detail (daily spend · pace rows · the Cost Timeline), all fed by ONE
 * `useJobChargesTimelineInputs` load. The verdict and chart render only for the
 * wage roles (`includeTeamLabor`) — without team labor the spend is not the
 * spend, so the margin would flatter every job. Replaces the Budget card + Burn
 * tiles of v2.3189–v2.3299; the Budget card's link-a-bid doorway survives
 * folded under the baseline strip.
 */
const DETAIL_PREF_KEY = 'job_costs_detail_open_v1'

function readTargetMarginPct(): number | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(JOB_SUMMARY_VIEW_STORAGE_KEY) : null
    const t = readJobSummaryViewPrefs(raw).targetTrueMarginPct
    return t > 0 ? t : null
  } catch {
    return null
  }
}
function readDetailPref(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DETAIL_PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function JobCostsTabCharts({ job, includeTeamLabor, teamPeople = null }: { job: JobWithDetails; includeTeamLabor: boolean; /** People who clocked on the job (the baseline strip). */ teamPeople?: number | null }) {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const inputsState = useJobChargesTimelineInputs(job, includeTeamLabor)
  // ONE overhead load (v2.3271): the verdict, the chart and the Cost Timeline read the same share.
  const overheadState = useJobBurnOverhead(includeTeamLabor && inputsState.kind === 'ready', job.id, firstEventYmdOf(inputsState))
  const budget = useJobBudget(job.id, job.bid_id ?? null, includeTeamLabor)
  const kept = useJobBaseline(job.id, includeTeamLabor)
  const { crewRate } = useBidCrewRate(includeTeamLabor)
  const inputs = inputsState.kind === 'ready' ? inputsState.inputs : null
  const priceUsd = inputs?.revenue ?? (job.revenue != null ? Number(job.revenue) : null)
  const resolved = useMemo(() => resolveJobBudget({ row: budget.row, priceUsd, targetMarginPct: readTargetMarginPct() }), [budget.row, priceUsd])
  const canWrite = role === 'dev' || role === 'assistant' || role === 'controller' || role === 'master_technician'
  const pctDone = useMemo(() => {
    // v2.3372: the newest dated % — a report or the office's hand-set — else the job's own.
    const reported = inputs ? newestPercentEvent(inputs.valueEvents)?.percent ?? null : null
    return reported ?? inputs?.fallbackPercent ?? resolveJobCurrentPercentFallback(job)
  }, [inputs, job])
  const [detailOpen, setDetailOpen] = useState(readDetailPref)
  const toggleDetail = () => {
    setDetailOpen((o) => {
      try {
        localStorage.setItem(DETAIL_PREF_KEY, o ? '0' : '1')
      } catch {
        /* per-device convenience only */
      }
      return !o
    })
  }

  const finished = job.status === 'billed' || job.status === 'paid'
  const verdict = useMemo(() => {
    if (!inputs) return null
    // A billed or paid job with no % anywhere is done — earned, at-completion and time left all read off 100.
    const burnInputs = inputs.fallbackPercent == null && finished ? { ...inputs, fallbackPercent: 100 } : inputs
    const burn = buildBurnForVerdict(burnInputs, overheadState.overhead, resolved)
    // The report the burn model read: the newest dated % when a REPORT set it; null when the
    // office's hand-set is newer (v2.3372) so the verdict reads "(set on the job)".
    const newest = newestPercentEvent(inputs.valueEvents)
    const latestReportYmd = newest && newest.kind !== 'manual' ? newest.dateKey : null
    return buildCostsVerdict({ burn, priceUsd, spend: spendByComponent(inputs.chargeEvents), teamHours: inputs.teamHours, teamPeople, resolved, bidLabel: job.linkedBid?.bid_number ?? null, latestReportYmd, jobPct: inputs.fallbackPercent ?? resolveJobCurrentPercentFallback(job), jobFinished: finished, todayYmd: todayYmdInAppTz() })
  }, [inputs, overheadState.overhead, resolved, priceUsd, teamPeople, job.linkedBid?.bid_number, finished])

  const linkedBid = job.linkedBid ? { id: job.linkedBid.id, bid_number: job.linkedBid.bid_number, project_name: job.linkedBid.project_name } : null
  const doorway = (
    <JobBudgetCard
      jobId={job.id}
      jobLabel={job.job_name ?? ''}
      priceUsd={priceUsd}
      pctDone={pctDone}
      inputs={inputs}
      budget={budget}
      resolved={resolved}
      companyRate={crewRate?.companyRate ?? null}
      canWrite={canWrite}
      currentUserId={user?.id ?? null}
      linkedBid={linkedBid}
    />
  )

  return (
    <>
      {includeTeamLabor ? (
        verdict ? (
          <JobCostsVerdict verdict={verdict} canWrite={canWrite} budget={budget} linkedBid={linkedBid} onOpenBidCounts={linkedBid ? () => navigate(`/bids?tab=counts&bidId=${encodeURIComponent(linkedBid.id)}`) : null} doorway={doorway} kept={kept} jobFinished={finished} />
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>{inputsState.kind === 'error' ? 'Could not load the job’s costs.' : 'Loading…'}</p>
        )
      ) : null}
      {includeTeamLabor ? <JobCostsBurnSection inputsState={inputsState} overheadState={overheadState} jobBudget={resolved} mode="chart" /> : null}
      <div>
        <button type="button" onClick={toggleDetail} aria-expanded={detailOpen} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit' }} data-testid="costs-detail-toggle">
          {detailOpen ? 'Hide' : 'Show'} the timeline · daily spend {detailOpen ? '▴' : '▾'}
        </button>
        {detailOpen ? (
          <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.6rem' }}>
            {includeTeamLabor ? <JobCostsBurnSection inputsState={inputsState} overheadState={overheadState} jobBudget={resolved} mode="detail" /> : null}
            <JobChargesTimelineStandalone job={job} includeTeamLabor={includeTeamLabor} inputsState={inputsState} overheadState={overheadState} />
          </div>
        ) : null}
      </div>
    </>
  )
}
