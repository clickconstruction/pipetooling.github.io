import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, useContext } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SectionDock } from '../components/SectionDock'
import { markStampInitial, markStampTime } from '../lib/quickfillMarkStamp'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { QuickfillRoundScreenContext } from '../components/quickfill/quickfillRoundContext'
import { QuickfillRoundList } from '../components/quickfill/QuickfillRoundList'
import { QuickfillRoundScreen } from '../components/quickfill/QuickfillRoundScreen'
import { QuickfillLastMarkedDoor } from '../components/quickfill/QuickfillLastMarkedDoor'
import { nextInRound, roundChipColors, roundQueue, roundRows, QUICKFILL_NOTE_FIRST_SECTIONS, QUICKFILL_PERSONAL_SECTIONS, type RoundEvent } from '../lib/quickfill/round'
import { quickfillFreshnessSummary } from '../lib/quickfill/freshnessSummary'
import { QuickfillFocusContext } from '../components/quickfill/quickfillViewContext'
import { QuickfillViewSwitch } from '../components/quickfill/QuickfillViewSwitch'
import { QuickfillRollerStrip } from '../components/quickfill/QuickfillRollerStrip'
import { QuickfillBoard } from '../components/quickfill/QuickfillBoard'
import {
  focusBucket,
  focusGroups,
  focusHeading,
  focusHeadline,
  keepFocusCounts,
  parseQuickfillViewRequest,
  quickfillOpeningView,
  readStoredQuickfillView,
  readStoredRollerShowDone,
  rollerDeck,
  rollerDot,
  rollerNext,
  rollerPrev,
  rollerWords,
  writeQuickfillView,
  writeRollerShowDone,
  type FocusBucket,
  type QuickfillView,
} from '../lib/quickfill/views'
import { quickfillOutstandingLabel } from '../lib/quickfill/outstandingLabel'
import { defaultQuickfillSectionBanner, isRetiredQuickfillSectionBanner } from '../lib/quickfill/sectionBanners'
import { QuickfillQuestion } from '../components/quickfill/QuickfillQuestion'
import { quickfillStationTelemetryTarget, resolveQuickfillStation, parseQuickfillStationRequest, quickfillStationHref } from '../lib/quickfill/stationDeepLink'
import { recordNavClick } from '../lib/navClickTelemetry'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { fetchWeekCloseCounts, type MoneyfillQueueCount } from '../lib/moneyfillWeekClose'
import { previousCompleteCloseWeekMonday } from '../lib/closeWeekAnchor'
import {
  WEEK_CLOSE_OPENED_CONTROL,
  canOpenMoneyfill,
  closeWeekChipModel,
  weekCloseOpenedTarget,
  type CloseWeekChipModel,
} from '../lib/quickfill/closeWeekChip'
import DashboardTallyStaleStaffBanner from '../components/DashboardTallyStaleStaffBanner'
import { DashboardStaleTallyStaffFollowUpModal } from '../components/DashboardStaleTallyStaffFollowUpModal'
import DashboardJobFollowupsBanner from '../components/DashboardJobFollowupsBanner'
import DashboardGcReviewWeeklyBanner from '../components/DashboardGcReviewWeeklyBanner'
import { QuickfillNeedsYouSection } from '../components/quickfill/QuickfillNeedsYouSection'
import { BilledAwaitingPaymentSection } from '../components/quickfill/BilledAwaitingPaymentSection'
import { CantReachSection } from '../components/quickfill/CantReachSection'
import { QuickfillMyInboxSection } from '../components/quickfill/QuickfillMyInboxSection'
import { JobsBillingReminderSection } from '../components/quickfill/JobsBillingReminderSection'
import { QuickfillCompleteNoBillSection } from '../components/quickfill/QuickfillCompleteNoBillSection'
import { QuickfillStagesNoCustomerSection } from '../components/quickfill/QuickfillStagesNoCustomerSection'
import { QuickfillPropertyKindsSection } from '../components/quickfill/QuickfillPropertyKindsSection'
import { useQuickfillPropertyKinds } from '../hooks/useQuickfillPropertyKinds'
import { QuickfillPercentCompleteSection } from '../components/quickfill/QuickfillPercentCompleteSection'
import { useQuickfillPercentComplete } from '../hooks/useQuickfillPercentComplete'
import { useQuickfillTexts } from '../hooks/useQuickfillTexts'
import { useQuickfillFieldPhotos } from '../hooks/useQuickfillFieldPhotos'
import { fieldPhotoAgeRows, fieldPhotosAgedNextLine, fieldPhotosMarkNote, fieldPhotosSince } from '../lib/quickfill/fieldPhotosAge'
import { formatDayLabel, formatMarkTime } from '../lib/quickfill/markHistory'
import { textsMarkNoteFor } from '../lib/quickfill/textsLedger'
import { canOpenMessages } from '../lib/gc/access'
import { QuickfillFieldPhotoHandoverSection } from '../components/quickfill/QuickfillFieldPhotoHandoverSection'
import { QuickfillJobsCleanupSection } from '../components/quickfill/QuickfillJobsCleanupSection'
import { QuickfillSectionMarkHistoryModal } from '../components/quickfill/QuickfillSectionMarkHistoryModal'
import { UnpricedFixturesSection } from '../components/quickfill/UnpricedFixturesSection'
import { SupplyHousesSection } from '../components/quickfill/SupplyHousesSection'
import { BankingSortingSnapshotSection } from '../components/quickfill/BankingSortingSnapshotSection'
import { QuickfillPeopleHoursNewSection } from '../components/quickfill/QuickfillPeopleHoursNewSection'
import { QuickfillUnassignedFieldTimeSection } from '../components/quickfill/QuickfillUnassignedFieldTimeSection'
import { QuickfillVehicleOdometersSection } from '../components/quickfill/QuickfillVehicleOdometersSection'
import { QuickfillUndatedBillsSection } from '../components/quickfill/QuickfillUndatedBillsSection'
import { QuickfillAssistantDailysSection } from '../components/quickfill/QuickfillAssistantDailysSection'
import { QuickfillDifficultPeopleSection } from '../components/quickfill/QuickfillDifficultPeopleSection'
import { QuickfillEmailSection } from '../components/quickfill/QuickfillEmailSection'
import { QuickfillTextsSection } from '../components/quickfill/QuickfillTextsSection'
import { QuickfillPhysicalInboxSection } from '../components/quickfill/QuickfillPhysicalInboxSection'
import { QuickfillOfficeSection } from '../components/quickfill/QuickfillOfficeSection'
import { QuickfillScheduleSection } from '../components/quickfill/QuickfillScheduleSection'
import { QuickfillTomorrowsScheduleSection } from '../components/quickfill/QuickfillTomorrowsScheduleSection'
import { QuickfillProspectsSection } from '../components/quickfill/QuickfillProspectsSection'
import { DispatchInboxSection } from '../components/DispatchInboxSection'
import { summarizeOpenDispatchAging } from '../lib/dispatchInboxAging'
import { DISPATCH_REQUESTS_MIN_AGE_DAYS } from '../lib/ageState'
import { DispatchDismissedItemsModal } from '../components/DispatchDismissedItemsModal'
import CreateTripChargeModal, { type CreateTripChargeTarget } from '../components/CreateTripChargeModal'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import {
  QuickfillSectionMetricsProvider,
  useQuickfillSectionMetric,
  useQuickfillSectionMetricsContext,
  useReportQuickfillSectionMetric,
} from '../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { markOutcomeForCount, type MarkOutcome } from '../lib/quickfill/markOutcome'
import { fileQuickfillQuestion } from '../lib/quickfill/questionRequestIo'
import { QuickfillMarkPresses } from '../components/quickfill/QuickfillMarkPresses'
import { QuickfillNextLine } from '../components/quickfill/QuickfillNextLine'
import { markHistoryHour } from '../lib/quickfill/markHistory'
import { QUICKFILL_SECTIONS, type QuickfillSectionMeta } from '../lib/quickfill/sections'
import { roundCloseSheet } from '../lib/quickfill/roundClose'
import { QuickfillRoundCloseSheet } from '../components/quickfill/QuickfillRoundCloseSheet'
import { completeNoBillNextLine, dispatchInboxNextLine, missingJobInfoNextLine, percentCompleteNextLine, propertyKindsNextLine, textsNextLine } from '../lib/quickfill/nextLine'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { canAccessBanking } from '../lib/bankingAccess'
import { useDispatchInbox } from '../hooks/useDispatchInbox'
import { useQuickfillCantReachProspects } from '../hooks/useQuickfillCantReachProspects'
import { useQuickfillCompleteNoBillJobs } from '../hooks/useQuickfillCompleteNoBillJobs'
import { matchesQuickfillSectionSearch } from '../lib/quickfillSectionSearch'
import { useQuickfillStagesJobsWithoutCustomer } from '../hooks/useQuickfillStagesJobsWithoutCustomer'
import { useUnpricedFixturesCount } from '../hooks/useUnpricedFixturesCount'
import { useStaleTallyStaffFollowUp } from '../hooks/useStaleTallyStaffFollowUp'
import { TALLY_STALE_MIN_AGE_DAYS } from '../lib/tallyStaleMinAgeDays'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../utils/dateUtils'
import { withSupabaseRetry } from '../utils/errorHandling'
import { QUICKFILL_SECTION_BANNER_BOX_STYLE } from '../lib/quickfillSectionBannerStyle'
import { EmptyState } from '../components/EmptyState'
import { emptyWords, emptyWordsWithPress } from '../lib/emptyWords'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH_FOR_QUICKFILL_SCHEDULE } from '../lib/scheduleDispatchEditRoles'

const SECTIONS = QUICKFILL_SECTIONS

const APP_SETTINGS_KEY_QUICKFILL_HIDDEN = 'quickfill_hidden_section_ids'
const APP_SETTINGS_KEY_QUICKFILL_MIN_HCP = 'quickfill_jobs_billing_min_hcp'
const APP_SETTINGS_KEY_QUICKFILL_SECTION_ORDER = 'quickfill_section_order'
const APP_SETTINGS_KEY_QUICKFILL_SECTION_BANNERS = 'quickfill_section_banners'
const QUICKFILL_SECTION_BANNER_MAX_CHARS = 800
const DEFAULT_JOBS_BILLING_MIN_HCP = 406

const DEFAULT_SECTION_ORDER_IDS = SECTIONS.map((s) => s.sectionId)
/** Where a later-added section slots into an org's already-saved order (see normalizeQuickfillSectionOrderFromValueText). */
const SECTION_INSERT_AFTER: Record<string, string> = {
  // '' means first: an org that saved its order before the station existed opens the round on it (v2.5843).
  'needs-you': '',
  'jobs-cleanup': 'no-customer-stages',
  'assistant-dailys': 'office-arriving',
  'undated-bills': 'complete-no-bill',
  'property-kinds': 'no-customer-stages',
  'percent-complete': 'property-kinds',
}

const VALID_SECTION_IDS = new Set(SECTIONS.map((s) => s.sectionId))

const SECTION_LABEL_BY_SECTION_ID = new Map(SECTIONS.map((s) => [s.sectionId, s.label]))

function parseHiddenSectionIdsFromValueText(raw: string | null | undefined): Set<string> {
  if (raw == null || raw === '') return new Set()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && VALID_SECTION_IDS.has(id)))
  } catch {
    return new Set()
  }
}

/** Merge saved order with canonical SECTIONS (append missing ids in default order). */
function normalizeQuickfillSectionOrderFromValueText(raw: string | null | undefined): string[] {
  if (raw == null || raw === '') return [...DEFAULT_SECTION_ORDER_IDS]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_SECTION_ORDER_IDS]
    const seen = new Set<string>()
    const out: string[] = []
    for (const x of parsed) {
      if (typeof x !== 'string' || !VALID_SECTION_IDS.has(x) || seen.has(x)) continue
      seen.add(x)
      out.push(x)
    }
    for (const id of DEFAULT_SECTION_ORDER_IDS) {
      if (seen.has(id)) continue
      // A section added after the org saved its order lands beside its
      // default neighbor (v2.2145: Jobs Cleanup after Missing job info), not
      // at the tail — devs can still move it.
      const anchor = SECTION_INSERT_AFTER[id]
      const at = anchor ? out.indexOf(anchor) : -1
      if (anchor === '') out.unshift(id)
      else if (at >= 0) out.splice(at + 1, 0, id)
      else out.push(id)
      seen.add(id)
    }
    return out
  } catch {
    return [...DEFAULT_SECTION_ORDER_IDS]
  }
}

function parseQuickfillSectionBannersFromValueText(raw: string | null | undefined): Record<string, string> {
  if (raw == null || raw === '') return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!VALID_SECTION_IDS.has(k) || typeof v !== 'string') continue
      const t = v.trim()
      if (t === '') continue
      out[k] = t.length > QUICKFILL_SECTION_BANNER_MAX_CHARS ? t.slice(0, QUICKFILL_SECTION_BANNER_MAX_CHARS) : t
    }
    return out
  } catch {
    return {}
  }
}

function capQuickfillBannerText(s: string): string {
  const t = s.trim()
  if (t === '') return ''
  return t.length > QUICKFILL_SECTION_BANNER_MAX_CHARS ? t.slice(0, QUICKFILL_SECTION_BANNER_MAX_CHARS) : t
}

/** Stored custom banner wins, unless it is a default this build retired (v2.5816); otherwise every section has a default question (v2.2189). */
function effectiveQuickfillSectionBanner(sectionId: string, banners: Record<string, string>): string | null {
  const custom = banners[sectionId]?.trim()
  if (custom && !isRetiredQuickfillSectionBanner(sectionId, custom)) return custom.length > QUICKFILL_SECTION_BANNER_MAX_CHARS ? custom.slice(0, QUICKFILL_SECTION_BANNER_MAX_CHARS) : custom
  return defaultQuickfillSectionBanner(sectionId)
}

type ButtonColor = 'red' | 'yellow' | 'green'

function getButtonColor(markedAt: string | null): ButtonColor {
  if (!markedAt) return 'red'
  const hoursAgo = (Date.now() - new Date(markedAt).getTime()) / (1000 * 60 * 60)
  if (hoursAgo > 30) return 'red'
  if (hoursAgo > 12) return 'yellow'
  return 'green'
}

const BUTTON_BG: Record<ButtonColor, string> = {
  red: 'var(--bg-red-200)',
  yellow: 'var(--bg-yellow-200)',
  green: 'var(--bg-green-200)',
}

const BUTTON_BORDER: Record<ButtonColor, string> = {
  red: '#f87171',
  yellow: '#eab308',
  green: '#22c55e',
}

const MARK_EVENT_NOTE_MAX_CHARS = 10_000

/** Match Banking page main title (Banking h1); use h2 on Quickfill because page has an h1 */
const QUICKFILL_SECTION_TITLE_STYLE: CSSProperties = {
  margin: '0 0 1rem 0',
  fontSize: '1.5rem',
  fontWeight: 700,
  textAlign: 'left',
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function hoursUntilExpand(markedAt: string): number {
  const elapsed = (Date.now() - new Date(markedAt).getTime()) / (1000 * 60 * 60)
  return Math.max(0, Math.ceil((12 - elapsed) * 10) / 10)
}

function formatHeaderLastMarked(iso: string | null | undefined): string {
  if (!iso) return 'Never marked'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return 'Never marked'
    return d.toLocaleString(undefined, {
      timeZone: APP_CALENDAR_TZ,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return 'Never marked'
  }
}

export default function Quickfill() {
  return (
    <QuickfillSectionMetricsProvider>
      <QuickfillPage />
    </QuickfillSectionMetricsProvider>
  )
}

/** A job's number and name for the Missing job info Next line (v2.5839). */
function jobInfoLabel(j: { hcp_number?: string | null; click_number?: string | null; job_name?: string | null }): { number: string; name: string } {
  return { number: effectiveJobLedgerNumber(j.hcp_number ?? null, j.click_number ?? null) ?? '', name: j.job_name ?? '' }
}

function QuickfillMetricReporter({
  sectionId,
  count,
  loading,
  nextLine = null,
}: {
  sectionId: string
  count: number | null
  loading: boolean
  /** The station's Next line (v2.5839, punch list #176): the first row to act on and its verb. */
  nextLine?: string | null
}) {
  useReportQuickfillSectionMetric(sectionId, count, loading, null, null, nextLine)
  return null
}


function QuickfillDevSectionSortableRow({
  meta,
  sectionVisible,
  onToggleVisible,
  jobsBillingMinHcp,
  onJobsBillingMinHcpChange,
  bannerDraft,
  onBannerDraftChange,
  onBannerCommit,
}: {
  meta: QuickfillSectionMeta
  sectionVisible: boolean
  onToggleVisible: (sectionId: string, visible: boolean) => void
  jobsBillingMinHcp: number
  onJobsBillingMinHcpChange: (n: number) => void
  bannerDraft: string
  onBannerDraftChange: (sectionId: string, value: string) => void
  onBannerCommit: (sectionId: string, value: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: meta.sectionId })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  }
  return (
    <li ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="button"
          className="quickfill-section-drag-handle"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${meta.label}`}
          title="Drag to reorder"
          style={{
            cursor: 'grab',
            touchAction: 'none',
            padding: '0.25rem 0.45rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            background: 'var(--surface)',
            color: 'var(--text-slate-500)',
            fontSize: '0.75rem',
            lineHeight: 1,
            letterSpacing: '-0.05em',
          }}
        >
          ⋮⋮
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={sectionVisible}
            onChange={(e) => onToggleVisible(meta.sectionId, e.target.checked)}
          />
          <span>{meta.label}</span>
        </label>
        <span style={{ color: 'var(--text-slate-400)', userSelect: 'none', fontSize: '0.875rem' }} aria-hidden>
          –
        </span>
        <input
          type="text"
          value={bannerDraft}
          onChange={(e) => onBannerDraftChange(meta.sectionId, e.target.value)}
          onBlur={() => onBannerCommit(meta.sectionId, bannerDraft)}
          placeholder={(() => {
            const d = defaultQuickfillSectionBanner(meta.sectionId)
            return d ? `Default: ${d}` : 'Shown at top of section when expanded'
          })()}
          maxLength={QUICKFILL_SECTION_BANNER_MAX_CHARS}
          aria-label={`Optional banner for ${meta.label}, shown at top of section when expanded`}
          style={{
            flex: '1 1 12rem',
            minWidth: 0,
            maxWidth: '28rem',
            boxSizing: 'border-box',
            padding: '0.35rem 0.5rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            fontSize: '0.8125rem',
          }}
        />
        {meta.sectionId === 'jobs-billing' && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Min HCP (inclusive)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={jobsBillingMinHcp}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                const n = Number.isFinite(v) && v >= 0 ? v : DEFAULT_JOBS_BILLING_MIN_HCP
                onJobsBillingMinHcpChange(n)
              }}
              style={{
                width: '4.5rem',
                padding: '0.2rem 0.35rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                fontSize: '0.8125rem',
              }}
            />
          </label>
        )}
      </div>
    </li>
  )
}

function QuickfillPage() {
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const {
    dispatchInboxEligible,
    dispatchRequests,
    dispatchRequestsLoading,
    dispatchRequestsLoaded,
    dispatchRequestDismissingId,
    expandedDispatchRequestId,
    dispatchThreadNotesByRequestId,
    dispatchNotesLoadingRequestId,
    dispatchNoteSubmitRequestId,
    dispatchNoteDraft,
    setDispatchNoteDraft,
    toggleExpandDispatchRequest,
    submitDispatchNote,
    submitDispatchNoteAndClose,
    dismissDispatchRequest,
    fetchDismissedDispatchInboxRows,
    dispatchPrioritySavingId,
    setDispatchRequestPriority,
    logDispatchRequestCall,
  } = useDispatchInbox()
  const jobFormModal = useJobFormModal()
  const { getOutstandingCount, getMarkNote, metrics: sectionMetrics } = useQuickfillSectionMetricsContext()
  const unpricedFixturesCount = useUnpricedFixturesCount()
  const quickfillNoCustomerStages = useQuickfillStagesJobsWithoutCustomer()
  // Needs You (journey-map #40): open dispatch requests past the min age, from the inbox rows this page already holds.
  const dispatchAged = useMemo(
    () =>
      dispatchInboxEligible && dispatchRequestsLoaded
        ? summarizeOpenDispatchAging(dispatchRequests, DISPATCH_REQUESTS_MIN_AGE_DAYS)
        : null,
    [dispatchInboxEligible, dispatchRequestsLoaded, dispatchRequests],
  )
  const quickfillStagesAlertsUnionCount = useMemo(() => {
    if (!quickfillNoCustomerStages.fetchEnabled) return null
    const ids = new Set<string>()
    for (const j of quickfillNoCustomerStages.jobsWithoutCustomer) ids.add(j.id)
    for (const j of quickfillNoCustomerStages.workingJobsWithoutPictures) ids.add(j.id)
    for (const j of quickfillNoCustomerStages.readyToBillNoEmailJobs) ids.add(j.id)
    return ids.size
  }, [
    quickfillNoCustomerStages.fetchEnabled,
    quickfillNoCustomerStages.jobsWithoutCustomer,
    quickfillNoCustomerStages.workingJobsWithoutPictures,
    quickfillNoCustomerStages.readyToBillNoEmailJobs,
  ])
  useReportQuickfillSectionMetric(
    'no-customer-stages',
    quickfillStagesAlertsUnionCount,
    quickfillNoCustomerStages.fetchEnabled && quickfillNoCustomerStages.loading,
    null,
    null,
    !quickfillNoCustomerStages.fetchEnabled || quickfillNoCustomerStages.loading
      ? null
      : missingJobInfoNextLine({
          noCustomer: quickfillNoCustomerStages.jobsWithoutCustomer.map(jobInfoLabel),
          noEmail: quickfillNoCustomerStages.readyToBillNoEmailJobs.map(jobInfoLabel),
          noPictures: quickfillNoCustomerStages.workingJobsWithoutPictures.map(jobInfoLabel),
        }),
  )
  // Property kinds (v2.4727): one row per unset property across the unpaid jobs; the count is properties, reported from here so it stays live while the strip is collapsed.
  const quickfillPropertyKinds = useQuickfillPropertyKinds()
  useReportQuickfillSectionMetric(
    'property-kinds',
    quickfillPropertyKinds.fetchEnabled ? (quickfillPropertyKinds.loading ? null : quickfillPropertyKinds.rows.length) : null,
    quickfillPropertyKinds.fetchEnabled && quickfillPropertyKinds.loading,
    null,
    null,
    quickfillPropertyKinds.fetchEnabled && !quickfillPropertyKinds.loading ? propertyKindsNextLine(quickfillPropertyKinds.rows.map((r) => ({ address: r.address, customerName: r.customerName, openBalance: r.jobs.reduce((n, j) => n + j.openBalance, 0), lienClock: r.lienClock }))) : null,
  )
  // Percent complete (v2.5764): the open jobs whose ticked stages or paid money disagree with the % done; the count is jobs, reported from here so it stays live while the strip is collapsed.
  const quickfillPercentComplete = useQuickfillPercentComplete()
  useReportQuickfillSectionMetric(
    'percent-complete',
    quickfillPercentComplete.fetchEnabled ? (quickfillPercentComplete.loading ? null : quickfillPercentComplete.list.count) : null,
    quickfillPercentComplete.fetchEnabled && quickfillPercentComplete.loading,
    null,
    null,
    quickfillPercentComplete.fetchEnabled && !quickfillPercentComplete.loading ? percentCompleteNextLine(quickfillPercentComplete.list.cards) : null,
  )
  // Texts (v2.5816, punch list #157): the day's text ledger from Messages' own reads; the count is texts needing a reply plus texts not delivered, reported from here so it stays live while the strip is collapsed. The office team alone reads Messages.
  const quickfillTextsEnabled = canOpenMessages(role)
  const quickfillTexts = useQuickfillTexts(quickfillTextsEnabled)
  useReportQuickfillSectionMetric(
    'texts',
    quickfillTextsEnabled && quickfillTexts.ledger ? quickfillTexts.ledger.count : null,
    quickfillTextsEnabled && quickfillTexts.loading,
    null,
    null,
    quickfillTextsEnabled && quickfillTexts.ledger ? textsNextLine(quickfillTexts.ledger) : null,
  )
  // The words typed under Anything else, held here so every Mark of the station carries them: the foot's and the
  // header's Mark, Focus's folded line and the round's Looked all write the note from the rows (`textsMarkNoteFor`).
  const [quickfillTextsTyped, setQuickfillTextsTyped] = useState('')
  const markTexts = async (outcome?: MarkOutcome, questionWords?: string): Promise<void> => {
    const note = textsMarkNoteFor({ ledger: quickfillTexts.ledger, typed: quickfillTextsTyped, problem: quickfillTexts.problem })
    setQuickfillTextsTyped('')
    await markSectionUpToDate('texts', { noteText: note || null, outcome: outcome ?? null, questionWords })
  }
  const {
    peopleCount: staleTallyStaffPeopleCount,
    transactionCount: staleTallyStaffTxCount,
    refetch: refetchStaleTallyStaffFollowUp,
  } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)
  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const [sectionMarks, setSectionMarks] = useState<Record<string, { marked_at: string; marked_by?: string; marked_by_name?: string | null }>>({})
  // Field photos → Drive (v2.5888, punch list #180, PR 5): the estimates still holding field photos, read here so the count
  // reaches a mark on a collapsed strip; the body signs the photo URLs when it is on screen.
  const quickfillFieldPhotos = useQuickfillFieldPhotos(!!authUser?.id)
  const quickfillFieldPhotoRows = useMemo(
    () => (quickfillFieldPhotos.groups ? fieldPhotoAgeRows(quickfillFieldPhotos.groups, new Date().toISOString()) : null),
    [quickfillFieldPhotos.groups],
  )
  const quickfillFieldPhotosSince = useMemo(
    () =>
      quickfillFieldPhotoRows
        ? fieldPhotosSince(quickfillFieldPhotoRows, quickfillFieldPhotos.handovers, sectionMarks['field-photos']?.marked_at ?? null, (iso) => `${formatDayLabel(calendarYmdInAppTzFromIso(iso))} at ${formatMarkTime(iso)}`)
        : null,
    [quickfillFieldPhotoRows, quickfillFieldPhotos.handovers, sectionMarks],
  )
  useReportQuickfillSectionMetric(
    'field-photos',
    quickfillFieldPhotoRows && !quickfillFieldPhotos.loading ? quickfillFieldPhotoRows.length : null,
    quickfillFieldPhotos.loading,
    null,
    quickfillFieldPhotoRows && !quickfillFieldPhotos.loading ? fieldPhotosMarkNote(quickfillFieldPhotoRows, 7, quickfillFieldPhotosSince) : null,
    quickfillFieldPhotoRows && !quickfillFieldPhotos.loading ? fieldPhotosAgedNextLine(quickfillFieldPhotoRows) : null,
  )
  // The marks' history (60 days) — what each section's own rhythm is read from. Loaded at every width since v2.3892: the desk's chips use it too.
  const [roundEvents, setRoundEvents] = useState<RoundEvent[]>([])
  const chipColorOf = useMemo(() => roundChipColors(sectionMarks, roundEvents, new Date()), [sectionMarks, roundEvents])
  // "Close week: $N open" chip on the money stations (journey-map Tier-2 #18).
  // Reads the SAME counts Moneyfill's header and the report's confidence footer
  // use, for the previous complete Mon–Sun close week — no second mark system.
  // Only the roles Moneyfill admits fetch; every other viewer gets the model's
  // inert line (never a link into a page that would redirect them).
  const closeWeekMonday = useMemo(() => previousCompleteCloseWeekMonday(), [])
  const [closeWeekCounts, setCloseWeekCounts] = useState<MoneyfillQueueCount[] | null>(null)
  useEffect(() => {
    if (!canOpenMoneyfill(role)) return
    let cancelled = false
    fetchWeekCloseCounts(closeWeekMonday, authUser?.id ?? undefined)
      .then((c) => {
        if (!cancelled) setCloseWeekCounts(c)
      })
      .catch(() => {
        /* each queue is already fail-soft; the chip stays "…" */
      })
    return () => {
      cancelled = true
    }
  }, [role, authUser?.id, closeWeekMonday])
  const closeWeekFor = (sectionId: string): CloseWeekChipModel | null =>
    closeWeekChipModel(sectionId, closeWeekCounts, closeWeekMonday, role)
  const onCloseWeekOpen = (sectionId: string) =>
    recordNavClick(authUser?.id, role, WEEK_CLOSE_OPENED_CONTROL, weekCloseOpenedTarget('station-chip', closeWeekMonday, sectionId))
  const [forceExpandedSections, setForceExpandedSections] = useState<Set<string>>(new Set(['cant-reach']))
  /** app_settings layout read has landed — station deep links wait for it so an org-hidden section reads as hidden, not missing. */
  const [layoutSettingsLoaded, setLayoutSettingsLoaded] = useState(false)
  // Session-only: chips removed from the floating SectionDock after "Mark up to date".
  // Deliberately NOT derived from the persisted marks — chips must return on reload.
  const [dockHiddenThisVisit, setDockHiddenThisVisit] = useState<Set<string>>(() => new Set())
  const [sectionSearch, setSectionSearch] = useState('')
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(() => new Set())
  const [activeSectionsPanelOpen, setActiveSectionsPanelOpen] = useState(false)
  const [jobsBillingMinHcp, setJobsBillingMinHcp] = useState<number>(DEFAULT_JOBS_BILLING_MIN_HCP)
  const quickfillCompleteNoBill = useQuickfillCompleteNoBillJobs(jobsBillingMinHcp)
  useReportQuickfillSectionMetric(
    'complete-no-bill',
    quickfillCompleteNoBill.fetchEnabled ? quickfillCompleteNoBill.completeNoBillJobs.length : null,
    quickfillCompleteNoBill.fetchEnabled && quickfillCompleteNoBill.loading,
    null,
    null,
    quickfillCompleteNoBill.fetchEnabled && !quickfillCompleteNoBill.loading ? completeNoBillNextLine(quickfillCompleteNoBill.completeNoBillJobs) : null,
  )
  const quickfillCantReach = useQuickfillCantReachProspects()
  useReportQuickfillSectionMetric(
    'cant-reach',
    quickfillCantReach.fetchEnabled ? (quickfillCantReach.loading ? null : quickfillCantReach.prospects.length) : null,
    quickfillCantReach.fetchEnabled && quickfillCantReach.loading,
  )
  const [markHistoryModal, setMarkHistoryModal] = useState<{ sectionId: string; label: string } | null>(null)
  const [sectionOrderIds, setSectionOrderIds] = useState<string[]>(() => [...DEFAULT_SECTION_ORDER_IDS])
  const [sectionBanners, setSectionBanners] = useState<Record<string, string>>({})
  const [sectionBannerDrafts, setSectionBannerDrafts] = useState<Record<string, string>>({})
  const [dispatchDismissedModalOpen, setDispatchDismissedModalOpen] = useState(false)
  const [tripChargeTarget, setTripChargeTarget] = useState<CreateTripChargeTarget | null>(null)

  const persistHiddenSectionIds = useCallback(async (hidden: Set<string>) => {
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').upsert(
            { key: APP_SETTINGS_KEY_QUICKFILL_HIDDEN, value_text: JSON.stringify([...hidden]) },
            { onConflict: 'key' },
          ),
        'save quickfill hidden section ids',
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  const persistJobsBillingMinHcp = useCallback(async (n: number) => {
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').upsert(
            { key: APP_SETTINGS_KEY_QUICKFILL_MIN_HCP, value_num: n },
            { onConflict: 'key' },
          ),
        'save quickfill jobs billing min hcp',
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  const persistSectionOrder = useCallback(async (ids: string[]) => {
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').upsert(
            { key: APP_SETTINGS_KEY_QUICKFILL_SECTION_ORDER, value_text: JSON.stringify(ids) },
            { onConflict: 'key' },
          ),
        'save quickfill section order',
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  const persistSectionBanners = useCallback(async (banners: Record<string, string>) => {
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').upsert(
            { key: APP_SETTINGS_KEY_QUICKFILL_SECTION_BANNERS, value_text: JSON.stringify(banners) },
            { onConflict: 'key' },
          ),
        'save quickfill section banners',
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase
              .from('app_settings')
              .select('key, value_text, value_num')
              .in('key', [
                APP_SETTINGS_KEY_QUICKFILL_HIDDEN,
                APP_SETTINGS_KEY_QUICKFILL_MIN_HCP,
                APP_SETTINGS_KEY_QUICKFILL_SECTION_ORDER,
                APP_SETTINGS_KEY_QUICKFILL_SECTION_BANNERS,
              ]),
          'load quickfill layout settings',
        )
        if (cancelled) return
        let hidden = new Set<string>()
        let minHcp = DEFAULT_JOBS_BILLING_MIN_HCP
        let orderText: string | null | undefined
        let bannersText: string | null | undefined
        const rowList = (rows ?? []) as Array<{ key: string; value_text: string | null; value_num: number | null }>
        for (const row of rowList) {
          const r = row
          if (r.key === APP_SETTINGS_KEY_QUICKFILL_HIDDEN) {
            hidden = parseHiddenSectionIdsFromValueText(r.value_text)
          } else if (r.key === APP_SETTINGS_KEY_QUICKFILL_MIN_HCP && r.value_num != null) {
            const n = Number(r.value_num)
            if (Number.isFinite(n) && n >= 0) minHcp = Math.floor(n)
          } else if (r.key === APP_SETTINGS_KEY_QUICKFILL_SECTION_ORDER) {
            orderText = r.value_text
          } else if (r.key === APP_SETTINGS_KEY_QUICKFILL_SECTION_BANNERS) {
            bannersText = r.value_text
          }
        }
        const banners = parseQuickfillSectionBannersFromValueText(bannersText)
        setHiddenSectionIds(hidden)
        setJobsBillingMinHcp(minHcp)
        setSectionOrderIds(normalizeQuickfillSectionOrderFromValueText(orderText))
        setSectionBanners(banners)
        setSectionBannerDrafts(
          Object.fromEntries(SECTIONS.map((s) => [s.sectionId, banners[s.sectionId] ?? ''] as const)),
        )
      } catch (e) {
        console.error(e)
      }
      if (!cancelled) setLayoutSettingsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // app_settings is not part of the supabase_realtime publication, so the
  // previous postgres_changes listener here was always a no-op on the wire.
  // Layout settings are read once on mount above; navigation and a hard
  // reload pick up cross-tab edits. Removing the dead listener is a Tier 1
  // realtime cleanup item (see RECENT_FEATURES v2.560).

  function isSectionVisible(sectionId: string): boolean {
    return !hiddenSectionIds.has(sectionId)
  }

  function devSetSectionVisible(sectionId: string, visible: boolean): void {
    setHiddenSectionIds((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(sectionId)
      else next.add(sectionId)
      if (role === 'dev') {
        queueMicrotask(() => {
          void persistHiddenSectionIds(next)
        })
      }
      return next
    })
  }

  // Eligibility-only (no data/count gating). The wrapper for `warnings` always renders
  // for these roles so the page does not jump down when the stale-tally / AR-bank
  // counts finish resolving. Inner banners self-hide when their counts are 0.
  const warningsSectionEligible = useMemo(() => {
    return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  }, [role])

  // Nudge sections (v2.2347): the dashboard's lost-bids / job-followups / GC-weekly
  // cards as independent Quickfill rituals. Same eligibility posture as warnings —
  // the wrapper always renders for office roles (the Mark button stamps the ritual
  // even on a clean day); the inner cards self-hide when there's nothing to nudge.
  const [jobFollowupsCount, setJobFollowupsCount] = useState<number | null>(null)
  const [jobFollowupsNextLine, setJobFollowupsNextLine] = useState<string | null>(null)
  const [gcReviewRemaining, setGcReviewRemaining] = useState<number | null>(null)
  const [needsYouSectionCount, setNeedsYouSectionCount] = useState<number | null>(null)
  const [needsYouNextLine, setNeedsYouNextLine] = useState<string | null>(null)

  const canAccessProspects = useMemo(
    () =>
      Boolean(
        authUser &&
          role &&
          (['dev', 'master_technician', 'assistant', 'controller'].includes(role) || (role === 'estimator' && estimatorProspectsAccess)),
      ),
    [authUser, role, estimatorProspectsAccess],
  )

  /**
   * True if this section is eligible to render on the page for this user.
   *
   * Eligibility is role/feature-only — never data/count-gated — so the page
   * height is stable from first paint and async data loads do not insert
   * sections above the user's scroll position. Sections with no actual content
   * still render their wrapper chrome (title row + Mark up to date button);
   * their bodies handle their own empty / loading states.
   *
   * Deliberate exception (user-requested): `cant-reach` IS count-gated — with 0
   * unreachable prospects the whole section (chrome, jump chip, dock chip)
   * disappears; the minor layout pop-in when the count resolves is accepted.
   */
  const sectionWouldRenderOnPage = useCallback(
    (sectionId: string): boolean => {
      if (!isSectionVisible(sectionId)) return false
      if (sectionId === 'my-inbox') return Boolean(authUser?.id)
      if (sectionId === 'cant-reach') {
        return quickfillCantReach.fetchEnabled && !quickfillCantReach.loading && quickfillCantReach.prospects.length > 0
      }
      if (sectionId === 'warnings') return warningsSectionEligible
      if (sectionId === 'unpriced-fixtures') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      if (sectionId === 'gc-weekly-review' || sectionId === 'job-followups') {
        return warningsSectionEligible
      }
      if (sectionId === 'needs-you') return warningsSectionEligible
      if (sectionId === 'no-customer-stages') return quickfillNoCustomerStages.fetchEnabled
      if (sectionId === 'property-kinds') return quickfillPropertyKinds.fetchEnabled
      if (sectionId === 'percent-complete') return quickfillPercentComplete.fetchEnabled
      // Banking is controller and above (v2.3305); the snapshot is the Banking page in miniature.
      if (sectionId === 'banking-sorting') return canAccessBanking(role)
      if (sectionId === 'undated-bills') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      if (sectionId === 'complete-no-bill') return quickfillCompleteNoBill.fetchEnabled
      if (sectionId === 'dispatch-inbox') return dispatchInboxEligible
      if (sectionId === 'schedule' || sectionId === 'tomorrow-schedule') {
        return role != null && CAN_USE_SCHEDULE_DISPATCH_FOR_QUICKFILL_SCHEDULE.has(role)
      }
      if (sectionId === 'prospects') return canAccessProspects
      if (sectionId === 'difficult-people') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      if (sectionId === 'assistant-dailys') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      if (sectionId === 'unassigned-field-time') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      if (sectionId === 'vehicle-odometers') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      return true
    },
    [
      hiddenSectionIds,
      warningsSectionEligible,
      dispatchInboxEligible,
      role,
      authUser,
      canAccessProspects,
      quickfillNoCustomerStages.fetchEnabled,
      quickfillPropertyKinds.fetchEnabled,
      quickfillPercentComplete.fetchEnabled,
      quickfillCompleteNoBill.fetchEnabled,
      quickfillCantReach.fetchEnabled,
      quickfillCantReach.loading,
      quickfillCantReach.prospects,
    ],
  )

  const orderedSections = useMemo(() => {
    const m = new Map(SECTIONS.map((s) => [s.sectionId, s]))
    return sectionOrderIds.map((id) => m.get(id)).filter((x): x is QuickfillSectionMeta => x != null)
  }, [sectionOrderIds])

  const hasAnyVisibleSection = orderedSections.some(({ sectionId }) => sectionWouldRenderOnPage(sectionId))

  const sectionPassesSearch = useCallback(
    (sectionId: string): boolean =>
      matchesQuickfillSectionSearch(SECTION_LABEL_BY_SECTION_ID.get(sectionId) ?? '', sectionSearch),
    [sectionSearch],
  )

  // Sections surviving both the eligibility gate and the search box. Drives the block
  // list, the first-divider logic, and the dock so no surface points at a filtered-out
  // block. The jump grid stays unfiltered — it sits above the search bar and doubles
  // as the "what exists" index.
  const searchedSections = useMemo(
    () =>
      orderedSections.filter(
        ({ sectionId }) => sectionWouldRenderOnPage(sectionId) && sectionPassesSearch(sectionId),
      ),
    [orderedSections, sectionWouldRenderOnPage, sectionPassesSearch],
  )
  const noSectionsMatchSearch = hasAnyVisibleSection && searchedSections.length === 0

  const firstVisibleSectionId = useMemo(() => searchedSections[0]?.sectionId ?? null, [searchedSections])

  const quickfillSectionDragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const onBannerDraftChange = useCallback((sid: string, value: string) => {
    setSectionBannerDrafts((d) => ({ ...d, [sid]: value }))
  }, [])

  const onBannerCommit = useCallback(
    (sid: string, value: string) => {
      const capped = capQuickfillBannerText(value)
      setSectionBanners((prev) => {
        const next = { ...prev }
        if (capped === '') delete next[sid]
        else next[sid] = capped
        queueMicrotask(() => {
          void persistSectionBanners(next)
        })
        return next
      })
      setSectionBannerDrafts((d) => ({ ...d, [sid]: capped }))
    },
    [persistSectionBanners],
  )

  const onQuickfillSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (role !== 'dev' || !over || active.id === over.id) return
      const a = String(active.id)
      const o = String(over.id)
      setSectionOrderIds((prev) => {
        const oldIndex = prev.indexOf(a)
        const newIndex = prev.indexOf(o)
        if (oldIndex < 0 || newIndex < 0) return prev
        const next = arrayMove(prev, oldIndex, newIndex)
        queueMicrotask(() => {
          void persistSectionOrder(next)
        })
        return next
      })
    },
    [role, persistSectionOrder],
  )

  async function loadSectionMarks() {
    const { data } = await supabase
      .from('quickfill_section_marks')
      .select('section_id, marked_at, marked_by, users!quickfill_section_marks_marked_by_fkey(name)')
    const map: Record<string, { marked_at: string; marked_by?: string; marked_by_name?: string | null }> = {}
    for (const row of data ?? []) {
      const r = row as { section_id: string; marked_at: string; marked_by?: string; users?: { name: string | null } | null }
      map[r.section_id] = {
        marked_at: r.marked_at,
        marked_by: r.marked_by,
        marked_by_name: r.users?.name ?? null,
      }
    }
    setSectionMarks(map)
  }

  useEffect(() => {
    loadSectionMarks()
  }, [])

  async function markSectionUpToDate(sectionId: string, options?: { noteText?: string | null; outcome?: MarkOutcome | null; questionWords?: string }) {
    const markedAt = new Date().toISOString()
    const outstanding_count = getOutstandingCount(sectionId)
    // What the press meant (punch list #176, change 1): a question whatever the count; otherwise the press's own
    // outcome, or the one the count implies, and null on a station with no count, which is a look as before.
    const outcome: MarkOutcome | null =
      options?.outcome === 'question' ? 'question' : outstanding_count == null ? null : (options?.outcome ?? markOutcomeForCount(outstanding_count))
    let note_text: string | null = null
    // A typed note wins; a station with no box (the Physical inbox deck, v2.5825) says its day in words.
    const rawNote = options?.noteText != null && options.noteText !== '' ? options.noteText : getMarkNote(sectionId)
    if (rawNote != null && rawNote !== '') {
      const t = rawNote.trim()
      if (t.length > 0) {
        note_text = t.length > MARK_EVENT_NOTE_MAX_CHARS ? t.slice(0, MARK_EVENT_NOTE_MAX_CHARS) : t
      }
    }
    const { error } = await supabase.from('quickfill_section_marks').upsert(
      { section_id: sectionId, marked_at: markedAt, marked_by: authUser?.id ?? null },
      { onConflict: 'section_id' },
    )
    if (error) return
    setForceExpandedSections((s) => {
      const next = new Set(s)
      next.delete(sectionId)
      return next
    })
    // Drop the chip from the floating dock for the rest of this visit (state resets
    // on reload, so the chip returns even though the mark persists).
    setDockHiddenThisVisit((s) => new Set([...s, sectionId]))
    loadSectionMarks()
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('quickfill_section_mark_events').insert({
            section_id: sectionId,
            marked_at: markedAt,
            marked_by: authUser?.id ?? null,
            outstanding_count: outstanding_count ?? null,
            note_text,
            outcome,
          }),
        'insert quickfill section mark event',
      )
    } catch {
      showToast('Marked up to date, but saving history failed. Try again or contact support.', 'warning')
    }
    if (outcome === 'question' && authUser?.id) {
      try {
        const result = await fileQuickfillQuestion({
          fromUserId: authUser.id,
          sectionId,
          label: SECTION_LABEL_BY_SECTION_ID.get(sectionId) ?? sectionId,
          count: outstanding_count ?? null,
          question: effectiveQuickfillSectionBanner(sectionId, sectionBanners),
          words: options?.questionWords ?? '',
        })
        showToast(result === 'filed' ? 'Your question is in the Dispatch inbox.' : 'Your question on this station is already in the Dispatch inbox.', 'success')
      } catch {
        showToast('Marked, but the question did not reach the Dispatch inbox. Try again or tell a dev.', 'warning')
      }
    }
  }

  /** "Open now" on a collapsed section: expand it and restore its dock chip. */
  const openSectionNow = useCallback((sectionId: string) => {
    setForceExpandedSections((s) => new Set([...s, sectionId]))
    setDockHiddenThisVisit((s) => {
      if (!s.has(sectionId)) return s
      const next = new Set(s)
      next.delete(sectionId)
      return next
    })
  }, [])

  function isCollapsed(sectionId: string): boolean {
    const mark = sectionMarks[sectionId]
    if (!mark) return false
    const hoursAgo = (Date.now() - new Date(mark.marked_at).getTime()) / (1000 * 60 * 60)
    return hoursAgo < 12
  }

  // Station deep links (Tier-2 #17, C11): `/quickfill#<sectionId>` (or
  // `?station=`) force-expands that section and scrolls it into view, so a
  // hand-off from anywhere lands ON the station instead of atop 26 chips.
  // Resolution is the tested kernel; this effect owns the DOM, the toast, and
  // the `station_deep_link` telemetry row (`ui_nav_clicks`). It waits for the
  // layout read so an org-hidden section fails soft as "hidden" rather than
  // racing the settings fetch, applies once per URL, and polls briefly for the
  // element because section bodies mount after their eligibility hooks settle.
  const location = useLocation()

  // The view (punch list #147, v2.5778): `?view=` on the URL for the visit, else the one this
  // person chose last, else the Roller (v2.5813, the owner's ask; the whole page before).
  // Remembered per person on the device, the Needs you card's Cards / Walk precedent; the
  // table comes with the Roller. The phone never reads it: under 640 px the page is the round.
  const [view, setView] = useState<QuickfillView>(() => quickfillOpeningView(location.search, authUser?.id))
  const viewRequested = parseQuickfillViewRequest(location.search)
  useEffect(() => {
    if (viewRequested) setView(viewRequested)
    else {
      const stored = readStoredQuickfillView(authUser?.id)
      if (stored) setView(stored)
    }
  }, [authUser?.id, viewRequested])
  const chooseView = useCallback(
    (next: QuickfillView) => {
      setView(next)
      writeQuickfillView(authUser?.id, next)
    },
    [authUser?.id],
  )
  // The Roller's "Show the N marked today" (v2.5787), per person on the device.
  const [rollerShowDone, setRollerShowDone] = useState<boolean>(() => readStoredRollerShowDone(authUser?.id))
  useEffect(() => {
    setRollerShowDone(readStoredRollerShowDone(authUser?.id))
  }, [authUser?.id])
  const chooseRollerShowDone = useCallback(
    (on: boolean) => {
      setRollerShowDone(on)
      writeRollerShowDone(authUser?.id, on)
    },
    [authUser?.id],
  )
  const [rollerBoardOpen, setRollerBoardOpen] = useState(false)
  // The last count each station reported this visit (v2.5830): Focus folds on it while a station
  // reloads or its reporter is gone, so neither reopens a station at zero.
  const focusLastCountsRef = useRef<Readonly<Record<string, number>>>({})
  focusLastCountsRef.current = keepFocusCounts(focusLastCountsRef.current, sectionMetrics)
  const focusBucketOf = useCallback(
    (sectionId: string): FocusBucket => {
      const m = sectionMetrics[sectionId]
      return focusBucket({
        count: m?.count ?? null,
        lastCount: focusLastCountsRef.current[sectionId] ?? null,
        loading: m?.loading ?? false,
        collapsed: isCollapsed(sectionId),
        personal: QUICKFILL_PERSONAL_SECTIONS.has(sectionId),
        forced: forceExpandedSections.has(sectionId),
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isCollapsed reads sectionMarks and the clock
    [sectionMetrics, sectionMarks, forceExpandedSections],
  )
  const stationRequestKey = `${location.hash}|${location.search}`
  const appliedStationKeyRef = useRef<string | null>(null)
  const stationPollTokenRef = useRef(0)
  useEffect(() => {
    if (!layoutSettingsLoaded) return
    if (appliedStationKeyRef.current === stationRequestKey) return
    appliedStationKeyRef.current = stationRequestKey
    const resolution = resolveQuickfillStation(location, SECTIONS, sectionWouldRenderOnPage)
    if (!resolution.raw) return
    recordNavClick(authUser?.id, role, 'station_deep_link', quickfillStationTelemetryTarget(resolution))
    if (!resolution.found || resolution.domId == null || resolution.sectionId == null) {
      showToast("That section isn't on your Quickfill.", 'info')
      return
    }
    openSectionNow(resolution.sectionId)
    const domId = resolution.domId
    const token = ++stationPollTokenRef.current
    const deadline = Date.now() + 4000
    const tick = () => {
      if (stationPollTokenRef.current !== token) return
      const el = document.getElementById(domId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      if (Date.now() < deadline) window.setTimeout(tick, 120)
    }
    tick()
  }, [layoutSettingsLoaded, stationRequestKey, location, sectionWouldRenderOnPage, authUser?.id, role, showToast, openSectionNow])

  function quickfillSectionBlock(meta: QuickfillSectionMeta, opts?: { first?: boolean }): ReactNode {
    const { id, sectionId, label } = meta
    const withTopDivider = opts?.first != null ? !opts.first : firstVisibleSectionId !== null && firstVisibleSectionId !== sectionId
    const bannerText = effectiveQuickfillSectionBanner(sectionId, sectionBanners)
    switch (sectionId) {
      case 'warnings':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('warnings')}
            collapsed={isCollapsed('warnings') && !forceExpandedSections.has('warnings')}
            mark={sectionMarks['warnings']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('warnings', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('warnings')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'warnings', label: 'Warnings' })}
          >
            {/* v2.2189: the unallocated-deposits banner left Warnings — it's the
                "Allocate N bank deposits" card in Jobs Cleanup now. */}
            <QuickfillMetricReporter
              sectionId="warnings"
              count={typeof staleTallyStaffTxCount === 'number' ? staleTallyStaffTxCount : null}
              loading={staleTallyStaffTxCount === null}
            />
            <DashboardTallyStaleStaffBanner
              peopleCount={typeof staleTallyStaffPeopleCount === 'number' ? staleTallyStaffPeopleCount : 0}
              transactionCount={typeof staleTallyStaffTxCount === 'number' ? staleTallyStaffTxCount : 0}
              loading={staleTallyStaffPeopleCount === null || staleTallyStaffTxCount === null}
              minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
              onOpen={() => setWarningsModalOpen(true)}
            />
            <DashboardStaleTallyStaffFollowUpModal
              open={warningsModalOpen}
              onClose={() => setWarningsModalOpen(false)}
              minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
              onDataChanged={() => void refetchStaleTallyStaffFollowUp()}
            />
          </QuickfillSectionWrapper>
        )
      case 'office-arriving':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('office-arriving')}
            collapsed={isCollapsed('office-arriving') && !forceExpandedSections.has('office-arriving')}
            mark={sectionMarks['office-arriving']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('office-arriving', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('office-arriving')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'office-arriving', label: 'Office Arriving' })}
          >
            <QuickfillOfficeSection variant="arriving" />
          </QuickfillSectionWrapper>
        )
      case 'my-inbox':
        // Per-user section: the org-wide mark system must not apply (one user's mark
        // would collapse it for everyone), so no mark button, history, stamp, or
        // collapse — its "done" state is checking off the actual tasks.
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(null)}
            collapsed={false}
            mark={undefined}
            omitDefaultMarkButton
            showOutstandingInHeader={false}
            showMarkHistoryButton={false}
            showLastMarked={false}
            onMarkUpToDate={() => {}}
            onOpenNow={() => {}}
            onOpenHistory={() => {}}
          >
            <QuickfillMyInboxSection />
          </QuickfillSectionWrapper>
        )
      case 'office-leaving':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('office-leaving')}
            collapsed={isCollapsed('office-leaving') && !forceExpandedSections.has('office-leaving')}
            mark={sectionMarks['office-leaving']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('office-leaving', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('office-leaving')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'office-leaving', label: 'Office Leaving' })}
          >
            <QuickfillOfficeSection variant="leaving" />
          </QuickfillSectionWrapper>
        )
      case 'people-hours-new':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('people-hours-new')}
            collapsed={isCollapsed('people-hours-new') && !forceExpandedSections.has('people-hours-new')}
            mark={sectionMarks['people-hours-new']}
            closeWeek={closeWeekFor('people-hours-new')}
            onCloseWeekOpen={() => onCloseWeekOpen('people-hours-new')}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('people-hours-new', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('people-hours-new')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'people-hours-new', label: 'People Hours' })}
          >
            <QuickfillPeopleHoursNewSection />
          </QuickfillSectionWrapper>
        )
      case 'unassigned-field-time':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('unassigned-field-time')}
            collapsed={
              isCollapsed('unassigned-field-time') &&
              !forceExpandedSections.has('unassigned-field-time')
            }
            mark={sectionMarks['unassigned-field-time']}
            closeWeek={closeWeekFor('unassigned-field-time')}
            onCloseWeekOpen={() => onCloseWeekOpen('unassigned-field-time')}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('unassigned-field-time', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('unassigned-field-time')}
            onOpenHistory={() =>
              setMarkHistoryModal({
                sectionId: 'unassigned-field-time',
                label: 'Unassigned field time',
              })
            }
          >
            <QuickfillUnassignedFieldTimeSection />
          </QuickfillSectionWrapper>
        )
      case 'vehicle-odometers':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('vehicle-odometers')}
            collapsed={
              isCollapsed('vehicle-odometers') && !forceExpandedSections.has('vehicle-odometers')
            }
            mark={sectionMarks['vehicle-odometers']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('vehicle-odometers', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('vehicle-odometers')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'vehicle-odometers', label: 'Vehicle check-ins' })
            }
          >
            <QuickfillVehicleOdometersSection lastMarkedAt={sectionMarks['vehicle-odometers']?.marked_at ?? null} />
          </QuickfillSectionWrapper>
        )
      case 'assistant-dailys':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('assistant-dailys')}
            collapsed={isCollapsed('assistant-dailys') && !forceExpandedSections.has('assistant-dailys')}
            mark={sectionMarks['assistant-dailys']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('assistant-dailys', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('assistant-dailys')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'assistant-dailys', label: 'Assistant Dailys' })}
          >
            <QuickfillAssistantDailysSection siblingMarks={sectionMarks} onOpenStation={openSectionNow} />
          </QuickfillSectionWrapper>
        )
      case 'difficult-people':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('difficult-people')}
            collapsed={isCollapsed('difficult-people') && !forceExpandedSections.has('difficult-people')}
            mark={sectionMarks['difficult-people']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('difficult-people', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('difficult-people')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'difficult-people', label: 'Difficult people' })}
          >
            <QuickfillDifficultPeopleSection />
          </QuickfillSectionWrapper>
        )
      case 'banking-sorting':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('banking-sorting')}
            collapsed={isCollapsed('banking-sorting') && !forceExpandedSections.has('banking-sorting')}
            mark={sectionMarks['banking-sorting']}
            closeWeek={closeWeekFor('banking-sorting')}
            onCloseWeekOpen={() => onCloseWeekOpen('banking-sorting')}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('banking-sorting', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('banking-sorting')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'banking-sorting', label: 'Banking sorting' })}
          >
            <BankingSortingSnapshotSection />
          </QuickfillSectionWrapper>
        )
      case 'billed-awaiting':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('billed-awaiting')}
            collapsed={isCollapsed('billed-awaiting') && !forceExpandedSections.has('billed-awaiting')}
            mark={sectionMarks['billed-awaiting']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('billed-awaiting', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('billed-awaiting')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'billed-awaiting', label: 'Billed Awaiting Payment' })}
          >
            <BilledAwaitingPaymentSection lastMarkedAt={sectionMarks['billed-awaiting']?.marked_at ?? null} />
          </QuickfillSectionWrapper>
        )
      case 'gc-weekly-review':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('gc-weekly-review')}
            collapsed={isCollapsed('gc-weekly-review') && !forceExpandedSections.has('gc-weekly-review')}
            mark={sectionMarks['gc-weekly-review']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('gc-weekly-review', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('gc-weekly-review')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'gc-weekly-review', label: 'GC weekly review' })}
          >
            <QuickfillMetricReporter
              sectionId="gc-weekly-review"
              count={gcReviewRemaining}
              loading={gcReviewRemaining === null}
            />
            <DashboardGcReviewWeeklyBanner onCount={setGcReviewRemaining} />
          </QuickfillSectionWrapper>
        )
      case 'job-followups':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('job-followups')}
            collapsed={isCollapsed('job-followups') && !forceExpandedSections.has('job-followups')}
            mark={sectionMarks['job-followups']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('job-followups', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('job-followups')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'job-followups', label: 'Job follow-ups' })}
          >
            <QuickfillMetricReporter
              sectionId="job-followups"
              count={jobFollowupsCount}
              loading={jobFollowupsCount === null}
              nextLine={jobFollowupsNextLine}
            />
            <DashboardJobFollowupsBanner onCount={setJobFollowupsCount} onNextLine={setJobFollowupsNextLine} />
          </QuickfillSectionWrapper>
        )
      case 'needs-you':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('needs-you')}
            collapsed={isCollapsed('needs-you') && !forceExpandedSections.has('needs-you')}
            mark={sectionMarks['needs-you']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('needs-you', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('needs-you')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'needs-you', label: "Today's lines" })}
          >
            <QuickfillMetricReporter
              sectionId="needs-you"
              count={needsYouSectionCount}
              loading={needsYouSectionCount === null}
              nextLine={needsYouNextLine}
            />
            <QuickfillNeedsYouSection
              onCount={setNeedsYouSectionCount}
              onNextLine={setNeedsYouNextLine}
              dispatchAged={dispatchAged}
              onOpenDispatchInbox={() => {
                openSectionNow('dispatch-inbox')
                document.getElementById('quickfill-dispatch-inbox')?.scrollIntoView({ behavior: 'smooth' })
              }}
              onOpenPeopleHours={() => {
                // The clock sessions waiting on approval (punch list #146): the People Hours station on this page.
                openSectionNow('people-hours-new')
                document.getElementById('quickfill-people-hours-new')?.scrollIntoView({ behavior: 'smooth' })
              }}
              onMarkUpToDate={() => void markSectionUpToDate('needs-you')}
            />
          </QuickfillSectionWrapper>
        )
      case 'unpriced-fixtures':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('unpriced-fixtures')}
            collapsed={isCollapsed('unpriced-fixtures') && !forceExpandedSections.has('unpriced-fixtures')}
            mark={sectionMarks['unpriced-fixtures']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('unpriced-fixtures', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('unpriced-fixtures')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'unpriced-fixtures', label: 'Unpriced Fixtures' })}
          >
            <QuickfillMetricReporter sectionId="unpriced-fixtures" count={unpricedFixturesCount} loading={false} />
            <UnpricedFixturesSection />
          </QuickfillSectionWrapper>
        )
      case 'cant-reach':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('cant-reach')}
            collapsed={isCollapsed('cant-reach') && !forceExpandedSections.has('cant-reach')}
            mark={sectionMarks['cant-reach']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('cant-reach', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('cant-reach')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'cant-reach', label: 'Unreachable Prospects' })}
          >
            <CantReachSection prospects={quickfillCantReach.prospects} refetch={quickfillCantReach.refetch} />
          </QuickfillSectionWrapper>
        )
      case 'prospects':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('prospects')}
            collapsed={isCollapsed('prospects') && !forceExpandedSections.has('prospects')}
            mark={sectionMarks['prospects']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('prospects', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('prospects')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'prospects', label: 'Prospects' })}
          >
            <QuickfillProspectsSection lastMarkedAt={sectionMarks['prospects']?.marked_at ?? null} />
          </QuickfillSectionWrapper>
        )
      case 'supply-houses':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('supply-houses')}
            collapsed={isCollapsed('supply-houses') && !forceExpandedSections.has('supply-houses')}
            mark={sectionMarks['supply-houses']}
            closeWeek={closeWeekFor('supply-houses')}
            onCloseWeekOpen={() => onCloseWeekOpen('supply-houses')}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('supply-houses', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('supply-houses')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'supply-houses', label: 'Supply Houses' })}
          >
            <SupplyHousesSection />
          </QuickfillSectionWrapper>
        )
      case 'jobs-billing':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('jobs-billing')}
            collapsed={isCollapsed('jobs-billing') && !forceExpandedSections.has('jobs-billing')}
            mark={sectionMarks['jobs-billing']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('jobs-billing', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('jobs-billing')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'jobs-billing', label: 'Jobs Billing' })}
          >
            <JobsBillingReminderSection minHcpNumber={jobsBillingMinHcp} />
          </QuickfillSectionWrapper>
        )
      case 'complete-no-bill':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('complete-no-bill')}
            collapsed={isCollapsed('complete-no-bill') && !forceExpandedSections.has('complete-no-bill')}
            mark={sectionMarks['complete-no-bill']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('complete-no-bill', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('complete-no-bill')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'complete-no-bill', label: 'Complete, no Total Bill' })
            }
          >
            <QuickfillCompleteNoBillSection
              completeNoBillJobs={quickfillCompleteNoBill.completeNoBillJobs}
              clockSummaryByJobId={quickfillCompleteNoBill.clockSummaryByJobId}
              jobsListBusy={quickfillCompleteNoBill.jobsListBusy}
            />
          </QuickfillSectionWrapper>
        )
      case 'undated-bills':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('undated-bills')}
            collapsed={isCollapsed('undated-bills') && !forceExpandedSections.has('undated-bills')}
            mark={sectionMarks['undated-bills']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('undated-bills', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('undated-bills')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'undated-bills', label: 'Missing bill dates' })}
          >
            <QuickfillUndatedBillsSection />
          </QuickfillSectionWrapper>
        )
      case 'jobs-cleanup':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('jobs-cleanup')}
            collapsed={isCollapsed('jobs-cleanup') && !forceExpandedSections.has('jobs-cleanup')}
            mark={sectionMarks['jobs-cleanup']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('jobs-cleanup', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('jobs-cleanup')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'jobs-cleanup', label: 'Jobs Cleanup' })}
          >
            <QuickfillJobsCleanupSection />
          </QuickfillSectionWrapper>
        )
      case 'property-kinds':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('property-kinds')}
            collapsed={isCollapsed('property-kinds') && !forceExpandedSections.has('property-kinds')}
            mark={sectionMarks['property-kinds']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('property-kinds', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('property-kinds')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'property-kinds', label: 'Property kinds' })}
          >
            <QuickfillPropertyKindsSection
              rows={quickfillPropertyKinds.rows}
              noCustomerCount={quickfillPropertyKinds.noCustomerCount}
              loading={quickfillPropertyKinds.loading}
              onKindSaved={quickfillPropertyKinds.setKind}
              onJobLinked={quickfillPropertyKinds.linkJob}
            />
          </QuickfillSectionWrapper>
        )
      case 'percent-complete':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('percent-complete')}
            collapsed={isCollapsed('percent-complete') && !forceExpandedSections.has('percent-complete')}
            mark={sectionMarks['percent-complete']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('percent-complete', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('percent-complete')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'percent-complete', label: 'Percent complete' })}
          >
            <QuickfillPercentCompleteSection
              list={quickfillPercentComplete.list}
              loading={quickfillPercentComplete.loading}
              snoozeAvailable={quickfillPercentComplete.snoozeAvailable}
              onSave={quickfillPercentComplete.save}
              onUndoSave={quickfillPercentComplete.undoSave}
              onDismiss={quickfillPercentComplete.dismiss}
              onUndoDismiss={quickfillPercentComplete.undoDismiss}
            />
          </QuickfillSectionWrapper>
        )
      case 'no-customer-stages':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('no-customer-stages')}
            collapsed={isCollapsed('no-customer-stages') && !forceExpandedSections.has('no-customer-stages')}
            mark={sectionMarks['no-customer-stages']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('no-customer-stages', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('no-customer-stages')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'no-customer-stages', label: 'Missing job info' })
            }
          >
            <QuickfillStagesNoCustomerSection
              jobsWithoutCustomer={quickfillNoCustomerStages.jobsWithoutCustomer}
              workingJobsWithoutPictures={quickfillNoCustomerStages.workingJobsWithoutPictures}
              readyToBillNoEmailJobs={quickfillNoCustomerStages.readyToBillNoEmailJobs}
              jobsListBusy={quickfillNoCustomerStages.jobsListBusy}
            />
          </QuickfillSectionWrapper>
        )
      case 'field-photos':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('field-photos')}
            collapsed={isCollapsed('field-photos') && !forceExpandedSections.has('field-photos')}
            mark={sectionMarks['field-photos']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('field-photos', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('field-photos')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'field-photos', label: 'Field photos → Drive' })
            }
          >
            <QuickfillFieldPhotoHandoverSection
              groups={quickfillFieldPhotos.groups}
              handovers={quickfillFieldPhotos.handovers}
              loading={quickfillFieldPhotos.loading}
              problem={quickfillFieldPhotos.problem}
              onMoved={quickfillFieldPhotos.removeGroup}
              lastMarkedAt={sectionMarks['field-photos']?.marked_at ?? null}
            />
          </QuickfillSectionWrapper>
        )
      case 'dispatch-inbox':
        return (
          <>
            {/* The open-requests count lives beside the wrapper, not inside it (v2.2896,
                journey-map J19-F4): a collapsed desktop strip never mounts its children,
                so a reporter placed inside read "—" while the requests were open. */}
            <QuickfillMetricReporter
              sectionId="dispatch-inbox"
              count={dispatchRequestsLoading ? null : dispatchRequests.filter((r) => r.status === 'open').length}
              loading={dispatchRequestsLoading}
              nextLine={
                dispatchRequestsLoading
                  ? null
                  : dispatchInboxNextLine(
                      dispatchRequests.map((r) => ({ status: r.status, title: r.title, created_at: r.created_at, senderName: (r as { sender?: { name?: string | null } | null }).sender?.name ?? null, priority: r.priority })),
                      Date.now(),
                    )
              }
            />
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('dispatch-inbox')}
            collapsed={isCollapsed('dispatch-inbox') && !forceExpandedSections.has('dispatch-inbox')}
            mark={sectionMarks['dispatch-inbox']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('dispatch-inbox', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('dispatch-inbox')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'dispatch-inbox', label: 'Dispatch inbox' })}
          >
            <DispatchInboxSection
              variant="embedded"
              sectionOpen={!isCollapsed('dispatch-inbox') || forceExpandedSections.has('dispatch-inbox')}
              onToggleSection={() => undefined}
              requests={dispatchRequests}
              loading={dispatchRequestsLoading}
              expandedRequestId={expandedDispatchRequestId}
              onToggleExpandRequest={toggleExpandDispatchRequest}
              notesByRequestId={dispatchThreadNotesByRequestId}
              notesLoadingRequestId={dispatchNotesLoadingRequestId}
              noteSubmitRequestId={dispatchNoteSubmitRequestId}
              canAddNotes={dispatchInboxEligible}
              dispatchRequestDismissingId={dispatchRequestDismissingId}
              noteDraft={dispatchNoteDraft}
              onNoteDraftChange={setDispatchNoteDraft}
              onSubmitNote={submitDispatchNote}
              onSubmitNoteAndClose={submitDispatchNoteAndClose}
              onDismiss={dismissDispatchRequest}
              onOpenDismissedArchive={() => setDispatchDismissedModalOpen(true)}
              onLinkJobPictures={
                jobFormModal
                  ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
                  : undefined
              }
              onCreateTripCharge={
                role === 'dev' || role === 'master_technician' || isAssistantLike(role)
                  ? (args) => setTripChargeTarget(args)
                  : undefined
              }
              prioritySavingId={dispatchPrioritySavingId}
              onSetPriority={setDispatchRequestPriority}
              onLogCall={logDispatchRequestCall}
            />
          </QuickfillSectionWrapper>
          </>
        )
      case 'schedule':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('schedule')}
            collapsed={isCollapsed('schedule') && !forceExpandedSections.has('schedule')}
            mark={sectionMarks['schedule']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('schedule', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('schedule')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'schedule', label: 'Schedule' })}
            showOutstandingInHeader={false}
            showMarkHistoryButton={false}
            omitDefaultMarkButton
            showLastMarked={false}
          >
            <QuickfillScheduleSection hideConflictPrompt />
          </QuickfillSectionWrapper>
        )
      case 'tomorrow-schedule':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('tomorrow-schedule')}
            collapsed={isCollapsed('tomorrow-schedule') && !forceExpandedSections.has('tomorrow-schedule')}
            mark={sectionMarks['tomorrow-schedule']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('tomorrow-schedule', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('tomorrow-schedule')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'tomorrow-schedule', label: "Tomorrow's Schedule" })
            }
            showOutstandingInHeader={false}
            showMarkHistoryButton={false}
            omitDefaultMarkButton
            showLastMarked={false}
          >
            <QuickfillTomorrowsScheduleSection />
          </QuickfillSectionWrapper>
        )
      case 'email-inbox':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('email-inbox')}
            collapsed={isCollapsed('email-inbox') && !forceExpandedSections.has('email-inbox')}
            mark={sectionMarks['email-inbox']}
            omitDefaultMarkButton
            onMarkUpToDate={() => undefined /* the Email station owns its Looked */}
            onOpenNow={() => openSectionNow('email-inbox')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'email-inbox', label: 'Email' })}
          >
            <QuickfillEmailSection
              metricSectionId="email-inbox"
              markButtonPalette={{
                bg: BUTTON_BG[chipColorOf('email-inbox')],
                border: BUTTON_BORDER[chipColorOf('email-inbox')],
              }}
              onConfirmMark={(note) => void markSectionUpToDate('email-inbox', { noteText: note })}
              lastMarkedAt={sectionMarks['email-inbox']?.marked_at ?? null}
            />
          </QuickfillSectionWrapper>
        )
      case 'texts':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('texts')}
            collapsed={isCollapsed('texts') && !forceExpandedSections.has('texts')}
            mark={sectionMarks['texts']}
            onMarkUpToDate={(outcome, words) => void markTexts(outcome, words)}
            onOpenNow={() => openSectionNow('texts')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'texts', label: 'Texts' })}
          >
            <QuickfillTextsSection
              ledger={quickfillTexts.ledger}
              todaysSends={quickfillTexts.todaysSends}
              loading={quickfillTexts.loading}
              problem={quickfillTexts.problem}
              canRead={quickfillTextsEnabled}
              typed={quickfillTextsTyped}
              onTyped={setQuickfillTextsTyped}
              onReload={quickfillTexts.reload}
            />
          </QuickfillSectionWrapper>
        )
      case 'physical-inbox':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={chipColorOf('physical-inbox')}
            collapsed={isCollapsed('physical-inbox') && !forceExpandedSections.has('physical-inbox')}
            mark={sectionMarks['physical-inbox']}
            onMarkUpToDate={(outcome, words) => void markSectionUpToDate('physical-inbox', { outcome, questionWords: words })}
            onOpenNow={() => openSectionNow('physical-inbox')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'physical-inbox', label: 'Physical inbox' })}
          >
            {/* v2.5818 (punch list #158): the tray as a clarify deck; the wrapper's own Mark snapshots the undecided count. */}
            <QuickfillPhysicalInboxSection />
          </QuickfillSectionWrapper>
        )
      default:
        return null
    }
  }

  const narrowViewport = useNarrowViewport640()
  const freshnessLine = useMemo(
    () =>
      quickfillFreshnessSummary(
        orderedSections
          .filter(({ sectionId }) => sectionWouldRenderOnPage(sectionId))
          .map(({ sectionId }) => ({ sectionId, markedAt: sectionMarks[sectionId]?.marked_at ?? null, personal: sectionId === 'my-inbox', green: chipColorOf(sectionId) === 'green' })),
      ).line,
    [orderedSections, sectionWouldRenderOnPage, sectionMarks, chipColorOf],
  )
  // Quickfill as a round (punch list #30, PR 3): on a phone the page is the sections' marks
  // as rows measured against each section's own rhythm, one section per screen
  // (`/quickfill#<sectionId>`, the station deep link), Looked · N open · next at the thumb.
  const [roundSearch, setRoundSearch] = useState('')
  const [roundMarking, setRoundMarking] = useState(false)
  const [roundEventsLoaded, setRoundEventsLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
      const { data } = await supabase
        .from('quickfill_section_mark_events')
        .select('section_id, marked_at, outstanding_count, outcome, users!quickfill_section_mark_events_marked_by_fkey(name)')
        .gte('marked_at', since)
        .order('marked_at', { ascending: false })
        .limit(2000)
      if (!cancelled) {
        setRoundEvents((data ?? []).map((r) => ({ section_id: r.section_id, marked_at: r.marked_at, outstanding_count: r.outstanding_count, outcome: r.outcome ?? null, marked_by_name: r.users?.name ?? null })))
        setRoundEventsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sectionMarks])
  const roundNow = useMemo(() => new Date(), [sectionMarks, roundEvents]) // eslint-disable-line react-hooks/exhaustive-deps
  const roundRowsValue = useMemo(
    () =>
      roundRows(
        orderedSections
          .filter(({ sectionId }) => sectionWouldRenderOnPage(sectionId))
          .map(({ sectionId, label }) => ({ sectionId, label, personal: QUICKFILL_PERSONAL_SECTIONS.has(sectionId), needsNote: QUICKFILL_NOTE_FIRST_SECTIONS.has(sectionId) })),
        sectionMarks,
        roundEvents,
        getOutstandingCount,
        roundNow,
      ),
    [orderedSections, sectionWouldRenderOnPage, sectionMarks, roundEvents, getOutstandingCount, roundNow],
  )
  // A round screen's count line (punch list #156, v2.5826): the live count, and the *last look*
  // words apart, which QuickfillRoundScreen draws as a door to the station's Mark history.
  const roundCountParts = (sectionId: string): { countLine: string; lastLook: string | null; nextLine: string | null } => {
    const row = roundRowsValue.find((r) => r.sectionId === sectionId)
    const live = getOutstandingCount(sectionId)
    return {
      nextLine: sectionMetrics[sectionId]?.loading ? null : (sectionMetrics[sectionId]?.nextLine ?? null),
      countLine: typeof live === 'number' ? `${live} open` : '',
      lastLook: row && !row.personal ? (row.lastMarkedAt ? `last look ${formatRelativeTime(row.lastMarkedAt)}${row.lastMarkedByName ? ` · ${row.lastMarkedByName}` : ''}` : 'never marked') : null,
    }
  }
  const roundStationRaw = parseQuickfillStationRequest(location.hash, location.search)
  const roundMeta = narrowViewport && roundStationRaw ? SECTIONS.find((sec) => sec.sectionId === roundStationRaw && sectionWouldRenderOnPage(sec.sectionId)) ?? null : null
  const roundActive = narrowViewport && layoutSettingsLoaded
  // The company-time hour: Office Leaving joins the round after 3 p.m. (v2.5841, punch list #176, change 4).
  const companyHour = markHistoryHour(roundNow.toISOString()) ?? roundNow.getHours()
  const roundQueueIds = roundQueue(roundRowsValue, companyHour)
  const roundPosition = roundMeta && roundQueueIds.includes(roundMeta.sectionId) ? { index: roundQueueIds.indexOf(roundMeta.sectionId) + 1, total: roundQueueIds.length } : null
  const goRound = (sectionId: string | null) => navigate(sectionId ? quickfillStationHref(sectionId) : '/quickfill')
  const roundSkip = () => goRound(roundMeta ? nextInRound(roundRowsValue, roundMeta.sectionId) : null)
  const roundLooked = async (outcome: MarkOutcome, words: string) => {
    if (!roundMeta || roundMarking) return
    setRoundMarking(true)
    try {
      await (roundMeta.sectionId === 'texts' ? markTexts(outcome, words) : markSectionUpToDate(roundMeta.sectionId, { outcome, questionWords: words }))
    } finally {
      setRoundMarking(false)
    }
    goRound(nextInRound(roundRowsValue, roundMeta.sectionId))
  }
  // The Roller (punch list #147, v2.5787): the round's screens on a desk. The deck is every
  // station not marked today (the doors last), the station is the URL's, Previous and Next
  // walk the deck, Looked marks and moves on, the Board is the index.
  const rollerActive = !narrowViewport && view === 'roller' && layoutSettingsLoaded
  const rollerDeckRows = useMemo(() => rollerDeck(roundRowsValue, rollerShowDone, companyHour), [roundRowsValue, rollerShowDone, companyHour])
  // The round's close sheet (v2.5845, punch list #176, change 5): today's marks with their outcomes, drawn where Round done ✓ was.
  const roundCloseToday = useMemo(() => roundCloseSheet(roundEvents, todayYmdInAppTz(), (id) => SECTION_LABEL_BY_SECTION_ID.get(id) ?? id), [roundEvents])
  const rollerMeta = rollerActive && roundStationRaw ? SECTIONS.find((sec) => sec.sectionId === roundStationRaw && sectionWouldRenderOnPage(sec.sectionId)) ?? null : null
  const rollerIndex = rollerMeta ? rollerDeckRows.findIndex((r) => r.sectionId === rollerMeta.sectionId) : -1
  const rollerDoneCount = roundRowsValue.filter((r) => !r.personal && r.state === 'fresh').length
  const rollerFirstId = rollerDeckRows[0]?.sectionId ?? null
  useEffect(() => {
    // No station on the URL: start at the top of the deck once the marks' history is in (the
    // rhythm rule sorts the deck). Replace, so Back leaves the page.
    if (rollerActive && roundEventsLoaded && !roundStationRaw && rollerFirstId) navigate(quickfillStationHref(rollerFirstId), { replace: true })
  }, [rollerActive, roundEventsLoaded, roundStationRaw, rollerFirstId, navigate])
  const rollerGo = (sectionId: string | null) => navigate(sectionId ? quickfillStationHref(sectionId) : '/quickfill')
  const rollerPrevId = rollerMeta ? rollerPrev(rollerDeckRows, rollerMeta.sectionId) : null
  const rollerSkip = () => rollerGo(rollerMeta ? rollerNext(rollerDeckRows, rollerMeta.sectionId) : rollerFirstId)
  const rollerLooked = async (outcome: MarkOutcome, words: string) => {
    if (!rollerMeta || roundMarking) return
    const nextId = rollerNext(rollerDeckRows, rollerMeta.sectionId)
    setRoundMarking(true)
    try {
      await (rollerMeta.sectionId === 'texts' ? markTexts(outcome, words) : markSectionUpToDate(rollerMeta.sectionId, { outcome, questionWords: words }))
    } finally {
      setRoundMarking(false)
    }
    rollerGo(nextId)
  }
  useEffect(() => {
    if (!rollerActive || rollerBoardOpen || markHistoryModal) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        rollerGo(rollerMeta ? rollerNext(rollerDeckRows, rollerMeta.sectionId) : rollerFirstId)
      } else if (e.key === 'ArrowLeft' && rollerPrevId) {
        e.preventDefault()
        rollerGo(rollerPrevId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rollerGo is a navigate wrapper
  }, [rollerActive, rollerBoardOpen, markHistoryModal, rollerMeta, rollerDeckRows, rollerFirstId, rollerPrevId])
  const dockSections = searchedSections
    .filter(({ sectionId }) => !dockHiddenThisVisit.has(sectionId))
    .map(({ id, label }) => ({ id, label }))

  return (
    // width/minWidth (v2.1003): same containment as .pageWrap — without it, flex
    // min-content flooring let wide section rows pan the whole page sideways on
    // phones (caught by the viewport e2e spec).
    <div style={{ padding: '1.5rem', paddingBottom: dockSections.length > 1 ? '4.5rem' : '1.5rem', maxWidth: 1200, margin: '0 auto', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {roundActive ? (
        <QuickfillRoundScreenContext.Provider value={roundMeta != null}>
          {roundMeta ? (
            <QuickfillRoundScreen
              label={roundMeta.label}
              position={roundPosition}
              question={effectiveQuickfillSectionBanner(roundMeta.sectionId, sectionBanners)}
              sectionId={roundMeta.sectionId}
              {...roundCountParts(roundMeta.sectionId)}
              liveCount={getOutstandingCount(roundMeta.sectionId)}
              countLoading={!(roundMeta.sectionId in sectionMetrics) || (sectionMetrics[roundMeta.sectionId]?.loading ?? false)}
              needsNote={QUICKFILL_NOTE_FIRST_SECTIONS.has(roundMeta.sectionId)}
              personal={QUICKFILL_PERSONAL_SECTIONS.has(roundMeta.sectionId)}
              marking={roundMarking}
              onBack={() => goRound(null)}
              onSkip={roundSkip}
              onPress={(outcome, words) => void roundLooked(outcome, words)}
              onHistory={() => setMarkHistoryModal({ sectionId: roundMeta.sectionId, label: roundMeta.label })}
            >
              {quickfillSectionBlock(roundMeta)}
            </QuickfillRoundScreen>
          ) : (
            <>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.6rem' }}>Quickfill</h1>
              <QuickfillRoundList rows={roundRowsValue} search={roundSearch} onSearch={setRoundSearch} onOpen={(id) => goRound(id)} now={roundNow} hourNow={companyHour} closeSheet={roundCloseToday} />
            </>
          )}
        </QuickfillRoundScreenContext.Provider>
      ) : narrowViewport ? null : (
        <>
      {dockSections.length > 1 && !rollerActive ? <SectionDock sections={dockSections} ariaLabel="Quickfill sections" /> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '1.5rem' }}>
        <span />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, textAlign: 'center' }}>Quickfill</h1>
        <span style={{ justifySelf: 'end' }}>
          <QuickfillViewSwitch view={view} onChange={chooseView} />
        </span>
      </div>
      {rollerActive ? (
        <QuickfillRoundScreenContext.Provider value={rollerMeta != null}>
          {rollerMeta ? (
            <QuickfillRoundScreen
              wide
              label={rollerMeta.label}
              position={rollerIndex >= 0 ? { index: rollerIndex + 1, total: rollerDeckRows.length } : null}
              question={effectiveQuickfillSectionBanner(rollerMeta.sectionId, sectionBanners)}
              sectionId={rollerMeta.sectionId}
              {...roundCountParts(rollerMeta.sectionId)}
              liveCount={getOutstandingCount(rollerMeta.sectionId)}
              countLoading={!(rollerMeta.sectionId in sectionMetrics) || (sectionMetrics[rollerMeta.sectionId]?.loading ?? false)}
              needsNote={QUICKFILL_NOTE_FIRST_SECTIONS.has(rollerMeta.sectionId)}
              personal={QUICKFILL_PERSONAL_SECTIONS.has(rollerMeta.sectionId)}
              marking={roundMarking}
              onBack={() => setRollerBoardOpen(true)}
              onPrev={rollerPrevId ? () => rollerGo(rollerPrevId) : null}
              onSkip={rollerSkip}
              onPress={(outcome, words) => void rollerLooked(outcome, words)}
              onHistory={() => setMarkHistoryModal({ sectionId: rollerMeta.sectionId, label: rollerMeta.label })}
              strip={
                <QuickfillRollerStrip
                  dots={rollerDeckRows.map((r) => ({ sectionId: r.sectionId, label: r.label, dot: rollerDot(r), current: r.sectionId === rollerMeta.sectionId }))}
                  words={rollerIndex >= 0 ? rollerWords(rollerDeckRows, rollerIndex) : `${rollerMeta.label} · not in this round`}
                  showDone={rollerShowDone}
                  doneCount={rollerDoneCount}
                  onShowDone={chooseRollerShowDone}
                  onPick={(id) => rollerGo(id)}
                  onGroups={() => setRollerBoardOpen(true)}
                />
              }
            >
              {quickfillSectionBlock(rollerMeta)}
            </QuickfillRoundScreen>
          ) : rollerDeckRows.length === 0 ? (
            <QuickfillRoundCloseSheet
              sheet={roundCloseToday}
              onOpenStation={(id) => {
                openSectionNow(id)
                rollerGo(id)
              }}
              extra={
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={rollerShowDone} onChange={(e) => chooseRollerShowDone(e.target.checked)} />
                  Show the {rollerDoneCount} marked today
                </label>
              }
            />
          ) : null}
        </QuickfillRoundScreenContext.Provider>
      ) : (
        <>
      {/* Jump grid (v2.2184): phones get a one-line strip you flick sideways (the
          dock's own pattern) plus a freshness summary — the wrapped grid was 18
          rows tall at 375px, a whole screen before the first section. Desktop
          and tablet keep the wrapped grid. The who·when stamp now sits inside
          the chip after its label instead of floating over the corner. */}
      <div
        style={
          narrowViewport
            ? {
                display: 'flex',
                flexWrap: 'nowrap',
                gap: '0.5rem',
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '0.25rem 0 0.5rem',
                marginBottom: '0.25rem',
                scrollbarWidth: 'thin',
              }
            : { display: 'flex', flexWrap: 'wrap', gap: '0.6rem 0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }
        }
        role="navigation"
        aria-label="Jump to a section"
      >
        {orderedSections.filter(({ sectionId }) => sectionWouldRenderOnPage(sectionId)).map(({ id, sectionId, label }) => {
          const mark = sectionMarks[sectionId]
          const color = chipColorOf(sectionId)
          const byName = mark?.marked_by_name?.trim() ?? ''
          const markRelative = mark ? formatRelativeTime(mark.marked_at) : ''
          // Mark-less sections (per-user my-inbox) are never marked — neutral
          // chip instead of the freshness palette (permanently red would
          // misread as neglected).
          const isPersonalSection = QUICKFILL_PERSONAL_SECTIONS.has(sectionId)
          const lastMarkedTitle =
            sectionId === 'my-inbox'
              ? 'Personal section — items are completed individually'
              : mark
                ? `Last marked ${markRelative}${byName ? ` by ${byName}` : ''}`
                : 'Never marked'
          return (
            <button
              key={id}
              type="button"
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
              title={lastMarkedTitle}
              aria-label={`${label}: jump to section. ${lastMarkedTitle}`}
              style={{
                padding: narrowViewport ? '0.4rem 0.65rem' : '0.5rem 0.75rem',
                borderRadius: 6,
                background: isPersonalSection ? 'var(--surface)' : BUTTON_BG[color],
                border: `1px solid ${isPersonalSection ? 'var(--border-strong)' : BUTTON_BORDER[color]}`,
                cursor: 'pointer',
                fontSize: narrowViewport ? '0.8125rem' : '0.875rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {label}
              {mark ? (
                <span
                  aria-hidden="true"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)' }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                    }}
                  >
                    {markStampInitial(byName)}
                  </span>
                  {markStampTime(mark.marked_at, Date.now())}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {narrowViewport && freshnessLine ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '0.75rem' }}>{freshnessLine}</div>
      ) : null}
      {hasAnyVisibleSection && (
        <div style={{ position: 'relative', width: '100%', marginBottom: '1.5rem' }}>
          <input
            id="quickfill-section-search"
            type="search"
            placeholder="Search sections…"
            value={sectionSearch}
            onChange={(e) => setSectionSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSectionSearch('')
            }}
            aria-label="Search Quickfill sections"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem 2.25rem 0.5rem 0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              fontSize: '1rem',
            }}
          />
          {sectionSearch !== '' && (
            <button
              type="button"
              onClick={() => setSectionSearch('')}
              aria-label="Clear section search"
              style={{
                position: 'absolute',
                right: '0.375rem',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.125rem 0.5rem',
                border: 'none',
                background: 'none',
                color: 'var(--text-muted)',
                fontSize: '1rem',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
          {/* v2.2189: what the header count means, once, where every section's count is read. */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <b style={{ fontWeight: 600 }}>open</b> = items waiting on someone in the office · — = this section has no count
          </div>
        </div>
      )}
      {/* The search hides every section: quote it and offer Clear the search, as the box's ✕ does (punch list #184, sweep C). */}
      {noSectionsMatchSearch && <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'sections', query: sectionSearch }), { onPress: () => setSectionSearch('') })} />}
      {!hasAnyVisibleSection && (
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.9375rem',
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
          }}
        >
          {role === 'dev' ? (
            <>
              All Quickfill sections are hidden. Use <strong>Active sections (Dev Only)</strong> below to show one or more sections again.
            </>
          ) : (
            <>
              All Quickfill sections are hidden. Ask a developer to restore sections on Quickfill (<strong>Active sections (Dev Only)</strong>).
            </>
          )}
        </p>
      )}
      {/* Focus (punch list #147, v2.5778): the groups with work first and open, then each
          folded run under its heading — at zero (with its ✓), marked today, the doors. One
          flat keyed list under one provider, so a switch reorders the stations instead of
          remounting them (a remount reloads every station and flashes its count). */}
      <QuickfillFocusContext.Provider value={view === 'focus' ? focusBucketOf : null}>
        {view === 'focus' && hasAnyVisibleSection
          ? (() => {
              const g = focusGroups(searchedSections, focusBucketOf)
              const runs: Array<{ bucket: 'zero' | 'fresh' | 'door'; items: QuickfillSectionMeta[] }> = [
                { bucket: 'zero', items: g.zero },
                { bucket: 'fresh', items: g.fresh },
                { bucket: 'door', items: g.door },
              ]
              const out: ReactNode[] = [
                <p key="focus-headline" style={{ margin: '-0.75rem 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {focusHeadline(g)}
                </p>,
                ...g.open.map((meta, i) => <Fragment key={meta.sectionId}>{quickfillSectionBlock(meta, { first: i === 0 })}</Fragment>),
              ]
              for (const r of runs) {
                if (r.items.length === 0) continue
                out.push(
                  <p key={`focus-heading-${r.bucket}`} style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {focusHeading(r.bucket, r.items.length)}
                  </p>,
                )
                for (const meta of r.items) out.push(<Fragment key={meta.sectionId}>{quickfillSectionBlock(meta, { first: true })}</Fragment>)
              }
              return out
            })()
          : searchedSections.map((meta) => <Fragment key={meta.sectionId}>{quickfillSectionBlock(meta)}</Fragment>)}
      </QuickfillFocusContext.Provider>
      {role === 'dev' && (
      <div style={{ marginTop: '2rem' }}>
        <button
          type="button"
          onClick={() => setActiveSectionsPanelOpen((prev) => !prev)}
          aria-expanded={activeSectionsPanelOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            margin: 0,
            padding: '1rem',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{activeSectionsPanelOpen ? '▼' : '▶'}</span>
          Active sections (Dev Only)
        </button>
        {activeSectionsPanelOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Uncheck a section to hide it from this page and from the jump buttons above for everyone. Drag the handle to
              reorder sections for everyone. Optional per-section banners (amber callout) appear when a section is expanded.
              Settings are stored in the database.
            </p>
            <DndContext sensors={quickfillSectionDragSensors} onDragEnd={onQuickfillSectionDragEnd}>
              <SortableContext items={sectionOrderIds} strategy={verticalListSortingStrategy}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {orderedSections.map((meta) => (
                    <QuickfillDevSectionSortableRow
                      key={meta.sectionId}
                      meta={meta}
                      sectionVisible={isSectionVisible(meta.sectionId)}
                      onToggleVisible={devSetSectionVisible}
                      jobsBillingMinHcp={jobsBillingMinHcp}
                      onJobsBillingMinHcpChange={(n) => {
                        setJobsBillingMinHcp(n)
                        void persistJobsBillingMinHcp(n)
                      }}
                      bannerDraft={sectionBannerDrafts[meta.sectionId] ?? ''}
                      onBannerDraftChange={onBannerDraftChange}
                      onBannerCommit={onBannerCommit}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
      )}
        </>
      )}
        </>
      )}
      {rollerActive && rollerBoardOpen ? (
        <QuickfillBoard
          rows={rollerDeckRows}
          currentId={rollerMeta?.sectionId ?? null}
          questionOf={(id) => effectiveQuickfillSectionBanner(id, sectionBanners)}
          now={roundNow}
          onPick={(id) => {
            setRollerBoardOpen(false)
            rollerGo(id)
          }}
          onClose={() => setRollerBoardOpen(false)}
        />
      ) : null}
      <QuickfillSectionMarkHistoryModal
        open={markHistoryModal !== null}
        onClose={() => setMarkHistoryModal(null)}
        sectionId={markHistoryModal?.sectionId ?? null}
        sectionLabel={markHistoryModal?.label ?? null}
      />
      {authUser?.id && dispatchInboxEligible && (
        <DispatchDismissedItemsModal
          open={dispatchDismissedModalOpen}
          onClose={() => setDispatchDismissedModalOpen(false)}
          loadRows={fetchDismissedDispatchInboxRows}
        />
      )}
      {tripChargeTarget && (
        <CreateTripChargeModal
          target={tripChargeTarget}
          onClose={() => setTripChargeTarget(null)}
          onCreated={() => setTripChargeTarget(null)}
        />
      )}
    </div>
  )
}

function QuickfillSectionHistoryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1.1em" height="1.1em" fill="currentColor" aria-hidden="true">
      <path d="M128 128C128 110.3 113.7 96 96 96C78.3 96 64 110.3 64 128L64 464C64 508.2 99.8 544 144 544L544 544C561.7 544 576 529.7 576 512C576 494.3 561.7 480 544 480L144 480C135.2 480 128 472.8 128 464L128 128zM534.6 214.6C547.1 202.1 547.1 181.8 534.6 169.3C522.1 156.8 501.8 156.8 489.3 169.3L384 274.7L326.6 217.4C314.1 204.9 293.8 204.9 281.3 217.4L185.3 313.4C172.8 325.9 172.8 346.2 185.3 358.7C197.8 371.2 218.1 371.2 230.6 358.7L304 285.3L361.4 342.7C373.9 355.2 394.2 355.2 406.7 342.7L534.7 214.7z" />
    </svg>
  )
}

/**
 * The close's number ON the station (Tier-2 #18). A green daily mark says
 * "checked today"; this chip says what the week still owes, from the same
 * counts Moneyfill shows — so a marked-green Supply Houses with two uncovered
 * invoices for the close week no longer reads as "reviewed and done".
 * Non-money roles get the inert line; dev/controller get a link into
 * Moneyfill pinned to the week the chip quotes.
 */
function CloseWeekChip({ model, onOpen }: { model: CloseWeekChipModel | null | undefined; onOpen?: () => void }) {
  if (!model) return null
  const base: CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    padding: '0.1rem 0.55rem',
    borderRadius: 999,
    border: '1px solid var(--border)',
    lineHeight: 1.5,
    flexShrink: 0,
  }
  if (model.kind === 'inert') {
    return (
      <span title={model.title} style={{ ...base, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>
        {model.text}
      </span>
    )
  }
  const tone: CSSProperties =
    model.kind === 'open'
      ? { color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)' }
      : model.kind === 'clear'
        ? { color: 'var(--text-green-800)', background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)' }
        : { color: 'var(--text-muted)', background: 'var(--bg-subtle)' }
  return (
    <Link
      to={model.href}
      onClick={onOpen}
      title={model.title}
      aria-label={`${model.text} — open Moneyfill on this week`}
      style={{ ...base, ...tone, textDecoration: 'none' }}
    >
      {model.text}
    </Link>
  )
}

/** Exported for its render smoke (`Quickfill.focusFold.render.test.tsx`, v2.5830). */
export function QuickfillSectionWrapper({
  id,
  sectionId,
  label,
  withTopDivider,
  bannerText = null,
  collapsed,
  mark,
  omitDefaultMarkButton = false,
  showOutstandingInHeader = true,
  showMarkHistoryButton = true,
  showLastMarked = true,
  closeWeek = null,
  onCloseWeekOpen,
  onMarkUpToDate,
  onOpenNow,
  onOpenHistory,
  children,
}: {
  id: string
  sectionId: string
  label: string
  withTopDivider: boolean
  /** Amber callout above section body when expanded; omit or null to hide. */
  bannerText?: string | null
  /** The freshness palette; since v2.5837 the presses carry their own colours and the chips and the strip say the freshness, so the wrapper no longer reads it. */
  color: ButtonColor
  collapsed: boolean
  mark: { marked_at: string; marked_by?: string; marked_by_name?: string | null } | undefined
  omitDefaultMarkButton?: boolean
  /** When false, omit the “N open” / backlog column (e.g. Schedule uses a non-backlog metric). */
  showOutstandingInHeader?: boolean
  /** When false, omit the Mark history control. */
  showMarkHistoryButton?: boolean
  /** When false, omit the "Last marked:" header stamp (per-user sections are never marked). */
  showLastMarked?: boolean
  /** Close-week chip model for the money stations (Tier-2 #18); null/undefined = no chip. */
  closeWeek?: CloseWeekChipModel | null
  /** Telemetry hook for a live chip click (`week_close_opened`). */
  onCloseWeekOpen?: () => void
  /** The press (punch list #176, change 1): Done, Worked it or Not sure, with the words typed under Not sure. */
  onMarkUpToDate: (outcome: MarkOutcome, words: string) => void
  onOpenNow: () => void
  onOpenHistory: () => void
  children: ReactNode
}) {
  const metric = useQuickfillSectionMetric(sectionId)
  const { metrics: allMetrics } = useQuickfillSectionMetricsContext()
  // Counting (v2.5868): the station's reporter is still loading, or has not registered yet (its body mounts a beat after
  // the page). Either way the count is not in, so the presses wait rather than offer a Looked that saves no count.
  const counting = metric.loading || !(sectionId in allMetrics)
  const pressCount = counting ? null : metric.count
  const outstandingLabel = quickfillOutstandingLabel(metric)
  const narrow = useNarrowViewport640()
  // Inside a round screen (punch list #30, PR 3) the screen owns the title, the count and the
  // mark; the wrapper renders the body only. The id stays so the station deep link lands.
  const roundBodyOnly = useContext(QuickfillRoundScreenContext)
  // Focus (punch list #147, v2.5778): where the page put this station; null on the whole page.
  const focusFold = useContext(QuickfillFocusContext)?.(sectionId) ?? null
  if (roundBodyOnly) return <div id={id}>{children}</div>

  // The body has one place in both drawings below, the open station and Focus's fold: the
  // station's second child, a div the fold hides (v2.5830). Drawn anywhere else, React remounts
  // it on every fold, so a body that loads its own count loads again, reports loading, reopens,
  // reports 0 and folds again without end. That loop read prod about 600 times a second.
  const stationBody = (folded: boolean) => (
    <div style={folded ? { display: 'none' } : undefined} aria-hidden={folded || undefined}>
      {!folded && bannerText != null && bannerText.trim() !== '' ? (
        <QuickfillQuestion sectionId={sectionId} text={bannerText.trim()} style={QUICKFILL_SECTION_BANNER_BOX_STYLE} phone={narrow} />
      ) : null}
      {!folded && !metric.loading && metric.nextLine ? <QuickfillNextLine text={metric.nextLine} /> : null}
      {children}
      {!folded && !omitDefaultMarkButton ? (
        <div style={{ marginTop: '0.75rem', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
          <QuickfillMarkPresses count={pressCount} loading={counting} layout="foot" stationLabel={label} onPress={onMarkUpToDate} />
        </div>
      ) : null}
    </div>
  )

  // Focus: a station at zero, or a door with no mark, is one line — the marked strip's
  // layout in grey, with its ✓ Mark (so a clean day still gets stamped) and Open now.
  if (!narrow && !collapsed && (focusFold === 'zero' || focusFold === 'door')) {
    return (
      <div
        id={id}
        style={{
          marginBottom: '0.6rem',
          ...(withTopDivider ? { borderTop: '2px solid #94a3b8', paddingTop: '0.6rem' } : {}),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.3rem 0.75rem',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
          }}
        >
          <span aria-hidden>{focusFold === 'door' ? '›' : '○'}</span>
          <h2
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-700)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </h2>
          {focusFold === 'zero' && showOutstandingInHeader ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-600)', fontWeight: 600, whiteSpace: 'nowrap' }}>{outstandingLabel}</span>
          ) : null}
          {focusFold === 'door' ? (
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>no mark</span>
          ) : (
            <QuickfillLastMarkedDoor text={`Last marked: ${formatHeaderLastMarked(mark?.marked_at ?? null)}`} stationLabel={label} onOpen={showMarkHistoryButton ? onOpenHistory : null} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, ...(showMarkHistoryButton ? { color: 'var(--text-link)' } : {}) }} />
          )}
          <CloseWeekChip model={closeWeek} onOpen={onCloseWeekOpen} />
          <span style={{ flex: 1 }} />
          {focusFold === 'zero' && showMarkHistoryButton ? (
            <button
              type="button"
              onClick={onOpenHistory}
              title="Mark history"
              aria-label={`Mark history for ${label}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-slate-tint)',
                color: 'var(--text-slate-600)',
                cursor: 'pointer',
                lineHeight: 0,
                flexShrink: 0,
              }}
            >
              <QuickfillSectionHistoryIcon />
            </button>
          ) : null}
          {focusFold === 'zero' && !omitDefaultMarkButton ? (
            <QuickfillMarkPresses count={pressCount} loading={counting} layout="small" stationLabel={label} onPress={onMarkUpToDate} />
          ) : null}
          <button
            type="button"
            onClick={onOpenNow}
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-700)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Open now
          </button>
        </div>
        {/* The body stays mounted, hidden, where the open station draws it (`stationBody`).
            It costs nothing the whole page does not already pay, and Open now shows the body
            as it was. */}
        {stationBody(true)}
      </div>
    )
  }

  // Desktop: a marked-complete section shrinks to one slim strip (title + stamp +
  // controls) instead of the full header row plus banner. Narrow keeps the
  // wrapping two-row layout.
  if (collapsed && !narrow) {
    return (
      <div
        id={id}
        style={{
          marginBottom: '0.6rem',
          ...(withTopDivider ? { borderTop: '2px solid #94a3b8', paddingTop: '0.6rem' } : {}),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.3rem 0.75rem',
            background: 'var(--bg-green-tint)',
            border: '1px solid var(--border-green)',
            borderRadius: 6,
            fontSize: '0.8125rem',
            color: 'var(--text-green-800)',
          }}
        >
          <span aria-hidden>✓</span>
          <h2
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: 'var(--text-700)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </h2>
          {showOutstandingInHeader && !metric.loading && metric.count !== null && metric.count > 0 ? (
            metric.onOutstandingClick ? (
              <button
                type="button"
                onClick={() => metric.onOutstandingClick?.()}
                title="Show breakdown by day"
                aria-label={`Show pending approvals by day, ${metric.count} open`}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-blue-700)',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  whiteSpace: 'nowrap',
                }}
              >
                {outstandingLabel}
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-slate-600)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {outstandingLabel}
              </span>
            )
          ) : null}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Marked {mark ? formatTime(mark.marked_at) : ''}
            {mark?.marked_by_name ? ` by ${mark.marked_by_name}` : ''} · Reloads in{' '}
            {mark ? `${hoursUntilExpand(mark.marked_at)}h` : '12h'}
          </span>
          <CloseWeekChip model={closeWeek} onOpen={onCloseWeekOpen} />
          <span style={{ flex: 1 }} />
          {showMarkHistoryButton ? (
            <button
              type="button"
              onClick={onOpenHistory}
              title="Mark history"
              aria-label={`Mark history for ${label}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-slate-tint)',
                color: 'var(--text-slate-600)',
                cursor: 'pointer',
                lineHeight: 0,
                flexShrink: 0,
              }}
            >
              <QuickfillSectionHistoryIcon />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenNow}
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px solid #22c55e',
              color: 'var(--text-green-800)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Open now
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      id={id}
      style={{
        marginBottom: '2rem',
        ...(withTopDivider ? { borderTop: '2px solid #94a3b8', paddingTop: '1.5rem' } : {}),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.65rem 1rem',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ ...QUICKFILL_SECTION_TITLE_STYLE, margin: 0, flex: '1 1 auto', minWidth: '12rem' }}>{label}</h2>
        {showOutstandingInHeader ? (
          !metric.loading && metric.count !== null && metric.count > 0 && metric.onOutstandingClick ? (
            <button
              type="button"
              onClick={() => metric.onOutstandingClick?.()}
              title="Show breakdown by day"
              aria-label={`Show pending approvals by day, ${metric.count} open`}
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-blue-700)',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {outstandingLabel}
            </button>
          ) : (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-slate-600)', fontWeight: 500 }} title="Outstanding items (when tracked)">
              {outstandingLabel}
            </span>
          )
        ) : null}
        {showLastMarked ? (
          <QuickfillLastMarkedDoor text={`Last marked: ${formatHeaderLastMarked(mark?.marked_at ?? null)}`} stationLabel={label} onOpen={showMarkHistoryButton ? onOpenHistory : null} title="Last time this section was marked up to date" style={{ fontSize: '0.8125rem', color: showMarkHistoryButton ? 'var(--text-link)' : 'var(--text-slate-500)' }} />
        ) : null}
        <CloseWeekChip model={closeWeek} onOpen={onCloseWeekOpen} />
        {/* Header mark (v2.2184): the same action as the big button at the foot, reachable
            without scrolling a long section. Sections that ask for a note first
            (Email / Physical) keep their own button only; Texts marks here since v2.5816,
            its note written from its rows. */}
        {!omitDefaultMarkButton && !collapsed ? (
          <QuickfillMarkPresses count={pressCount} loading={counting} layout="small" stationLabel={label} onPress={onMarkUpToDate} />
        ) : null}
        {showMarkHistoryButton ? (
          <button
            type="button"
            onClick={onOpenHistory}
            title="Mark history"
            aria-label={`Mark history for ${label}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.35rem',
              borderRadius: 6,
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-slate-tint)',
              color: 'var(--text-slate-600)',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            <QuickfillSectionHistoryIcon />
          </button>
        ) : null}
      </div>
      {collapsed ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--bg-green-tint)',
            border: '1px solid var(--border-green)',
            borderRadius: 6,
            fontSize: '0.875rem',
            color: 'var(--text-green-800)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.6rem' }}>
            <span>
              Marked at {mark ? formatTime(mark.marked_at) : ''}{mark?.marked_by_name ? ` by ${mark.marked_by_name}` : ''}. Reloads in {mark ? `${hoursUntilExpand(mark.marked_at)}h` : '12h'}.
            </span>
            <CloseWeekChip model={closeWeek} onOpen={onCloseWeekOpen} />
          </span>
          <button
            type="button"
            onClick={onOpenNow}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 6,
              background: 'var(--surface)',
              border: '1px solid #22c55e',
              color: 'var(--text-green-800)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Open now
          </button>
        </div>
      ) : (
        stationBody(false)
      )}
    </div>
  )
}
