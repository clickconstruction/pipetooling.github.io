import { useState, type CSSProperties, type ReactNode } from 'react'
import type { StagesPhoneRowsMode } from './stagesPhoneRowsMode'
import { stagesTableFlatProps, type StagesUnifiedTableShared } from './stagesTableShared'
import { stagesRowContext } from './stagesRowContext'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { useJobHoursStoryModal } from '../../contexts/JobHoursStoryModalContext'
import { useNavigate } from 'react-router-dom'
import StagesProgressPaymentHeader from './StagesProgressPaymentHeader'
import { type InvoiceWithJob, type StageRow } from '../../lib/jobsStagesBoard'
import { type StagesExpandedThreadRowShared } from './StagesExpandedThreadRow'
import { StagesUnifiedInvoiceRow } from './StagesUnifiedInvoiceRow'
import { StagesUnifiedJobRow } from './StagesUnifiedJobRow'
import { JobPhotosWindow } from '../photos/JobPhotosWindow'
import { stagesUnifiedRowKey } from '../../lib/jobs/stagesUnifiedRowKey'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { buildClickToolingUrl } from '../../lib/jobs/jobAddressUrls'
import { useTestReportModalOptional } from '../../contexts/TestReportModalContext'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import type { Database } from '../../types/database'
import type { UncollectibleFacts } from '../../lib/jobs/uncollectible'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { useWideViewport1100 } from '../../hooks/useWideViewport1100'
import { useSessionNotesOpener } from './sessionNotesOpenerContext'
import {
  renderJobCustomerLine as renderJobCustomerLineWithCtx,
  STAGES_TABLE_MIN_WIDTH,
  type StagesRowRenderContext,
} from './jobsStagesRowShared'
import { StagesFieldAndBillingLines } from './StagesFieldAndBillingLines'
import { StagesJobCellActivityFooter } from './StagesJobCellActivityFooter'
import { StagesQuickActionsStack } from './StagesQuickActionsStack'
import { EmptyState } from '../EmptyState'
import { stagesGroupEmptyWords, type StagesGroupEmptyContext } from '../../lib/jobs/stagesGroupEmptyWords'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/**
 * Stages mixed job/invoice-row section table (Ready to Bill / Billed Awaiting
 * Payment / Collections) — Jobs.tsx decomposition step 9a
 * (docs/JOBS_TABS_ARCHITECTURE.md "Section renderers"). Behavior-preserving
 * move of the IIFE closure `renderUnifiedStagesTable(rows, options)`: the
 * former ~20-key options object is flattened into same-named props (defaults
 * preserved in the destructure), and every captured page value is a same-named
 * prop. Since the Stages map's step 10 the captured page values arrive as one
 * prop, `shared` (`stagesTableShared.ts`), and the section's own rows, labels
 * and moves stay beside it. The quick-action
 * stack's `navigate` + dispatch-task/checklist modal contexts are consumed via
 * their app-global hooks here instead of props.
 */
export type JobsStagesUnifiedTableProps = {
  rows: StageRow[]
  /** Click on the "Progress & payment" header (v2.3408): flip the % complete sort. Omit to render a plain header. */
  onToggleProgressSort?: () => void
  /** Follow-Up deck embed (v2.1740): the card names the columns' context itself, so skip the header row. */
  hideHeader?: boolean
  actionLabel: React.ReactNode | null
  onJobAction: (j: JobWithDetails) => void
  onInvoiceAction: (inv: InvoiceWithJob) => void
  /** Billed Awaiting Payment: open read-only bill (Stripe or outside). */
  onViewBill?: (inv: InvoiceWithJob) => void
  onJobSendBack?: (j: JobWithDetails) => void
  onInvoiceSendBack: (inv: InvoiceWithJob) => void
  showRemaining?: boolean
  showTimeOpen?: boolean
  sendBackBelowRemaining?: boolean
  showCreatePartialInvoice?: boolean
  jobSendBackLabel?: string
  invoiceBundleActionLabel?: string
  invoiceStandaloneActionLabel?: string
  /** When false, hide the Test report (wrench) shortcut (e.g. Billed Awaiting Payment). Default true. */
  showClickTooling?: boolean
  /** Billed Awaiting Payment: open Lien Tooling prefill modal. */
  onOpenLienTooling?: (ctx: { job: JobWithDetails; invoice: JobsLedgerInvoice | null }) => void
  /** Billed Awaiting Payment: flag the row's job as difficult-to-collect (Collections section). */
  onJobMoveToCollections?: (j: JobWithDetails) => void
  /** Collections: short muted note line under the amounts (e.g. the stored collections reason). */
  jobNoteLine?: (j: JobWithDetails) => string | null
  /** Collections (punch list #94, v2.4792): give up on the row's job — the typed confirm with a required reason. */
  onJobMarkUncollectible?: (j: JobWithDetails) => void
  /** The Uncollectible band (v2.4792): the stamp's facts for a row the office gave up on; null = no stamp. */
  rowStamp?: (j: JobWithDetails) => UncollectibleFacts | null
  /** Billed Awaiting Payment: expected-payment chip for the row (bill date + customer pay speed). */
  /** v2.4130: the bill's story for the words line under the bar, plus what still sits under the cell (bank-returned, the no-bill-line pill, the reliability line). */
  billedBillLine?: (row: StageRow) => BilledRowBillLine | null
  /** Phone rows (punch list #30, PR 2a): the card lists render two-line rows instead of cards. */
  phoneRows?: StagesPhoneRowsMode
  /** The section's stage offers the Hazmat fee press (v2.7012): Waiting, Working and Ready to Bill say so; a section that says nothing offers none. */
  offerHazmatFee?: boolean
  openNewReportForJob?: StagesRowRenderContext['openNewReportForJob']
  /** The group's empty words (punch list #184): its name and what hides its rows, from the Stages tab. */
  groupEmpty?: StagesGroupEmptyContext
  /** What every section shares, built once by the Stages tab (`stagesTableShared.ts`, the map's step 10). */
  shared: StagesUnifiedTableShared
}

/**
 * Everything a row component reads (Stages tab decomposition PR 10, v2.3548): the table's
 * props after defaults, plus the helpers it builds once per render. The two row files
 * destructure only what they use.
 */
/** v2.4168: what a Billed row adds under its cell (the bank-returned ⚠, a shell's pill); the bar prints no words under itself (v2.4351: on any row). */
export type BilledRowBillLine = { extras: React.ReactNode }

/** The table's props as the rows read them: the section's own beside the bundle's, flat (step 10). */
type JobsStagesUnifiedTableFlatProps = Omit<JobsStagesUnifiedTableProps, 'shared'> & StagesUnifiedTableShared

export type StagesUnifiedRowContext = Omit<JobsStagesUnifiedTableFlatProps, 'jobSendBackLabel' | 'invoiceBundleActionLabel' | 'invoiceStandaloneActionLabel' | 'flashInvoiceId' | 'showClickTooling'> &
  Required<Pick<JobsStagesUnifiedTableFlatProps, 'jobSendBackLabel' | 'invoiceBundleActionLabel' | 'invoiceStandaloneActionLabel' | 'flashInvoiceId' | 'showClickTooling'>> & {
    openTestReportFor: (job: JobWithDetails) => void
    /** The Job photos window on this job (punch list #244): the row's camera icon. */
    openJobPhotos?: (job: JobWithDetails) => void
    stagesRowSharedCtx: StagesRowRenderContext
    renderStagesFieldAndBillingLines: (job: JobWithDetails, opts?: { datesBilledYmd?: string | null }) => ReactNode
    renderJobCustomerLine: (job: JobWithDetails) => ReactNode
    renderStagesJobCellActivityFooter: (job: JobWithDetails, billingLineForStripeHint?: JobsLedgerInvoice | null, opts?: { hideSeeAllButton?: boolean }) => ReactNode
    renderStagesQuickActionsStack: (job: JobWithDetails) => ReactNode
    renderJobNoteLine: (j: JobWithDetails) => ReactNode
    unifiedStagesColCount: number
    flashRowStyle: (invoiceId: string) => CSSProperties
    stagesSecondaryOutlineButtonBase: CSSProperties
    stagesCellButtonRowStyle: CSSProperties
    stagesCellButtonStyle: CSSProperties
    stagesInvoiceHcpBadgeStyle: CSSProperties
    threadRowShared: StagesExpandedThreadRowShared
    wideViewport: boolean
  }

export default function JobsStagesUnifiedTable(tableProps: JobsStagesUnifiedTableProps) {
  // The bundle and the section's own props as one flat object, so nothing under this line changed (step 10).
  const props = stagesTableFlatProps(tableProps)
  // Test reports (v2.3298): the wrench opens the modal; without the provider (render smokes) it keeps the old site.
  const testReportModal = useTestReportModalOptional()
  const openTestReportFor = (job: JobWithDetails) => {
    if (testReportModal) testReportModal.openTestReport({ job })
    else openInExternalBrowser(buildClickToolingUrl(job))
  }
  const {
    rows,
    hideHeader,
    jobSendBackLabel = 'Send back',
    invoiceBundleActionLabel = 'Remove line',
    invoiceStandaloneActionLabel = 'Send back',
    flashInvoiceId = null,
    showClickTooling = true,
    jobNoteLine,
    pctCompleteSavingId,
    commitStagesPctWithNote,
    canEditJobPctComplete,
    canManageJobPeople,
    setManageJobPeople,
    jobThreadNotesLoadingId,
    submitJobThreadNoteWithBody,
    authUser,
    jobThreadActivityByJobId,
    stagesUpcomingByJobId,
    stagesWorkedByJobId,
    jobThreadFullscreen,
    setJobThreadFullscreen,
    authRole,
  } = props
  const wideViewport = useWideViewport1100()
  const navigate = useNavigate()
  const dispatchTaskModal = useDispatchTaskModal()
  const checklistAddModal = useChecklistAddModal()

  const customerProfileModal = useCustomerProfileModal()
  const jobHoursStoryModal = useJobHoursStoryModal()
  const sessionNotesOpener = useSessionNotesOpener()
  const stagesRowSharedCtx = stagesRowContext(props, {
    openSessionNotesForJob: sessionNotesOpener,
    openCustomerProfile: customerProfileModal?.openCustomerProfile,
    openJobHoursStory: jobHoursStoryModal?.openJobHoursStory,
    navigate,
    dispatchTaskModal,
    checklistAddModal,
  })
  const renderStagesFieldAndBillingLines = (job: JobWithDetails, opts?: { datesBilledYmd?: string | null }) => (
    <StagesFieldAndBillingLines ctx={stagesRowSharedCtx} job={job} datesBilledYmd={opts?.datesBilledYmd} />
  )
  const renderJobCustomerLine = (job: JobWithDetails) => renderJobCustomerLineWithCtx(stagesRowSharedCtx, job)
  const renderStagesJobCellActivityFooter = (
    job: JobWithDetails,
    billingLineForStripeHint?: JobsLedgerInvoice | null,
    opts?: { hideSeeAllButton?: boolean },
  ) => <StagesJobCellActivityFooter ctx={stagesRowSharedCtx} job={job} billingLineForStripeHint={billingLineForStripeHint} hideSeeAllButton={opts?.hideSeeAllButton} />

  const renderStagesQuickActionsStack = (job: JobWithDetails) => <StagesQuickActionsStack ctx={stagesRowSharedCtx} job={job} />

  const renderJobNoteLine = (j: JobWithDetails) => {
    const note = jobNoteLine?.(j)
    if (!note) return null
    return (
      <span
        title={note}
        style={{
          fontSize: '0.75rem',
          color: 'var(--text-red-700)',
          fontStyle: 'italic',
          maxWidth: '11rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {note}
      </span>
    )
  }
  const unifiedStagesColCount = 4
  const flashRowStyle = (invoiceId: string): CSSProperties =>
    flashInvoiceId === invoiceId
      ? {
          backgroundColor: 'var(--bg-amber-100)',
          outline: '2px solid #f59e0b',
          outlineOffset: -2,
          transition: 'background-color 0.35s ease',
        }
      : {}
  const stagesSecondaryOutlineButtonBase: CSSProperties = {
    padding: '0.25rem 0.5rem',
    fontSize: '0.8125rem',
    lineHeight: 1.2,
    textAlign: 'center',
    background: 'none',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    width: 'fit-content',
    maxWidth: '100%',
    boxSizing: 'border-box',
  }
  /** Send back · Collections under the cell (v2.3459): one row, the two buttons
   *  sharing the cell's width, never stacked — the column is 176px and the pair
   *  at their natural widths wrapped onto two lines. */
  const stagesCellButtonRowStyle: CSSProperties = { display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'nowrap', width: '100%' }
  const stagesCellButtonStyle: CSSProperties = { ...stagesSecondaryOutlineButtonBase, flex: '1 1 0', minWidth: 0, width: 'auto', padding: '0.25rem 0.3rem', whiteSpace: 'nowrap' }
  const stagesInvoiceHcpBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.4rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    border: '1px solid rgba(255,255,255,0.5)',
    borderRadius: 4,
    background: '#16a34a',
    color: 'white',
    lineHeight: 1.2,
    // "Invoice: 891" must never break after the colon in a narrow column.
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  }
  /** The expanded thread row's inputs, built once (Stages decomposition PR 9, v2.3541). */
  const threadRowShared = {
    jobThreadActivityByJobId,
    jobThreadNotesLoadingId,
    stagesUpcomingByJobId,
    stagesWorkedByJobId,
    authRole,
    authUser,
    submitJobThreadNoteWithBody,
    jobThreadFullscreen,
    setJobThreadFullscreen,
    canEditJobPctComplete,
    pctCompleteSavingId,
    commitStagesPctWithNote,
    canManageJobPeople,
    setManageJobPeople,
  }

  // The Job photos window (punch list #244): a row's camera icon opens it on that job.
  const [photosJob, setPhotosJob] = useState<JobWithDetails | null>(null)

  const rowCtx: StagesUnifiedRowContext = {
    ...props,
    openJobPhotos: setPhotosJob,
    jobSendBackLabel,
    invoiceBundleActionLabel,
    invoiceStandaloneActionLabel,
    flashInvoiceId,
    showClickTooling,
    openTestReportFor,
    stagesRowSharedCtx,
    renderStagesFieldAndBillingLines,
    renderJobCustomerLine,
    renderStagesJobCellActivityFooter,
    renderStagesQuickActionsStack,
    renderJobNoteLine,
    unifiedStagesColCount,
    flashRowStyle,
    stagesSecondaryOutlineButtonBase,
    stagesCellButtonRowStyle,
    stagesCellButtonStyle,
    stagesInvoiceHcpBadgeStyle,
    threadRowShared,
    wideViewport,
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
      {/* tableLayout: fixed (v2.971, matching JobsStagesTable v2.967): widths come from the
          colgroup, never from content measurement — Billed/Collections rows loading or search
          filtering used to re-measure auto layout and jitter the columns. The one
          unspecified col (Job) takes all the remaining width, so minWidth must
          exceed the colgroup's sized total (see STAGES_TABLE_MIN_WIDTH). */}
      <table style={{ width: '100%', minWidth: STAGES_TABLE_MIN_WIDTH, borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '14rem' }} />
          <col />
          {/* v2.3462: 14.5rem — wide enough that the legend's widest row ("100% Done, not billed" beside a six-figure amount) never wraps. */}
          <col style={{ width: '14.5rem' }} />
          <col style={{ width: 140 }} />
        </colgroup>
        {hideHeader ? null : (
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                borderBottom: '1px solid var(--border)',
                minWidth: '6.75rem',
              }}
            >
              <span style={{ whiteSpace: 'nowrap' }}>Crew &amp; Dates</span>
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
            <StagesProgressPaymentHeader
              sortedByProgress={props.stagesSortMode === 'progress'}
              onToggleSort={props.onToggleProgressSort}
            />
            <th style={{ padding: '0.75rem', width: 140, borderBottom: '1px solid var(--border)' }} />
          </tr>
        </thead>
        )}
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={unifiedStagesColCount} style={{ padding: 0 }}>
                <EmptyState compact {...stagesGroupEmptyWords(props.groupEmpty)} />
              </td>
            </tr>
          ) : (
            rows.map((row) =>
              row.kind === 'invoice' ? (
                <StagesUnifiedInvoiceRow key={stagesUnifiedRowKey(row)} row={row} t={rowCtx} />
              ) : (
                <StagesUnifiedJobRow key={stagesUnifiedRowKey(row)} row={row} t={rowCtx} />
              ),
            )
          )}
        </tbody>
      </table>
      {photosJob ? (
        <JobPhotosWindow
          job={photosJob}
          onClose={() => setPhotosJob(null)}
          onOpenJob={() => {
            const j = photosJob
            setPhotosJob(null)
            props.openEdit(j)
          }}
        />
      ) : null}
    </div>
  )
}
