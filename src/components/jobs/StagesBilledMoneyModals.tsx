import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import BilledAgingChartModal from './BilledAgingChartModal'
import BilledByCustomerBreakdownModal from './BilledByCustomerBreakdownModal'
import BilledPaymentForecastModal from './BilledPaymentForecastModal'
import BilledReportShareModal from './BilledReportShareModal'
import FixBillLinesModal from './FixBillLinesModal'
import PaidProfitChartModal from './PaidProfitChartModal'
import PaymentChaseModal from './PaymentChaseModal'
import PaymentForecastShareModal from './PaymentForecastShareModal'
import SetPromisedPayDateModal from './SetPromisedPayDateModal'
import type { StagesRowRenderContext } from './jobsStagesRowShared'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import type { OpenEditJobOptions } from '../../contexts/JobFormModalContext'
import type { useAuth } from '../../hooks/useAuth'
import type { BilledMoneyData } from '../../hooks/useBilledMoneyData'
import { useForecastWorkMonths } from '../../hooks/useForecastWorkMonths'
import { NON_PAID_SCOPES } from '../../lib/jobs/boardScopes'
import { buildFixBillLineItems } from '../../lib/jobs/fixBillLines'
import { buildPaymentChaseQueue } from '../../lib/jobs/paymentChase'
import * as stagesGates from '../../lib/jobs/stagesRoleGates'
import type { StagesSectionOpenState } from '../../lib/jobs/stagesSectionPrefs'
import type { latestTemperatureByGc } from '../../lib/jobs/temperatureBoard'
import type { JobsStagesBoardLists, StageRow } from '../../lib/jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * The Stages tab's billed-money windows (punch list #46 row 2, JOBS_STAGES_TAB map step 8), moved
 * verbatim out of `JobsStagesTab`: who owes what, the aging chart, the payment forecast and its
 * Email… window, call mode, Fix bill lines, the promised pay date, the paid profit chart and the
 * billed report share. The open flags stay in the tab — the handle, the money overview, the ☰ menu
 * and the Billed header write them — except the forecast's share window, which only the forecast
 * opens. With the windows come what only they read: the scope kicks that keep the non-paid scopes
 * loading while one is open, call mode's full queue and the forecast's work months. Every prop keeps
 * the tab's name, so the JSX is the tab's.
 */
export type StagesBilledMoneyModalsProps = {
  authRole: ReturnType<typeof useAuth>['role']
  jobs: JobWithDetails[]
  customerFilterForFetch: string | null
  /** The board with no search applied: the money windows count every bill. */
  unfilteredBoardLists: JobsStagesBoardLists
  /** The board as filtered on screen: Fix bill lines, the paid chart and the billed print read it (map quirk 4). */
  stagesBoardLists: JobsStagesBoardLists
  stagesSearchQuery: string
  billedBreakdownOpen: boolean
  setBilledBreakdownOpen: Dispatch<SetStateAction<boolean>>
  billedAgingChartOpen: boolean
  setBilledAgingChartOpen: Dispatch<SetStateAction<boolean>>
  billedPaymentForecastOpen: boolean
  setBilledPaymentForecastOpen: Dispatch<SetStateAction<boolean>>
  chaseModalOpen: boolean
  setChaseModalOpen: Dispatch<SetStateAction<boolean>>
  fixBillLinesOpen: boolean
  setFixBillLinesOpen: Dispatch<SetStateAction<boolean>>
  promisedPayModalJob: { jobId: string; jobLabel: string; initialYmd: string | null } | null
  setPromisedPayModalJob: (next: null) => void
  paidProfitChartOpen: boolean
  setPaidProfitChartOpen: Dispatch<SetStateAction<boolean>>
  billedShareModalOpen: boolean
  setBilledShareModalOpen: Dispatch<SetStateAction<boolean>>
  billedPaySpeeds: BilledMoneyData['billedPaySpeeds']
  refreshBilledPaySpeeds: BilledMoneyData['refreshBilledPaySpeeds']
  promisedPayDates: BilledMoneyData['promisedPayDates']
  loadPromisedPayDates: BilledMoneyData['loadPromisedPayDates']
  loadPromiseRecords: BilledMoneyData['loadPromiseRecords']
  promiseSlipByCustomer: BilledMoneyData['promiseSlipByCustomer']
  chaseTouches: BilledMoneyData['chaseTouches']
  loadChaseTouches: BilledMoneyData['loadChaseTouches']
  gcTemperatureById: ReturnType<typeof latestTemperatureByGc>
  chaseTodayYmd: string
  forecastTodayYmd: string
  applyStagesInvoiceFocus: (invoiceId: string) => boolean
  setStagesSectionOpen: Dispatch<SetStateAction<StagesSectionOpenState>>
  setPendingStagesJobFocusId: Dispatch<SetStateAction<string | null>>
  setStagesJobFlashId: Dispatch<SetStateAction<string | null>>
  setBilledAgingFilter: Dispatch<SetStateAction<'30_90' | '90' | 'no_line' | null>>
  focusStagesSection: (key: 'waiting' | 'working' | 'readyToBill' | 'billed' | 'collections') => void
  tryOpenEditJob: (jobId: string, options?: OpenEditJobOptions) => void
  setLienDesk: (next: { jobId: string }) => void
  setCollectionsConfirm: (next: { job: JobWithDetails; direction: 'to' }) => void
  showToast: StagesRowRenderContext['showToast']
  loadJobs: () => Promise<JobWithDetails[] | undefined>
  openStagesDetailJobModal: (j: JobWithDetails) => void
  printBilledAwaitingPaymentReport: (rows: StageRow[], opts?: { searchFilter?: string }) => void
}

export default function StagesBilledMoneyModals({
  authRole,
  jobs,
  customerFilterForFetch,
  unfilteredBoardLists,
  stagesBoardLists,
  stagesSearchQuery,
  billedBreakdownOpen,
  setBilledBreakdownOpen,
  billedAgingChartOpen,
  setBilledAgingChartOpen,
  billedPaymentForecastOpen,
  setBilledPaymentForecastOpen,
  chaseModalOpen,
  setChaseModalOpen,
  fixBillLinesOpen,
  setFixBillLinesOpen,
  promisedPayModalJob,
  setPromisedPayModalJob,
  paidProfitChartOpen,
  setPaidProfitChartOpen,
  billedShareModalOpen,
  setBilledShareModalOpen,
  billedPaySpeeds,
  refreshBilledPaySpeeds,
  promisedPayDates,
  loadPromisedPayDates,
  loadPromiseRecords,
  promiseSlipByCustomer,
  chaseTouches,
  loadChaseTouches,
  gcTemperatureById,
  chaseTodayYmd,
  forecastTodayYmd,
  applyStagesInvoiceFocus,
  setStagesSectionOpen,
  setPendingStagesJobFocusId,
  setStagesJobFlashId,
  setBilledAgingFilter,
  focusStagesSection,
  tryOpenEditJob,
  setLienDesk,
  setCollectionsConfirm,
  showToast,
  loadJobs,
  openStagesDetailJobModal,
  printBilledAwaitingPaymentReport,
}: StagesBilledMoneyModalsProps) {
  // The cache's scope API, read from the context as the tab reads it.
  const {
    mergedScopes: cacheMergedScopes,
    scopeLoading: cacheScopeLoading,
    fetchScopeIfNeeded: cacheFetchScopeIfNeeded,
  } = useJobsListCache()
  /** Email… on the Payment forecast header (v2.2226) — the payment_forecast stream's share modal. */
  const [forecastShareModalOpen, setForecastShareModalOpen] = useState(false)
  // The three billed money modals (aging chart / payment forecast / who owes
  // what) work from a collapsed section too: while any is open, keep kicking
  // the scope fetches until they merge — a one-shot call no-ops when the base
  // board fetch is still in flight (fetchScopeIfNeeded's loadInFlight guard),
  // so this mirrors the fetch-on-expand effect's retry-on-cache-change shape.
  // ALL non-paid scopes, not just billed (v2.2035's chase-queue fix): billed
  // invoices hang on working/waiting jobs too (a part-billed Working job is
  // exactly the bill that falls through cracks), and the board kernel routes
  // them into the billed section only when their job's scope is loaded.
  const billedMoneyModalOpen = billedAgingChartOpen || billedPaymentForecastOpen || billedBreakdownOpen
  useEffect(() => {
    if (!billedMoneyModalOpen) return
    for (const scope of NON_PAID_SCOPES) {
      void cacheFetchScopeIfNeeded(scope, customerFilterForFetch)
    }
  }, [billedMoneyModalOpen, cacheMergedScopes, cacheScopeLoading, customerFilterForFetch, cacheFetchScopeIfNeeded])
  // Call mode reads FULL rows (names + send evidence) from EVERY non-paid
  // scope — billed invoices hang on working/waiting jobs too (a part-billed
  // working job is exactly the bill that falls through cracks), and the
  // board kernel routes them into the billed section only when their job's
  // scope is loaded. Same retry-until-merged shape as the forecast.
  useEffect(() => {
    if (!chaseModalOpen) return
    for (const scope of NON_PAID_SCOPES) {
      void cacheFetchScopeIfNeeded(scope, customerFilterForFetch)
    }
  }, [chaseModalOpen, cacheMergedScopes, cacheScopeLoading, customerFilterForFetch, cacheFetchScopeIfNeeded])
  // Work months under the forecast's rows (the lien clock's evidence): one
  // clock-sessions fetch for the open-bill jobs, only while the modal is open.
  const forecastWorkMonthJobs = useMemo(() => {
    if (!billedPaymentForecastOpen) return null
    const seen = new Map<string, { id: string; gc_customer_id: string | null; customer_address_id: string | null }>()
    for (const r of unfilteredBoardLists.billedActiveRows) {
      if (r.kind === 'job' || seen.has(r.job.id)) continue
      seen.set(r.job.id, { id: r.job.id, gc_customer_id: r.job.gc_customer_id ?? null, customer_address_id: r.job.customer_address_id ?? null })
    }
    return [...seen.values()]
  }, [billedPaymentForecastOpen, unfilteredBoardLists])
  const { byJob: forecastWorkMonths } = useForecastWorkMonths(forecastWorkMonthJobs, forecastTodayYmd)
  const nonPaidScopesMerged = NON_PAID_SCOPES.every((s) => cacheMergedScopes.has(s))
  const chaseFullQueue = useMemo(() => {
    if (!chaseModalOpen || !nonPaidScopesMerged) return null
    return buildPaymentChaseQueue(
      unfilteredBoardLists.billedActiveRows,
      billedPaySpeeds,
      promisedPayDates,
      chaseTouches,
      chaseTodayYmd,
      gcTemperatureById,
    )
  }, [chaseModalOpen, nonPaidScopesMerged, unfilteredBoardLists, billedPaySpeeds, promisedPayDates, chaseTouches, chaseTodayYmd, gcTemperatureById])

  return (
    <>
      {billedBreakdownOpen && (
        <BilledByCustomerBreakdownModal
          rows={unfilteredBoardLists.billedActiveRows}
          loading={!nonPaidScopesMerged}
          canSeeCharts={stagesGates.canSeeStagesMoneyCharts(authRole)}
          authRole={authRole}
          onClose={() => setBilledBreakdownOpen(false)}
          onOpenBill={(bill) => {
            setBilledBreakdownOpen(false)
            if (bill.invoiceId) {
              applyStagesInvoiceFocus(bill.invoiceId)
            } else {
              setStagesSectionOpen((prev) => ({ ...prev, billed: true }))
              setPendingStagesJobFocusId(bill.jobId)
              setStagesJobFlashId(bill.jobId)
            }
          }}
          onOpenAgingChart={() => {
            setBilledBreakdownOpen(false)
            setBilledAgingChartOpen(true)
          }}
          onShow90={() => {
            setBilledBreakdownOpen(false)
            setBilledAgingFilter('90')
            focusStagesSection('billed')
          }}
          onGoToBilled={() => {
            setBilledBreakdownOpen(false)
            focusStagesSection('billed')
          }}
        />
      )}
      {billedAgingChartOpen && (
        <BilledAgingChartModal
          rows={unfilteredBoardLists.billedActiveRows}
          loading={!nonPaidScopesMerged}
          onClose={() => setBilledAgingChartOpen(false)}
          onOpenInvoice={(invoiceId) => {
            setBilledAgingChartOpen(false)
            applyStagesInvoiceFocus(invoiceId)
          }}
        />
      )}
      {billedPaymentForecastOpen && (
        <BilledPaymentForecastModal
          rows={unfilteredBoardLists.billedActiveRows}
          loading={!nonPaidScopesMerged}
          paySpeeds={billedPaySpeeds}
          promises={promisedPayDates}
          slipByCustomer={promiseSlipByCustomer}
          todayYmd={calendarYmdInAppTzFromIso(new Date().toISOString())}
          onClose={() => setBilledPaymentForecastOpen(false)}
          onOpenInvoice={(invoiceId) => {
            setBilledPaymentForecastOpen(false)
            applyStagesInvoiceFocus(invoiceId)
          }}
          onOpenJobDetail={(jobId) => {
            // Land on the Bill tab (v2.2303, owner call): payments + invoice
            // links are what these doors exist to fix.
            setBilledPaymentForecastOpen(false)
            tryOpenEditJob(jobId, { initialTab: 'bill' })
          }}
          canExcludePayments={stagesGates.isStagesOwnerRole(authRole)}
          isDev={authRole === 'dev'}
          canEmailMoneyWaiting={stagesGates.isStagesOfficeRole(authRole)}
          onOpenJobStacked={(jobId, onSaved) => {
            // v2.2311: the Job window (z 1010) stacks above the drill-down
            // (z 780) — nothing closes, and every save refreshes the list.
            tryOpenEditJob(jobId, { initialTab: 'bill', onSaved })
          }}
          onPaySpeedsChanged={() => void refreshBilledPaySpeeds()}
          onEmail={
            stagesGates.isStagesOfficeRole(authRole)
              ? () => setForecastShareModalOpen(true)
              : undefined
          }
          workMonths={forecastWorkMonths}
          onOpenLienNotice={(jobId) => {
            // The Lien desk on that job (v2.3405) — draft, approve, send; the
            // forecast closes so the desk has the screen.
            setBilledPaymentForecastOpen(false)
            setLienDesk({ jobId })
          }}
        />
      )}
      {forecastShareModalOpen && <PaymentForecastShareModal onClose={() => setForecastShareModalOpen(false)} />}
      {chaseModalOpen && (
        <PaymentChaseModal
          queue={chaseFullQueue}
          loading={!nonPaidScopesMerged}
          paySpeeds={billedPaySpeeds}
          todayYmd={chaseTodayYmd}
          authRole={authRole}
          onClose={() => setChaseModalOpen(false)}
          onRecorded={() => {
            void loadChaseTouches()
            void loadPromisedPayDates()
          }}
          onOpenInvoice={(invoiceId) => {
            setChaseModalOpen(false)
            applyStagesInvoiceFocus(invoiceId)
          }}
          // B6 / J4-7: the board's typed confirm layers over call mode (z 780 > 770);
          // the session snapshot stays put while the flag writes.
          onMoveToCollections={
            // same office pool as the section's Collections button (server RPC is authoritative)
            stagesGates.isStagesOfficeRole(authRole)
              ? (jobId) => {
                  const job = jobs.find((j) => j.id === jobId)
                  if (!job) {
                    showToast('That job is not on the board any more — refresh and try again.', 'warning')
                    return
                  }
                  setCollectionsConfirm({ job, direction: 'to' })
                }
              : undefined
          }
        />
      )}
      {fixBillLinesOpen && (
        <FixBillLinesModal
          items={buildFixBillLineItems(stagesBoardLists.billedActiveRows)}
          onClose={() => setFixBillLinesOpen(false)}
          onAnyFixed={() => void loadJobs()}
        />
      )}
      {promisedPayModalJob && (
        <SetPromisedPayDateModal
          jobId={promisedPayModalJob.jobId}
          jobLabel={promisedPayModalJob.jobLabel}
          initialYmd={promisedPayModalJob.initialYmd}
          onClose={() => setPromisedPayModalJob(null)}
          onSaved={() => {
            void loadPromisedPayDates()
            void loadPromiseRecords()
          }}
        />
      )}
      {paidProfitChartOpen && (
        <PaidProfitChartModal
          paidJobs={stagesBoardLists.paid}
          onClose={() => setPaidProfitChartOpen(false)}
          onOpenJob={(job) => {
            setPaidProfitChartOpen(false)
            openStagesDetailJobModal(job)
          }}
        />
      )}
      {billedShareModalOpen && (
        <BilledReportShareModal
          onClose={() => setBilledShareModalOpen(false)}
          onPrint={() => printBilledAwaitingPaymentReport(stagesBoardLists.billedActiveRows, { searchFilter: stagesSearchQuery })}
          printDisabled={stagesBoardLists.billedActiveRows.length === 0}
        />
      )}
    </>
  )
}
