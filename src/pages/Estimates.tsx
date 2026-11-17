import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { canOpenBillingNotifications } from '../lib/jobs/stagesRoleGates'
import { defaultEstimateTitle, shouldReplaceTitleOnCustomerChange } from '../lib/estimates/estimateTitle'
import { pickBidRoomForChangeOrder } from '../lib/estimates/changeOrderRoomPick'
import { EstimateLineItemCatalogModal } from '../components/estimates/EstimateLineItemCatalogModal'
import { estDangerOutlineButton, estInputBase, estInputBlock, estPrimaryButton, estSecondaryButton, estSendButton, estSmallSecondaryButton } from '../components/estimates/estimatesPageStyles'
import { EstimateChangeOrderChip, EstimateLegacyChangeOrderTitleChip } from '../components/estimates/EstimateKindChips'
import { ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS, EstimateListCards, EstimateListTable, type EstimateListStagesThread } from '../components/estimates/EstimateListTable'
import { estimateDeclinedRowLabel, estimateListRowMatchesSearch, estimateStatusLabel as statusLabel, formatEstimateMoney as formatMoney, type EstimateListCustomerEvent, type EstimateListRow } from '../lib/estimates/estimateListRows'
import {
  catalogEntryToLineItem,
  coerceDraftQuantity,
  defaultDraftFirstLine,
  draftUnitPriceInputCents,
  emptyDraftLine,
  isDefaultDraftStubShape,
  isReplaceableStubLine,
  patchDraftLine,
} from '../lib/estimates/estimateDraftLines'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  PREVIEW_EMAIL_ACCEPT_URL,
  normalizeCustomerAcceptUrlCandidate,
  readStoredEstimateAcceptUrl,
  storeEstimateAcceptUrl,
} from '../lib/estimates/estimateAcceptUrlSession'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import type { UserRole } from '../hooks/useAuth'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { resolveEstimateMasterUserId as resolveMasterUserId } from '../lib/estimateMasterUser'
import { EstimateFieldPhotosStrip } from '../components/estimates/EstimateFieldPhotosStrip'
import { EstimateFirstLookStrip } from '../components/firstLook/EstimateFirstLookStrip'
import { formatSignedCentsUsd, isChangeOrderDocKind, isLegacyChangeOrderTitledEstimate } from '../lib/estimateChangeOrder'
import { bridgedCostImpactText } from '../lib/bidDocuments/changeOrderBridge'
import { CO_CREDIT_LABEL_PREFIX, isCoCreditLine, type CoCostPromptMode } from '../lib/coCostLinePrompt'
import { computeEstimateDraftSteps, type EstimateDraftStepKey } from '../lib/estimateDraftSteps'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { countMeaningfulEstimateLines, computeLedgerTotals, ledgerRowPasses, type LedgerKindFilter, isEmptyEstimateDraft, splitFollowupRows } from '../lib/estimatePipelineRefresh'
import { estimateOpenState, groupEventsByEstimateId, type EstimateOpenState } from '../lib/estimateOpenState'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { withEstimatePreviewMarker } from '../lib/estimateViewPreview'
import { estimatePaperModel } from '../lib/estimates/estimatePaper'
import { estimatePaperPdfBlob, loadEstimateBrandLogo } from '../lib/estimates/estimatePaperPdf'
import { estimateTermsPageHref } from '../lib/estimateTermsPageHref'
import { goodThroughState } from '../lib/estimates/estimateGoodThroughExtend'
import { EXTEND_GOOD_THROUGH_HASH } from '../lib/estimates/estimateGoodThroughChip'
import EstimateDraftStepRail from '../components/estimates/EstimateDraftStepRail'
import { useToastContext } from '../contexts/ToastContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import CustomerSearchCombobox from '../components/customers/CustomerSearchCombobox'
import NewCustomerForm from '../components/NewCustomerForm'
import { filterActiveCustomersForPicker } from '../lib/customerArchive'
import { CustomerNotesTable } from '../components/customerNotes/CustomerNotesTable'
import { useCustomerContactsForCustomer } from '../hooks/useCustomerContactsForCustomer'
import {
  extractContactFromCustomer,
  getCustomerDisplay,
  type CustomerRow,
} from '../lib/customerContactDisplay'
import AutosizeTextarea from '../components/AutosizeTextarea'
import EstimateAcceptBody from '../components/estimates/EstimateAcceptBody'
import CustomerAcceptanceRecordModal from '../components/estimates/CustomerAcceptanceRecordModal'
import EstimateAcceptedNotifySettingsModal from '../components/estimates/EstimateAcceptedNotifySettingsModal'
import { EmptyState } from '../components/EmptyState'
import { estimateLaneEmptyWords, estimatesLedgerEmptyWords, estimatesListEmptyWords, estimatesSearchEmptyWords } from '../lib/estimates/estimatesEmptyWords'
import {
  type EstimateCustomerExperienceResolved,
  mergeEstimateExperienceStrings,
  parseEstimateCustomerExperienceSnapshot,
  resolveEstimateCustomerExperience,
} from '../lib/estimateCustomerExperience'
import type { EstimateCatalogLineItem } from '../lib/estimateLineItemCatalog'
import CreateJobFromEstimateModal, {
  type LinkedCustomerPrefill,
} from '../components/estimates/CreateJobFromEstimateModal'
import { CustomerSnapshotModal } from '../components/customers/CustomerSnapshotModal'
import { AcceptHeaderBrandPicker } from '../components/estimates/AcceptHeaderBrandPicker'
import EstimateCustomerAttachmentCard from '../components/estimates/EstimateCustomerAttachmentCard'
import { EstimateLineItemsTable } from '../components/estimates/EstimateCustomerDocument'
import EstimateOfferedOptions from '../components/estimates/EstimateOfferedOptions'
import { postSendEstimate, sendEstimateAnswerFrom } from '../lib/estimates/sendEstimateIo'
import { estimateRecipientEmail, estimateSendPlan } from '../lib/estimates/estimateSendPlan'
import { useEstimateSentActions } from '../hooks/useEstimateSentActions'
import { useEstimateDetailData } from '../hooks/useEstimateDetailData'
import EstimateSentView, { ESTIMATE_JOB_SECTION_HASH } from '../components/estimates/EstimateSentView'
import EstimateSupportingDocumentFieldset from '../components/estimates/EstimateSupportingDocumentFieldset'
import EstimateDeliverySection from '../components/estimates/EstimateDeliverySection'
import EstimateCustomerExperienceSection from '../components/estimates/EstimateCustomerExperienceSection'
import EstimateOptionsStrip from '../components/estimates/EstimateOptionsStrip'
import {
  addEstimateOptionToEditor,
  patchEstimateOption,
  removeViewedEstimateOption,
  setViewedEstimateOptionKind,
  switchViewedEstimateOption,
  syncedEstimateOptionsOf,
  type EstimateOptionsEditorState,
} from '../lib/estimates/estimateOptionsEditor'
import { recordNavClick } from '../lib/navClickTelemetry'
import { formatCurrency } from '../lib/format'
import { TellCustomerSheet } from '../components/customers/TellCustomerSheet'
import { tieEstimateTextsToJob } from '../lib/estimates/estimateTextsTieIo'
import type { TellSendEmailAnswer } from '../lib/tellCustomer/tellCustomer'
import {
  estimateLineItemRecentsStorageKey,
  loadRecentCatalogIds,
  persistRecentCatalogIds,
  recordRecentCatalogPick,
  resolveRecentChips,
} from '../lib/estimateLineItemRecents'
import { buildStaffAcceptPreviewSnapshot, writeStaffAcceptPreviewSnapshot } from '../lib/estimateStaffAcceptPreview'
import {
  addCalendarDaysYmd,
  presetMatchingTodayOffset,
} from '../lib/addCalendarDaysYmd'
import {
  acceptHeaderBrandImageSrc,
  acceptHeaderBrandLabel,
  parseAcceptHeaderBrand,
  type EstimateAcceptHeaderBrand,
} from '../lib/estimateAcceptHeaderBrand'
import { estimateEmailFrom } from '../lib/customerEmailFrom'
import { buildEstimateLetterheadEmail } from '../lib/estimateEmailLetterhead'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../utils/dateUtils'
import { formatValidUntilForDisplay } from '../lib/formatEstimateValidUntilDisplay'
import {
  normalizeCustomerAttachmentDraftForDb,
  parseCustomerAttachmentSent,
  type CustomerAttachmentPayload,
} from '../lib/estimateCustomerAttachment'
import { pageTabStyle } from '../lib/pageTabStyle'
import { tapHintCss } from '../lib/tapHint'
import { useEstimateThreadNotes } from '../hooks/useEstimateThreadNotes'
import {
  normalizeEstimateLineItemsFromJson,
  type EstimateLineItemNormalized,
} from '../lib/estimateLineItemNormalize'
import {
  estimateOptionTotalCents,
  normalizeEstimateOptionsFromJson,
  toggleEstimateOptionSelection,
  type EstimateOption,
  type EstimateOptionKind,
} from '../lib/estimates/estimateOptions'

const ESTIMATE_CATALOG_EDITOR_ROLES = new Set<UserRole>([
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'estimator',
  'primary',
  'superintendent',
])

/** Primary blue — detail Job section “Create job from estimate”. */
const ESTIMATES_PAGE_CLASS = 'estimates-page-modern'

/** Width clamp + responsive padding; modifiers cap content width on large screens. */
const estimatesPageShellCss = `
  .${ESTIMATES_PAGE_CLASS} {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 1rem;
    margin-left: auto;
    margin-right: auto;
  }
  .${ESTIMATES_PAGE_CLASS}.estimates-page-shell--list {
    max-width: min(1100px, 100%);
  }
  .${ESTIMATES_PAGE_CLASS}.estimates-page-shell--detail {
    max-width: min(900px, 100%);
  }
  @media (max-width: 640px) {
    .${ESTIMATES_PAGE_CLASS} {
      padding: 0.75rem 0.5rem;
    }
  }
`

const estimatesFocusVisibleCss = `
  .${ESTIMATES_PAGE_CLASS} input:not([type="radio"]):not([type="checkbox"]):focus-visible,
  .${ESTIMATES_PAGE_CLASS} textarea:focus-visible,
  .${ESTIMATES_PAGE_CLASS} button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`

const estimatesListCustomerSnapshotBtnCss = `
  .${ESTIMATES_PAGE_CLASS} .${ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS}:hover {
    background: var(--bg-muted);
  }
`

const estimateCustomerSearchHighlightCss = `
  @keyframes estimateCustomerSearchPulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.45); }
    50% { box-shadow: 0 0 0 5px rgba(234, 88, 12, 0.28); }
  }
  .estimate-customer-search-highlight {
    border-radius: 8px;
    transition: box-shadow 0.2s ease;
    animation: estimateCustomerSearchPulse 1.2s ease-in-out 2;
  }
`

const estimateDetailLineItemRowCss = `
  .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-block {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-line {
    flex: 1 1 120px;
    min-width: 0;
  }
  .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-line input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-qty-unit {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  @media (max-width: 640px) {
    .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-block {
      flex-direction: column;
      align-items: stretch;
    }
    .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-line {
      flex: none;
      width: 100%;
    }
    .${ESTIMATES_PAGE_CLASS} .estimate-detail-line-item-qty-unit {
      width: 100%;
    }
  }
`

const estimateDetailPageCss = `${estimatesPageShellCss}\n${estimatesFocusVisibleCss}\n${estimateCustomerSearchHighlightCss}\n${estimateDetailLineItemRowCss}`

const estimatesListPageCss = `${estimatesPageShellCss}\n${estimatesFocusVisibleCss}\n${estimatesListCustomerSnapshotBtnCss}\n${tapHintCss('.estimate-card--tap-hint')}`

/** Keeps wide estimate tables from widening the whole page (flex min-width chain). */
const estimateListTableScrollWrapStyle: CSSProperties = {
  overflowX: 'auto',
  maxWidth: '100%',
  minWidth: 0,
}

/** Amber "Change order" pill (v2.1831 CO train) — list rows + detail header. */

type LineItem = EstimateLineItemNormalized

/** Guided CO cost-entry chips (“+ Added work” / “− Credit / removed work”). */
function coPromptChipStyle(kind: 'add' | 'credit'): CSSProperties {
  return {
    padding: '0.45rem 1rem',
    fontWeight: 600,
    fontSize: '0.85rem',
    borderRadius: 9999,
    border: `1.5px dashed ${kind === 'add' ? 'var(--text-green-600)' : 'var(--text-red-700)'}`,
    background: 'var(--bg-subtle)',
    color: 'var(--text-700)',
    cursor: 'pointer',
  }
}

const coPromptPanelStyle: CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  borderRadius: 8,
  padding: '0.85rem 0.95rem',
}

type EstimateDraftCustomerGateProps = {
  active: boolean
  onBlockedInteraction: () => void
  children: ReactNode
}

/** When `active`, blocks interaction with draft body until a customer is selected; overlay forwards clicks to `onBlockedInteraction`. */
function EstimateDraftCustomerGate({ active, onBlockedInteraction, children }: EstimateDraftCustomerGateProps) {
  if (!active) return <>{children}</>
  return (
    <div style={{ position: 'relative' }}>
      <div
        role="presentation"
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          cursor: 'not-allowed',
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onBlockedInteraction()
        }}
      />
      <div style={{ opacity: 0.58 }} {...({ inert: true as const })}>
        {children}
      </div>
    </div>
  )
}

type EstimateListTab = 'all' | 'followup'

function EstimateList() {
  const { user, role, profileName } = useAuth()
  const narrowViewport640 = useNarrowViewport640()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  /** `load()` only filters by this URL param; matches Jobs `?customer=`. */
  const customerParamForEstimatesReload = searchParams.get('customer')
  const [listTab, setListTab] = useState<EstimateListTab>('followup')
  // Ledger money view (pipeline refresh part 3)
  const [ledgerKind, setLedgerKind] = useState<LedgerKindFilter>('all')
  const [ledgerDays, setLedgerDays] = useState(90)
  const [ledgerIncludeClosed, setLedgerIncludeClosed] = useState(false)
  /** ⚙ next to New estimate: org-wide "who gets emailed when an estimate is accepted". */
  const [acceptNotifySettingsOpen, setAcceptNotifySettingsOpen] = useState(false)
  const [listSearch, setListSearch] = useState('')
  const [rows, setRows] = useState<EstimateListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [acceptanceModalEstimateId, setAcceptanceModalEstimateId] = useState<string | null>(null)
  const [createJobFromListRow, setCreateJobFromListRow] = useState<EstimateListRow | null>(null)
  const [customerSnapshotId, setCustomerSnapshotId] = useState<string | null>(null)

  const {
    expandedEstimateThreadId,
    setExpandedEstimateThreadId,
    estimateThreadNotesByEstimateId,
    estimateThreadNotesLoadingId,
    estimateThreadSubmittingId,
    estimateThreadDraft,
    setEstimateThreadDraft,
    submitEstimateThreadNote,
    estimateThreadStatsByEstimateId,
    refreshEstimateThreadStatsForEstimateIds,
  } = useEstimateThreadNotes(showToast, user?.id, profileName)

  const toggleEstimateThreadExpanded = useCallback((id: string) => {
    setExpandedEstimateThreadId((prev) => (prev === id ? null : id))
  }, [setExpandedEstimateThreadId])

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const customerFilter = customerParamForEstimatesReload?.trim() || null
      const data = await withSupabaseRetry(
        async () => {
          let q = supabase
            .from('estimates')
            .select('*, customers(name, address, contact_info), jobs_ledger(hcp_number)')
          if (customerFilter) {
            q = q.eq('customer_id', customerFilter)
          }
          return await q.order('updated_at', { ascending: false }).limit(200)
        },
        'load estimates',
      )
      setRows((data ?? []) as EstimateListRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load estimates'), 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast, customerParamForEstimatesReload])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    if (!listSearch.trim()) return rows
    return rows.filter((r) => estimateListRowMatchesSearch(r, listSearch))
  }, [rows, listSearch])

  const followupBuckets = useMemo(() => splitFollowupRows(filteredRows), [filteredRows])

  // v2.2873 (J17-F1 / N2): one chunked fetch of every sent + declined row's customer events,
  // so the Sent chip can say opened / never opened and a Declined row can say who said no.
  // The list select stays `estimates` alone — a join would multiply rows per event.
  const [listCustomerEvents, setListCustomerEvents] = useState<Record<string, EstimateListCustomerEvent[]> | null>(null)
  const eventRowIdsKey = useMemo(
    () => rows.filter((r) => r.status === 'sent' || r.status === 'declined').map((r) => r.id).sort().join(','),
    [rows],
  )
  useEffect(() => {
    const ids = eventRowIdsKey ? eventRowIdsKey.split(',') : []
    if (ids.length === 0) {
      setListCustomerEvents({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const events = await fetchAllRowsChunkedIn<EstimateListCustomerEvent, string>(
          ids,
          (chunk, from, to) =>
            supabase
              .from('estimate_customer_events')
              .select('estimate_id, event_type, occurred_at, client_ip, metadata')
              .in('estimate_id', chunk)
              .order('occurred_at', { ascending: false })
              .range(from, to),
          'estimate list customer events',
        )
        if (!cancelled) setListCustomerEvents(groupEventsByEstimateId(events))
      } catch {
        // Best-effort: the chip falls back to computeSentWait alone.
        if (!cancelled) setListCustomerEvents({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eventRowIdsKey])
  const sentOpenStateById = useMemo(() => {
    if (!listCustomerEvents) return undefined
    const nowMs = Date.now()
    const out: Record<string, EstimateOpenState | null> = {}
    for (const r of followupBuckets.sent) out[r.id] = estimateOpenState(listCustomerEvents[r.id] ?? [], r, nowMs)
    return out
  }, [listCustomerEvents, followupBuckets.sent])
  const declinedLabelById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const r of followupBuckets.declined) out[r.id] = estimateDeclinedRowLabel(listCustomerEvents?.[r.id])
    return out
  }, [listCustomerEvents, followupBuckets.declined])

  // Pipeline refresh: empty-draft debris collapses behind one sweep button.
  const listConfirmDialog = useConfirmDialog()
  const emptyDraftIds = useMemo(
    () => followupBuckets.unsent.filter((r) => isEmptyEstimateDraft(r)).map((r) => r.id),
    [followupBuckets.unsent],
  )
  const unsentVisibleRows = useMemo(
    () => followupBuckets.unsent.filter((r) => !isEmptyEstimateDraft(r)),
    [followupBuckets.unsent],
  )
  const [cleaningEmpties, setCleaningEmpties] = useState(false)

  const ledgerRows = useMemo(() => {
    const nowMs = Date.now()
    return filteredRows.filter((r) =>
      ledgerRowPasses(r, { kind: ledgerKind, includeClosed: ledgerIncludeClosed, withinDays: ledgerDays }, nowMs),
    )
  }, [filteredRows, ledgerKind, ledgerIncludeClosed, ledgerDays])
  const ledgerTotals = useMemo(() => computeLedgerTotals(ledgerRows, Date.now()), [ledgerRows])

  async function cleanUpEmptyDrafts() {
    if (cleaningEmpties || emptyDraftIds.length === 0) return
    const n = emptyDraftIds.length
    const ok = await listConfirmDialog({
      message: `Delete ${n} empty draft${n === 1 ? '' : 's'}? These have no customer, title, or line items.`,
      confirmLabel: `Delete ${n} draft${n === 1 ? '' : 's'}`,
      danger: true,
    })
    if (!ok) return
    setCleaningEmpties(true)
    try {
      await withSupabaseRetry(
        async () => await supabase.from('estimates').delete().in('id', emptyDraftIds).eq('status', 'draft'),
        'clean up empty drafts',
      )
      showToast(`Deleted ${n} empty draft${n === 1 ? '' : 's'}`, 'success')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not clean up drafts'), 'error')
    } finally {
      setCleaningEmpties(false)
    }
  }

  const THREAD_STATS_ESTIMATES_DEBOUNCE_MS = 320
  useEffect(() => {
    if (!user?.id || listTab !== 'followup') return
    const ids = [...new Set(filteredRows.map((r) => r.id))]
    const t = window.setTimeout(() => {
      void refreshEstimateThreadStatsForEstimateIds(ids)
    }, THREAD_STATS_ESTIMATES_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [user?.id, listTab, filteredRows, refreshEstimateThreadStatsForEstimateIds])

  useEffect(() => {
    if (listTab !== 'followup') setExpandedEstimateThreadId(null)
  }, [listTab, setExpandedEstimateThreadId])

  // Projects card "+ Estimate" deep link (?newEstimate=true&project=<id>):
  // create a draft pre-linked to the project, then navigate to it. This INSERTS
  // a row, so it fires once per mount (ref guard) and strips its params before
  // creating (deep-link contract; no e2e spec — cold-loading it would write to prod).
  // v2.2885: like the button, the row is marked fresh — leave it untouched and
  // the editor deletes it again on the way out.
  const newEstimateParamFiredRef = useRef(false)
  useEffect(() => {
    if (searchParams.get('newEstimate') !== 'true') return
    if (!user?.id || newEstimateParamFiredRef.current) return
    newEstimateParamFiredRef.current = true
    const projectParam = searchParams.get('project')?.trim() || null
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('newEstimate')
      next.delete('project')
      return next
    }, { replace: true })
    void createDraft(projectParam, 'estimate', 'deeplink')
    // createDraft reads latest state when it runs; ref guard prevents refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.id, setSearchParams])

  async function createDraft(
    projectId?: string | null,
    docKind: 'estimate' | 'change_order' = 'estimate',
    trigger: 'button' | 'deeplink' = 'button',
  ) {
    if (!user?.id || creating) return
    setCreating(true)
    try {
      const masterUserId = await resolveMasterUserId(user.id, role)
      if (!masterUserId) {
        showToast('Could not determine account owner for estimate.', 'error')
        return
      }
      const inserted = await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .insert({
              master_user_id: masterUserId,
              created_by: user.id,
              title: '',
              // COs start with no lines: Impact on cost opens with the guided
              // prompt instead of the estimate's "Custom Service Visit" stub.
              line_items_snapshot: docKind === 'change_order' ? [] : [defaultDraftFirstLine()],
              terms_snapshot: '',
              total_cents: 0,
              project_id: projectId?.trim() || null,
              // CO train (v2.1831): a change order is an estimate flavor.
              ...(docKind === 'change_order' ? { doc_kind: 'change_order', change_order_fields: {} } : {}),
            })
            .select('id, estimate_number')
            .single(),
        'create estimate',
      )
      const ins = inserted as { id: string; estimate_number: number } | null
      if (ins?.estimate_number != null) {
        recordNavClick(user.id, role, 'estimate_draft_created', `#${trigger}:${docKind}`)
        // Fresh-draft marker (decision 17, v2.2885): the editor deletes this row
        // again on leave if nothing was ever committed to it — the button is not
        // the insert, the first real edit / Save / Send is.
        navigate(`/estimates/${ins.estimate_number}`, { state: { freshEstimateDraft: true } })
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create estimate'), 'error')
    } finally {
      setCreating(false)
    }
  }

  if (!user) return null

  // Primary scoping (v2.2175): a primary's list is the estimates they created or
  // that hang off a job they are the Account Man for (RLS enforces it) — say so
  // when the list is empty instead of implying the company has none.
  // Empty words (punch list #184, sweep C): New estimate adds the first, and the customer filter's Clear filter shows every estimate.
  const estimatesListEmpty = estimatesListEmptyWords({
    customerFiltered: !!customerParamForEstimatesReload?.trim(),
    primary: role === 'primary',
    newEstimate: () => void createDraft(),
    clearCustomer: () =>
      setSearchParams((p) => {
        const n = new URLSearchParams(p)
        n.delete('customer')
        return n
      }),
  })
  const clearListSearch = () => setListSearch('')

  const estimatesStagesThread: EstimateListStagesThread = {
    estimateThreadStatsByEstimateId,
    estimateThreadNotesByEstimateId,
    estimateThreadNotesLoadingId,
    expandedEstimateThreadId,
    toggleEstimateThreadExpanded,
    estimateThreadDraft,
    setEstimateThreadDraft,
    estimateThreadSubmittingId,
    submitEstimateThreadNote,
    canPostNotes: !!user,
  }

  return (
    <div className={`${ESTIMATES_PAGE_CLASS} estimates-page-shell--list`}>
      <style>{estimatesListPageCss}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Estimates</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canOpenBillingNotifications(role) ? (
            <button
              type="button"
              onClick={() => setAcceptNotifySettingsOpen(true)}
              title="Who gets emailed when a customer accepts an estimate"
              aria-label="Estimate accepted notification settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 36,
                width: 36,
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                background: 'var(--surface)',
                cursor: 'pointer',
                color: 'var(--text-700)',
                fontSize: '1rem',
              }}
            >
              <span aria-hidden>⚙</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void createDraft(null, 'change_order')}
            disabled={creating}
            title="Write a change order and send it for signature — same flow as an estimate"
            style={estSecondaryButton(creating)}
          >
            New change order
          </button>
          <button type="button" onClick={() => void createDraft()} disabled={creating} style={estPrimaryButton(creating)}>
            {creating ? 'Creating…' : 'New estimate'}
          </button>
        </div>
      </div>
      {acceptNotifySettingsOpen ? (
        <EstimateAcceptedNotifySettingsModal onClose={() => setAcceptNotifySettingsOpen(false)} />
      ) : null}
      <div
        role="tablist"
        aria-label="Estimates views"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          marginTop: '0.75rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={listTab === 'followup'}
          id="estimates-tab-stages"
          onClick={() => setListTab('followup')}
          style={pageTabStyle(listTab === 'followup')}
        >
          Pipeline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={listTab === 'all'}
          id="estimates-tab-ledger"
          onClick={() => setListTab('all')}
          style={pageTabStyle(listTab === 'all')}
        >
          Ledger
        </button>
      </div>
      {customerParamForEstimatesReload ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-blue-tint)',
            border: '1px solid var(--border-blue)',
            borderRadius: 6,
            fontSize: '0.875rem',
          }}
        >
          <span style={{ color: 'var(--text-blue-800)' }}>Filtered by customer</span>
          <button
            type="button"
            onClick={() =>
              setSearchParams((p) => {
                const n = new URLSearchParams(p)
                n.delete('customer')
                return n
              })
            }
            style={{
              padding: '0.25rem 0.5rem',
              background: 'var(--surface)',
              border: '1px solid #93c5fd',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--text-blue-800)',
              fontSize: '0.8125rem',
            }}
          >
            Clear filter
          </button>
        </div>
      ) : null}
      {listTab === 'all' ? (
        <div role="tabpanel" aria-labelledby="estimates-tab-ledger">
          <div style={{ marginTop: '0.75rem', width: '100%' }}>
            <input
              id="estimates-list-search"
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search estimates…"
              autoComplete="off"
              aria-label="Search estimates"
              style={{ ...estInputBase, width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem' }}>
            <button type="button" onClick={() => setLedgerKind('all')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'all' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'all' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'all' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>All kinds</button>
            <button type="button" onClick={() => setLedgerKind('estimate')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'estimate' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'estimate' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'estimate' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Estimates</button>
            <button type="button" onClick={() => setLedgerKind('change_order')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'change_order' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'change_order' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'change_order' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Change orders</button>
            <button type="button" onClick={() => setLedgerKind('bid_proposal')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'bid_proposal' ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerKind === 'bid_proposal' ? '#2563eb' : 'var(--surface)', color: ledgerKind === 'bid_proposal' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Bid proposals</button>
            <select
              value={ledgerDays}
              onChange={(e) => setLedgerDays(Number(e.target.value))}
              aria-label="Date range"
              style={{ ...estInputBase, padding: '0.22rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, width: 'auto' }}
            >
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
              <option value={0}>All time</option>
            </select>
            <button type="button" onClick={() => setLedgerIncludeClosed((p) => !p)} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerIncludeClosed ? 'var(--text-link, #2563eb)' : 'var(--border-strong)'), background: ledgerIncludeClosed ? '#2563eb' : 'var(--surface)', color: ledgerIncludeClosed ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Include superseded & declined</button>
          </div>
          {loading ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState {...estimatesListEmpty} />
          ) : ledgerRows.length === 0 ? (
            <EmptyState
              {...estimatesLedgerEmptyWords({
                query: listSearch,
                searchHidesAll: filteredRows.length === 0,
                clearSearch: clearListSearch,
                clearFilters: () => {
                  setLedgerKind('all')
                  setLedgerDays(0)
                  setLedgerIncludeClosed(true)
                },
              })}
            />
          ) : (
            <div style={{ ...estimateListTableScrollWrapStyle, marginTop: '1rem' }}>
              {narrowViewport640 ? (
                <EstimateListCards
                  rows={ledgerRows}
                  setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                  setCreateJobFromListRow={setCreateJobFromListRow}
                  showCustomerColumn
                  onCustomerSnapshotRequest={setCustomerSnapshotId}
                />
              ) : (
                <EstimateListTable
                  rows={ledgerRows}
                  setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                  setCreateJobFromListRow={setCreateJobFromListRow}
                  showCustomerColumn
                  onCustomerSnapshotRequest={setCustomerSnapshotId}
                />
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: '1.6rem', flexWrap: 'wrap', borderTop: '2px solid var(--border-strong)', marginTop: '0.9rem', paddingTop: '0.6rem', fontSize: '0.85rem' }}>
            <span><span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Accepted this month</span><strong style={{ color: 'var(--text-green-600)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(ledgerTotals.acceptedThisMonthCents)}</strong></span>
            <span><span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Outstanding sent</span><strong style={{ color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(ledgerTotals.outstandingSentCents)}</strong></span>
            <span><span style={{ color: 'var(--text-muted)', marginRight: '0.35rem' }}>Accepted, not on a job</span><strong style={{ color: ledgerTotals.acceptedUnlinkedCents > 0 ? 'var(--text-red-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(ledgerTotals.acceptedUnlinkedCents)}</strong></span>
          </div>
        </div>
      ) : (
        <div role="tabpanel" aria-labelledby="estimates-tab-stages" style={{ marginTop: '0.75rem' }}>
          <div style={{ width: '100%' }}>
            <input
              id="estimates-list-search-stages"
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search estimates…"
              autoComplete="off"
              aria-label="Search estimates"
              style={{ ...estInputBase, width: '100%', padding: '0.5rem' }}
            />
          </div>
          {loading ? (
            <p style={{ marginTop: '1rem' }}>Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState {...estimatesListEmpty} />
          ) : filteredRows.length === 0 ? (
            <EmptyState {...estimatesSearchEmptyWords(listSearch, clearListSearch)} />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.75rem',
                marginTop: '1.25rem',
              }}
            >
              <section>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', margin: '0 0 0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>Unsent</h2>
                  {emptyDraftIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void cleanUpEmptyDrafts()}
                      disabled={cleaningEmpties}
                      style={{
                        marginLeft: 'auto',
                        padding: '0.25rem 0.7rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 5,
                        background: 'var(--bg-muted)',
                        color: 'var(--text-muted)',
                        cursor: cleaningEmpties ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {cleaningEmpties ? 'Cleaning…' : `🧹 Clean up ${emptyDraftIds.length} empty draft${emptyDraftIds.length === 1 ? '' : 's'}`}
                    </button>
                  ) : null}
                </div>
                {unsentVisibleRows.length === 0 ? (
                  <EmptyState compact {...estimateLaneEmptyWords('unsent', { query: listSearch, clearSearch: clearListSearch, emptyDrafts: emptyDraftIds.length })} />
                ) : (
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={unsentVisibleRows}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    ) : (
                      <EstimateListTable
                        rows={unsentVisibleRows}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    )}
                  </div>
                )}
              </section>
              <section>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Sent</h2>
                {followupBuckets.sent.length === 0 ? (
                  <EmptyState compact {...estimateLaneEmptyWords('sent', { query: listSearch, clearSearch: clearListSearch, emptyDrafts: 0 })} />
                ) : (
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={followupBuckets.sent}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        sentOpenStateById={sentOpenStateById}
                      />
                    ) : (
                      <EstimateListTable
                        rows={followupBuckets.sent}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        sentOpenStateById={sentOpenStateById}
                      />
                    )}
                  </div>
                )}
              </section>
              {followupBuckets.declined.length > 0 ? (
                <section>
                  <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Declined</h2>
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={followupBuckets.declined}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        declinedLabelById={declinedLabelById}
                      />
                    ) : (
                      <EstimateListTable
                        rows={followupBuckets.declined}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                        declinedLabelById={declinedLabelById}
                      />
                    )}
                  </div>
                </section>
              ) : null}
              <section>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Accepted</h2>
                {followupBuckets.accepted.length === 0 ? (
                  <EmptyState compact {...estimateLaneEmptyWords('accepted', { query: listSearch, clearSearch: clearListSearch, emptyDrafts: 0 })} />
                ) : (
                  <div style={estimateListTableScrollWrapStyle}>
                    {narrowViewport640 ? (
                      <EstimateListCards
                        rows={followupBuckets.accepted}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    ) : (
                      <EstimateListTable
                        rows={followupBuckets.accepted}
                        setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                        setCreateJobFromListRow={setCreateJobFromListRow}
                        showCustomerColumn
                        onCustomerSnapshotRequest={setCustomerSnapshotId}
                        stagesThread={estimatesStagesThread}
                      />
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
      <CustomerAcceptanceRecordModal
        open={acceptanceModalEstimateId != null}
        estimateId={acceptanceModalEstimateId}
        onClose={() => setAcceptanceModalEstimateId(null)}
      />
      <CustomerSnapshotModal
        open={customerSnapshotId != null}
        onClose={() => setCustomerSnapshotId(null)}
        customerId={customerSnapshotId}
        gcBuilder={null}
      />
      <CreateJobFromEstimateModal
        open={createJobFromListRow != null}
        estimate={createJobFromListRow}
        customerIdForPayload={createJobFromListRow?.customer_id ?? null}
        linkedCustomerPrefill={
          createJobFromListRow?.customers != null
            ? {
                name: createJobFromListRow.customers.name ?? '',
                address: createJobFromListRow.customers.address ?? '',
              }
            : null
        }
        onClose={() => setCreateJobFromListRow(null)}
        onSuccess={(jobId) => {
          void (async () => {
            await load()
            navigate(`/jobs?edit=${jobId}`)
          })()
        }}
      />
    </div>
  )
}

function EstimateDetail({ routeSegment }: { routeSegment: string }) {
  const { user, role, profileName } = useAuth()
  const { showToast } = useToastContext()
  const editCustomerModal = useEditCustomerModal()
  const navigate = useNavigate()
  const location = useLocation()
  // The draft's engine: the row, the form it opens as, the reads, the save, both autosaves and the leave rule (`useEstimateDetailData`, v2.7627).
  const {
    committedDraftRowIdRef,
    row,
    loading,
    title,
    setTitle,
    terms,
    setTerms,
    lines,
    setLines,
    estimateOptions,
    setEstimateOptions,
    viewedOptionKey,
    setViewedOptionKey,
    previewSelectedOptionKeys,
    setPreviewSelectedOptionKeys,
    customers,
    setCustomers,
    customersLoading,
    customerId,
    setCustomerId,
    customerSearch,
    setCustomerSearch,
    sendEmailOverride,
    setSendEmailOverride,
    validUntil,
    setValidUntil,
    validUntilPreset,
    setValidUntilPreset,
    forAddress,
    setForAddress,
    linkedProjectId,
    setLinkedProjectId,
    projectsForPicker,
    internalNotes,
    setInternalNotes,
    customerAttachmentUrl,
    setCustomerAttachmentUrl,
    customerAttachmentLabel,
    setCustomerAttachmentLabel,
    attachmentCheckStatus,
    attachmentCheckMessage,
    acceptHeaderBrand,
    setAcceptHeaderBrand,
    acceptorSignatureSignedUrl,
    saving,
    sending,
    setSending,
    lastAcceptUrl,
    setLastAcceptUrl,
    appCxSettings,
    catalogLineItems,
    estimateCustomerEvents,
    estimateCustomerEventsLoading,
    cxOverrideFields,
    setCxOverrideFields,
    acceptNotifyUserIds,
    setAcceptNotifyUserIds,
    notifyUserOptions,
    acceptNotifyResolvedUsers,
    loadCatalogFromDb,
    loadEstimateCustomerEvents,
    load,
    refetchCustomersAfterEdit,
    isDraft,
    isCO,
    coFields,
    setCoFields,
    totalCents,
    unfinishedDateStopsSending,
    saveDraft,
    draftAutosave,
    checkCustomerAttachmentUrl,
  } = useEstimateDetailData({ routeSegment })
  const [emailOverrideRevealed, setEmailOverrideRevealed] = useState(false)
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [createJobModalOpen, setCreateJobModalOpen] = useState(false)
  // v2.2743: the Signed agreements email's "Create the job" button lands here with ?createJob=1.
  const [detailSearchParams, setDetailSearchParams] = useSearchParams()
  useEffect(() => {
    if (detailSearchParams.get('createJob') !== '1' || !row) return
    if (row.status === 'customer_accepted' && !row.job_ledger_id) setCreateJobModalOpen(true)
    const next = new URLSearchParams(detailSearchParams)
    next.delete('createJob')
    setDetailSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id])
  const [customerPreviewTab, setCustomerPreviewTab] = useState<'email' | 'page' | 'thankyou'>('email')
  /** Tell the customer (v2.5594): a normal estimate's send goes through the sheet — the email, the text with the link, the receipt with the call. */
  const [tellEstimate, setTellEstimate] = useState<{ estimateId: string; customerId: string; customerName: string | null; email: string; totalCents: number; number: number; title: string; jobId: string | null } | null>(null)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [catalogIconHovered, setCatalogIconHovered] = useState(false)
  const canManageEstimateCatalog = Boolean(role && ESTIMATE_CATALOG_EDITOR_ROLES.has(role))
  const [lineItemRecentIds, setLineItemRecentIds] = useState<string[]>([])
  const [draftTitleEditing, setDraftTitleEditing] = useState(false)
  const [customerNotesExpanded, setCustomerNotesExpanded] = useState(false)
  const [detailCustomerSnapshotId, setDetailCustomerSnapshotId] = useState<string | null>(null)
  const customerNotesQueryCustomerId = row?.status === 'draft' && customerId ? customerId : null
  const {
    entries: customerNotesEntries,
    loading: customerNotesLoading,
    refetch: refetchCustomerNotes,
  } = useCustomerContactsForCustomer(customerNotesQueryCustomerId, (m) => showToast(m, 'error'))
  const recentNotePreviewText = customerNotesEntries[0]?.details?.trim()
  const showRecentCustomerNotePreview =
    (customerNotesLoading && customerNotesEntries.length === 0) || Boolean(recentNotePreviewText)
  const draftNotesToggleLabel = customerNotesExpanded
    ? 'Collapse'
    : customerNotesEntries.length >= 2
      ? 'View Notes'
      : 'Add Note'
  const titleInputRef = useRef<HTMLInputElement>(null)
  const sendEmailOverrideInputRef = useRef<HTMLInputElement>(null)
  const customerSearchSectionRef = useRef<HTMLDivElement>(null)
  const confirmDialog = useConfirmDialog()
  const lastCustomerGateToastAt = useRef(0)
  const customerGateHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [customerSearchHighlight, setCustomerSearchHighlight] = useState(false)
  useEffect(() => {
    setEmailOverrideRevealed(false)
  }, [customerId])

  // A different estimate: the page's own windows close (the form's reset is the hook's).
  useEffect(() => {
    setDraftTitleEditing(false)
    setDetailCustomerSnapshotId(null)
  }, [routeSegment])

  useEffect(() => {
    if (loading) return
    const hash = location.hash.replace(/^#/, '')
    if (hash !== ESTIMATE_JOB_SECTION_HASH && hash !== EXTEND_GOOD_THROUGH_HASH) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(hash)
      if (!el) return
      // The Pipeline's good-through-passed chip (v2.6037) lands on the Extend door with the date field in hand.
      if (hash === EXTEND_GOOD_THROUGH_HASH) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.querySelector<HTMLInputElement>('input[type="date"]')?.focus({ preventScroll: true })
        return
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(t)
  }, [loading, location.hash, row?.id])

  useEffect(() => {
    setCustomerNotesExpanded(false)
  }, [customerId])

  useLayoutEffect(() => {
    if (!draftTitleEditing) return
    titleInputRef.current?.focus()
  }, [draftTitleEditing])

  useEffect(() => {
    if (!user?.id) {
      setLineItemRecentIds([])
      return
    }
    setLineItemRecentIds(loadRecentCatalogIds(estimateLineItemRecentsStorageKey(user.id)))
  }, [user?.id])

  useEffect(() => {
    if (catalogLineItems.length === 0 && !canManageEstimateCatalog) setCatalogIconHovered(false)
  }, [catalogLineItems.length, canManageEstimateCatalog])

  const openDraftCustomerForEdit = useCallback(() => {
    if (!editCustomerModal || !customerId) return
    const cid = customerId
    editCustomerModal.openEditCustomerModal(cid, {
      onSaved: async () => {
        await refetchCustomersAfterEdit(cid)
      },
      onDeleted: (deletedId) => {
        queueMicrotask(() => {
          setCustomers((prev) => prev.filter((c) => c.id !== deletedId))
          if (deletedId === cid) {
            setCustomerId(null)
            setCustomerSearch('')
            setSendEmailOverride('')
            setForAddress('')
          }
        })
      },
      onMerged: ({ removedId }) => {
        queueMicrotask(() => {
          setCustomers((prev) => prev.filter((c) => c.id !== removedId))
        })
      },
    })
  }, [editCustomerModal, customerId, refetchCustomersAfterEdit, setCustomers, setCustomerId, setCustomerSearch, setSendEmailOverride, setForAddress])

  // Guided cost-impact entry (v2.1944): the "added work" / "credit" chips
  // append an inline-editable line directly — a line exists per chip click.
  const coFocusLineIndexRef = useRef<number | null>(null)

  function addCoLine(mode: CoCostPromptMode) {
    setLines((p) => {
      coFocusLineIndexRef.current = p.length
      const line = emptyDraftLine()
      if (mode === 'credit') line.line_item = CO_CREDIT_LABEL_PREFIX
      return [...p, line]
    })
  }
  const draftNeedsCustomer = isDraft && !customerId

  const requestCustomerFirst = useCallback(() => {
    if (customerId) return
    const now = Date.now()
    if (now - lastCustomerGateToastAt.current < 700) return
    lastCustomerGateToastAt.current = now
    showToast('Choose a customer before editing this estimate.', 'warning')
    customerSearchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    setCustomerSearchHighlight(true)
    if (customerGateHighlightTimerRef.current) clearTimeout(customerGateHighlightTimerRef.current)
    customerGateHighlightTimerRef.current = setTimeout(() => {
      setCustomerSearchHighlight(false)
      customerGateHighlightTimerRef.current = null
    }, 2400)
    queueMicrotask(() => {
      const input = customerSearchSectionRef.current?.querySelector<HTMLInputElement>(
        '.customer-search-combobox input',
      )
      input?.focus()
    })
  }, [customerId, showToast])

  useEffect(() => {
    if (!customerId) return
    setCustomerSearchHighlight(false)
    if (customerGateHighlightTimerRef.current) {
      clearTimeout(customerGateHighlightTimerRef.current)
      customerGateHighlightTimerRef.current = null
    }
  }, [customerId])

  const customerAttachmentPreview = useMemo((): CustomerAttachmentPayload | null => {
    if (isDraft) {
      const a = normalizeCustomerAttachmentDraftForDb(customerAttachmentUrl, customerAttachmentLabel)
      if (!a.url) return null
      return { url: a.url, label: a.label }
    }
    if (!row) return null
    return parseCustomerAttachmentSent(row.customer_attachment_sent)
  }, [
    isDraft,
    row,
    customerAttachmentUrl,
    customerAttachmentLabel,
  ])
  /** Options with the viewed option's lines kept live — what cards, save, and previews read. */
  const syncedEstimateOptions = useMemo(
    () => syncedEstimateOptionsOf({ options: estimateOptions, viewedKey: viewedOptionKey, lines }),
    [estimateOptions, viewedOptionKey, lines],
  )

  // The option moves (`lib/estimates/estimateOptionsEditor`, v2.7605) are pure steps over these four pieces;
  // a piece a move leaves alone comes back as the same reference, so setting it is a no-op.
  const optionsEditorState: EstimateOptionsEditorState = { options: estimateOptions, viewedKey: viewedOptionKey, lines, previewSelected: previewSelectedOptionKeys }
  function applyOptionsEditor(next: EstimateOptionsEditorState) {
    if (next === optionsEditorState) return
    setEstimateOptions(next.options)
    setViewedOptionKey(next.viewedKey)
    setLines(next.lines)
    setPreviewSelectedOptionKeys(next.previewSelected)
  }

  function switchViewedOption(key: string) {
    applyOptionsEditor(switchViewedEstimateOption(optionsEditorState, key))
  }

  function addEstimateOption() {
    applyOptionsEditor(addEstimateOptionToEditor(optionsEditorState))
  }

  function removeViewedOption() {
    applyOptionsEditor(removeViewedEstimateOption(optionsEditorState))
  }

  function patchViewedOption(patch: Partial<Pick<EstimateOption, 'name' | 'description'>>) {
    setEstimateOptions((prev) => patchEstimateOption(prev, viewedOptionKey, patch))
  }

  /** v2.3556: offer the edited option as a choice or an add-on; the star re-seats itself and the Page preview restarts from the default. */
  function setViewedOptionKind(kind: EstimateOptionKind) {
    applyOptionsEditor(setViewedEstimateOptionKind(optionsEditorState, kind))
  }

  const viewedOption = estimateOptions.find((o) => o.key === viewedOptionKey) ?? null
  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : undefined

  const linkedCustomerPrefillForCreateJobModal = useMemo((): LinkedCustomerPrefill | null => {
    if (!customerId) return null
    const c = customers.find((x) => x.id === customerId)
    if (!c) return null
    return { name: c.name ?? '', address: c.address ?? '' }
  }, [customerId, customers])
  const crmEmailForSelected = selectedCustomer ? extractContactFromCustomer(selectedCustomer).email.trim() : ''

  // Step rail (rail-v2): map + checklist + send-gate, all from the kernel.
  const [railFlashStep, setRailFlashStep] = useState<EstimateDraftStepKey | null>(null)
  // Customer view (rail-v2): swap the edit paper for the pixel-true customer document.
  const [customerViewOn, setCustomerViewOn] = useState(false)
  const railFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const railData = useMemo(
    () =>
      computeEstimateDraftSteps({
        isCO,
        customerSelected: customerId != null,
        customerEmailPresent: Boolean(estimateRecipientEmail(crmEmailForSelected, sendEmailOverride)),
        changeDescriptionFilled: coFields.description_of_change.trim() !== '',
        // Same rule as the list's send-gate (B18 / J17-F5): the seeded $0 stub is not a line.
        lineCount: countMeaningfulEstimateLines(lines),
        totalCents,
        termsFilled: terms.trim() !== '',
        attachmentFilled: Boolean(customerAttachmentUrl.trim() || customerAttachmentLabel.trim()),
        notifyCount: acceptNotifyUserIds.length,
      }),
    [
      isCO,
      customerId,
      crmEmailForSelected,
      sendEmailOverride,
      coFields.description_of_change,
      lines,
      totalCents,
      terms,
      customerAttachmentUrl,
      customerAttachmentLabel,
      acceptNotifyUserIds.length,
    ],
  )

  function handleRailStepClick(key: EstimateDraftStepKey) {
    const el = document.getElementById(`est-step-${key}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (key === 'customer') {
      queueMicrotask(() => {
        customerSearchSectionRef.current
          ?.querySelector<HTMLInputElement>('.customer-search-combobox input')
          ?.focus()
      })
    }
    setRailFlashStep(key)
    if (railFlashTimerRef.current) clearTimeout(railFlashTimerRef.current)
    railFlashTimerRef.current = setTimeout(() => setRailFlashStep(null), 2600)
  }

  /** Small numbered circle before a region's heading, synced to the rail. */
  function railStepDot(key: EstimateDraftStepKey) {
    const step = railData.steps.find((st) => st.key === key)
    if (!step) return null
    return (
      <span className={`est-step-margin-dot ${step.status}`} aria-hidden>
        {step.status === 'done' ? '✓' : step.number}
      </span>
    )
  }
  const showSendEmailOverride = Boolean(isDraft && customerId && !crmEmailForSelected)

  const previewEmailTo = useMemo(() => {
    if (!row) return '—'
    if (row.status === 'draft') {
      const sel = customerId ? customers.find((x) => x.id === customerId) : undefined
      const crm = sel ? extractContactFromCustomer(sel).email.trim() : ''
      return estimateRecipientEmail(crm, sendEmailOverride) || '—'
    }
    const emailed = row.customer_email?.trim()
    if (emailed) return emailed
    const c = row.customer_id ? customers.find((x) => x.id === row.customer_id) : undefined
    return c ? extractContactFromCustomer(c).email.trim() || '—' : '—'
  }, [row, customerId, customers, sendEmailOverride])

  const previewEmailTitle = row ? (row.status === 'draft' ? title : (row.title ?? '')) : ''

  const acceptUrlForTemplatePreview = lastAcceptUrl ?? PREVIEW_EMAIL_ACCEPT_URL

  const customerAcceptUrl = useMemo((): string | null => {
    if (!row || row.status === 'draft') return null
    if (row.status !== 'sent' && row.status !== 'customer_accepted') return null
    const fromState = normalizeCustomerAcceptUrlCandidate(lastAcceptUrl)
    if (fromState) return fromState
    return normalizeCustomerAcceptUrlCandidate(readStoredEstimateAcceptUrl(row.id))
  }, [row?.id, row?.status, lastAcceptUrl])

  const acceptancePreviewForLine = useMemo((): string | null => {
    if (!row) return null
    if (row.status === 'draft') {
      const crm = selectedCustomer?.address?.trim() ?? ''
      return forAddress.trim() || crm || null
    }
    const cust = row.customer_id ? customers.find((c) => c.id === row.customer_id) : undefined
    const crm = cust?.address?.trim() ?? ''
    return row.for_address?.trim() || crm || null
  }, [row, forAddress, selectedCustomer, customers])

  /** What was offered (v2.5988, #206 PR 2): a sent row's options, read for the office; a CO never has any. */
  const rowOfferedOptions = useMemo(
    () => (!row || isDraft || isCO ? [] : normalizeEstimateOptionsFromJson(row.options_snapshot)),
    [row, isDraft, isCO],
  )
  const acceptanceDocHeaderBrand = useMemo((): EstimateAcceptHeaderBrand | null => {
    if (!row) return null
    if (isDraft) return acceptHeaderBrand
    return parseAcceptHeaderBrand(row.accept_header_brand)
  }, [row, isDraft, acceptHeaderBrand])

  function openStaffAcceptCustomerPreview() {
    if (!row) return
    if (isDraft) {
      const crm = selectedCustomer?.address?.trim() ?? ''
      const forLineEffective = forAddress.trim() || crm || ''
      writeStaffAcceptPreviewSnapshot(
        buildStaffAcceptPreviewSnapshot({
          estimateId: row.id,
          title,
          terms,
          validUntilTrimmed: validUntil,
          lines,
          totalCents,
          forLineEffective,
          cxOverrideFields,
          acceptHeaderBrand,
          customerAttachment: customerAttachmentPreview,
          options: syncedEstimateOptions,
        }),
      )
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    window.open(
      `${origin}/estimate/customer-accept-preview/${row.estimate_number}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const copyCustomerAcceptUrl = useCallback(() => {
    const url = customerAcceptUrl
    if (!url) return
    void navigator.clipboard.writeText(url).then(
      () => showToast('Customer link copied.', 'success'),
      () => showToast('Could not copy link.', 'error'),
    )
  }, [customerAcceptUrl, showToast])

  const openCustomerAcceptUrl = useCallback(() => {
    const url = customerAcceptUrl
    if (!url) return
    // v2.2873 (#34/#37): the office's own look must not read as a customer open — the marker
    // tells get-estimate-for-customer to skip the view stamp. Copy stays the raw link.
    window.open(withEstimatePreviewMarker(url), '_blank', 'noopener,noreferrer')
  }, [customerAcceptUrl])

  const todayYmd = todayYmdInAppTz()
  /** What went re-reads after a letter goes from this page (v2.5997). */
  const [whatWentRevision, setWhatWentRevision] = useState(0)
  // The sent side's presses — Resend link, Extend, Mark declined, Unlink job — and their state (`useEstimateSentActions`, v2.7613).
  const sentActions = useEstimateSentActions({
    row,
    user,
    role,
    load,
    loadEstimateCustomerEvents,
    setLastAcceptUrl,
    bumpWhatWent: () => setWhatWentRevision((n) => n + 1),
    showToast,
  })

  const staffResolvedExperience = useMemo((): EstimateCustomerExperienceResolved | null => {
    if (!row) return null
    const snap = parseEstimateCustomerExperienceSnapshot(row.customer_experience_sent)
    if (snap) return snap
    return resolveEstimateCustomerExperience(
      appCxSettings,
      cxOverrideFields,
      {
        acceptUrl: acceptUrlForTemplatePreview,
        title: previewEmailTitle.trim() || '',
        estimateNumber: row.estimate_number,
      },
      { docKind: row.doc_kind },
    )
  }, [
    row,
    appCxSettings,
    cxOverrideFields,
    acceptUrlForTemplatePreview,
    previewEmailTitle,
  ])

  /**
   * Download PDF (v2.5993, punch list #206 PR 3): the estimate's paper as the customer page reads it,
   * drawn on the press; a download is a send, so the button files the copy under the customer, the
   * job and the bid with the estimate as its source.
   */
  const estimatePdfCustomerName = row?.customer_id ? customers.find((c) => c.id === row.customer_id)?.name?.trim() || null : null
  const buildEstimatePdf = useCallback(async () => {
    if (!row) throw new Error('No estimate to draw')
    const model = estimatePaperModel({
      row,
      customerName: estimatePdfCustomerName,
      forLine: acceptancePreviewForLine,
      experience: staffResolvedExperience,
      termsHref: estimateTermsPageHref(),
    })
    const logo = await loadEstimateBrandLogo(model.brand ? acceptHeaderBrandImageSrc(model.brand) : null)
    return { blob: await estimatePaperPdfBlob(model, logo), fileName: model.fileName }
  }, [row, estimatePdfCustomerName, acceptancePreviewForLine, staffResolvedExperience])
  const estimatePdfFiling = useMemo(
    () => ({
      kind: 'estimate_pdf',
      title: `${isCO ? 'Change order' : 'Estimate'} ${row?.estimate_number ?? ''}${estimatePdfCustomerName ? ` · ${estimatePdfCustomerName}` : ''}`,
      recipientName: estimatePdfCustomerName,
      customerId: row?.customer_id ?? null,
      jobIds: [row?.job_ledger_id ?? null],
      bidId: row?.bid_id ?? null,
      source: { table: 'estimates', id: row?.id ?? null },
    }),
    [row, isCO, estimatePdfCustomerName],
  )

  /** The exact email the customer gets — same builder as send-estimate-to-customer (v2.2747). */
  const customerEmailPreview = useMemo(() => {
    if (!row || !staffResolvedExperience) return null
    const brand = acceptanceDocHeaderBrand
    const rel = brand ? acceptHeaderBrandImageSrc(brand) : null
    const brandImageUrl = rel ? (typeof window !== 'undefined' ? new URL(rel, window.location.origin).href : rel) : null
    const options = isDraft ? syncedEstimateOptions : normalizeEstimateOptionsFromJson(row.options_snapshot)
    const sentAt = !isDraft && row.sent_at ? new Date(row.sent_at) : new Date()
    const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(sentAt)
    return buildEstimateLetterheadEmail({
      docKind: isChangeOrderDocKind(row.doc_kind) ? 'change_order' : 'estimate',
      estimateNumber: row.estimate_number,
      title: previewEmailTitle,
      totalCents: isDraft ? totalCents : row.total_cents,
      validUntilYmd: isDraft ? validUntil.trim() || null : row.valid_until,
      forAddress: acceptancePreviewForLine,
      acceptUrl: acceptUrlForTemplatePreview,
      brand,
      brandImageUrl,
      bodyText: staffResolvedExperience.emailBody,
      options: options.map((o) => ({ name: o.name, recommended: o.recommended, kind: o.kind, totalCents: estimateOptionTotalCents(o) })),
      footerLines: staffResolvedExperience.acceptPageFooter.split('\n'),
      sender: user?.email ? { name: profileName?.trim() || '', email: user.email } : null,
      dateLabel,
    })
  }, [
    row,
    staffResolvedExperience,
    acceptanceDocHeaderBrand,
    isDraft,
    syncedEstimateOptions,
    previewEmailTitle,
    totalCents,
    validUntil,
    acceptancePreviewForLine,
    acceptUrlForTemplatePreview,
    user?.email,
    profileName,
  ])

  const cxTemplateDefaults = useMemo(
    () => mergeEstimateExperienceStrings(appCxSettings, {}, { docKind: row?.doc_kind }),
    [appCxSettings, row?.doc_kind],
  )

  function handleSelectCustomer(c: CustomerRow) {
    const prev = customerId ? customers.find((x) => x.id === customerId) : undefined
    const prevName = prev?.name?.trim() ?? ''

    setForAddress('')
    setCustomerId(c.id)
    setCustomerSearch(getCustomerDisplay(c))
    const crm = extractContactFromCustomer(c).email.trim()
    if (crm) setSendEmailOverride('')

    if (row?.status !== 'draft') return
    if (shouldReplaceTitleOnCustomerChange(title, prevName)) setTitle(defaultEstimateTitle(c.name ?? '', isCO))
  }

  function handleCustomerSearchChange(value: string) {
    setCustomerSearch(value)
    if (customerId) {
      const selected = customers.find((c) => c.id === customerId)
      if (
        !selected ||
        !value.trim() ||
        getCustomerDisplay(selected).toLowerCase() !== value.trim().toLowerCase()
      ) {
        setCustomerId(null)
        setSendEmailOverride('')
        setForAddress('')
      }
    }
  }

  async function sendToCustomer() {
    if (!row || row.status !== 'draft' || sending || !user) return
    if (unfinishedDateStopsSending()) return
    if (!customerId) {
      showToast('Choose a customer before sending.', 'error')
      return
    }
    let sel = customers.find((c) => c.id === customerId)
    if (!sel) {
      try {
        const one = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
              .eq('id', customerId)
              .maybeSingle(),
          'load customer for send',
        )
        if (one) {
          sel = one as CustomerRow
          setCustomers((prev) =>
            [...prev.filter((x) => x.id !== sel!.id), sel!].sort((a, b) =>
              (a.name || '').localeCompare(b.name || ''),
            ),
          )
        }
      } catch {
        /* ignore */
      }
    }
    if (!sel) {
      showToast('Could not load the selected customer.', 'error')
      return
    }
    const plan = estimateSendPlan({
      customerEmail: extractContactFromCustomer(sel).email.trim(),
      override: sendEmailOverride,
      isChangeOrder: isCO,
      totalCents,
      role,
    })
    if (plan.kind === 'refuse') {
      showToast(plan.why, 'error')
      return
    }
    const payloadEmail = plan.email
    // Tier-2 #42 (J17-F4): one confirm that names the recipient — this emails a
    // real customer. Rail decision 1's $0 soft gate (schedule-only change
    // orders are legitimate, silent $0 sends are not) folds into the same ask.
    recordNavClick(user.id, role, 'discard_guard_shown', 'estimate_send')
    // Tell the customer (v2.5594): a normal estimate's send goes through the sheet, which emails it, texts the link, and shows the receipt with the call.
    if (plan.kind === 'sheet') {
      setTellEstimate({ estimateId: row.id, customerId: sel.id, customerName: sel.name ?? null, email: payloadEmail, totalCents, number: row.estimate_number, title: (row.status === 'draft' ? title : row.title) ?? '', jobId: row.job_ledger_id ?? null })
      return
    }
    const okSend = await confirmDialog({ title: plan.title, message: plan.message, confirmLabel: plan.confirmLabel })
    if (!okSend) return
    await sendEstimateEmail(payloadEmail)
  }

  /**
   * The estimate's email as the sheet hears it (v2.5681, punch list #133): ok with the accept link, or why not — never
   * a bare null, never a toast (the sheet owns the words). Mode `resend` is Send the link again on an estimate that
   * already went: a fresh link, the old one dead. The refresh after a send stands apart: a page that fails to reload
   * never reads as a send that failed.
   */
  async function sendEstimateEmailAnswer(payloadEmail: string, mode: 'send' | 'resend'): Promise<TellSendEmailAnswer> {
    if (!row) return { ok: false, kind: 'refused', why: 'The estimate is not open.' }
    setSending(true)
    try {
      // The pre-send save skips its reload (v2.5695): the refresh after the send re-seeds the editor once, without blanking the page.
      if (mode === 'send') await saveDraft({ skipReload: true })
      const post = await postSendEstimate(
        mode === 'resend' ? { estimateId: row.id, mode: 'resend', timeoutMs: 20_000 } : { estimateId: row.id, mode: 'send', customerEmail: payloadEmail, timeoutMs: 20_000 },
      )
      if (post.kind === 'no-session') return { ok: false, kind: 'refused', why: 'Not signed in. Sign in again and retry.' }
      if (post.kind === 'slow') return { ok: false, kind: 'slow', why: 'No answer after 20 seconds.' }
      const json = post.json
      const answer = sendEstimateAnswerFrom(post.httpOk, json)
      if (!answer.ok) return answer
      if (json.accept_url) {
        setLastAcceptUrl(json.accept_url)
        storeEstimateAcceptUrl(row.id, json.accept_url)
      }
      if (!json.emailed && json.accept_url) {
        void navigator.clipboard.writeText(json.accept_url)
      }
      try {
        await load({ refresh: true })
      } catch {
        /* the page is stale; the send stands */
      }
      return answer
    } catch (e) {
      return { ok: false, kind: 'refused', why: formatErrorMessage(e, 'Send failed') }
    } finally {
      setSending(false)
    }
  }

  /** The same send with the page's own toasts, for the asks that have no sheet (a change order, a $0 total). */
  async function sendEstimateEmail(payloadEmail: string): Promise<{ acceptUrl: string | null; emailed: boolean } | null> {
    const a = await sendEstimateEmailAnswer(payloadEmail, 'send')
    if (!a.ok) {
      showToast(a.why, 'error')
      return null
    }
    showToast(a.emailed ? 'Email sent.' : `Link ready. ${a.warning || ''}`, 'success')
    return { acceptUrl: a.acceptUrl, emailed: a.emailed }
  }

  function openCreateJobModal() {
    if (!row || row.status !== 'customer_accepted' || row.job_ledger_id) return
    setCreateJobModalOpen(true)
  }

  /**
   * Phase 4 of the Bid Room (v2.2472): publish a bid-linked CO draft into the GC's room —
   * the CO freezes (status sent, no email, no per-CO token; the room link is the credential)
   * and the GC signs it on the same page as the proposal.
   */
  async function publishCoToBidRoom() {
    if (!row || !isDraft || !isCO || !row.bid_id || saving || sending) return
    if (unfinishedDateStopsSending()) return
    const { data: roomRows } = await supabase
      .from('bid_proposal_rooms')
      .select('id, customer_id, public_token')
      .eq('bid_id', row.bid_id)
      .is('closed_at', null)
    const rooms = (roomRows ?? []) as Array<{ id: string; customer_id: string | null; public_token: string }>
    if (rooms.length === 0) {
      showToast('No open bid room for this bid — open one from the bid\u2019s Cover Letter first.', 'error')
      return
    }
    const target = pickBidRoomForChangeOrder(rooms, row.customer_id)
    if (!target) {
      showToast('This bid has several rooms and none matches this CO\u2019s customer — set the CO\u2019s customer to the right GC first.', 'error')
      return
    }
    if (
      !(await confirmDialog({
        message: `Publish this change order into the bid room? The GC signs it there — no separate email link.`,
        confirmLabel: 'Publish to room',
      }))
    )
      return
    const saved = await saveDraft({ quiet: true })
    if (!saved) return
    // draft→sent is a privileged transition (estimates_update_draft pins status to 'draft'), so
    // the write goes through the SECURITY DEFINER RPC — found live by the v2.2472 E2E (v2.2476).
    const { error: pubErr } = await supabase.rpc('publish_co_to_bid_room', {
      p_estimate_id: row.id,
      p_room_id: target.id,
    })
    if (pubErr) {
      showToast(formatErrorMessage(pubErr, 'Could not publish the change order'), 'error')
      return
    }
    window.dispatchEvent(new Event('bid-room-changed'))
    showToast('Change order published to the bid room — the GC signs it there.', 'success')
    await load()
  }

  async function deleteDraft() {
    if (!row || !isDraft) return
    if (!(await confirmDialog({ message: 'Delete this draft?', confirmLabel: 'Delete', danger: true }))) return
    try {
      await withSupabaseRetry(
        async () => await supabase.from('estimates').delete().eq('id', row.id).eq('status', 'draft'),
        'delete estimate',
      )
      committedDraftRowIdRef.current = row.id
      showToast('Deleted', 'success')
      navigate('/estimates')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not delete'), 'error')
    }
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => {
      const next = [...prev]
      const cur = next[i]
      if (!cur) return prev
      next[i] = patchDraftLine(cur, patch, { allowNegative: isCO })
      return next
    })
  }

  const lineItemRecentChips = useMemo(
    () =>
      resolveRecentChips(lineItemRecentIds, catalogLineItems).filter(
        (c) => !isDefaultDraftStubShape(c.line_item, c.description, c.amount_cents),
      ),
    [lineItemRecentIds, catalogLineItems],
  )

  function applyFromCatalogEntry(entry: EstimateCatalogLineItem) {
    const row = catalogEntryToLineItem(entry)
    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (last && isReplaceableStubLine(last)) {
        const next = [...prev]
        next[next.length - 1] = row
        return next
      }
      return [...prev, row]
    })
    if (user?.id) {
      const sk = estimateLineItemRecentsStorageKey(user.id)
      setLineItemRecentIds((prev) => {
        const next = recordRecentCatalogPick(prev, entry.id)
        persistRecentCatalogIds(sk, next)
        return next
      })
    }
    setCatalogModalOpen(false)
  }

  // The Tell sheet (v2.5594) sits above the loading early-return and first in both trees, keyed (v2.5695, punch
  // list #139): a refresh of the page behind it must never unmount the sheet, or the receipt it is about to show
  // lands on a dead instance and the office reads an unchanged sheet after a send that went.
  const tellSheet =
    tellEstimate && user ? (
      <TellCustomerSheet
        key="tell-sheet"
        moment="estimate"
        jobId={tellEstimate.jobId}
        jobLabel={`Estimate #${tellEstimate.number}${tellEstimate.title ? ` · ${tellEstimate.title}` : ''}`}
        estimate={{
          estimateId: tellEstimate.estimateId,
          customerId: tellEstimate.customerId,
          email: tellEstimate.email,
          amount: `$${formatCurrency(tellEstimate.totalCents / 100)}`,
          title: tellEstimate.title,
          jobId: tellEstimate.jobId,
          sendEmail: () => sendEstimateEmailAnswer(tellEstimate.email, 'send'),
          sendEmailAgain: () => sendEstimateEmailAnswer(tellEstimate.email, 'resend'),
          // Preview on the sheet (v2.5794): the same built email the page's own Email preview shows.
          previewEmail: customerEmailPreview ? { from: estimateEmailFrom(acceptanceDocHeaderBrand), replyTo: customerEmailPreview.replyTo, subject: customerEmailPreview.subject, html: customerEmailPreview.html } : null,
        }}
        userId={user.id}
        role={role}
        onClose={() => setTellEstimate(null)}
        // What went re-reads once the sheet's text lands (v2.6658, punch list #139's walk): the page read it during the
        // email leg's refresh, before the text went, and said *No text went* under a receipt that said it did.
        onSent={() => setWhatWentRevision((n) => n + 1)}
      />
    ) : null

  if (loading || !row) {
    return (
      <div className={`${ESTIMATES_PAGE_CLASS} estimates-page-shell--detail`}>
        {tellSheet}
        <style>{estimateDetailPageCss}</style>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className={`${ESTIMATES_PAGE_CLASS} estimates-page-shell--detail`}>
      {tellSheet}
      <style>{estimateDetailPageCss}</style>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/estimates">← Estimates</Link>
      </div>
      {isDraft ? (
        <EstimateDraftStepRail
          steps={railData.steps}
          sendGate={railData.sendGate}
          onStepClick={handleRailStepClick}
          onSend={() => void sendToCustomer()}
          sending={sending}
          sendLabel={isCO ? 'Send for signature' : 'Send to customer'}
          customerViewOn={customerViewOn}
          onToggleCustomerView={() => setCustomerViewOn((p) => !p)}
        />
      ) : null}
      {isDraft && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            marginBottom: '1rem',
          }}
        >
          <div
            id="est-step-customer"
            ref={customerSearchSectionRef}
            className={
              'est-region-tint' +
              (customerSearchHighlight || railFlashStep === 'customer' ? ' estimate-customer-search-highlight' : '')
            }
            style={{ width: '100%', maxWidth: 480, textAlign: 'left' }}
          >
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>{railStepDot('customer')}Customer</span>
            <CustomerSearchCombobox
              customers={filterActiveCustomersForPicker(customers, customerId)}
              loading={customersLoading}
              valueId={customerId}
              searchText={customerSearch}
              onSearchTextChange={handleCustomerSearchChange}
              onSelect={handleSelectCustomer}
              onClear={() => {
                setCustomerId(null)
                setCustomerSearch('')
                setSendEmailOverride('')
                setForAddress('')
              }}
              onRequestCreateNew={() => setCreateCustomerOpen(true)}
              placeholder="Search customers…"
            />
            {selectedCustomer && (
              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-700)',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--bg-subtle)',
                  borderRadius: 6,
                  maxWidth: 480,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: '0.35rem',
                      rowGap: '0.25rem',
                    }}
                  >
                    <strong>Email:</strong>{' '}
                    {crmEmailForSelected ? (
                      <span>{crmEmailForSelected}</span>
                    ) : showSendEmailOverride ? (
                      emailOverrideRevealed || sendEmailOverride.trim() ? null : (
                        <button
                          type="button"
                          aria-label="Add email for acceptance delivery"
                          onClick={() => {
                            setEmailOverrideRevealed(true)
                            queueMicrotask(() => sendEmailOverrideInputRef.current?.focus())
                          }}
                          style={{
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-red-700)',
                            cursor: 'pointer',
                            font: 'inherit',
                            fontSize: '0.875rem',
                            textDecoration: 'underline',
                            textUnderlineOffset: '2px',
                            maxWidth: '100%',
                            textAlign: 'left',
                          }}
                        >
                          required, click to add
                        </button>
                      )
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  {showSendEmailOverride && !crmEmailForSelected && (emailOverrideRevealed || sendEmailOverride.trim()) ? (
                    <input
                      ref={sendEmailOverrideInputRef}
                      type="email"
                      autoComplete="email"
                      value={sendEmailOverride}
                      onChange={(e) => setSendEmailOverride(e.target.value)}
                      placeholder="Address for acceptance link"
                      style={estInputBlock({ marginTop: '0.35rem' })}
                    />
                  ) : null}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.35rem',
                    marginTop: '0.35rem',
                  }}
                >
                  <div>
                    <strong>Phone:</strong> {extractContactFromCustomer(selectedCustomer).phone.trim() || '—'}
                  </div>
                  {editCustomerModal && customerId ? (
                    <button
                      type="button"
                      onClick={openDraftCustomerForEdit}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-link)',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontSize: '0.875rem',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        flexShrink: 0,
                        marginLeft: 'auto',
                      }}
                    >
                      Edit customer
                    </button>
                  ) : null}
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                    }}
                  >
                    {showRecentCustomerNotePreview ? (
                      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                        <strong>Most recent note:</strong>{' '}
                        {customerNotesLoading && customerNotesEntries.length === 0 ? (
                          <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
                        ) : (
                          <span
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              wordBreak: 'break-word',
                            }}
                          >
                            {recentNotePreviewText}
                          </span>
                        )}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      aria-expanded={customerNotesExpanded}
                      onClick={() => setCustomerNotesExpanded((v) => !v)}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-link)',
                        cursor: 'pointer',
                        font: 'inherit',
                        fontSize: '0.875rem',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                        flexShrink: 0,
                        ...(!showRecentCustomerNotePreview ? { marginLeft: 'auto' } : {}),
                      }}
                    >
                      {draftNotesToggleLabel}
                    </button>
                  </div>
                  {customerNotesExpanded && customerId ? (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        maxWidth: '100%',
                        minWidth: 0,
                        overflowX: 'auto',
                      }}
                    >
                      <CustomerNotesTable
                        customerId={customerId}
                        customerName={selectedCustomer.name?.trim() || 'Customer'}
                        title=""
                        hasBidsAbove={false}
                        contactsState={{
                          entries: customerNotesEntries,
                          loading: customerNotesLoading,
                          refetch: refetchCustomerNotes,
                        }}
                        onLoadError={(m) => showToast(m, 'error')}
                        onMutated={() => {
                          void refetchCustomerNotes()
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <EstimateDraftCustomerGate active={draftNeedsCustomer} onBlockedInteraction={requestCustomerFirst}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            {isDraft || row.status === 'customer_accepted' ? (
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  lineHeight: 1.25,
                }}
              >
                # {row.estimate_number}
                {isChangeOrderDocKind(row.doc_kind) ? (
                  <>
                    {' '}
                    <EstimateChangeOrderChip />
                  </>
                ) : isLegacyChangeOrderTitledEstimate(row.doc_kind, title) ? (
                  <>
                    {' '}
                    <EstimateLegacyChangeOrderTitleChip />
                  </>
                ) : null}
              </span>
          ) : (
            <h1 style={{ margin: 0 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 600 }}>
                # {row.estimate_number}
              </span>{' '}
              {isChangeOrderDocKind(row.doc_kind) ? (
                <>
                  <EstimateChangeOrderChip />{' '}
                </>
              ) : isLegacyChangeOrderTitledEstimate(row.doc_kind, title) ? (
                <>
                  <EstimateLegacyChangeOrderTitleChip />{' '}
                </>
              ) : null}
              {title || 'Estimate'}
            </h1>
          )}
        </div>
        <span style={{ fontWeight: 600, color: 'var(--text-amber-800)' }}>{statusLabel(row.status)}</span>
      </div>

      {!isDraft && row.status !== 'customer_accepted' ? (
        <>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }}>
            <strong>For:</strong>{' '}
            {(() => {
              const cust = row.customer_id ? customers.find((c) => c.id === row.customer_id) : undefined
              const crm = cust?.address?.trim() ?? ''
              return row.for_address?.trim() || crm || '—'
            })()}
          </p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }}>
            <strong>Acceptance page logo:</strong>{' '}
            {acceptanceDocHeaderBrand ? acceptHeaderBrandLabel(acceptanceDocHeaderBrand) : 'None'}
          </p>
          {(() => {
            // v2.5992 (#206 PR 1): the office reads the good-through day where the customer does, and sees when it passed.
            const gt = goodThroughState(row.valid_until, todayYmd)
            if (gt.kind === 'none') return null
            return (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: 'var(--text-700)' }} data-testid="estimate-good-through">
                <strong>Good through:</strong> {formatValidUntilForDisplay(gt.ymd)}
                {gt.kind === 'passed' ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}> · passed</span> : null}
              </p>
            )
          })()}
          {isCO ? (
            <section style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-700)' }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Change order</h2>
              <p style={{ margin: '0.25rem 0' }}>
                <strong>Description of change:</strong> {coFields.description_of_change.trim() || '—'}
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                <strong>Reason for change:</strong> {coFields.reason_for_change.trim() || '—'}
              </p>
              <p style={{ margin: '0.25rem 0' }}>
                <strong>Impact on schedule:</strong> {coFields.impact_on_schedule.trim() || '—'}
              </p>
              {coFields.response_requested_by.trim() ? (
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Response requested by:</strong> {coFields.response_requested_by}
                </p>
              ) : null}
            </section>
          ) : null}
          {rowOfferedOptions.length >= 2 ? (
            // What was offered (v2.5988, #206 PR 2): every option as it went, not the recommended one's frozen lines alone.
            <EstimateOfferedOptions options={rowOfferedOptions} />
          ) : (
            <section style={{ marginTop: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
                {staffResolvedExperience?.docLineItemsHeading ?? (isCO ? 'Impact on cost' : 'Line items')}
              </h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-700)' }}>
                <EstimateLineItemsTable lines={normalizeEstimateLineItemsFromJson(row.line_items_snapshot, { allowNegative: isCO })} />
              </div>
            </section>
          )}
        </>
      ) : null}

      {isDraft && (
        <>
          {customerViewOn && staffResolvedExperience ? (
            <div
              style={{
                fontFamily: 'system-ui, sans-serif',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '1rem',
                background: 'var(--surface)',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <EstimateAcceptBody
                variant="staffPreview"
                previewBanner={
                  <span>
                    <strong>Customer view</strong> — the live document, rendered by the same code as the signature
                    page. Switch back to Editing to change it.
                  </span>
                }
                estimate={{
                  title: title.trim() || '',
                  for_line: acceptancePreviewForLine,
                  valid_until: validUntil.trim() ? validUntil.trim() : null,
                  line_items_snapshot: lines,
                  terms_snapshot: terms,
                  total_cents: totalCents,
                  doc_kind: row.doc_kind,
                  change_order_fields: coFields,
                }}
                options={syncedEstimateOptions}
                selectedOptionKeys={previewSelectedOptionKeys}
                onToggleOption={(key) => setPreviewSelectedOptionKeys((prev) => toggleEstimateOptionSelection(syncedEstimateOptions, prev, key))}
                experience={staffResolvedExperience}
                printedName=""
                agreed={false}
                onPrintedNameChange={() => {}}
                onAgreedChange={() => {}}
                formError={null}
                submitting={false}
                onSubmit={() => undefined}
                headerBrand={acceptanceDocHeaderBrand}
                customerAttachment={customerAttachmentPreview}
                staffAcceptedRecord={null}
              />
            </div>
          ) : null}
          <div style={customerViewOn && staffResolvedExperience ? { display: 'none' } : undefined}>
          <AcceptHeaderBrandPicker
            value={acceptHeaderBrand}
            onChange={setAcceptHeaderBrand}
            documentTitleSlot={
              <div style={{ minWidth: 0 }}>
                {draftTitleEditing ? (
                  <>
                    <label id="estimate-draft-title-field" style={{ display: 'block', marginTop: 0 }}>
                      <span style={{ fontWeight: 500 }}>Title</span>
                      <input
                        ref={titleInputRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        style={estInputBlock()}
                      />
                    </label>
                    <div style={{ marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        aria-expanded={draftTitleEditing}
                        aria-controls="estimate-draft-title-field"
                        aria-label="Done editing title"
                        onClick={() => setDraftTitleEditing(false)}
                        style={{ ...estSmallSecondaryButton(), flexShrink: 0 }}
                      >
                        Done
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.35rem',
                        minWidth: 0,
                      }}
                    >
                      <h1
                        style={{
                          margin: 0,
                          minWidth: 0,
                          maxWidth: '100%',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {title.trim() || 'Estimate'}
                      </h1>
                      <button
                        type="button"
                        aria-expanded={draftTitleEditing}
                        aria-controls="estimate-draft-title-field"
                        aria-label="Edit title"
                        onClick={() => setDraftTitleEditing(true)}
                        style={{
                          flexShrink: 0,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: 0,
                          padding: '0.25rem',
                          border: 'none',
                          background: 'transparent',
                          lineHeight: 0,
                          cursor: 'pointer',
                          color: 'var(--text-link)',
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 640 640"
                          width={18}
                          height={18}
                          aria-hidden
                        >
                          <path
                            fill="currentColor"
                            d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z"
                          />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            }
            forFieldSlot={
              <>
                {!customerId ? (
                  <span
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-red-600)',
                      marginBottom: '0.35rem',
                      textAlign: 'center',
                    }}
                  >
                    Select a customer to enable.
                  </span>
                ) : null}
                <label
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <strong>For:</strong>
                  <input
                    value={forAddress}
                    onChange={(e) => setForAddress(e.target.value)}
                    disabled={!customerId}
                    placeholder={selectedCustomer?.address?.trim() || 'Customer address…'}
                    style={{
                      ...estInputBase,
                      flex: '1 1 200px',
                      minWidth: 0,
                      maxWidth: 480,
                      padding: '0.5rem',
                      opacity: !customerId ? 0.65 : 1,
                      cursor: !customerId ? 'not-allowed' : 'text',
                    }}
                  />
                </label>
              </>
            }
            expiresOnSlot={
              <label
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <strong style={{ flexShrink: 0 }}>Expires on:</strong>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => {
                    const v = e.target.value
                    setValidUntil(v)
                    setValidUntilPreset(presetMatchingTodayOffset(v))
                  }}
                  style={{ ...estInputBase, padding: '0.5rem' }}
                />
                {([7, 15, 30] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={validUntilPreset === n}
                    onClick={() => {
                      setValidUntil(addCalendarDaysYmd(n))
                      setValidUntilPreset(n)
                    }}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: validUntilPreset === n ? 600 : 500,
                      borderRadius: 4,
                      border: validUntilPreset === n ? 'none' : '1px solid var(--border-strong)',
                      background: validUntilPreset === n ? '#ea580c' : 'var(--bg-muted)',
                      color: validUntilPreset === n ? 'white' : 'var(--text-700)',
                      cursor: 'pointer',
                    }}
                  >
                    {n} days
                  </button>
                ))}
              </label>
            }
            lineItemsSlot={
          <section style={{ marginTop: 0 }}>
            <EstimateFieldPhotosStrip estimateId={row.id} />
            <EstimateFirstLookStrip estimateId={row.id} />
            {isCO ? (
              <div
                id="est-step-change"
                className={'est-region-tint' + (railFlashStep === 'change' ? ' estimate-customer-search-highlight' : '')}
                style={{
                  border: '1px solid #f59e0b',
                  borderRadius: 8,
                  padding: '0.6rem 0.8rem 0.8rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{railStepDot('change')}Change order</h2>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  Description of change
                  <AutosizeTextarea
                    value={coFields.description_of_change}
                    onChange={(e) => setCoFields((prev) => ({ ...prev, description_of_change: e.target.value }))}
                    placeholder="What is changing — scope, plan reference…"
                    minRows={2}
                    style={{ ...estInputBase, fontWeight: 400, width: '100%', padding: '0.5rem' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  Reason for change
                  <AutosizeTextarea
                    value={coFields.reason_for_change}
                    onChange={(e) => setCoFields((prev) => ({ ...prev, reason_for_change: e.target.value }))}
                    placeholder="Owner directive, field condition, plan revision…"
                    minRows={1}
                    style={{ ...estInputBase, fontWeight: 400, width: '100%', padding: '0.5rem' }}
                  />
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flex: '1 1 200px' }}>
                    Impact on schedule
                    <input
                      value={coFields.impact_on_schedule}
                      onChange={(e) => setCoFields((prev) => ({ ...prev, impact_on_schedule: e.target.value }))}
                      placeholder='"+2 working days", "none"…'
                      style={{ ...estInputBase, fontWeight: 400, padding: '0.5rem' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flex: '0 1 180px' }}>
                    Response requested by
                    <input
                      type="date"
                      value={coFields.response_requested_by}
                      onChange={(e) => setCoFields((prev) => ({ ...prev, response_requested_by: e.target.value }))}
                      style={{ ...estInputBase, fontWeight: 400, padding: '0.5rem' }}
                    />
                  </label>
                </div>
              </div>
            ) : null}
            {!isCO && isDraft ? (
              <EstimateOptionsStrip
                estimateOptions={estimateOptions}
                syncedEstimateOptions={syncedEstimateOptions}
                viewedOptionKey={viewedOptionKey}
                viewedOption={viewedOption}
                lines={lines}
                totalCents={totalCents}
                switchViewedOption={switchViewedOption}
                addEstimateOption={addEstimateOption}
                patchViewedOption={patchViewedOption}
                setViewedOptionKind={setViewedOptionKind}
                removeViewedOption={removeViewedOption}
                setEstimateOptions={setEstimateOptions}
                setPreviewSelectedOptionKeys={setPreviewSelectedOptionKeys}
              />
            ) : null}
            {(() => {
              // v2.2911 (J16-F2 / P2): a draft bridged from Bids shows the typed cost text
              // where the money is entered, instead of leaving it to the internal note.
              if (!isCO) return null
              const bridged = bridgedCostImpactText({ lines, internalNotes })
              if (!bridged) return null
              return (
                <div
                  role="note"
                  style={{ margin: '0 0 0.6rem', padding: '0.55rem 0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderLeft: '3px solid #f59e0b', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-amber-800)' }}>From the Bids form — Impact on Cost as typed:</span>{' '}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{bridged}</span>
                  <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                    {totalCents === 0
                      ? 'The draft was created at $0 — add the cost lines below if the price changes.'
                      : `Carried below as one net-change line (${formatSignedCentsUsd(totalCents)}). Split it into itemized lines if the customer wants the breakdown.`}
                  </span>
                </div>
              )
            })()}
            <div
              id="est-step-cost"
              className={'est-region-ruled' + (railFlashStep === 'cost' ? ' estimate-customer-search-highlight' : '')}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{railStepDot('cost')}{isCO ? 'Impact on cost' : 'Line items'}</h2>
              {lineItemRecentChips.map((c) => {
                const primary = (c.line_item.trim() || c.description.trim() || '(line)').slice(0, 40)
                const short = primary.length > 36 ? `${primary.slice(0, 35)}…` : primary
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyFromCatalogEntry(c)}
                    title={`${c.line_item ? `${c.line_item} · ` : ''}${c.description} — ${c.quantity} × ${formatMoney(c.unit_price_cents)}`}
                    style={{
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.8125rem',
                      fontWeight: 500,
                      borderRadius: 4,
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-muted)',
                      color: 'var(--text-700)',
                      cursor: 'pointer',
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
            <EstimateLineItemCatalogModal open={catalogModalOpen} onClose={() => setCatalogModalOpen(false)} catalogLineItems={catalogLineItems} onReloadCatalog={loadCatalogFromDb} canManage={canManageEstimateCatalog} onInsert={applyFromCatalogEntry} />
            {isCO && lines.length === 0 ? (
              <div style={{ ...coPromptPanelStyle, textAlign: 'center', marginBottom: '0.75rem' }}>
                <p style={{ margin: '0 0 0.2rem', fontWeight: 600 }}>What does this change include?</p>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Each line becomes part of the signed contract change.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => addCoLine('add')} style={coPromptChipStyle('add')}>
                    + Added work
                  </button>
                  <button type="button" onClick={() => addCoLine('credit')} style={coPromptChipStyle('credit')}>
                    − Credit / removed work
                  </button>
                </div>
                {canManageEstimateCatalog || catalogLineItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCatalogModalOpen(true)}
                    style={{
                      marginTop: '0.6rem',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '0.8rem',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                    }}
                  >
                    or pick from the line-item catalog
                  </button>
                ) : null}
              </div>
            ) : null}
            <ul
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                listStylePosition: 'outside',
              }}
            >
              {lines.map((ln, i) => {
                const coCredit = isCO && isCoCreditLine(ln.line_item, ln.unit_price_cents)
                return (
                <li key={i} style={{ marginBottom: '0.35rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div className="estimate-detail-line-item-block">
                      <div className="estimate-detail-line-item-line">
                        <input
                          ref={(el) => {
                            if (el && coFocusLineIndexRef.current === i) {
                              coFocusLineIndexRef.current = null
                              el.focus()
                            }
                          }}
                          placeholder="Line item"
                          value={ln.line_item}
                          onChange={(e) => updateLine(i, { line_item: e.target.value })}
                          style={{ ...estInputBase, padding: '0.5rem' }}
                        />
                      </div>
                      <div className="estimate-detail-line-item-qty-unit">
                        <input
                          className="no-spinner"
                          type="number"
                          min={0}
                          step="any"
                          placeholder="Count"
                          title="Count"
                          value={ln.quantity}
                          onChange={(e) => updateLine(i, { quantity: coerceDraftQuantity(e.target.value) })}
                          style={{ ...estInputBase, width: 72, padding: '0.5rem' }}
                        />
                        <input
                          className="no-spinner"
                          type="number"
                          min={isCO ? undefined : 0}
                          step="0.01"
                          placeholder="Unit ($)"
                          title={
                            coCredit
                              ? 'Credit line — this amount is credited back to the customer'
                              : isCO
                                ? 'Negative unit price = credit line'
                                : undefined
                          }
                          value={
                            ln.unit_price_cents
                              ? (coCredit ? Math.abs(ln.unit_price_cents) : ln.unit_price_cents) / 100
                              : ''
                          }
                          onChange={(e) => updateLine(i, { unit_price_cents: draftUnitPriceInputCents(e.target.value, { credit: coCredit }) })}
                          style={{
                            ...estInputBase,
                            width: 100,
                            padding: '0.5rem',
                            ...(coCredit ? { color: 'var(--text-red-700)' } : {}),
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                          aria-label="Remove line"
                          title="Remove line"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            margin: 0,
                            padding: 0,
                            border: '1px solid var(--border-red)',
                            borderRadius: '50%',
                            background: 'var(--bg-red-tint)',
                            color: 'var(--text-red-700)',
                            fontSize: '1.125rem',
                            fontWeight: 500,
                            lineHeight: 0,
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          −
                        </button>
                      </div>
                    </div>
                    <input
                      placeholder="Description (optional)"
                      aria-label="Description (optional)"
                      value={ln.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      style={{
                        ...estInputBase,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        padding: '0.5rem',
                      }}
                    />
                  </div>
                </li>
                )
              })}
              {isCO && lines.length === 0 ? null : (
              <li style={{ marginBottom: '0.35rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minHeight: 38,
                    flexWrap: 'wrap',
                  }}
                >
                  {isCO ? (
                    <>
                      <button type="button" onClick={() => addCoLine('add')} style={coPromptChipStyle('add')}>
                        + Added work
                      </button>
                      <button type="button" onClick={() => addCoLine('credit')} style={coPromptChipStyle('credit')}>
                        − Credit / removed work
                      </button>
                    </>
                  ) : (
                  <button
                    type="button"
                    onClick={() => setLines((p) => [...p, emptyDraftLine()])}
                    aria-label="Add line"
                    title="Add line"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      margin: 0,
                      padding: 0,
                      border: '1px solid var(--border-strong)',
                      borderRadius: '50%',
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-700)',
                      fontSize: '1.125rem',
                      fontWeight: 500,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                  )}
                  <button
                    type="button"
                    aria-label="Open line item catalog"
                    onClick={() => setCatalogModalOpen(true)}
                    disabled={!canManageEstimateCatalog && catalogLineItems.length === 0}
                    title={
                      !canManageEstimateCatalog && catalogLineItems.length === 0
                        ? 'No catalog items'
                        : canManageEstimateCatalog && catalogLineItems.length === 0
                          ? 'Open catalog to add preset line items'
                          : 'Preset line items (edit catalog in modal)'
                    }
                    onMouseEnter={() => {
                      if (canManageEstimateCatalog || catalogLineItems.length > 0) setCatalogIconHovered(true)
                    }}
                    onMouseLeave={() => setCatalogIconHovered(false)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: 0,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      lineHeight: 0,
                      flexShrink: 0,
                      cursor:
                        !canManageEstimateCatalog && catalogLineItems.length === 0 ? 'not-allowed' : 'pointer',
                      color:
                        !canManageEstimateCatalog && catalogLineItems.length === 0 ? 'var(--text-faint)'
                        : catalogIconHovered ? 'var(--text-blue-700)'
                        : 'var(--text-link)',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={22} height={22} aria-hidden>
                      <path
                        fill="currentColor"
                        d="M192 576L512 576C529.7 576 544 561.7 544 544C544 526.3 529.7 512 512 512L512 445.3C530.6 438.7 544 420.9 544 400L544 112C544 85.5 522.5 64 496 64L448 64L448 233.4C448 245.9 437.9 256 425.4 256C419.4 256 413.6 253.6 409.4 249.4L368 208L326.6 249.4C322.4 253.6 316.6 256 310.6 256C298.1 256 288 245.9 288 233.4L288 64L192 64C139 64 96 107 96 160L96 480C96 533 139 576 192 576zM160 480C160 462.3 174.3 448 192 448L448 448L448 512L192 512C174.3 512 160 497.7 160 480z"
                      />
                    </svg>
                  </button>
                </div>
              </li>
              )}
            </ul>
            <p style={{ fontWeight: 600, textAlign: 'right' }}>
              {isCO ? <>Net change to contract: {formatSignedCentsUsd(totalCents)}</> : <>Total: {formatMoney(totalCents)}</>}
            </p>
            {customerAttachmentPreview ?
              <EstimateCustomerAttachmentCard attachment={customerAttachmentPreview} />
            : (
              <section
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem 1.15rem',
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 8,
                  background: 'var(--bg-page)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
                aria-labelledby="estimate-draft-supporting-doc-placeholder-heading"
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    gap: '0.75rem 1rem',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: 'var(--bg-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '1.25rem',
                      color: 'var(--text-faint)',
                      fontWeight: 600,
                    }}
                    aria-hidden
                  >
                    PDF
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <h2
                      id="estimate-draft-supporting-doc-placeholder-heading"
                      style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-faint)' }}
                    >
                      Supporting document
                    </h2>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      Preview — add a label and URL in Supporting document (Optional) below.
                    </p>
                  </div>
                </div>
              </section>
            )}
            <section
              id="est-step-paper_extras"
              className={'est-region-ruled est-region-tint' + (railFlashStep === 'paper_extras' ? ' estimate-customer-search-highlight' : '')}
              style={{ marginTop: '1.5rem' }}
            >
              <h2
                style={{
                  fontSize: '1.1rem',
                  margin: '0 0 0.5rem',
                  color: terms.trim() ? 'var(--text-strong)' : 'var(--text-faint)',
                  transition: 'color 0.15s ease',
                }}
              >
                {railStepDot('paper_extras')}
                {staffResolvedExperience?.docTermsHeading ?? 'Terms'}
              </h2>
              <AutosizeTextarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                minRows={1}
                extraLines={terms.trim() ? 1 : 0}
                style={{
                  ...estInputBase,
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '1rem',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              />
            </section>
          </section>
            }
          />
          </div>
          <EstimateSupportingDocumentFieldset
            label={customerAttachmentLabel}
            url={customerAttachmentUrl}
            onLabelChange={setCustomerAttachmentLabel}
            onUrlChange={setCustomerAttachmentUrl}
            checkStatus={attachmentCheckStatus}
            checkMessage={attachmentCheckMessage}
            onCheck={() => void checkCustomerAttachmentUrl()}
          />
          <EstimateDeliverySection
            flash={railFlashStep === 'delivery'}
            stepDot={railStepDot('delivery')}
            user={user}
            profileName={profileName}
            acceptNotifyUserIds={acceptNotifyUserIds}
            setAcceptNotifyUserIds={setAcceptNotifyUserIds}
            notifyUserOptions={notifyUserOptions}
            linkedProjectId={linkedProjectId}
            setLinkedProjectId={setLinkedProjectId}
            projectsForPicker={projectsForPicker}
            internalNotes={internalNotes}
            setInternalNotes={setInternalNotes}
          />
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '1rem',
              justifyContent: 'center',
            }}
          >
            <button type="button" onClick={() => void saveDraft()} disabled={saving} style={estSecondaryButton(saving)}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <span
              aria-live="polite"
              style={{ alignSelf: 'center', fontSize: '0.75rem', color: draftAutosave.status === 'error' ? 'var(--text-red-600)' : 'var(--text-muted)' }}
            >
              {draftAutosave.status === 'error'
                ? 'Autosave failed — press Save draft'
                : saving || draftAutosave.status === 'saving'
                  ? 'Autosaving…'
                  : draftAutosave.status === 'saved'
                    ? 'Autosaved'
                    : ''}
            </span>
            <button
              type="button"
              onClick={() => void sendToCustomer()}
              disabled={sending}
              style={estSendButton(sending)}
            >
              {sending ? 'Sending…' : 'Send to customer'}
            </button>
            {isCO && row.bid_id ? (
              <button
                type="button"
                onClick={() => void publishCoToBidRoom()}
                disabled={saving || sending}
                title="Freeze this change order into the bid's room — the GC signs it on the same page as the proposal"
                style={estSecondaryButton(saving || sending)}
              >
                Publish to bid room
              </button>
            ) : null}
            <button type="button" onClick={() => void deleteDraft()} style={estDangerOutlineButton()}>
              Delete draft
            </button>
          </div>
        </>
      )}
      </EstimateDraftCustomerGate>

      {!isDraft && (
        <EstimateSentView
          row={row}
          isCO={isCO}
          customers={customers}
          loading={loading}
          saving={saving}
          whatWentRevision={whatWentRevision}
          acceptNotifyResolvedUsers={acceptNotifyResolvedUsers}
          acceptancePreviewForLine={acceptancePreviewForLine}
          acceptanceDocHeaderBrand={acceptanceDocHeaderBrand}
          staffResolvedExperience={staffResolvedExperience}
          coFields={coFields}
          customerAttachmentPreview={customerAttachmentPreview}
          rowOfferedOptions={rowOfferedOptions}
          acceptorSignatureSignedUrl={acceptorSignatureSignedUrl}
          estimateCustomerEvents={estimateCustomerEvents}
          estimateCustomerEventsLoading={estimateCustomerEventsLoading}
          todayYmd={todayYmd}
          customerAcceptUrl={customerAcceptUrl}
          copyCustomerAcceptUrl={copyCustomerAcceptUrl}
          openCustomerAcceptUrl={openCustomerAcceptUrl}
          buildEstimatePdf={buildEstimatePdf}
          estimatePdfFiling={estimatePdfFiling}
          setDetailCustomerSnapshotId={setDetailCustomerSnapshotId}
          openCreateJobModal={openCreateJobModal}
          actions={sentActions}
        />
      )}

      <EstimateDraftCustomerGate active={draftNeedsCustomer} onBlockedInteraction={requestCustomerFirst}>
        <EstimateCustomerExperienceSection
          row={row}
          isDraft={isDraft}
          loading={loading}
          customerAcceptUrl={customerAcceptUrl}
          resendAvailable={sentActions.resendVerdict.ok}
          copyCustomerAcceptUrl={copyCustomerAcceptUrl}
          openCustomerAcceptUrl={openCustomerAcceptUrl}
          buildEstimatePdf={buildEstimatePdf}
          estimatePdfFiling={estimatePdfFiling}
          customerPreviewTab={customerPreviewTab}
          setCustomerPreviewTab={setCustomerPreviewTab}
          customerEmailPreview={customerEmailPreview}
          previewEmailTo={previewEmailTo}
          staffResolvedExperience={staffResolvedExperience}
          openStaffAcceptCustomerPreview={openStaffAcceptCustomerPreview}
          title={title}
          validUntil={validUntil}
          lines={lines}
          terms={terms}
          totalCents={totalCents}
          acceptancePreviewForLine={acceptancePreviewForLine}
          syncedEstimateOptions={syncedEstimateOptions}
          previewSelectedOptionKeys={previewSelectedOptionKeys}
          setPreviewSelectedOptionKeys={setPreviewSelectedOptionKeys}
          acceptanceDocHeaderBrand={acceptanceDocHeaderBrand}
          customerAttachmentPreview={customerAttachmentPreview}
          acceptorSignatureSignedUrl={acceptorSignatureSignedUrl}
          cxOverrideFields={cxOverrideFields}
          setCxOverrideFields={setCxOverrideFields}
          cxTemplateDefaults={cxTemplateDefaults}
        />
      </EstimateDraftCustomerGate>

      {createCustomerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            paddingTop: 'var(--app-top-chrome, 0px)',
          }}
        >
          <div role="dialog" aria-modal="true"
            style={{
              background: 'var(--surface)',
              padding: '1rem 2rem 2rem',
              borderRadius: 8,
              maxWidth: '500px',
              width: '90%',
              maxHeight: 'min(90vh, 100%)',
              overflow: 'auto',
            }}
          >
            <NewCustomerForm
              showQuickFill={false}
              mode="modal"
              initialValues={{ name: customerSearch.trim() || undefined }}
              onCancel={() => setCreateCustomerOpen(false)}
              onCreated={(c) => {
                setCustomers((prev) =>
                  [...prev.filter((x) => x.id !== c.id), c].sort((a, b) =>
                    (a.name || '').localeCompare(b.name || ''),
                  ),
                )
                handleSelectCustomer(c)
                setCreateCustomerOpen(false)
                showToast('Customer created', 'success')
              }}
            />
          </div>
        </div>
      )}

      <CreateJobFromEstimateModal
        open={createJobModalOpen && row != null}
        estimate={row}
        customerIdForPayload={customerId}
        linkedCustomerPrefill={linkedCustomerPrefillForCreateJobModal}
        onClose={() => setCreateJobModalOpen(false)}
        onSuccess={(jobId) => {
          void (async () => {
            // The estimate's texts move onto the job it became (v2.5706, punch list #139): best effort, before the page leaves.
            if (row.customer_id) await tieEstimateTextsToJob({ customerId: row.customer_id, sentAt: row.sent_at, tokenHash: row.public_token_hash ?? null, jobId, estimateId: row.id })
            await load()
            navigate(`/jobs?edit=${jobId}`)
          })()
        }}
      />
      <CustomerSnapshotModal
        open={detailCustomerSnapshotId != null}
        onClose={() => setDetailCustomerSnapshotId(null)}
        customerId={detailCustomerSnapshotId}
        gcBuilder={null}
      />
    </div>
  )
}

export default function Estimates() {
  const { id: routeSegment } = useParams<{ id: string }>()
  if (routeSegment) return <EstimateDetail routeSegment={routeSegment} />
  return <EstimateList />
}