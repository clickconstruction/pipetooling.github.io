import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useBidCrewRate } from '../../hooks/useBidCrewRate'
import { useBidPricedMargin } from '../../hooks/useBidPricedMargin'
import { useJobBaseline } from '../../hooks/useJobBaseline'
import { useJobBudget } from '../../hooks/useJobBudget'
import { useJobBurnOverhead } from '../../hooks/useJobBurnOverhead'
import { useJobChargesTimelineInputs, type JobChargesTimelineInputsState } from '../../hooks/useJobChargesTimelineInputs'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { useOptionalToastContext } from '../../contexts/ToastContext'
import { withLiveJobFormValues, type JobCostsLiveValues } from '../../lib/jobs/jobCostsLiveInputs'
import { budgetForBurn, resolveJobBudget, spendByComponent } from '../../lib/jobs/jobBudget'
import { baselineKeptWords, buildCostsVerdict, pctDoneWords } from '../../lib/jobs/jobCostsVerdict'
import { buildMoneyRows } from '../../lib/jobs/jobMoneyTable'
import { materialRowHasUserContent } from '../../lib/jobs/jobFormRows'
import type { MaterialRow } from '../../lib/jobs/jobFormTypes'
import { cardChargeCostUsd, type CardChargeExclusions } from '../../lib/jobs/cardChargeAllocationFilter'
import type { JobCardCostLine } from '../../lib/jobs/jobCardCostLines'
import type { CategoryTagRow } from '../../lib/banking/categoryTags'
import { jobCardLineStatus, type JobMercuryAllocLine, type JobSupplyInvoiceLine, type JobTallyPartLine } from '../../lib/fetchJobMaterialsCostSnapshot'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { labelJobsLedgerStatus, normalizeJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'
import { resolveJobCurrentPercentFallback } from '../../lib/jobSummaryPercentComplete'
import { newestPercentEvent, ymdFromDateOnlyOrIso } from '../../lib/jobChargesTimeline'
import { buildJobCostsPacketHtml, jobCostsPacketDayLabel, type JobCostsPacketCardLine } from '../../lib/jobsDocuments/jobCostsPacket'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import type { TeamLaborRow } from '../../utils/teamLabor'
import type { JobWithDetails } from '../../types/jobWithDetails'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import { JobBudgetCard } from './JobBudgetCard'
import { JobCostsVerdict } from './JobCostsVerdict'
import { firstEventYmdOf, JobCostsBurnSection } from './JobCostsBurnSection'
import { buildBurnForVerdict, readTargetMarginPct } from '../../lib/jobs/jobBurnForVerdict'

/**
 * The Costs tab (v2.3361 — the honest tab): the verdict (true margin · spent ·
 * earned off the price · time left, with the by-section build-up and the
 * baseline strip) above one chart (cost against value earned) above the folded
 * detail (daily spend · pace rows · the Cost Timeline), all fed by ONE
 * `useJobChargesTimelineInputs` load. The verdict and chart render only for the
 * wage roles (`includeTeamLabor`) — without team labor the spend is not the
 * spend, so the margin would flatter every job. Replaces the Budget card + Burn
 * tiles of v2.3189–v2.3299; the Budget card's link-a-bid doorway survives
 * folded under the baseline strip. Since v2.5749 **Print** on the verdict's
 * first line lays the whole tab out as four Letter pages
 * (`lib/jobsDocuments/jobCostsPacket.ts`) from the lines the host hands down.
 */
const DETAIL_PREF_KEY = 'job_costs_detail_open_v1'

/** The name on the packet's first line and running footer. */
export const JOB_COSTS_PACKET_COMPANY = 'Click Plumbing and Electrical'

/** The lines behind Where the money went, as the Edit Job window holds them — what Print needs beyond the tab's own load. */
export type JobCostsPacketLines = {
  supplyInvoiceTotal: number
  supplyInvoiceRpcFailed: boolean
  supplyInvoiceLines: JobSupplyInvoiceLine[]
  mercuryCardTotal: number
  mercuryFetchFailed: boolean
  mercuryAllocLines: JobMercuryAllocLine[]
  mercuryCardExclusions?: CardChargeExclusions
  mercuryCardCostLines?: JobCardCostLine[]
  mercuryCardTagByTxId?: ReadonlyMap<string, CategoryTagRow>
  tallyPartsTotal: number
  tallyFetchFailed: boolean
  tallyPartLines: JobTallyPartLine[]
  teamLabor: { loading: boolean; error: boolean; row: TeamLaborRow | null }
  subLabor: { loading: boolean; error: boolean; data: { count: number; total: number } | null }
  otherCharges: MaterialRow[]
}

function readDetailPref(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(DETAIL_PREF_KEY) === '1'
  } catch {
    return false
  }
}

const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function JobCostsTabCharts({ job, includeTeamLabor, teamPeople = null, live = null, packet = null }: { job: JobWithDetails; includeTeamLabor: boolean; /** People who clocked on the job (the baseline strip). */ teamPeople?: number | null; /** The open form's own price and other job charges — the tab reads these over the loaded job's, so it follows what was typed without a reopen. Memoize it. */ live?: JobCostsLiveValues | null; /** The lines behind the money table (v2.5749), so Print can lay the whole tab out; null hides the button. */ packet?: JobCostsPacketLines | null }) {
  const { user, role, profileName } = useAuth()
  const navigate = useNavigate()
  const toast = useOptionalToastContext()
  const loadedInputsState = useJobChargesTimelineInputs(job, includeTeamLabor)
  const inputsState = useMemo<JobChargesTimelineInputsState>(
    () => (loadedInputsState.kind === 'ready' && live ? { kind: 'ready', inputs: withLiveJobFormValues(loadedInputsState.inputs, live) } : loadedInputsState),
    [loadedInputsState, live],
  )
  // ONE overhead load (v2.3271): the verdict, the chart and the Cost Timeline read the same share.
  const overheadState = useJobBurnOverhead(includeTeamLabor && inputsState.kind === 'ready', job.id, firstEventYmdOf(inputsState))
  const budget = useJobBudget(job.id, job.bid_id ?? null, includeTeamLabor)
  const kept = useJobBaseline(job.id, includeTeamLabor)
  const { crewRate } = useBidCrewRate(includeTeamLabor)
  // v2.5043: the margin the linked bid was priced at, beside the direct margin at completion.
  const priced = useBidPricedMargin(job.bid_id ?? null, includeTeamLabor)
  // The card nicknames the packet prints beside each charge (v2.5749); off when there is nothing to print.
  const { nicknameByDebitCard } = useMercuryLedgerNicknames({ enabled: includeTeamLabor && packet != null })
  const inputs = inputsState.kind === 'ready' ? inputsState.inputs : null
  const priceUsd = inputs?.revenue ?? live?.priceUsd ?? (job.revenue != null ? Number(job.revenue) : null)
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
  const built = useMemo(() => {
    if (!inputs) return null
    // A billed or paid job with no % anywhere is done — earned, at-completion and time left all read off 100.
    const burnInputs = inputs.fallbackPercent == null && finished ? { ...inputs, fallbackPercent: 100 } : inputs
    const burn = buildBurnForVerdict(burnInputs, overheadState.overhead, resolved)
    // The report the burn model read: the newest dated % when a REPORT set it; null when the
    // office's hand-set is newer (v2.3372) so the verdict reads "(set on the job)".
    const newest = newestPercentEvent(inputs.valueEvents)
    const latestReportYmd = newest && newest.kind !== 'manual' ? newest.dateKey : null
    const verdict = buildCostsVerdict({ burn, priceUsd, spend: spendByComponent(inputs.chargeEvents), teamHours: inputs.teamHours, teamPeople, resolved, bidLabel: job.linkedBid?.bid_number ?? null, latestReportYmd, jobPct: inputs.fallbackPercent ?? resolveJobCurrentPercentFallback(job), jobFinished: finished, todayYmd: todayYmdInAppTz(), priced })
    return { burn, verdict }
  }, [inputs, overheadState.overhead, resolved, priceUsd, teamPeople, job, finished, priced])
  const verdict = built?.verdict ?? null

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

  /** The Costs tab on paper (v2.5749): every figure the tab holds, laid out by the builder, into a print window. */
  const printPacket = () => {
    if (!inputs || !built || !packet) return
    const { burn, verdict: v } = built
    const hcp = (job.hcp_number ?? '').trim()
    const number = hcp || (job.click_number ?? '').trim()
    const trade = buildServiceTypeTradePill(job.serviceType?.name)?.label
    const status = normalizeJobsLedgerStatus(job.status)
    const newest = newestPercentEvent(inputs.valueEvents)
    const pctLine =
      newest?.kind === 'manual' && newest.dateKey && newest.percent != null
        ? `${Math.round(newest.percent)}% done · set on the job by ${newest.label.replace(/^Set on the job by /, '')} on ${jobCostsPacketDayLabel(newest.dateKey)}`
        : pctDoneWords(v, dayLabel)
    const money = buildMoneyRows({
      supplyUsd: packet.supplyInvoiceTotal, supplyCount: packet.supplyInvoiceLines.length, supplyFailed: packet.supplyInvoiceRpcFailed,
      teamUsd: packet.teamLabor.row?.jobCost ?? 0, teamHours: packet.teamLabor.row?.manHours ?? 0, teamPeople: packet.teamLabor.row?.people.length ?? 0, teamLoading: packet.teamLabor.loading, teamFailed: packet.teamLabor.error,
      cardUsd: packet.mercuryCardTotal, cardCount: packet.mercuryAllocLines.length, cardFailed: packet.mercuryFetchFailed, cardCostLines: packet.mercuryCardCostLines,
      subUsd: packet.subLabor.data?.total ?? 0, subCount: packet.subLabor.data?.count ?? 0, subLoading: packet.subLabor.loading, subFailed: packet.subLabor.error,
      tallyUsd: packet.tallyPartsTotal, tallyCount: packet.tallyPartLines.length, tallyFailed: packet.tallyFetchFailed,
      otherUsd: packet.otherCharges.reduce((s, m) => s + (Number(m.amount) || 0), 0), otherCount: packet.otherCharges.filter(materialRowHasUserContent).length,
    })
    const cards: JobCostsPacketCardLine[] = packet.mercuryAllocLines.map((ln) => {
      const tag = ln.mercuryTransactionId ? packet.mercuryCardTagByTxId?.get(ln.mercuryTransactionId) : undefined
      return {
        postedYmd: ln.postedAt ? calendarYmdInAppTzFromIso(ln.postedAt) : null,
        card: ln.debitCardId ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId) : null,
        counterparty: ln.counterpartyName,
        amount: cardChargeCostUsd(ln.allocationAmount),
        tag: tag ? { icon: tag.icon, name: tag.name } : null,
        status: jobCardLineStatus(ln, packet.mercuryCardExclusions),
      }
    })
    const bidFigureUsd = budgetForBurn(resolved)
    const html = buildJobCostsPacketHtml({
      company: JOB_COSTS_PACKET_COMPANY,
      job: {
        numberLabel: [number, trade].filter(Boolean).join(' '),
        name: job.job_name ?? '',
        address: job.job_address ?? '',
        customer: job.customer_name ?? null,
        gc: job.gcCustomer?.name ?? null,
        statusWords: status ? labelJobsLedgerStatus(status) : null,
        openedYmd: job.created_at ? calendarYmdInAppTzFromIso(job.created_at) : null,
        lastWorkYmd: ymdFromDateOnlyOrIso(job.last_work_date, calendarYmdInAppTzFromIso),
      },
      printedAt: new Date().toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      printedBy: profileName,
      todayYmd: todayYmdInAppTz(),
      verdict: v,
      burn,
      pctLine,
      baselineKeptWords: baselineKeptWords(kept.row),
      money,
      chargeEvents: inputs.chargeEvents,
      valueEvents: inputs.valueEvents,
      paymentEvents: inputs.paymentEvents,
      supply: packet.supplyInvoiceLines,
      cards,
      tally: packet.tallyPartLines,
      other: packet.otherCharges.filter(materialRowHasUserContent).map((m) => ({ description: m.description, amount: Number(m.amount) || 0, chargedOn: m.charged_on ?? null, memo: m.memo ?? null })),
      paidToDateUsd: inputs.paymentEvents.reduce((s, p) => s + (Number(p.amount) || 0), 0),
      bidFigure: bidFigureUsd != null ? { usd: bidFigureUsd, label: `${resolved.glyph} bid figure` } : null,
    })
    if (!openHtmlPrintWindow(html)) toast?.showToast('Allow pop-ups to print it.', 'error')
  }

  return (
    <>
      {includeTeamLabor ? (
        verdict ? (
          <JobCostsVerdict verdict={verdict} canWrite={canWrite} budget={budget} linkedBid={linkedBid} onOpenBidCounts={linkedBid ? () => navigate(`/bids?tab=counts&bidId=${encodeURIComponent(linkedBid.id)}`) : null} doorway={doorway} kept={kept} jobFinished={finished} onPrint={packet ? printPacket : null} />
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
