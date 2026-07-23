import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DashboardArBankUnallocatedBanner from '../components/DashboardArBankUnallocatedBanner'
import { SectionDock } from '../components/SectionDock'
import { markStampInitial, markStampTime } from '../lib/quickfillMarkStamp'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import DashboardTallyStaleStaffBanner from '../components/DashboardTallyStaleStaffBanner'
import { DashboardStaleTallyStaffFollowUpModal } from '../components/DashboardStaleTallyStaffFollowUpModal'
import { BilledAwaitingPaymentSection } from '../components/quickfill/BilledAwaitingPaymentSection'
import { CantReachSection } from '../components/quickfill/CantReachSection'
import { QuickfillMyInboxSection } from '../components/quickfill/QuickfillMyInboxSection'
import { CrewJobsSection } from '../components/quickfill/CrewJobsSection'
import { JobsBillingReminderSection } from '../components/quickfill/JobsBillingReminderSection'
import { QuickfillCompleteNoBillSection } from '../components/quickfill/QuickfillCompleteNoBillSection'
import { QuickfillStagesNoCustomerSection } from '../components/quickfill/QuickfillStagesNoCustomerSection'
import { QuickfillSectionMarkHistoryModal } from '../components/quickfill/QuickfillSectionMarkHistoryModal'
import { UnpricedFixturesSection } from '../components/quickfill/UnpricedFixturesSection'
import { SupplyHousesSection } from '../components/quickfill/SupplyHousesSection'
import { BankingSortingSnapshotSection } from '../components/quickfill/BankingSortingSnapshotSection'
import { HoursSection } from '../components/quickfill/HoursSection'
import { QuickfillPeopleHoursNewSection } from '../components/quickfill/QuickfillPeopleHoursNewSection'
import { QuickfillUnassignedFieldTimeSection } from '../components/quickfill/QuickfillUnassignedFieldTimeSection'
import { QuickfillDifficultPeopleSection } from '../components/quickfill/QuickfillDifficultPeopleSection'
import { QuickfillEmailInboxSection } from '../components/quickfill/QuickfillEmailInboxSection'
import { QuickfillTextsSection } from '../components/quickfill/QuickfillTextsSection'
import { QuickfillPhysicalInboxSection } from '../components/quickfill/QuickfillPhysicalInboxSection'
import { QuickfillOfficeSection } from '../components/quickfill/QuickfillOfficeSection'
import { QuickfillScheduleSection } from '../components/quickfill/QuickfillScheduleSection'
import { QuickfillTomorrowsScheduleSection } from '../components/quickfill/QuickfillTomorrowsScheduleSection'
import { QuickfillProspectsSection } from '../components/quickfill/QuickfillProspectsSection'
import { DispatchInboxSection } from '../components/DispatchInboxSection'
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
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useDispatchInbox } from '../hooks/useDispatchInbox'
import { useQuickfillCantReachProspects } from '../hooks/useQuickfillCantReachProspects'
import { useQuickfillCompleteNoBillJobs } from '../hooks/useQuickfillCompleteNoBillJobs'
import { matchesQuickfillSectionSearch } from '../lib/quickfillSectionSearch'
import { useQuickfillStagesJobsWithoutCustomer } from '../hooks/useQuickfillStagesJobsWithoutCustomer'
import { useUnpricedFixturesCount } from '../hooks/useUnpricedFixturesCount'
import {
  canRoleSeeArBankUnallocatedOrgNudge,
  useArBankUnallocatedCount,
} from '../hooks/useArBankUnallocatedCount'
import { useStaleTallyStaffFollowUp } from '../hooks/useStaleTallyStaffFollowUp'
import { TALLY_STALE_MIN_AGE_DAYS } from '../lib/tallyStaleMinAgeDays'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { withSupabaseRetry } from '../utils/errorHandling'
import { QUICKFILL_SECTION_BANNER_BOX_STYLE } from '../lib/quickfillSectionBannerStyle'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES as CAN_USE_SCHEDULE_DISPATCH_FOR_QUICKFILL_SCHEDULE } from '../lib/scheduleDispatchEditRoles'

const SECTIONS: { id: string; sectionId: string; label: string }[] = [
  { id: 'quickfill-warnings', sectionId: 'warnings', label: 'Warnings' },
  { id: 'quickfill-office-arriving', sectionId: 'office-arriving', label: 'Office Arriving' },
  { id: 'quickfill-my-inbox', sectionId: 'my-inbox', label: 'My Inbox' },
  { id: 'quickfill-hours', sectionId: 'hours', label: 'People Hours (Old)' },
  { id: 'quickfill-people-hours-new', sectionId: 'people-hours-new', label: 'People Hours (new)' },
  {
    id: 'quickfill-unassigned-field-time',
    sectionId: 'unassigned-field-time',
    label: 'Unassigned field time',
  },
  { id: 'quickfill-difficult-people', sectionId: 'difficult-people', label: 'Difficult people' },
  { id: 'quickfill-banking-sorting', sectionId: 'banking-sorting', label: 'Banking sorting' },
  { id: 'quickfill-crew-jobs', sectionId: 'crew-jobs', label: 'Crew Jobs / Bids' },
  { id: 'quickfill-billed-awaiting', sectionId: 'billed-awaiting', label: 'Billing Awaiting Payments' },
  { id: 'quickfill-unpriced-fixtures', sectionId: 'unpriced-fixtures', label: 'Unpriced Fixtures' },
  { id: 'quickfill-cant-reach', sectionId: 'cant-reach', label: 'Unreachable Prospects' },
  { id: 'quickfill-prospects', sectionId: 'prospects', label: 'Prospects' },
  { id: 'quickfill-supply-houses', sectionId: 'supply-houses', label: 'Supply Houses' },
  { id: 'quickfill-jobs-billing', sectionId: 'jobs-billing', label: 'Jobs Billing' },
  { id: 'quickfill-complete-no-bill', sectionId: 'complete-no-bill', label: 'Complete, no Total Bill' },
  { id: 'quickfill-no-customer-stages', sectionId: 'no-customer-stages', label: 'Stages: customer link & customer pictures' },
  { id: 'quickfill-dispatch-inbox', sectionId: 'dispatch-inbox', label: 'Dispatch inbox' },
  { id: 'quickfill-schedule', sectionId: 'schedule', label: 'Schedule' },
  {
    id: 'quickfill-tomorrow-schedule',
    sectionId: 'tomorrow-schedule',
    label: "Tomorrow's Schedule (Dispatch hub)",
  },
  { id: 'quickfill-email-inbox', sectionId: 'email-inbox', label: 'Email Inbox' },
  { id: 'quickfill-email-next-actions', sectionId: 'email-next-actions', label: 'Email: Next Actions' },
  { id: 'quickfill-email-follow-up', sectionId: 'email-follow-up', label: 'Email: Follow Up' },
  { id: 'quickfill-texts', sectionId: 'texts', label: 'Texts' },
  { id: 'quickfill-physical-inbox', sectionId: 'physical-inbox', label: 'Physical inbox' },
  { id: 'quickfill-office-leaving', sectionId: 'office-leaving', label: 'Office Leaving' },
]

const APP_SETTINGS_KEY_QUICKFILL_HIDDEN = 'quickfill_hidden_section_ids'
const APP_SETTINGS_KEY_QUICKFILL_MIN_HCP = 'quickfill_jobs_billing_min_hcp'
const APP_SETTINGS_KEY_QUICKFILL_SECTION_ORDER = 'quickfill_section_order'
const APP_SETTINGS_KEY_QUICKFILL_SECTION_BANNERS = 'quickfill_section_banners'
const QUICKFILL_SECTION_BANNER_MAX_CHARS = 800
const SCHEDULE_SECTION_DEFAULT_BANNER = 'Are there any obvious schedule conflicts?'
const TOMORROW_SCHEDULE_SECTION_DEFAULT_BANNER = 'Who is on what job tomorrow?'
const DEFAULT_JOBS_BILLING_MIN_HCP = 406

const DEFAULT_SECTION_ORDER_IDS = SECTIONS.map((s) => s.sectionId)

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
      if (!seen.has(id)) out.push(id)
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

/** Stored custom banner only; schedule falls back in `effectiveQuickfillSectionBanner`. */
function effectiveQuickfillSectionBanner(sectionId: string, banners: Record<string, string>): string | null {
  const custom = banners[sectionId]?.trim()
  if (custom) return custom.length > QUICKFILL_SECTION_BANNER_MAX_CHARS ? custom.slice(0, QUICKFILL_SECTION_BANNER_MAX_CHARS) : custom
  if (sectionId === 'schedule') return SCHEDULE_SECTION_DEFAULT_BANNER
  if (sectionId === 'tomorrow-schedule') return TOMORROW_SCHEDULE_SECTION_DEFAULT_BANNER
  return null
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

function QuickfillMetricReporter({
  sectionId,
  count,
  loading,
}: {
  sectionId: string
  count: number | null
  loading: boolean
}) {
  useReportQuickfillSectionMetric(sectionId, count, loading)
  return null
}

type QuickfillSectionMeta = (typeof SECTIONS)[number]

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
          placeholder={
            meta.sectionId === 'schedule'
              ? `Default: ${SCHEDULE_SECTION_DEFAULT_BANNER}`
              : meta.sectionId === 'tomorrow-schedule'
                ? `Default: ${TOMORROW_SCHEDULE_SECTION_DEFAULT_BANNER}`
                : 'Shown at top of section when expanded'
          }
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
  const navigate = useNavigate()
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const { showToast } = useToastContext()
  const {
    dispatchInboxEligible,
    dispatchRequests,
    dispatchRequestsLoading,
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
  } = useDispatchInbox()
  const jobFormModal = useJobFormModal()
  const { getOutstandingCount } = useQuickfillSectionMetricsContext()
  const unpricedFixturesCount = useUnpricedFixturesCount()
  const quickfillNoCustomerStages = useQuickfillStagesJobsWithoutCustomer()
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
  )
  const {
    peopleCount: staleTallyStaffPeopleCount,
    transactionCount: staleTallyStaffTxCount,
    refetch: refetchStaleTallyStaffFollowUp,
  } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)
  const arBankCountEnabled = Boolean(authUser?.id) && canRoleSeeArBankUnallocatedOrgNudge(role)
  const { count: arBankUnallocatedCount } = useArBankUnallocatedCount({
    enabled: arBankCountEnabled,
    authUserId: authUser?.id,
    authRole: role,
  })
  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const [sectionMarks, setSectionMarks] = useState<Record<string, { marked_at: string; marked_by?: string; marked_by_name?: string | null }>>({})
  const [forceExpandedSections, setForceExpandedSections] = useState<Set<string>>(new Set(['cant-reach']))
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
      if (sectionId === 'no-customer-stages') return quickfillNoCustomerStages.fetchEnabled
      if (sectionId === 'complete-no-bill') return quickfillCompleteNoBill.fetchEnabled
      if (sectionId === 'dispatch-inbox') return dispatchInboxEligible
      if (sectionId === 'schedule' || sectionId === 'tomorrow-schedule') {
        return role != null && CAN_USE_SCHEDULE_DISPATCH_FOR_QUICKFILL_SCHEDULE.has(role)
      }
      if (sectionId === 'prospects') return canAccessProspects
      if (sectionId === 'difficult-people') {
        return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
      }
      if (sectionId === 'unassigned-field-time') {
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

  async function markSectionUpToDate(sectionId: string, options?: { noteText?: string | null }) {
    const markedAt = new Date().toISOString()
    const outstanding_count = getOutstandingCount(sectionId)
    let note_text: string | null = null
    if (options?.noteText != null && options.noteText !== '') {
      const t = options.noteText.trim()
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
          }),
        'insert quickfill section mark event',
      )
    } catch {
      showToast('Marked up to date, but saving history failed. Try again or contact support.', 'warning')
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

  function quickfillSectionBlock(meta: QuickfillSectionMeta): ReactNode {
    const { id, sectionId, label } = meta
    const withTopDivider = firstVisibleSectionId !== null && firstVisibleSectionId !== sectionId
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
            color={getButtonColor(sectionMarks['warnings']?.marked_at ?? null)}
            collapsed={isCollapsed('warnings') && !forceExpandedSections.has('warnings')}
            mark={sectionMarks['warnings']}
            onMarkUpToDate={() => markSectionUpToDate('warnings')}
            onOpenNow={() => openSectionNow('warnings')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'warnings', label: 'Warnings' })}
          >
            <QuickfillMetricReporter
              sectionId="ar-bank-unallocated"
              count={arBankCountEnabled ? arBankUnallocatedCount : null}
              loading={arBankCountEnabled && arBankUnallocatedCount === null}
            />
            <QuickfillMetricReporter
              sectionId="warnings"
              count={typeof staleTallyStaffTxCount === 'number' ? staleTallyStaffTxCount : null}
              loading={staleTallyStaffTxCount === null}
            />
            {arBankCountEnabled && (
              <DashboardArBankUnallocatedBanner
                count={arBankUnallocatedCount ?? 0}
                loading={arBankUnallocatedCount === null}
                onGoToAr={() => {
                  showToast('Opening Accounts Receivable…', 'info', 2800)
                  navigate('/accounts-receivable')
                }}
              />
            )}
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
            color={getButtonColor(sectionMarks['office-arriving']?.marked_at ?? null)}
            collapsed={isCollapsed('office-arriving') && !forceExpandedSections.has('office-arriving')}
            mark={sectionMarks['office-arriving']}
            onMarkUpToDate={() => void markSectionUpToDate('office-arriving')}
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
            color={getButtonColor(sectionMarks['office-leaving']?.marked_at ?? null)}
            collapsed={isCollapsed('office-leaving') && !forceExpandedSections.has('office-leaving')}
            mark={sectionMarks['office-leaving']}
            onMarkUpToDate={() => void markSectionUpToDate('office-leaving')}
            onOpenNow={() => openSectionNow('office-leaving')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'office-leaving', label: 'Office Leaving' })}
          >
            <QuickfillOfficeSection variant="leaving" />
          </QuickfillSectionWrapper>
        )
      case 'hours':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['hours']?.marked_at ?? null)}
            collapsed={isCollapsed('hours') && !forceExpandedSections.has('hours')}
            mark={sectionMarks['hours']}
            onMarkUpToDate={() => markSectionUpToDate('hours')}
            onOpenNow={() => openSectionNow('hours')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'hours', label: 'People Hours (Old)' })}
          >
            <HoursSection />
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
            color={getButtonColor(sectionMarks['people-hours-new']?.marked_at ?? null)}
            collapsed={isCollapsed('people-hours-new') && !forceExpandedSections.has('people-hours-new')}
            mark={sectionMarks['people-hours-new']}
            onMarkUpToDate={() => markSectionUpToDate('people-hours-new')}
            onOpenNow={() => openSectionNow('people-hours-new')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'people-hours-new', label: 'People Hours (new)' })}
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
            color={getButtonColor(sectionMarks['unassigned-field-time']?.marked_at ?? null)}
            collapsed={
              isCollapsed('unassigned-field-time') &&
              !forceExpandedSections.has('unassigned-field-time')
            }
            mark={sectionMarks['unassigned-field-time']}
            onMarkUpToDate={() => markSectionUpToDate('unassigned-field-time')}
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
      case 'difficult-people':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['difficult-people']?.marked_at ?? null)}
            collapsed={isCollapsed('difficult-people') && !forceExpandedSections.has('difficult-people')}
            mark={sectionMarks['difficult-people']}
            onMarkUpToDate={() => void markSectionUpToDate('difficult-people')}
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
            color={getButtonColor(sectionMarks['banking-sorting']?.marked_at ?? null)}
            collapsed={isCollapsed('banking-sorting') && !forceExpandedSections.has('banking-sorting')}
            mark={sectionMarks['banking-sorting']}
            onMarkUpToDate={() => markSectionUpToDate('banking-sorting')}
            onOpenNow={() => openSectionNow('banking-sorting')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'banking-sorting', label: 'Banking sorting' })}
          >
            <BankingSortingSnapshotSection />
          </QuickfillSectionWrapper>
        )
      case 'crew-jobs':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['crew-jobs']?.marked_at ?? null)}
            collapsed={isCollapsed('crew-jobs') && !forceExpandedSections.has('crew-jobs')}
            mark={sectionMarks['crew-jobs']}
            onMarkUpToDate={() => markSectionUpToDate('crew-jobs')}
            onOpenNow={() => openSectionNow('crew-jobs')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'crew-jobs', label: 'Crew Jobs / Bids' })}
          >
            <CrewJobsSection />
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
            color={getButtonColor(sectionMarks['billed-awaiting']?.marked_at ?? null)}
            collapsed={isCollapsed('billed-awaiting') && !forceExpandedSections.has('billed-awaiting')}
            mark={sectionMarks['billed-awaiting']}
            onMarkUpToDate={() => markSectionUpToDate('billed-awaiting')}
            onOpenNow={() => openSectionNow('billed-awaiting')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'billed-awaiting', label: 'Billing Awaiting Payments' })}
          >
            <BilledAwaitingPaymentSection />
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
            color={getButtonColor(sectionMarks['unpriced-fixtures']?.marked_at ?? null)}
            collapsed={isCollapsed('unpriced-fixtures') && !forceExpandedSections.has('unpriced-fixtures')}
            mark={sectionMarks['unpriced-fixtures']}
            onMarkUpToDate={() => markSectionUpToDate('unpriced-fixtures')}
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
            color={getButtonColor(sectionMarks['cant-reach']?.marked_at ?? null)}
            collapsed={isCollapsed('cant-reach') && !forceExpandedSections.has('cant-reach')}
            mark={sectionMarks['cant-reach']}
            onMarkUpToDate={() => markSectionUpToDate('cant-reach')}
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
            color={getButtonColor(sectionMarks['prospects']?.marked_at ?? null)}
            collapsed={isCollapsed('prospects') && !forceExpandedSections.has('prospects')}
            mark={sectionMarks['prospects']}
            onMarkUpToDate={() => void markSectionUpToDate('prospects')}
            onOpenNow={() => openSectionNow('prospects')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'prospects', label: 'Prospects' })}
          >
            <QuickfillProspectsSection />
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
            color={getButtonColor(sectionMarks['supply-houses']?.marked_at ?? null)}
            collapsed={isCollapsed('supply-houses') && !forceExpandedSections.has('supply-houses')}
            mark={sectionMarks['supply-houses']}
            onMarkUpToDate={() => markSectionUpToDate('supply-houses')}
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
            color={getButtonColor(sectionMarks['jobs-billing']?.marked_at ?? null)}
            collapsed={isCollapsed('jobs-billing') && !forceExpandedSections.has('jobs-billing')}
            mark={sectionMarks['jobs-billing']}
            onMarkUpToDate={() => markSectionUpToDate('jobs-billing')}
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
            color={getButtonColor(sectionMarks['complete-no-bill']?.marked_at ?? null)}
            collapsed={isCollapsed('complete-no-bill') && !forceExpandedSections.has('complete-no-bill')}
            mark={sectionMarks['complete-no-bill']}
            onMarkUpToDate={() => void markSectionUpToDate('complete-no-bill')}
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
      case 'no-customer-stages':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['no-customer-stages']?.marked_at ?? null)}
            collapsed={isCollapsed('no-customer-stages') && !forceExpandedSections.has('no-customer-stages')}
            mark={sectionMarks['no-customer-stages']}
            onMarkUpToDate={() => void markSectionUpToDate('no-customer-stages')}
            onOpenNow={() => openSectionNow('no-customer-stages')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'no-customer-stages', label: 'Stages: customer link & customer pictures' })
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
      case 'dispatch-inbox':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['dispatch-inbox']?.marked_at ?? null)}
            collapsed={isCollapsed('dispatch-inbox') && !forceExpandedSections.has('dispatch-inbox')}
            mark={sectionMarks['dispatch-inbox']}
            onMarkUpToDate={() => void markSectionUpToDate('dispatch-inbox')}
            onOpenNow={() => openSectionNow('dispatch-inbox')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'dispatch-inbox', label: 'Dispatch inbox' })}
          >
            <QuickfillMetricReporter
              sectionId="dispatch-inbox"
              count={
                dispatchRequestsLoading
                  ? null
                  : dispatchRequests.filter((r) => r.status === 'open').length
              }
              loading={dispatchRequestsLoading}
            />
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
            />
          </QuickfillSectionWrapper>
        )
      case 'schedule':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['schedule']?.marked_at ?? null)}
            collapsed={isCollapsed('schedule') && !forceExpandedSections.has('schedule')}
            mark={sectionMarks['schedule']}
            onMarkUpToDate={() => void markSectionUpToDate('schedule')}
            onOpenNow={() => openSectionNow('schedule')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'schedule', label: 'Schedule' })}
            showOutstandingInHeader={false}
            showMarkHistoryButton={false}
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
            color={getButtonColor(sectionMarks['tomorrow-schedule']?.marked_at ?? null)}
            collapsed={isCollapsed('tomorrow-schedule') && !forceExpandedSections.has('tomorrow-schedule')}
            mark={sectionMarks['tomorrow-schedule']}
            onMarkUpToDate={() => void markSectionUpToDate('tomorrow-schedule')}
            onOpenNow={() => openSectionNow('tomorrow-schedule')}
            onOpenHistory={() =>
              setMarkHistoryModal({ sectionId: 'tomorrow-schedule', label: "Tomorrow's Schedule" })
            }
            showOutstandingInHeader={false}
            showMarkHistoryButton={false}
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
            color={getButtonColor(sectionMarks['email-inbox']?.marked_at ?? null)}
            collapsed={isCollapsed('email-inbox') && !forceExpandedSections.has('email-inbox')}
            mark={sectionMarks['email-inbox']}
            omitDefaultMarkButton
            onMarkUpToDate={() => undefined}
            onOpenNow={() => openSectionNow('email-inbox')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'email-inbox', label: 'Email Inbox' })}
          >
            <QuickfillEmailInboxSection
              metricSectionId="email-inbox"
              markButtonPalette={{
                bg: BUTTON_BG[getButtonColor(sectionMarks['email-inbox']?.marked_at ?? null)],
                border: BUTTON_BORDER[getButtonColor(sectionMarks['email-inbox']?.marked_at ?? null)],
              }}
              onConfirmMark={(note) => void markSectionUpToDate('email-inbox', { noteText: note })}
            />
          </QuickfillSectionWrapper>
        )
      case 'email-next-actions':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['email-next-actions']?.marked_at ?? null)}
            collapsed={isCollapsed('email-next-actions') && !forceExpandedSections.has('email-next-actions')}
            mark={sectionMarks['email-next-actions']}
            omitDefaultMarkButton
            onMarkUpToDate={() => undefined}
            onOpenNow={() => openSectionNow('email-next-actions')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'email-next-actions', label: 'Email: Next Actions' })}
          >
            <QuickfillEmailInboxSection
              metricSectionId="email-next-actions"
              fieldLabel="Still in Next Actions"
              description=" - Before marking complete, list what is still in Next Actions (one item per line or free text)."
              markButtonLabel="Mark Next Actions up to date!"
              emptyNoteToast="List what is still in Next Actions before marking complete."
              markButtonPalette={{
                bg: BUTTON_BG[getButtonColor(sectionMarks['email-next-actions']?.marked_at ?? null)],
                border: BUTTON_BORDER[getButtonColor(sectionMarks['email-next-actions']?.marked_at ?? null)],
              }}
              onConfirmMark={(note) => void markSectionUpToDate('email-next-actions', { noteText: note })}
            />
          </QuickfillSectionWrapper>
        )
      case 'email-follow-up':
        return (
          <QuickfillSectionWrapper
            id={id}
            sectionId={sectionId}
            label={label}
            bannerText={bannerText}
            withTopDivider={withTopDivider}
            color={getButtonColor(sectionMarks['email-follow-up']?.marked_at ?? null)}
            collapsed={isCollapsed('email-follow-up') && !forceExpandedSections.has('email-follow-up')}
            mark={sectionMarks['email-follow-up']}
            omitDefaultMarkButton
            onMarkUpToDate={() => undefined}
            onOpenNow={() => openSectionNow('email-follow-up')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'email-follow-up', label: 'Email: Follow Up' })}
          >
            <QuickfillEmailInboxSection
              metricSectionId="email-follow-up"
              fieldLabel="Still in Follow Up"
              description=" - Before marking complete, list what is still in Follow Up (one item per line or free text)."
              markButtonLabel="Mark Follow Up up to date!"
              emptyNoteToast="List what is still in Follow Up before marking complete."
              markButtonPalette={{
                bg: BUTTON_BG[getButtonColor(sectionMarks['email-follow-up']?.marked_at ?? null)],
                border: BUTTON_BORDER[getButtonColor(sectionMarks['email-follow-up']?.marked_at ?? null)],
              }}
              onConfirmMark={(note) => void markSectionUpToDate('email-follow-up', { noteText: note })}
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
            color={getButtonColor(sectionMarks['texts']?.marked_at ?? null)}
            collapsed={isCollapsed('texts') && !forceExpandedSections.has('texts')}
            mark={sectionMarks['texts']}
            omitDefaultMarkButton
            onMarkUpToDate={() => undefined}
            onOpenNow={() => openSectionNow('texts')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'texts', label: 'Texts' })}
          >
            <QuickfillTextsSection
              markButtonPalette={{
                bg: BUTTON_BG[getButtonColor(sectionMarks['texts']?.marked_at ?? null)],
                border: BUTTON_BORDER[getButtonColor(sectionMarks['texts']?.marked_at ?? null)],
              }}
              onConfirmMark={(note) => void markSectionUpToDate('texts', { noteText: note })}
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
            color={getButtonColor(sectionMarks['physical-inbox']?.marked_at ?? null)}
            collapsed={isCollapsed('physical-inbox') && !forceExpandedSections.has('physical-inbox')}
            mark={sectionMarks['physical-inbox']}
            omitDefaultMarkButton
            onMarkUpToDate={() => undefined}
            onOpenNow={() => openSectionNow('physical-inbox')}
            onOpenHistory={() => setMarkHistoryModal({ sectionId: 'physical-inbox', label: 'Physical inbox' })}
          >
            <QuickfillPhysicalInboxSection
              markButtonPalette={{
                bg: BUTTON_BG[getButtonColor(sectionMarks['physical-inbox']?.marked_at ?? null)],
                border: BUTTON_BORDER[getButtonColor(sectionMarks['physical-inbox']?.marked_at ?? null)],
              }}
              onConfirmMark={(note) => void markSectionUpToDate('physical-inbox', { noteText: note })}
            />
          </QuickfillSectionWrapper>
        )
      default:
        return null
    }
  }

  const dockSections = searchedSections
    .filter(({ sectionId }) => !dockHiddenThisVisit.has(sectionId))
    .map(({ id, label }) => ({ id, label }))

  return (
    <div style={{ padding: '1.5rem', paddingBottom: dockSections.length > 1 ? '4.5rem' : '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      {dockSections.length > 1 ? <SectionDock sections={dockSections} ariaLabel="Quickfill sections" /> : null}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>Quickfill</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
        {orderedSections.filter(({ sectionId }) => sectionWouldRenderOnPage(sectionId)).map(({ id, sectionId, label }) => {
          const mark = sectionMarks[sectionId]
          const color = getButtonColor(mark?.marked_at ?? null)
          const byName = mark?.marked_by_name?.trim() ?? ''
          const markRelative = mark ? formatRelativeTime(mark.marked_at) : ''
          // Per-user sections are never marked — neutral chip instead of the
          // freshness palette (permanently red would misread as neglected).
          const isPersonalSection = sectionId === 'my-inbox'
          const lastMarkedTitle = isPersonalSection
            ? 'Personal section — items are completed individually'
            : mark
              ? `Last marked ${markRelative}${byName ? ` by ${byName}` : ''}`
              : 'Never marked'
          return (
            <div key={id} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
                title={lastMarkedTitle}
                aria-label={`${label}: jump to section. ${lastMarkedTitle}`}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  background: isPersonalSection ? 'var(--surface)' : BUTTON_BG[color],
                  border: `1px solid ${isPersonalSection ? 'var(--border-strong)' : BUTTON_BORDER[color]}`,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {label}
              </button>
              {mark ? (
                // Compact who+when stamp floating over the button's corner; hover title carries the full text.
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: -8,
                    right: -6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '1px 6px 1px 1px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 999,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                    whiteSpace: 'nowrap',
                  }}
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
            </div>
          )
        })}
      </div>
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
        </div>
      )}
      {noSectionsMatchSearch && (
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
          No sections match your search.
        </p>
      )}
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
      {searchedSections.map((meta) => (
        <Fragment key={meta.sectionId}>{quickfillSectionBlock(meta)}</Fragment>
      ))}
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

function QuickfillSectionWrapper({
  id,
  sectionId,
  label,
  withTopDivider,
  bannerText = null,
  color,
  collapsed,
  mark,
  omitDefaultMarkButton = false,
  showOutstandingInHeader = true,
  showMarkHistoryButton = true,
  showLastMarked = true,
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
  onMarkUpToDate: () => void
  onOpenNow: () => void
  onOpenHistory: () => void
  children: ReactNode
}) {
  const metric = useQuickfillSectionMetric(sectionId)
  const outstandingLabel = metric.loading ? '…' : metric.count !== null ? `${metric.count} open` : '—'
  const narrow = useNarrowViewport640()

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
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-slate-500)' }} title="Last time this section was marked up to date">
            Last marked: {formatHeaderLastMarked(mark?.marked_at ?? null)}
          </span>
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
          <span>
            Marked at {mark ? formatTime(mark.marked_at) : ''}{mark?.marked_by_name ? ` by ${mark.marked_by_name}` : ''}. Reloads in {mark ? `${hoursUntilExpand(mark.marked_at)}h` : '12h'}.
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
        <>
          {bannerText != null && bannerText.trim() !== '' ? (
            <div role="note" style={QUICKFILL_SECTION_BANNER_BOX_STYLE}>
              {bannerText.trim()}
            </div>
          ) : null}
          {children}
          {!omitDefaultMarkButton && (
            <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={onMarkUpToDate}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  background: BUTTON_BG[color],
                  border: `1px solid ${BUTTON_BORDER[color]}`,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Mark {label} up to date!
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
