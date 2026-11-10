import { lazy, Suspense, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { OpenStageChecklistAsk } from '../stageChecklists/JobStageChecklistStrip'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { JobWindowActionBar, JobWindowStatusSheet } from './JobWindowActionBar'
import { JOB_THREAD_COMPOSE_EVENT } from '../JobThreadNotesPanel'
import { pickJobNextChip, type JobNextStage } from '../../lib/jobs/jobNextLine'
import { progressPaymentForJob } from '../../lib/jobs/progressPaymentForJob'
import { stagesBillSentPctAlert } from '../../lib/jobs/stagesBillSentPctAlert'
import { buildEditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import { jobWindowVerb, tabbedJobWindowBar } from '../../lib/jobs/jobWindowBar'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { JobFormFocusRow } from '../../lib/jobs/jobFormFocusRow'
import { JOB_WINDOW_TAB_LABELS, jobWindowFormPaneHidden, jobWindowFormRegionForTab, type JobWindowTabKey } from '../../lib/jobs/jobHistoryTab'
import JobWindowMaterialsPanel from './JobWindowMaterialsPanel'
import { LegendButton } from '../help/LegendButton'
import { DeskLegendCard } from '../help/LegendCard'
import { JOB_WINDOW_LEGEND } from '../../lib/jobs/jobWindowLegend'
import DetailJobModal, {
  formatJobDetailModalTitleParts,
  type DetailJobModalAssignedJobRow,
  type DetailJobScheduleContext,
  type JobPanePhoneBar,
} from './DetailJobModal'
import JobKindChip from './JobKindChip'
import { jobKindOfRow } from '../../lib/jobs/jobKind'
import { JOB_STEPPER_LABELS, type JobStepperStatus } from '../../lib/jobs/jobStatusStepper'
import { priorNumbersBare } from '../../lib/jobs/priorNumbers'
import JobFormModal from './JobFormModal'
import JobHistoryLienTimeline from './JobHistoryLienTimeline'
import { useJobLienTimeline } from '../../hooks/useJobLienTimeline'
import { jobOpenBalance, showJobHistoryLienTimeline } from '../../lib/jobs/jobHistoryLienTimeline'
import { lienMonthLines } from '../../lib/jobs/lienMonthLines'
import { JobWindowDocumentsTab } from './JobWindowDocumentsTab'
import { JobWindowCostMovePanel } from './JobWindowCostMovePanel'
import type { JobWithDetails } from '../../types/jobWithDetails'
import InKindChip from '../inKind/InKindChip'
import { isOfficeRole } from '../../lib/doorRoles'
import JobInKindStrip from '../inKind/JobInKindStrip'
import { useInKindStandings } from '../../hooks/useInKindStandings'
import { jobIsOffTheDeal } from '../../lib/inKind/inKindChip'

/**
 * The tabbed Job window (v2.1675, owner-approved mockup): ONE modal for a job
 * with five tabs — Job (the read view, DetailJobModal in pane mode) · Edit
 * (identity/team/customer/links) · Bill (money in: line items, invoices,
 * payments) · Costs (money out: Cost Timeline, team + sub labor, parts —
 * split out of Bill, owner call) · History — and a single ✕. Edit, Bill and
 * Costs are ONE JobFormModal instance in embedded mode showing one region at
 * a time; everything stays mounted (display-toggled)
 * so switching tabs never loses state, and the form's autosave slices mean
 * there is no Save button anywhere.
 *
 * Close semantics: the ✕, Escape, and the backdrop all route through the
 * form's guarded close-flush (registered via `registerRequestClose`), so an
 * in-flight autosave is never abandoned. Escape is owned by the form's own
 * listener; the Job tab reports its stacked-satellite state up (Reports /
 * Calendar / …) so Esc closes the satellite, never the window underneath it.
 *
 * This component renders only for roles that can edit jobs —
 * JobDetailModalContext keeps serving the plain DetailJobModal to everyone
 * else, unchanged.
 */

export type JobWindowTab = JobWindowTabKey

/** Matches JobFormModal's overlay tier so its nested overlays stack above. */
const JOB_WINDOW_OVERLAY_Z_INDEX = 1010

const TAB_LABELS: Record<JobWindowTab, string> = JOB_WINDOW_TAB_LABELS

/** T5-05: the History pane loads on first visit (lazy) — it is the Projects day-grid in single-job mode. */
const ProjectsJobHistoryTabLazy = lazy(() =>
  import('../projects/ProjectsJobHistoryTab').then((m) => ({ default: m.ProjectsJobHistoryTab })),
)

/** The phone's tabs: pills that wrap (v2.3231). */
const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: '0.3rem 0.85rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 999,
  cursor: 'pointer',
  background: active ? '#2563eb' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
})

/** The desktop's tabs (v2.6539): a full-width strip under the title row, the one that stands underlined, like the Jobs page's own. */
const tabStripStyle = (active: boolean): CSSProperties => ({
  padding: '0.5rem 0.85rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: 'none',
  borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
  marginBottom: -1,
  borderRadius: 0,
  cursor: 'pointer',
  background: 'transparent',
  color: active ? 'var(--text-blue-700)' : 'var(--text-muted)',
  whiteSpace: 'nowrap',
})

const headNumberChip: CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.5rem',
  borderRadius: 6,
  background: 'var(--bg-blue-tint)',
  color: 'var(--text-blue-700)',
  fontSize: '0.8125rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const headStatusChip: CSSProperties = {
  display: 'inline-block',
  padding: '0.1rem 0.55rem',
  borderRadius: 999,
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

type Props = {
  jobId: string
  initialTab: JobWindowTab
  onClose: () => void
  /* ---- Job pane (DetailJobModal) ---- */
  authRole: string | null
  scheduleContext: DetailJobScheduleContext | null
  assignedJobsRows: DetailJobModalAssignedJobRow[]
  prefillRowLabel?: string | null
  prefillAddress?: string | null
  autoOpenSupplyHouseShare?: boolean
  /** Open a stage's checklist sheet on a check once the Job pane loads (punch list #245). */
  openStageChecklist?: OpenStageChecklistAsk | null
  /* ---- Edit/Bill panes (JobFormModal, edit mode) ---- */
  initialJob: JobWithDetails | null
  billingCustomerHighlightInitial: boolean
  fixturesSectionHighlightInitial: boolean
  /** Land on ③ Payments received, flashed (v2.3795). */
  paymentsReceivedHighlightInitial?: boolean
  jobPicturesLinkHighlightInitial: boolean
  propertyRecordFocusInitial?: boolean
  focusRowInitial?: JobFormFocusRow | null
  alsoOpenCreateCustomerModal: boolean
  /** Fires after form saves (also refreshes the Job pane via externalRefreshKey). */
  onSaved: (() => void) | null
}

export function JobWindowModal({
  jobId,
  initialTab,
  onClose,
  authRole,
  scheduleContext,
  assignedJobsRows,
  prefillRowLabel = null,
  prefillAddress = null,
  autoOpenSupplyHouseShare = false,
  openStageChecklist = null,
  initialJob,
  billingCustomerHighlightInitial,
  fixturesSectionHighlightInitial,
  paymentsReceivedHighlightInitial = false,
  jobPicturesLinkHighlightInitial,
  propertyRecordFocusInitial = false,
  focusRowInitial = null,
  alsoOpenCreateCustomerModal,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<JobWindowTab>(initialTab)
  const [historyMounted, setHistoryMounted] = useState(initialTab === 'history')
  // The Documents pane reads the job's pay applications on first visit; while its AIA window is
  // open, Escape belongs to that window.
  const [documentsMounted, setDocumentsMounted] = useState(initialTab === 'documents')
  const [documentsEscBlocked, setDocumentsEscBlocked] = useState(false)
  // Devs: the Costs tab's list of every cost row and its Move cost window (v2.6115) mount on first
  // sight of the tab; while that window is open, Escape belongs to it.
  const [costMoveMounted, setCostMoveMounted] = useState(initialTab === 'costs')
  const [costMoveEscBlocked, setCostMoveEscBlocked] = useState(false)
  // The Job pane reloads when this bumps — form saves must never leave the
  // read view stale behind a tab switch.
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [detailEscBlocked, setDetailEscBlocked] = useState(false)
  const formCloseRef = useRef<(() => Promise<boolean>) | null>(null)
  // Punch list #30, PR 2b: on a phone a bar under the body carries Status ▾ · the job's next
  // verb · Note, read from the job the Job pane loaded (the same chip the Pipeline row shows);
  // since punch list #189 PR 4 also Arrived or Leaving for a viewer on the crew.
  const phone = useNarrowViewport640()
  // The ? and its card (punch list #187 PR 3): what each tab holds, at the end of the tab bar.
  const [legendOpen, setLegendOpen] = useState(false)
  const [fullJob, setFullJob] = useState<JobWithDetails | null>(initialJob)
  // Who pays in kind (punch list #301): the chip beside the customer's name, and the strip on a job the deal does not pay yet.
  const inKindStandings = useInKindStandings(isOfficeRole(authRole))
  // The job's lien timeline for the History tab (v2.3879; lifted here v2.4707): one read, two readers — the box above and the calendar's month lines.
  const lien = useJobLienTimeline(fullJob, historyMounted)
  const lienShown = !!fullJob && !!lien.timeline && showJobHistoryLienTimeline({ openBalance: jobOpenBalance(fullJob), hasPaper: lien.hasPaper })
  const [statusSheetOpen, setStatusSheetOpen] = useState(false)
  // Punch list #189, PR 4: the Job pane's half of the bar. A viewer on the crew gets the stamp they
  // are due between the verb and Note; Arrived, Leaving and Note are answered by the pane, whose
  // handlers and composer draft they are. Null until the pane reports, and off a phone.
  const [paneBar, setPaneBar] = useState<JobPanePhoneBar | null>(null)
  const verb = useMemo(() => {
    if (!phone || !fullJob) return null
    const status = fullJob.status ?? 'working'
    const stage: JobNextStage =
      status === 'billed' && fullJob.collections_at ? 'collections' : status === 'waiting' || status === 'working' || status === 'ready_to_bill' || status === 'billed' ? status : 'working'
    const { model, view } = progressPaymentForJob(fullJob, null)
    const chip = pickJobNextChip({
      stage,
      view,
      money: model,
      billSentAlert: stagesBillSentPctAlert(fullJob),
      quietDays: null,
      expectedPay: null,
      contract: undefined,
      upcoming: null,
      crew: null,
      billDisplay: null,
      createdAt: null,
      todayYmd: todayYmdInAppTz(),
    })
    const bar = buildEditJobBillingBar({ total: Number(fullJob.revenue ?? 0), payments: fullJob.payments ?? [], invoices: fullJob.invoices ?? [] })
    return jobWindowVerb({ status: fullJob.status, chip, bar })
  }, [phone, fullJob])
  const compose = (mode: 'note' | 'pct') => {
    setTab('job')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(JOB_THREAD_COMPOSE_EVENT, { detail: { mode } })), 50)
  }
  const onVerb = () => {
    if (!verb) return
    if (verb.target === 'bill') setTab('bill')
    else if (verb.target === 'pct') compose('pct')
    else setStatusSheetOpen(true)
  }

  const requestClose = () => {
    const flushClose = formCloseRef.current
    if (flushClose) void flushClose()
    else onClose()
  }

  // The desktop's title row (v2.6539): the number, the name and the status on one line, a quiet line under it
  // for the development, the customer, the prior numbers and the kind, with the ? and the ✕ at the right. The Job
  // pane's own title stays out (paneTitleHidden); its action row and map band stay the shared band under the tabs.
  // On a phone the window keeps its older order: the wrapping pill tabs first, the pane's title under them.
  const titleId = useId()
  const headJob = fullJob ?? initialJob
  const titleParts = headJob ? formatJobDetailModalTitleParts(headJob.hcp_number, headJob.job_name) : { num: null, name: 'Job' }
  const headNumber = (headJob?.hcp_number ?? '').trim() || (headJob?.click_number ?? '').trim()
  const headStatus = headJob?.status ? (headJob.collections_at ? 'Collections' : (JOB_STEPPER_LABELS[headJob.status as JobStepperStatus] ?? headJob.status)) : null
  const headStanding = headJob?.customer_id ? inKindStandings.get(headJob.customer_id) : undefined
  const quietParts = [headJob?.development?.name?.trim() || null, headJob?.customer_name?.trim() || null, priorNumbersBare(headJob?.prior_numbers) || null].filter((p): p is string => !!p)
  const closeButton = (
    <button
      className="job-window-close"
      type="button"
      onClick={requestClose}
      title={phone ? 'Close' : 'Close · esc'}
      aria-label="Close job window"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.3rem 0.5rem',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        color: 'var(--text-muted)',
        fontSize: '1.15rem',
        lineHeight: 1,
        borderRadius: 4,
        flexShrink: 0,
      }}
    >
      ✕
    </button>
  )

  return (
    <div
      className="job-window-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: JOB_WINDOW_OVERLAY_Z_INDEX,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      role="presentation"
    >
      {/* Phones (v2.3231): the five tabs + "esc to close" + ✕ ran 437px wide inside a
          343px dialog, so the ✕ sat off-screen behind overflow: hidden and the window
          could not be closed by touch (Taunya, 2026-09-10). Same treatment as the bid
          window: full-bleed sheet, tabs wrap and shrink, the ✕ pins to the right of the
          first row. The esc hint left the desktop too in v2.6539: it lives in the ✕'s tip. */}
      <style>{`
        @media (max-width: 640px) {
          .job-window-overlay {
            align-items: stretch !important;
            justify-content: stretch !important;
            padding: 0 !important;
          }
          .job-window-dialog {
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
          }
          .job-window-tabs {
            flex-wrap: wrap !important;
            gap: 0.25rem !important;
            padding: calc(0.5rem + env(safe-area-inset-top, 0px)) 0.6rem 0.5rem !important;
          }
          .job-window-tab {
            padding: 0.3rem 0.6rem !important;
            font-size: 0.8rem !important;
          }
          .job-window-close {
            margin-left: auto !important;
            padding: 0.45rem 0.7rem !important;
            font-size: 1.3rem !important;
          }
          .job-window-body {
            padding: 0.5rem 0.9rem calc(1rem + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
      <div
        className="job-window-dialog"
        role="dialog"
        aria-label={phone ? 'Job window' : undefined}
        aria-labelledby={phone ? undefined : titleId}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          // 560 on every screen from v2.1675 to v2.6538 (the Bill tab was drawn to it, v2.4293); 760 at desktop
          // since v2.6539, so the title row and the seven tabs each get a row of their own.
          maxWidth: 760,
          width: '100%',
          // min(…, 100%): 90vh can exceed the overlay's padded box on phones, and a
          // centered flex child taller than its container overflows BOTH ends — the
          // top slid under the status bar (v2.1747). 100% = the safe-area padded box.
          maxHeight: 'min(90vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!phone ? (
          <div className="job-window-head" data-testid="job-window-head" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.9rem 1.25rem 0', flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 id={titleId} style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-strong)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem 0.5rem', minWidth: 0 }}>
                {headNumber ? <span style={headNumberChip}>{headNumber}</span> : null}
                <span style={{ wordBreak: 'break-word', minWidth: 0 }}>{titleParts.name}</span>
                {headStatus ? (
                  <span style={headStatusChip} data-testid="job-window-status">
                    {headStatus}
                  </span>
                ) : null}
              </h2>
              {headJob ? (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.2rem 0.5rem', marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid="job-window-quiet-line">
                  {quietParts.map((p, i) => (
                    <span key={`${i}-${p}`} title={i === quietParts.length - 1 && p.startsWith('also ') ? 'Numbers this job answered to before a combine' : undefined}>
                      {i ? `· ${p}` : p}
                    </span>
                  ))}
                  <JobKindChip read={jobKindOfRow(headJob)} size="sm" />
                  {headStanding ? <InKindChip standing={headStanding} form="short" plain /> : null}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
              <LegendButton legend={JOB_WINDOW_LEGEND} open={legendOpen} onToggle={setLegendOpen} />
              {closeButton}
            </div>
          </div>
        ) : null}
        <div
          className="job-window-tabs"
          role="tablist"
          aria-label="Job window tabs"
          style={
            phone
              ? {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.6rem 0.9rem',
                  borderBottom: '1px solid var(--border)',
                  flexShrink: 0,
                }
              : {
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '0.15rem',
                  padding: '0.55rem 1.25rem 0',
                  borderBottom: '1px solid var(--border)',
                  flexShrink: 0,
                  overflowX: 'auto',
                }
          }
        >
          {(Object.keys(TAB_LABELS) as JobWindowTab[]).map((t) => (
            <button
              key={t}
              className="job-window-tab"
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t)
                if (t === 'history') setHistoryMounted(true)
                if (t === 'documents') setDocumentsMounted(true)
                if (t === 'costs') setCostMoveMounted(true)
              }}
              style={phone ? tabButtonStyle(tab === t) : tabStripStyle(tab === t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
          {phone ? (
            <>
              <LegendButton legend={JOB_WINDOW_LEGEND} open={legendOpen} onToggle={setLegendOpen} style={{ marginLeft: 'auto' }} />
              {closeButton}
            </>
          ) : null}
        </div>
        {legendOpen ? <DeskLegendCard legend={JOB_WINDOW_LEGEND} phone={phone} onClose={() => setLegendOpen(false)} style={{ margin: '0.6rem 0.9rem 0', flexShrink: 0 }} /> : null}

        {/* Top padding stays slimmer than the sides: the tab bar's own bottom
            padding already separates it from the title (v2.1679). */}
        <div className="job-window-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '0.5rem 1.25rem 1.25rem' }}>
          {headJob && headStanding && jobIsOffTheDeal(headJob, headStanding) ? (
            <JobInKindStrip
              jobId={headJob.id}
              customerName={headJob.customer_name ?? ''}
              standing={headStanding}
              onAdded={(arrangementId) => setFullJob((prev) => (prev ? { ...prev, in_kind_arrangement_id: arrangementId } : prev))}
            />
          ) : null}
          {/* Job pane — ALWAYS visible (v2.1676): its title, action icons, and
              Street View / map band are the window's shared header on every
              tab. Only its read-view body hides on Edit/Bill (paneBodyHidden),
              so the icon handlers and their satellite modals stay live from
              any tab. */}
          <div role="tabpanel" aria-label="Job">
            <DetailJobModal
              open
              paneMode
              paneBodyHidden={tab !== 'job'}
              paneTitleHidden={!phone}
              onClose={onClose}
              jobId={jobId}
              scheduleContext={scheduleContext}
              authRole={authRole}
              assignedJobsRows={assignedJobsRows}
              prefillRowLabel={prefillRowLabel ?? undefined}
              prefillAddress={prefillAddress ?? undefined}
              autoOpenSupplyHouseShare={autoOpenSupplyHouseShare}
              openStageChecklist={openStageChecklist}
              externalRefreshKey={detailRefreshKey}
              onEscBlockedChange={setDetailEscBlocked}
              onRequestTab={setTab}
              onJobLoaded={setFullJob}
              onPhoneBarChange={setPaneBar}
            />
          </div>
          {/* Edit + Bill + Costs panes — ONE form instance; the region prop picks
              which third shows. Hidden entirely on the Job and History tabs. */}
          <div style={jobWindowFormPaneHidden(tab) ? { display: 'none' } : undefined} role="tabpanel" aria-label={TAB_LABELS[jobWindowFormRegionForTab(tab)]}>
            <JobFormModal
              mode="edit"
              editJobId={jobId}
              initialJob={initialJob}
              billingCustomerHighlightInitial={billingCustomerHighlightInitial}
              fixturesSectionHighlightInitial={fixturesSectionHighlightInitial}
              paymentsReceivedHighlightInitial={paymentsReceivedHighlightInitial}
              jobPicturesLinkHighlightInitial={jobPicturesLinkHighlightInitial}
              propertyRecordFocusInitial={propertyRecordFocusInitial}
              focusRowInitial={focusRowInitial}
              alsoOpenCreateCustomerModal={alsoOpenCreateCustomerModal}
              onClose={onClose}
              onSaved={() => {
                setDetailRefreshKey((k) => k + 1)
                onSaved?.()
              }}
              embeddedRegion={jobWindowFormRegionForTab(tab)}
              onRequestRegion={(region) => setTab(region)}
              registerRequestClose={(fn) => {
                formCloseRef.current = fn
              }}
              externalEscBlocked={detailEscBlocked || documentsEscBlocked || costMoveEscBlocked}
            />
            {/* Devs (v2.6115): under the Costs region, every cost row on the job by stream — bank, supply-house,
                clock, Other — with ticks and Move N rows…, the Move cost window, and the batches that touched
                the job with their Revert. The owner's shape of the tool: the job's own cost view, a click, a window. */}
            {costMoveMounted && fullJob ? (
              <div style={tab !== 'costs' ? { display: 'none' } : undefined}>
                <JobWindowCostMovePanel
                  job={{ id: fullJob.id, hcp_number: fullJob.hcp_number, click_number: fullJob.click_number, job_name: fullJob.job_name, job_address: fullJob.job_address, service_type_id: fullJob.service_type_id }}
                  onOverlayOpenChange={setCostMoveEscBlocked}
                />
              </div>
            ) : null}
          </div>
          {/* History pane (T5-05 / J31-adj3): the Projects day-grid for THIS job — every job, any status. */}
          {historyMounted ? (
            <div style={tab !== 'history' ? { display: 'none' } : undefined} role="tabpanel" aria-label="History">
              {/* The lien timeline above the calendar (v2.3879, punch list #32): every deadline, whose move it is, the demand letter — while money is owed or paper is out.
                  Since v2.4707 the read lives here, so Days on the job can carry each month's § 53.056 line from the same timeline. */}
              {lienShown && lien.timeline ? <JobHistoryLienTimeline timeline={lien.timeline} /> : null}
              <Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>Loading…</p>}>
                <ProjectsJobHistoryTabLazy customerId={null} jobId={jobId} lienMonthLines={lienShown && lien.timeline ? lienMonthLines(lien.timeline) : null} />
              </Suspense>
            </div>
          ) : null}
          {/* Documents pane (v2.4491): the job's pay applications, the files behind them, the job's folders. */}
          {documentsMounted && fullJob ? (
            <div style={tab !== 'documents' ? { display: 'none' } : undefined} role="tabpanel" aria-label="Documents">
              <JobWindowDocumentsTab
                job={fullJob}
                onOverlayOpenChange={setDocumentsEscBlocked}
                onRequestTab={setTab}
                onLeave={onClose}
                onFoldersMade={(patch) => {
                  // The folders press wrote links on the job (v2.6054): the window's copy, the Job pane and the page's list follow.
                  setFullJob((prev) => (prev ? { ...prev, ...patch } : prev))
                  setDetailRefreshKey((k) => k + 1)
                  onSaved?.()
                }}
              />
            </div>
          ) : null}
          {/* Materials pane (punch list 209): the site's summary, one press to the page. */}
          {tab === 'materials' ? (
            <div role="tabpanel" aria-label="Materials">
              <JobWindowMaterialsPanel jobId={jobId} onBeforeNavigate={requestClose} />
            </div>
          ) : null}

        </div>
        {phone && fullJob ? (
          <>
            <JobWindowActionBar
              buttons={tabbedJobWindowBar(verb, paneBar?.stamp ?? null)}
              onPress={(key) => {
                if (key === 'status') setStatusSheetOpen(true)
                else if (key === 'verb') onVerb()
                else if (key === 'arrived' || key === 'leaving') paneBar?.press(key)
                else if (key === 'note') {
                  // The pane's note sheet over the Job tab, so the saved note shows in the activity
                  // behind it; before the pane reports, the composer's own box as before.
                  if (paneBar) {
                    setTab('job')
                    paneBar.press('note')
                  } else compose('note')
                }
              }}
            />
            <JobWindowStatusSheet
              open={statusSheetOpen}
              job={{
                id: fullJob.id,
                status: fullJob.status,
                collections_at: fullJob.collections_at ?? null,
                hcp_number: fullJob.hcp_number,
                click_number: fullJob.click_number,
                job_name: fullJob.job_name,
                revenue: fullJob.revenue,
                payments_made: fullJob.payments_made,
              }}
              authRole={authRole}
              onChanged={() => {
                setDetailRefreshKey((k) => k + 1)
                onSaved?.()
              }}
              onClose={() => setStatusSheetOpen(false)}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}

export default JobWindowModal
