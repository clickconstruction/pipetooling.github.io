import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { signedRecordId } from '../lib/signedRecordId'
import { defaultEstimateTitle, isGenericEstimateTitle } from '../lib/estimates/estimateTitle'
import { EstimateLineItemCatalogModal } from '../components/estimates/EstimateLineItemCatalogModal'
import { estDangerOutlineButton, estInputBase, estInputBlock, estPrimaryButton, estSecondaryButton, estSendButton, estSmallPrimaryButton, estSmallSecondaryButton } from '../components/estimates/estimatesPageStyles'
import { EstimateChangeOrderChip, EstimateLegacyChangeOrderTitleChip } from '../components/estimates/EstimateKindChips'
import { ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS, EstimateListCards, EstimateListTable, type EstimateListStagesThread } from '../components/estimates/EstimateListTable'
import { estimateDeclinedRowLabel, estimateLinkedJobHcp, estimateListRowMatchesSearch, estimateStatusLabel as statusLabel, formatEstimateMoney as formatMoney, type EstimateListCustomerEvent, type EstimateListRow } from '../lib/estimates/estimateListRows'
import { buildEstimateDraftPersistPayload, estimateDraftHeldDateMessage, estimateDraftUnfinishedDateBlocksSend, estimateDraftUnfinishedDates } from '../lib/estimates/estimateDraftPersist'
import { heldDatesToTell } from '../lib/autosaveDateHold'
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
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import type { UserRole } from '../hooks/useAuth'
import type { Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { resolveEstimateMasterUserId as resolveMasterUserId } from '../lib/estimateMasterUser'
import { EstimateFieldPhotosStrip } from '../components/estimates/EstimateFieldPhotosStrip'
import { EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS, formatSignedCentsUsd, isChangeOrderDocKind, isLegacyChangeOrderTitledEstimate, parseEstimateChangeOrderFields, type EstimateChangeOrderFields } from '../lib/estimateChangeOrder'
import { bridgedCostImpactText } from '../lib/bidDocuments/changeOrderBridge'
import { CO_CREDIT_LABEL_PREFIX, isCoCreditLine, type CoCostPromptMode } from '../lib/coCostLinePrompt'
import { computeEstimateDraftSteps, type EstimateDraftStepKey } from '../lib/estimateDraftSteps'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'
import { countMeaningfulEstimateLines, computeLedgerTotals, isBidProposalDocKind, ledgerRowPasses, type LedgerKindFilter, isEmptyEstimateDraft, splitFollowupRows } from '../lib/estimatePipelineRefresh'
import { estimateOpenState, groupEventsByEstimateId, type EstimateOpenState } from '../lib/estimateOpenState'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { withEstimatePreviewMarker } from '../lib/estimateViewPreview'
import {
  canDeclineEstimate,
  estimateDeclinedLabel,
  parseEstimateDeclineMetadata,
  type EstimateDeclineChannel,
} from '../../supabase/functions/_shared/estimateDecline'
import EstimateRecordDeclineControl from '../components/estimates/EstimateRecordDeclineControl'
import EstimateDraftStepRail from '../components/estimates/EstimateDraftStepRail'
import { useToastContext } from '../contexts/ToastContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import CustomerSearchCombobox from '../components/customers/CustomerSearchCombobox'
import { useJobFormAutosaveSlice } from '../components/jobs/useJobFormAutosaveSlice'
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
import { EstimateAcceptTypedSignatureLine } from '../components/estimates/EstimateAcceptTypedSignatureLine'
import EstimateCustomerThankYou from '../components/estimates/EstimateCustomerThankYou'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  ESTIMATE_EXPERIENCE_FIELD_MAX_LEN,
  type EstimateCustomerExperienceResolved,
  type EstimateExperienceOverrideKey,
  mergeEstimateExperienceStrings,
  parseEstimateCustomerExperienceSnapshot,
  parseEstimateExperienceOverrides,
  resolveEstimateCustomerExperience,
} from '../lib/estimateCustomerExperience'
import type { EstimateCatalogLineItem } from '../lib/estimateLineItemCatalog'
import {
  catalogDbRowsToLineItems,
  fetchEstimateCatalogLive,
} from '../lib/estimateCatalogApi'
import CreateJobFromEstimateModal, {
  type LinkedCustomerPrefill,
} from '../components/estimates/CreateJobFromEstimateModal'
import { CustomerSnapshotModal } from '../components/customers/CustomerSnapshotModal'
import { AcceptHeaderBrandPicker } from '../components/estimates/AcceptHeaderBrandPicker'
import EstimateCustomerAttachmentCard from '../components/estimates/EstimateCustomerAttachmentCard'
import EstimateCustomerDocument, {
  EstimateLineItemsTable,
} from '../components/estimates/EstimateCustomerDocument'
import EstimateCustomerAcceptLinkButtons from '../components/estimates/EstimateCustomerAcceptLinkButtons'
import EstimateResendLinkPanel from '../components/estimates/EstimateResendLinkPanel'
import { canResendEstimateLink } from '../../supabase/functions/_shared/estimateLinkResend'
import { recordNavClick } from '../lib/navClickTelemetry'
import { estimateDraftFormSnapshot, shouldDiscardFreshEstimateDraftOnLeave } from '../lib/estimateFreshDraftDiscard'
import IpAddressMapButton from '../components/estimates/IpAddressMapButton'
import { SearchableMultiSelect } from '../components/SearchableMultiSelect'
import { SearchableSelect, type SearchableSelectOption } from '../components/SearchableSelect'
import { formatProjectNumberLabel } from '../lib/projectNumberLabel'
import {
  estimateLineItemRecentsStorageKey,
  loadRecentCatalogIds,
  persistRecentCatalogIds,
  recordRecentCatalogPick,
  resolveRecentChips,
} from '../lib/estimateLineItemRecents'
import { isEstimateUuidSegment, parseEstimateQuoteNumberSegment } from '../lib/estimateRouteSegment'
import { buildStaffAcceptPreviewSnapshot, writeStaffAcceptPreviewSnapshot } from '../lib/estimateStaffAcceptPreview'
import {
  addCalendarDaysYmd,
  presetMatchingTodayOffset,
  type ValidUntilPresetDays,
} from '../lib/addCalendarDaysYmd'
import {
  acceptHeaderBrandImageSrc,
  acceptHeaderBrandLabel,
  parseAcceptHeaderBrand,
  type EstimateAcceptHeaderBrand,
} from '../lib/estimateAcceptHeaderBrand'
import { estimateEmailFrom } from '../lib/customerEmailFrom'
import { buildEstimateLetterheadEmail } from '../lib/estimateEmailLetterhead'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { formatEstimateUpdatedRelativeCompact } from '../lib/formatEstimateListUpdated'
import { formatNotificationDatetime } from '../utils/formatNotificationDatetime'
import { checkGoogleDriveAttachmentUrl } from '../lib/checkGoogleDriveAttachmentUrl'
import {
  normalizeCustomerAttachmentDraftForDb,
  normalizeCustomerAttachmentUrl,
  parseCustomerAttachmentSent,
  type CustomerAttachmentPayload,
} from '../lib/estimateCustomerAttachment'
import { pageTabStyle } from '../lib/pageTabStyle'
import { tapHintCss } from '../lib/tapHint'
import { useEstimateThreadNotes } from '../hooks/useEstimateThreadNotes'
import {
  normalizeEstimateLineItemsFromJson,
  sumNormalizedLineItems,
  type EstimateLineItemNormalized,
} from '../lib/estimateLineItemNormalize'
import {
  MAX_ESTIMATE_OPTIONS,
  defaultEstimateSelection,
  estimateOptionTotalCents,
  newEstimateOptionKey,
  normalizeEstimateOptionsFromJson,
  recommendedEstimateOption,
  setEstimateAddOnPreticked,
  setEstimateOptionKind,
  setRecommendedEstimateOption,
  toggleEstimateOptionSelection,
  type EstimateOption,
  type EstimateOptionKind,
} from '../lib/estimates/estimateOptions'
import { acceptedEstimateOptionKeys, describeAcceptedEstimateRecord } from '../lib/estimates/estimateAcceptedRecord'

const ESTIMATE_CATALOG_EDITOR_ROLES = new Set<UserRole>([
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'estimator',
  'primary',
  'superintendent',
])

const SEND_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


const PREVIEW_EMAIL_ACCEPT_URL = 'https://example.com/estimate/accept?t=preview'

const ESTIMATE_ACCEPT_URL_SESSION_PREFIX = 'estimate_accept_url:'

function EstimateCustomerActivityDetails({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{ marginTop: '1rem' }}
    >
      {children}
    </details>
  )
}

function EstimateDetailCustomerActivitySection({
  estimateId,
  status,
  defaultOpen,
  loading,
  events,
}: {
  estimateId: string
  status: 'sent' | 'customer_accepted' | 'declined'
  defaultOpen: boolean
  loading: boolean
  events: Tables<'estimate_customer_events'>[]
}) {
  return (
    <EstimateCustomerActivityDetails
      key={`customer-activity-${estimateId}-${status}`}
      defaultOpen={defaultOpen}
    >
      <summary
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--text-strong)',
        }}
      >
        Customer activity
      </summary>
      {loading ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Loading…</p>
      ) : events.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          No link views or acceptance events recorded yet.
        </p>
      ) : (
        <ul
          style={{
            margin: '0.5rem 0 0',
            paddingLeft: '1.25rem',
            fontSize: '0.9rem',
            color: 'var(--text-700)',
          }}
        >
          {events.map((ev) => {
            const meta = ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
              ? (ev.metadata as Record<string, unknown>)
              : null
            const sig =
              ev.event_type === 'public_accept_submitted' && meta && meta.had_signature === true
                ? ' (with signature)'
                : ''
            const optionName =
              ev.event_type === 'option_viewed' && meta && typeof meta.option_name === 'string' && meta.option_name.trim()
                ? ` — ${meta.option_name.trim()}`
                : ''
            // v2.2873: "Declined by customer — went with another bid" / "Declined — office heard it by phone — …".
            const declineMeta = ev.event_type === 'declined' ? parseEstimateDeclineMetadata(meta) : null
            const declineNote = declineMeta?.note ? ` — “${declineMeta.note}”` : ''
            return (
              <li key={ev.id} style={{ marginBottom: '0.35rem' }}>
                {ev.event_type === 'declined' ? estimateDeclinedLabel(declineMeta) : estimateCustomerEventLabel(ev.event_type)}
                {optionName}
                {declineNote}
                {sig}
                {ev.client_ip?.trim() ? (
                  <>
                    {' · '}
                    <IpAddressMapButton ip={ev.client_ip} />
                  </>
                ) : null}{' '}
                — {formatNotificationDatetime(ev.occurred_at)}
                {ev.occurred_at?.trim() ? ` ${formatEstimateUpdatedRelativeCompact(ev.occurred_at)}` : ''}
              </li>
            )
          })}
        </ul>
      )}
    </EstimateCustomerActivityDetails>
  )
}

function estimateCustomerEventLabel(eventType: string): string {
  switch (eventType) {
    case 'public_link_view':
      return 'Customer opened quote link'
    case 'public_accept_submitted':
      return 'Customer accepted estimate'
    case 'option_viewed':
      return 'Viewed option'
    case 'declined':
      return 'Declined'
    default:
      return eventType
  }
}

function isUsableCustomerAcceptUrl(url: string): boolean {
  const t = url.trim()
  if (!t || t === PREVIEW_EMAIL_ACCEPT_URL) return false
  try {
    const u = new URL(t)
    if (!u.pathname.includes('/estimate/accept')) return false
    if (!u.searchParams.get('t')?.trim()) return false
    return true
  } catch {
    return false
  }
}

function normalizeCustomerAcceptUrlCandidate(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s || !isUsableCustomerAcceptUrl(s)) return null
  return s
}

const CX_FIELD_LABELS: Record<EstimateExperienceOverrideKey, string> = {
  email_subject_template: 'Email subject template',
  email_body_template: 'Email body template',
  accept_section_title: 'Accept section title',
  accept_instructions: 'Accept instructions',
  accept_name_field_label: 'Name field label',
  accept_checkbox_label: 'Agreement checkbox label',
  accept_submit_label: 'Submit button label',
  accept_submitting_label: 'Submitting button label',
  thank_you_title: 'Thank you heading',
  thank_you_body: 'Thank you body',
  doc_title_fallback: 'Document title fallback (empty estimate title)',
  doc_valid_through_prefix: '“Expires on” line prefix (before date)',
  doc_line_items_heading: 'Line items heading',
  doc_terms_heading: 'Terms heading',
  doc_total_label: 'Total label (before amount)',
  accept_page_footer: 'Acceptance page footer (below sign-off)',
}

type CxOverrideSectionConfig = {
  title: string
  description?: string
  keys: EstimateExperienceOverrideKey[]
}

type CxDraftSectionFieldsOptions = {
  omitKeys?: ReadonlySet<EstimateExperienceOverrideKey>
}

const CX_OVERRIDE_SECTIONS: [CxOverrideSectionConfig, CxOverrideSectionConfig, CxOverrideSectionConfig] = [
  {
    title: 'Email',
    description:
      'The body template may include {{title}} and {{estimate_number}}. Its first paragraph opens the email; the rest sign it off below the button (a paragraph holding {{accept_url}} is replaced by the button). The subject is built for you: "Estimate #N — title — total · company". Leave blank to use organization defaults (dev: Settings → Estimate customer experience defaults).',
    keys: ['email_body_template'],
  },
  {
    title: 'Acceptance page',
    description:
      'Quote document labels (title; line items, total, terms; accept form below)—same order customers see on the public page. The expiry date line (“Expires on” + date) appears only when Expires on is set on this estimate; the prefix field below appears only when Expires on is filled in above. The document title fallback applies only when the estimate title is empty; the fallback field below appears only when the estimate title above is empty.',
    keys: [
      'doc_title_fallback',
      'doc_valid_through_prefix',
      'doc_line_items_heading',
      'doc_total_label',
      'doc_terms_heading',
      'accept_section_title',
      'accept_instructions',
      'accept_name_field_label',
      'accept_checkbox_label',
      'accept_submit_label',
      'accept_submitting_label',
      'accept_page_footer',
    ],
  },
  {
    title: 'Thank you',
    description: 'Shown after submit or if the customer opens an already-used link.',
    keys: ['thank_you_title', 'thank_you_body'],
  },
]

function cxOverrideFieldRows(k: EstimateExperienceOverrideKey): number {
  if (k === 'email_body_template' || k === 'thank_you_body' || k === 'accept_page_footer') return 7
  return 2
}

/** Detail load embeds linked job HCP when `job_ledger_id` is set. */
type EstimateDetailRow = Tables<'estimates'> & {
  jobs_ledger?: { hcp_number: string } | null
}

type EstimateNotifyUserOption = { id: string; name: string; email: string; role?: UserRole }

/** Section caption on "Also notify" role-group separators (group below the divider). */
function estimateAcceptNotifySeparatorLabel(
  bucketKey: 'master' | 'assistant' | 'superintendent' | 'rest',
): string | undefined {
  switch (bucketKey) {
    case 'assistant':
      return 'Assistants'
    case 'superintendent':
      return 'Superintendents'
    case 'rest':
      return 'Everyone else'
    default:
      return undefined
  }
}

const ESTIMATE_JOB_SECTION_HASH = 'estimate-job'

/** Primary blue — detail Job section “Create job from estimate”. */
const estimateDetailCreateJobButtonStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  fontWeight: 600,
  border: 'none',
  borderRadius: 6,
  background: '#3b82f6',
  color: 'white',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

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

function lineItemsFromJson(raw: unknown, allowNegative?: boolean): LineItem[] {
  return normalizeEstimateLineItemsFromJson(raw, { allowNegative })
}

function sumLineItems(lines: LineItem[]): number {
  return sumNormalizedLineItems(lines)
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
  const estimatesListEmptyLabel = customerParamForEstimatesReload?.trim()
    ? 'No estimates for this customer.'
    : role === 'primary'
      ? 'No estimates yet — you see the ones you created and those on jobs you are the Account Man for.'
      : 'No estimates yet.'

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
          {role === 'dev' || role === 'master_technician' ? (
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
            <button type="button" onClick={() => setLedgerKind('all')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'all' ? 'var(--text-link, #3b82f6)' : 'var(--border-strong)'), background: ledgerKind === 'all' ? '#3b82f6' : 'var(--surface)', color: ledgerKind === 'all' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>All kinds</button>
            <button type="button" onClick={() => setLedgerKind('estimate')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'estimate' ? 'var(--text-link, #3b82f6)' : 'var(--border-strong)'), background: ledgerKind === 'estimate' ? '#3b82f6' : 'var(--surface)', color: ledgerKind === 'estimate' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Estimates</button>
            <button type="button" onClick={() => setLedgerKind('change_order')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'change_order' ? 'var(--text-link, #3b82f6)' : 'var(--border-strong)'), background: ledgerKind === 'change_order' ? '#3b82f6' : 'var(--surface)', color: ledgerKind === 'change_order' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Change orders</button>
            <button type="button" onClick={() => setLedgerKind('bid_proposal')} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerKind === 'bid_proposal' ? 'var(--text-link, #3b82f6)' : 'var(--border-strong)'), background: ledgerKind === 'bid_proposal' ? '#3b82f6' : 'var(--surface)', color: ledgerKind === 'bid_proposal' ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Bid proposals</button>
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
            <button type="button" onClick={() => setLedgerIncludeClosed((p) => !p)} style={{ padding: '0.22rem 0.7rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid ' + (ledgerIncludeClosed ? 'var(--text-link, #3b82f6)' : 'var(--border-strong)'), background: ledgerIncludeClosed ? '#3b82f6' : 'var(--surface)', color: ledgerIncludeClosed ? 'white' : 'var(--text-700)', cursor: 'pointer' }}>Include superseded & declined</button>
          </div>
          {loading ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>{estimatesListEmptyLabel}</p>
          ) : ledgerRows.length === 0 ? (
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No estimates match your search.</p>
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
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>{estimatesListEmptyLabel}</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>No estimates match your search.</p>
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
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No estimates</p>
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
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No estimates</p>
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
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No estimates</p>
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
  // Fresh-draft marker from createDraft's navigate state (decision 17, v2.2885):
  // captured per render into a ref so load() can stamp the row it hydrates.
  const locationFreshDraftRef = useRef(false)
  locationFreshDraftRef.current =
    (location.state as { freshEstimateDraft?: boolean } | null | undefined)?.freshEstimateDraft === true
  /** The row id this visit minted (New estimate / New change order / the Projects deep link). */
  const freshDraftRowIdRef = useRef<string | null>(null)
  /** The row id that received any write since hydration (autosave / Save draft / pre-send save / delete). */
  const committedDraftRowIdRef = useRef<string | null>(null)
  /** The date boxes the last draft save held back half typed — the autosave says each once (`heldDatesToTell`), and again the next time the draft is opened. */
  const toldHeldDraftDatesRef = useRef<string[]>([])
  const [row, setRow] = useState<EstimateDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [terms, setTerms] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  // Estimate Options (v2.2457): the row's options; empty = a normal single-option estimate.
  // `lines` always holds the VIEWED option's lines while options exist — the editor below the
  // cards keeps operating on `lines` exactly as before, and switches/saves sync it back.
  const [estimateOptions, setEstimateOptions] = useState<EstimateOption[]>([])
  const [viewedOptionKey, setViewedOptionKey] = useState<string | null>(null)
  // The staff Page preview's own selection — rehearses the customer's picker.
  const [previewSelectedOptionKeys, setPreviewSelectedOptionKeys] = useState<string[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [sendEmailOverride, setSendEmailOverride] = useState('')
  const [emailOverrideRevealed, setEmailOverrideRevealed] = useState(false)
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [validUntil, setValidUntil] = useState('')
  const [validUntilPreset, setValidUntilPreset] = useState<ValidUntilPresetDays | null>(null)
  const [forAddress, setForAddress] = useState('')
  /** Linked `projects.id` ('' = not linked); internal-only, saved with the draft. */
  const [linkedProjectId, setLinkedProjectId] = useState('')
  const [projectsForPicker, setProjectsForPicker] = useState<Array<{ id: string; name: string | null; project_number: string | null }> | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [customerAttachmentUrl, setCustomerAttachmentUrl] = useState('')
  const [customerAttachmentLabel, setCustomerAttachmentLabel] = useState('')
  const [attachmentCheckStatus, setAttachmentCheckStatus] = useState<
    'idle' | 'loading' | 'success' | 'warn' | 'error'
  >('idle')
  const [attachmentCheckMessage, setAttachmentCheckMessage] = useState('')
  const [acceptHeaderBrand, setAcceptHeaderBrand] = useState<EstimateAcceptHeaderBrand | null>(null)
  const [acceptorSignatureSignedUrl, setAcceptorSignatureSignedUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
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
  const [unlinkingJob, setUnlinkingJob] = useState(false)
  const [unlinkJobConfirmOpen, setUnlinkJobConfirmOpen] = useState(false)
  const [customerPreviewTab, setCustomerPreviewTab] = useState<'email' | 'page' | 'thankyou'>('email')
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null)
  // Resend link (v2.2856, J17-F2/N3): the fresh URL is shown once, in the tab that asked for it.
  const [resending, setResending] = useState(false)
  const [resentInfo, setResentInfo] = useState<{ email: string; emailed: boolean; url: string } | null>(null)
  const [appCxSettings, setAppCxSettings] = useState<{ key: string; value_text: string | null }[]>([])
  const [catalogLineItems, setCatalogLineItems] = useState<EstimateCatalogLineItem[]>([])
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [catalogIconHovered, setCatalogIconHovered] = useState(false)
  const canManageEstimateCatalog = Boolean(role && ESTIMATE_CATALOG_EDITOR_ROLES.has(role))
  const [lineItemRecentIds, setLineItemRecentIds] = useState<string[]>([])
  const [estimateCustomerEvents, setEstimateCustomerEvents] = useState<Tables<'estimate_customer_events'>[]>([])
  const [estimateCustomerEventsLoading, setEstimateCustomerEventsLoading] = useState(false)
  const [cxOverrideFields, setCxOverrideFields] = useState<
    Partial<Record<EstimateExperienceOverrideKey, string>>
  >({})
  const [draftTitleEditing, setDraftTitleEditing] = useState(false)
  const [customerNotesExpanded, setCustomerNotesExpanded] = useState(false)
  const [detailCustomerSnapshotId, setDetailCustomerSnapshotId] = useState<string | null>(null)
  const [acceptNotifyUserIds, setAcceptNotifyUserIds] = useState<string[]>([])
  const [notifyUserOptions, setNotifyUserOptions] = useState<EstimateNotifyUserOption[]>([])
  const [acceptNotifyResolvedUsers, setAcceptNotifyResolvedUsers] = useState<EstimateNotifyUserOption[]>([])
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
  /** Tracks last persisted customer link for draft auto-save; `undefined` = skip first run after load/navigation. */
  const prevCustomerIdForAutosave = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    setEmailOverrideRevealed(false)
  }, [customerId])

  useEffect(() => {
    setLastAcceptUrl(null)
    setDraftTitleEditing(false)
    setValidUntilPreset(null)
    setCustomerAttachmentUrl('')
    setCustomerAttachmentLabel('')
    setAttachmentCheckStatus('idle')
    setAttachmentCheckMessage('')
    prevCustomerIdForAutosave.current = undefined
    toldHeldDraftDatesRef.current = []
    setDetailCustomerSnapshotId(null)
    setAcceptNotifyUserIds([])
    setAcceptNotifyResolvedUsers([])
  }, [routeSegment])

  useEffect(() => {
    setAttachmentCheckStatus('idle')
    setAttachmentCheckMessage('')
  }, [customerAttachmentUrl])

  useEffect(() => {
    if (loading) return
    const hash = location.hash.replace(/^#/, '')
    if (hash !== ESTIMATE_JOB_SECTION_HASH) return
    const t = window.setTimeout(() => {
      document.getElementById(ESTIMATE_JOB_SECTION_HASH)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(t)
  }, [loading, location.hash, row?.id])

  useEffect(() => {
    const path = row?.acceptor_signature_storage_path?.trim()
    if (!path) {
      setAcceptorSignatureSignedUrl(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const signed = await withSupabaseRetry(
          async () => await supabase.storage.from('estimate-acceptor-signatures').createSignedUrl(path, 3600),
          'estimate acceptor signature url',
        )
        if (cancelled) return
        setAcceptorSignatureSignedUrl(signed?.signedUrl ?? null)
      } catch {
        if (!cancelled) setAcceptorSignatureSignedUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row?.acceptor_signature_storage_path, row?.id])

  useEffect(() => {
    setCustomerNotesExpanded(false)
  }, [customerId])

  useLayoutEffect(() => {
    if (!draftTitleEditing) return
    titleInputRef.current?.focus()
  }, [draftTitleEditing])

  const loadCatalogFromDb = useCallback(async () => {
    try {
      const rows = await fetchEstimateCatalogLive(supabase)
      setCatalogLineItems(catalogDbRowsToLineItems(rows))
    } catch {
      setCatalogLineItems([])
    }
  }, [])

  useEffect(() => {
    void loadCatalogFromDb()
  }, [loadCatalogFromDb])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!user?.id) {
        if (!cancelled) setNotifyUserOptions([])
        return
      }
      try {
        const [usersRes, meRes] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('users')
                .select('id, name, email, role')
                .in('role', [
                  'assistant',
                  'controller' as 'assistant',
                  'master_technician',
                  'subcontractor',
                  'helpers',
                  'estimator',
                  'primary',
                  'superintendent',
                ])
                .order('name'),
            'load estimate notify user options',
          ),
          supabase.from('users').select('role').eq('id', user.id).single(),
        ])
        let usersList = (usersRes as EstimateNotifyUserOption[]) ?? []
        const meRole = (meRes.data as { role?: string } | null)?.role
        if (meRole === 'dev') {
          const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
          if (devUsers?.length) {
            const existingIds = new Set(usersList.map((u) => u.id))
            const newDevs = (devUsers as EstimateNotifyUserOption[]).filter((u) => !existingIds.has(u.id))
            usersList = [...usersList, ...newDevs]
          }
        }
        if (!cancelled) setNotifyUserOptions(usersList)
      } catch {
        if (!cancelled) setNotifyUserOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase.from('app_settings').select('key, value_text').in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST),
          'load estimate app_settings',
        )
        const list = (rows ?? []) as { key: string; value_text: string | null }[]
        if (!cancelled) setAppCxSettings(list)
      } catch {
        if (!cancelled) setAppCxSettings([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setLineItemRecentIds([])
      return
    }
    setLineItemRecentIds(loadRecentCatalogIds(estimateLineItemRecentsStorageKey(user.id)))
  }, [user?.id])

  const loadEstimateCustomerEvents = useCallback(async () => {
    const id = row?.id
    const st = row?.status
    if (!id || (st !== 'sent' && st !== 'customer_accepted' && st !== 'declined')) {
      setEstimateCustomerEvents([])
      setEstimateCustomerEventsLoading(false)
      return
    }
    setEstimateCustomerEventsLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimate_customer_events')
            .select('id, estimate_id, occurred_at, event_type, source, client_ip, user_agent, metadata')
            .eq('estimate_id', id)
            .order('occurred_at', { ascending: false }),
        'load estimate customer events',
      )
      const rows = (data ?? []) as Tables<'estimate_customer_events'>[]
      setEstimateCustomerEvents(rows)
    } catch (e) {
      setEstimateCustomerEvents([])
    } finally {
      setEstimateCustomerEventsLoading(false)
    }
  }, [row?.id, row?.status])

  useEffect(() => {
    void loadEstimateCustomerEvents()
  }, [loadEstimateCustomerEvents])

  useEffect(() => {
    if (row?.status !== 'sent' && row?.status !== 'customer_accepted') return
    const onFocus = () => void loadEstimateCustomerEvents()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [row?.status, loadEstimateCustomerEvents])

  useEffect(() => {
    if (catalogLineItems.length === 0 && !canManageEstimateCatalog) setCatalogIconHovered(false)
  }, [catalogLineItems.length, canManageEstimateCatalog])

  function hydrateCustomerFieldsFromEstimate(r: EstimateDetailRow, custList: CustomerRow[]) {
    if (!r.customer_id) {
      setCustomerSearch('')
      setSendEmailOverride('')
      return
    }
    const c = custList.find((x) => x.id === r.customer_id)
    if (c) {
      setCustomerSearch(getCustomerDisplay(c))
      const crm = extractContactFromCustomer(c).email.trim()
      if (crm) setSendEmailOverride('')
      else setSendEmailOverride(r.customer_email ?? '')
    } else {
      setCustomerSearch('')
      setSendEmailOverride(r.customer_email ?? '')
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let data: EstimateDetailRow | null = null

      const detailSelect = '*, jobs_ledger(hcp_number)'

      if (isEstimateUuidSegment(routeSegment)) {
        const one = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select(detailSelect).eq('id', routeSegment).maybeSingle(),
          'load estimate',
        )
        data = (one ?? null) as EstimateDetailRow | null
      } else {
        const n = parseEstimateQuoteNumberSegment(routeSegment)
        if (n === null) {
          showToast('Invalid estimate link.', 'error')
          navigate('/estimates')
          return
        }
        const one = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select(detailSelect).eq('estimate_number', n).maybeSingle(),
          'load estimate',
        )
        data = (one ?? null) as EstimateDetailRow | null
      }

      if (!data) {
        showToast('Estimate not found.', 'error')
        navigate('/estimates')
        return
      }
      const r = data

      if (isEstimateUuidSegment(routeSegment) && String(r.estimate_number) !== routeSegment) {
        navigate(`/estimates/${r.estimate_number}`, { replace: true })
      }

      if (locationFreshDraftRef.current && r.status === 'draft') freshDraftRowIdRef.current = r.id
      setRow(r)
      setAcceptHeaderBrand(parseAcceptHeaderBrand(r.accept_header_brand))
      setTerms(r.terms_snapshot ?? '')
      const rowIsCO = isChangeOrderDocKind(r.doc_kind)
      const parsedLines = lineItemsFromJson(r.line_items_snapshot, rowIsCO)
      const parsedOptions = rowIsCO ? [] : normalizeEstimateOptionsFromJson(r.options_snapshot)
      setEstimateOptions(parsedOptions)
      const hydratedViewed = recommendedEstimateOption(parsedOptions)
      setViewedOptionKey(hydratedViewed?.key ?? null)
      setPreviewSelectedOptionKeys(defaultEstimateSelection(parsedOptions))
      setLines(
        // With options, the editor shows the recommended option's lines; otherwise the legacy
        // snapshot. CO drafts stay empty so Impact on cost opens with the guided prompt.
        hydratedViewed
          ? hydratedViewed.line_items
          : r.status === 'draft' && parsedLines.length === 0 && !rowIsCO
            ? [defaultDraftFirstLine()]
            : parsedLines,
      )
      setCoFields(parseEstimateChangeOrderFields(r.change_order_fields))
      setCustomerId(r.customer_id ?? null)
      const vu = (r.valid_until ?? '').trim()
      if (r.status === 'draft') {
        if (!vu) {
          setValidUntil(addCalendarDaysYmd(30))
          setValidUntilPreset(30)
        } else {
          setValidUntil(vu)
          setValidUntilPreset(presetMatchingTodayOffset(vu))
        }
      } else {
        setValidUntil(r.valid_until ?? '')
        setValidUntilPreset(null)
      }
      setForAddress(r.for_address ?? '')
      setLinkedProjectId(r.project_id ?? '')
      setInternalNotes(r.internal_notes ?? '')
      {
        const raw = r.accept_notify_user_ids
        if (raw === null || raw === undefined) {
          if (r.status === 'draft' && user?.id) {
            try {
              const masterRows =
                (await withSupabaseRetry(
                  async () =>
                    await supabase.from('users').select('id').eq('role', 'master_technician'),
                  'load estimate default notify master technicians',
                )) ?? []
              const masterIds = masterRows
                .map((row) => row.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
              setAcceptNotifyUserIds([...new Set([user.id, ...masterIds])])
            } catch {
              setAcceptNotifyUserIds([user.id])
            }
          } else {
            setAcceptNotifyUserIds([])
          }
        } else {
          setAcceptNotifyUserIds(
            raw.filter((x): x is string => typeof x === 'string' && x.length > 0),
          )
        }
      }
      {
        const ids =
          Array.isArray(r.accept_notify_user_ids) ?
            r.accept_notify_user_ids.filter((x): x is string => typeof x === 'string' && x.length > 0)
          : []
        if (r.status !== 'draft' && ids.length > 0) {
          try {
            const nu = await withSupabaseRetry(
              async () =>
                await supabase.from('users').select('id, name, email').in('id', ids),
              'load estimate notify display users',
            )
            setAcceptNotifyResolvedUsers((nu ?? []) as EstimateNotifyUserOption[])
          } catch {
            setAcceptNotifyResolvedUsers([])
          }
        } else {
          setAcceptNotifyResolvedUsers([])
        }
      }
      if (r.status === 'draft') {
        setCustomerAttachmentUrl(r.customer_attachment_url ?? '')
        setCustomerAttachmentLabel(r.customer_attachment_label ?? '')
      } else {
        const attFrozen = parseCustomerAttachmentSent(r.customer_attachment_sent)
        setCustomerAttachmentUrl(attFrozen?.url ?? '')
        setCustomerAttachmentLabel(attFrozen?.label ?? '')
      }
      if (r.status === 'sent' || r.status === 'customer_accepted') {
        try {
          if (typeof sessionStorage !== 'undefined') {
            const stored = sessionStorage.getItem(`${ESTIMATE_ACCEPT_URL_SESSION_PREFIX}${r.id}`)
            if (stored?.trim()) setLastAcceptUrl(stored.trim())
          }
        } catch {
          /* ignore */
        }
      }

      if (!user?.id) {
        setCustomers([])
        hydrateCustomerFieldsFromEstimate(r, [])
        setTitle(r.title ?? '')
        return
      }
      setCustomersLoading(true)
      try {
        const cust = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
              .order('name'),
          'load customers for estimate',
        )
        const list = (cust ?? []) as CustomerRow[]
        let initialTitle = r.title ?? ''
        if (
          r.status === 'draft' &&
          r.customer_id &&
          isGenericEstimateTitle(initialTitle)
        ) {
          const matchCust = list.find((x) => x.id === r.customer_id)
          if (matchCust?.name?.trim()) initialTitle = defaultEstimateTitle(matchCust.name, isChangeOrderDocKind(r.doc_kind))
        }
        setTitle(initialTitle)
        setCustomers(list)
        hydrateCustomerFieldsFromEstimate(r, list)
      } catch {
        setCustomers([])
        hydrateCustomerFieldsFromEstimate(r, [])
        setTitle(r.title ?? '')
      } finally {
        setCustomersLoading(false)
      }
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load estimate'), 'error')
      navigate('/estimates')
    } finally {
      setLoading(false)
    }
  }, [routeSegment, navigate, showToast, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!row) {
      setCxOverrideFields({})
      return
    }
    setCxOverrideFields(parseEstimateExperienceOverrides(row.customer_experience_overrides))
  }, [row?.id, row?.updated_at, row?.customer_experience_overrides])

  const refetchCustomersAfterEdit = useCallback(
    async (forCustomerId: string) => {
      if (!user?.id) return
      try {
        const cust = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
              .order('name'),
          'refetch customers after edit',
        )
        const list = (cust ?? []) as CustomerRow[]
        setCustomers(list)
        const c = list.find((x) => x.id === forCustomerId)
        if (c) {
          setCustomerSearch(getCustomerDisplay(c))
          if (extractContactFromCustomer(c).email.trim()) setSendEmailOverride('')
        }
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not refresh customers'), 'error')
      }
    },
    [user?.id, showToast],
  )

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
  }, [editCustomerModal, customerId, refetchCustomersAfterEdit])

  const isDraft = row?.status === 'draft'
  /** CO train (v2.1832): change orders reuse this whole page in CO mode. */
  const isCO = isChangeOrderDocKind(row?.doc_kind)
  const [coFields, setCoFields] = useState<EstimateChangeOrderFields>(EMPTY_ESTIMATE_CHANGE_ORDER_FIELDS)
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

  const acceptNotifyOtherSelectOptions = useMemo((): SearchableSelectOption[] => {
    const others = notifyUserOptions.filter((opt) => opt.id !== user?.id)
    const sortByName = (a: EstimateNotifyUserOption, b: EstimateNotifyUserOption) => {
      const na = a.name?.trim() || '—'
      const nb = b.name?.trim() || '—'
      return na.localeCompare(nb, undefined, { sensitivity: 'base' })
    }
    const masters: EstimateNotifyUserOption[] = []
    const assistants: EstimateNotifyUserOption[] = []
    const supers: EstimateNotifyUserOption[] = []
    const rest: EstimateNotifyUserOption[] = []
    for (const opt of others) {
      const r = opt.role
      if (r === 'master_technician') masters.push(opt)
      else if (isAssistantLike(r)) assistants.push(opt)
      else if (r === 'superintendent') supers.push(opt)
      else rest.push(opt)
    }
    masters.sort(sortByName)
    assistants.sort(sortByName)
    supers.sort(sortByName)
    rest.sort(sortByName)
    const toSelectable = (opt: EstimateNotifyUserOption) => {
      const name = opt.name?.trim() || '—'
      const email = opt.email?.trim() || ''
      return {
        value: opt.id,
        label: `${name} ${email}`.trim(),
        labelContent: (
          <>
            <span style={{ fontWeight: 500 }}>{name}</span>
            <span style={{ color: 'var(--text-muted)' }}> · {email || 'no email'}</span>
          </>
        ),
      }
    }
    const bucketMeta = [
      { key: 'master', rows: masters },
      { key: 'assistant', rows: assistants },
      { key: 'superintendent', rows: supers },
      { key: 'rest', rows: rest },
    ] as const
    const out: SearchableSelectOption[] = []
    let prevKey: (typeof bucketMeta)[number]['key'] | null = null
    for (const { key, rows } of bucketMeta) {
      if (!rows.length) continue
      if (prevKey !== null) {
        const sepLabel = estimateAcceptNotifySeparatorLabel(key)
        out.push({
          kind: 'separator',
          id: `estimate-notify-sep-${prevKey}-${key}`,
          ...(sepLabel ? { label: sepLabel } : {}),
        })
      }
      prevKey = key
      out.push(...rows.map(toSelectable))
    }
    return out
  }, [notifyUserOptions, user?.id])

  const acceptNotifyOtherIds = useMemo(
    () => acceptNotifyUserIds.filter((id) => id !== user?.id),
    [acceptNotifyUserIds, user?.id],
  )

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
  const customerAttachmentUrlIsCheckable = Boolean(normalizeCustomerAttachmentUrl(customerAttachmentUrl))
  const totalCents = sumLineItems(lines)
  /** Options with the viewed option's lines kept live — what cards, save, and previews read. */
  const syncedEstimateOptions = useMemo(
    () => estimateOptions.map((o) => (o.key === viewedOptionKey ? { ...o, line_items: lines } : o)),
    [estimateOptions, viewedOptionKey, lines],
  )

  function switchViewedOption(key: string) {
    if (key === viewedOptionKey) return
    const target = estimateOptions.find((o) => o.key === key)
    if (!target) return
    // Fold the editor's live lines into the option we're leaving, then load the target's.
    setEstimateOptions((prev) => prev.map((o) => (o.key === viewedOptionKey ? { ...o, line_items: lines } : o)))
    setViewedOptionKey(key)
    setLines(target.line_items.length > 0 ? target.line_items : [defaultDraftFirstLine()])
  }

  function addEstimateOption() {
    if (estimateOptions.length >= MAX_ESTIMATE_OPTIONS) return
    if (estimateOptions.length === 0) {
      // First press converts the single estimate into two options: the current lines become
      // Option 1 (recommended), Option 2 starts as a clone to edit from — the Bids move.
      const a: EstimateOption = { key: newEstimateOptionKey(), name: 'Option 1', description: '', recommended: true, kind: 'choice', line_items: lines }
      const b: EstimateOption = { key: newEstimateOptionKey(), name: 'Option 2', description: '', recommended: false, kind: 'choice', line_items: lines.map((l) => ({ ...l })) }
      setEstimateOptions([a, b])
      setViewedOptionKey(b.key)
      setPreviewSelectedOptionKeys([a.key])
      return
    }
    const src = syncedEstimateOptions.find((o) => o.key === viewedOptionKey) ?? syncedEstimateOptions[0]
    const next: EstimateOption = {
      key: newEstimateOptionKey(),
      name: `Option ${estimateOptions.length + 1}`,
      description: '',
      recommended: false,
      // A copy is offered the way its source is (v2.3554) — cloning an add-on makes an add-on.
      kind: src?.kind ?? 'choice',
      line_items: (src?.line_items ?? []).map((l) => ({ ...l })),
    }
    setEstimateOptions((prev) => [...prev.map((o) => (o.key === viewedOptionKey ? { ...o, line_items: lines } : o)), next])
    setViewedOptionKey(next.key)
    setLines(next.line_items.length > 0 ? next.line_items : [defaultDraftFirstLine()])
  }

  function removeViewedOption() {
    const remaining = syncedEstimateOptions.filter((o) => o.key !== viewedOptionKey)
    if (remaining.length <= 1) {
      // Down to one option: collapse back to a normal single-option estimate.
      const only = remaining[0] ?? null
      setEstimateOptions([])
      setViewedOptionKey(null)
      setPreviewSelectedOptionKeys([])
      if (only) setLines(only.line_items.length > 0 ? only.line_items : [defaultDraftFirstLine()])
      return
    }
    const fixed = remaining.some((o) => o.recommended) ? remaining : remaining.map((o, i) => ({ ...o, recommended: i === 0 }))
    const nextViewed = recommendedEstimateOption(fixed)
    setEstimateOptions(fixed)
    setViewedOptionKey(nextViewed?.key ?? null)
    setPreviewSelectedOptionKeys(defaultEstimateSelection(fixed))
    if (nextViewed) setLines(nextViewed.line_items.length > 0 ? nextViewed.line_items : [defaultDraftFirstLine()])
  }

  function patchViewedOption(patch: Partial<Pick<EstimateOption, 'name' | 'description'>>) {
    setEstimateOptions((prev) => prev.map((o) => (o.key === viewedOptionKey ? { ...o, ...patch } : o)))
  }

  /** v2.3556: offer the edited option as a choice or an add-on; the star re-seats itself and the Page preview restarts from the default. */
  function setViewedOptionKind(kind: EstimateOptionKind) {
    if (!viewedOptionKey) return
    setEstimateOptions((prev) => {
      const next = setEstimateOptionKind(prev, viewedOptionKey, kind)
      setPreviewSelectedOptionKeys(defaultEstimateSelection(next))
      return next
    })
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
        customerEmailPresent: Boolean(crmEmailForSelected || sendEmailOverride.trim()),
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

  function resolveCustomerEmailForPersist(): string | null {
    if (!customerId) return null
    const sel = customers.find((x) => x.id === customerId)
    const crm = sel ? extractContactFromCustomer(sel).email.trim() : ''
    return crm || (sendEmailOverride.trim() || null)
  }

  const previewEmailTo = useMemo(() => {
    if (!row) return '—'
    if (row.status === 'draft') {
      if (!customerId) return sendEmailOverride.trim() || '—'
      const sel = customers.find((x) => x.id === customerId)
      const crm = sel ? extractContactFromCustomer(sel).email.trim() : ''
      if (crm) return crm
      return sendEmailOverride.trim() || '—'
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
    try {
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem(`${ESTIMATE_ACCEPT_URL_SESSION_PREFIX}${row.id}`)
        return normalizeCustomerAcceptUrlCandidate(stored)
      }
    } catch {
      /* ignore */
    }
    return null
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

  // v2.2873 (J17-N1): the office heard a "no" on the phone — record it. One RPC flips
  // sent → declined and writes the `declined` event (metadata.by = staff) in one transaction.
  const [recordingDecline, setRecordingDecline] = useState(false)
  const declineVerdict = useMemo(() => canDeclineEstimate(row?.status), [row?.status])
  async function recordStaffDecline(note: string, channel: EstimateDeclineChannel) {
    if (!row || recordingDecline || !user || !declineVerdict.ok) return
    setRecordingDecline(true)
    try {
      // The RPC ships with this PR's migration; generated types catch up on the next gen-types run.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('record_estimate_decline', {
        p_estimate_id: row.id,
        p_note: note,
        p_channel: channel,
      })
      if (error) throw error
      showToast('Marked declined.', 'success')
      recordNavClick(user.id, role, 'estimate_declined', '#staff')
      await load()
      await loadEstimateCustomerEvents()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not mark declined'), 'error')
    } finally {
      setRecordingDecline(false)
    }
  }

  /** Resend link (v2.2856): can THIS row take a re-mint? Same kernel the edge function enforces. */
  const resendVerdict = useMemo(
    () =>
      canResendEstimateLink(row?.status, row?.sent_at, new Date(), {
        validUntil: row?.valid_until ?? null,
        inBidRoom: Boolean(row?.bid_room_id),
      }),
    [row?.status, row?.sent_at, row?.valid_until, row?.bid_room_id],
  )

  // A different estimate → forget the one-time URL panel.
  useEffect(() => {
    setResentInfo(null)
  }, [row?.id])

  const copyResentUrl = useCallback(
    (url: string) => {
      void navigator.clipboard.writeText(url).then(
        () => showToast('Customer link copied.', 'success'),
        () => showToast('Could not copy link.', 'error'),
      )
    },
    [showToast],
  )

  /**
   * Resend link (v2.2856, J17-F2/N3): `send-estimate-to-customer` in `mode: 'resend'` mints a
   * fresh token (the old link dies), mails the stored email again to the address on the row,
   * and returns the new URL — kept in this tab like a first send, and shown once below.
   */
  async function resendCustomerLink() {
    if (!row || resending || !user || !resendVerdict.ok) return
    setResending(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        showToast('Not signed in', 'error')
        return
      }
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimate-to-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          apikey: anon,
        },
        body: JSON.stringify({
          mode: 'resend',
          estimate_id: row.id,
          public_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        accept_url?: string
        emailed?: boolean
        sent_to?: string
        email_error?: string
        warning?: string
        error?: string
      }
      if (!res.ok || !json.ok || !json.accept_url) {
        showToast(json.error || 'Resend failed', 'error')
        return
      }
      const email = json.sent_to?.trim() || row.customer_email?.trim() || ''
      setLastAcceptUrl(json.accept_url)
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`${ESTIMATE_ACCEPT_URL_SESSION_PREFIX}${row.id}`, json.accept_url)
        }
      } catch {
        /* ignore */
      }
      setResentInfo({ email, emailed: Boolean(json.emailed), url: json.accept_url })
      showToast(
        json.emailed ? `Link resent to ${email}.` : `New link ready — email did not go out. ${json.warning || json.email_error || ''}`.trim(),
        json.emailed ? 'success' : 'error',
      )
      recordNavClick(user.id, role, 'estimate_link_resent', json.emailed ? '#emailed' : '#link-only')
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Resend failed'), 'error')
    } finally {
      setResending(false)
    }
  }

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

  function buildCustomerExperienceOverridesPayload(): Record<string, string> | null {
    const parsed = parseEstimateExperienceOverrides(cxOverrideFields)
    return Object.keys(parsed).length > 0 ? parsed : null
  }

  function acceptanceCxOmitKeys(): ReadonlySet<EstimateExperienceOverrideKey> | undefined {
    const omit = new Set<EstimateExperienceOverrideKey>()
    if (!validUntil.trim()) omit.add('doc_valid_through_prefix')
    if (title.trim()) omit.add('doc_title_fallback')
    return omit.size > 0 ? omit : undefined
  }

  function renderCxDraftSectionFields(section: CxOverrideSectionConfig, options?: CxDraftSectionFieldsOptions) {
    const keys =
      options?.omitKeys?.size != null && options.omitKeys.size > 0
        ? section.keys.filter((k) => !options.omitKeys!.has(k))
        : section.keys
    return (
      <div
        style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'var(--bg-page)',
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        <p style={{ fontSize: '0.85rem', fontWeight: 500, margin: '0 0 0.35rem', userSelect: 'none' }}>
          Customize customer copy (optional)
        </p>
        {keys.map((k) =>
          k === 'accept_page_footer' ? (
            <div key={k} style={{ marginTop: '0.65rem' }}>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={
                    'accept_page_footer' in cxOverrideFields && cxOverrideFields.accept_page_footer === ''
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCxOverrideFields((prev) => ({ ...prev, accept_page_footer: '' }))
                    } else {
                      setCxOverrideFields((prev) => {
                        if (!('accept_page_footer' in prev)) return prev
                        const { accept_page_footer: _removed, ...rest } = prev
                        return rest
                      })
                    }
                  }}
                />
                <span style={{ fontSize: '0.85rem' }}>
                  Hide company footer on this quote (acceptance page only)
                </span>
              </label>
              <label style={{ display: 'block', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{CX_FIELD_LABELS[k]}</span>
                <textarea
                  value={
                    'accept_page_footer' in cxOverrideFields && cxOverrideFields.accept_page_footer === ''
                      ? ''
                      : (cxOverrideFields[k] ?? cxTemplateDefaults[k])
                  }
                  disabled={
                    'accept_page_footer' in cxOverrideFields && cxOverrideFields.accept_page_footer === ''
                  }
                  onChange={(e) => {
                    const next = e.target.value.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
                    const def = cxTemplateDefaults[k]
                    setCxOverrideFields((prev) => {
                      if (next.trim() === '' || next === def) {
                        if (!(k in prev)) return prev
                        const { [k]: _removed, ...rest } = prev
                        return rest
                      }
                      return { ...prev, [k]: next }
                    })
                  }}
                  rows={cxOverrideFieldRows(k)}
                  style={{
                    ...estInputBase,
                    display: 'block',
                    width: '100%',
                    marginTop: '0.25rem',
                    padding: '0.5rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    ...(('accept_page_footer' in cxOverrideFields &&
                      cxOverrideFields.accept_page_footer === '') ?
                      { opacity: 0.7 }
                    : {}),
                  }}
                />
              </label>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }}>
                Clear the textarea to use organization default. Check “Hide…” to omit the footer for this quote only
                (saved as an empty override).
              </p>
            </div>
          ) : (
            <label key={k} style={{ display: 'block', marginTop: '0.65rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{CX_FIELD_LABELS[k]}</span>
              <textarea
                value={cxOverrideFields[k] ?? cxTemplateDefaults[k]}
                onChange={(e) => {
                  const next = e.target.value.slice(0, ESTIMATE_EXPERIENCE_FIELD_MAX_LEN)
                  const def = cxTemplateDefaults[k]
                  setCxOverrideFields((prev) => {
                    if (next.trim() === '' || next === def) {
                      if (!(k in prev)) return prev
                      const { [k]: _removed, ...rest } = prev
                      return rest
                    }
                    return { ...prev, [k]: next }
                  })
                }}
                rows={cxOverrideFieldRows(k)}
                style={{
                  ...estInputBase,
                  display: 'block',
                  width: '100%',
                  marginTop: '0.25rem',
                  padding: '0.5rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </label>
          ),
        )}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
          Blank fields show organization defaults (built-in if unset in Settings). Only changes you make are saved as
          overrides.
        </p>
        {section.description ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>{section.description}</p>
        ) : null}
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem', marginBottom: 0 }}>
          Save the draft (Save draft or Send) to persist overrides.
        </p>
      </div>
    )
  }

  function handleSelectCustomer(c: CustomerRow) {
    const prev = customerId ? customers.find((x) => x.id === customerId) : undefined
    const prevName = prev?.name?.trim() ?? ''

    setForAddress('')
    setCustomerId(c.id)
    setCustomerSearch(getCustomerDisplay(c))
    const crm = extractContactFromCustomer(c).email.trim()
    if (crm) setSendEmailOverride('')

    if (row?.status !== 'draft') return
    const shouldSetTitle =
      isGenericEstimateTitle(title) ||
      (prevName.length > 0 &&
        (title.trim() === defaultEstimateTitle(prevName) ||
          title.trim() === defaultEstimateTitle(prevName, true)))
    if (shouldSetTitle) setTitle(defaultEstimateTitle(c.name ?? '', isCO))
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

  // Lazy projects fetch for the draft's linked-project picker (first draft render only).
  useEffect(() => {
    if (!row || !isDraft || projectsForPicker !== null) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('projects').select('id, name, project_number').order('name')
      if (cancelled) return
      setProjectsForPicker((data ?? []) as Array<{ id: string; name: string | null; project_number: string | null }>)
    })()
    return () => {
      cancelled = true
    }
  }, [row, isDraft, projectsForPicker])

  /**
   * The exact draft UPDATE payload — one builder shared by saveDraft and the
   * autosave dirty check (v2.2592), so "dirty" can never disagree with what a
   * save would actually write.
   */
  function buildDraftPersistPayload(attDb: { url: string | null; label: string | null }) {
    // The one builder (`lib/estimates/estimateDraftPersist`, v2.3867); the page resolves the
    // two state-derived values and hands over the fields.
    return buildEstimateDraftPersistPayload(
      {
        isChangeOrder: isCO,
        title,
        terms,
        lines,
        totalCents,
        options: estimateOptions,
        viewedOptionKey,
        validUntil,
        forAddress,
        linkedProjectId,
        internalNotes,
        customerId,
        customerEmail: resolveCustomerEmailForPersist(),
        customerExperienceOverrides: buildCustomerExperienceOverridesPayload(),
        acceptHeaderBrand,
        acceptNotifyUserIds,
        changeOrderFields: coFields,
      },
      attDb,
    )
  }

  /** The date boxes caught half typed: the payload above leaves them out, a save says so, and nothing goes out past one. */
  function unfinishedDraftDates() {
    return estimateDraftUnfinishedDates({ isChangeOrder: isCO, validUntil, changeOrderFields: coFields })
  }
  /** Says why and answers true when a half-typed date stops the draft going out — what is sent is what is saved. */
  function unfinishedDateStopsSending(): boolean {
    const why = estimateDraftUnfinishedDateBlocksSend(unfinishedDraftDates(), new Date().getFullYear())
    if (why) showToast(why, 'error')
    return why !== null
  }

  async function saveDraft(options?: { quiet?: boolean; skipReload?: boolean }): Promise<boolean> {
    if (!row || !isDraft || saving) return false
    const quiet = options?.quiet ?? false
    const attDb = normalizeCustomerAttachmentDraftForDb(customerAttachmentUrl, customerAttachmentLabel)
    if (customerAttachmentUrl.trim() && !attDb.url) {
      showToast('Supporting document URL must be a valid https link.', 'error')
      return false
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .update(buildDraftPersistPayload(attDb))
            .eq('id', row.id)
            .eq('status', 'draft'),
        'save estimate',
      )
      committedDraftRowIdRef.current = row.id
      // A date caught half typed was left out of that write: say so — once per box from the autosave, every time from Save draft.
      const heldDates = unfinishedDraftDates()
      const heldBoxes = heldDates.map((box) => `${row.id}:${box}`)
      if (heldDates.length > 0 && (!quiet || heldDatesToTell(toldHeldDraftDatesRef.current, heldBoxes))) {
        showToast(estimateDraftHeldDateMessage(heldDates, new Date().getFullYear()), 'info')
      } else if (!quiet) showToast('Saved', 'success')
      toldHeldDraftDatesRef.current = heldBoxes
      // Autosave (v2.2592) skips the reload: load() re-seeds the whole editor
      // from the row (resets lines, options, the viewed option) and would
      // clobber whatever was typed while the save was in flight.
      if (!options?.skipReload) await load()
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save'), 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!row || !isDraft || loading) return
    if (prevCustomerIdForAutosave.current === undefined) {
      prevCustomerIdForAutosave.current = customerId
      return
    }
    if (prevCustomerIdForAutosave.current === customerId) return
    const nextId = customerId
    void (async () => {
      const ok = await saveDraft({ quiet: true })
      if (ok) prevCustomerIdForAutosave.current = nextId
    })()
    // Customer-link changes only; avoid re-saving on every keystroke. saveDraft reads latest form state when the IIFE runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, row?.id, isDraft, loading])

  // Draft autosave (v2.2592, Taunya: work wiped by a hard reload mid-edit).
  // Reuses the Edit-Job autosave slice: baseline vs the EXACT persist payload,
  // ~1.5s debounce after the last change, quiet + reload-skipping save. jobId
  // gates on !loading so the baseline is captured only after hydration
  // completes — never against a half-hydrated editor.
  const draftAutosaveAttachment = normalizeCustomerAttachmentDraftForDb(customerAttachmentUrl, customerAttachmentLabel)
  const draftAutosaveBlocked = Boolean(customerAttachmentUrl.trim() && !draftAutosaveAttachment.url)
  const draftAutosaveSliceJson =
    row && isDraft && !draftAutosaveBlocked ? JSON.stringify(buildDraftPersistPayload(draftAutosaveAttachment)) : ''
  const draftAutosave = useJobFormAutosaveSlice({
    jobId: row && isDraft && !loading ? row.id : null,
    sliceJson: draftAutosaveSliceJson,
    save: () => saveDraft({ quiet: true, skipReload: true }),
    enabled: !saving && !sending && !draftAutosaveBlocked,
    debounceMs: 1500,
  })
  const draftAutosaveFlushRef = useRef(draftAutosave.flush)
  draftAutosaveFlushRef.current = draftAutosave.flush

  // Leave hook (decision 17, v2.2885): a draft this visit minted that never
  // received a commit — no autosave landed, no Save draft, no Send — and is
  // still empty deletes itself when you navigate away or the editor unmounts.
  // Keyed on routeSegment, not row.id: at a route change the state below is
  // still the OLD row's (load() hasn't run yet), which is what must be judged.
  const freshDraftLeaveRef = useRef<() => void>(() => {})
  freshDraftLeaveRef.current = () => {
    if (!row) return
    const discard = shouldDiscardFreshEstimateDraftOnLeave({
      fresh: freshDraftRowIdRef.current === row.id,
      everSaved: committedDraftRowIdRef.current === row.id,
      form: estimateDraftFormSnapshot({
        status: row.status,
        docKind: row.doc_kind,
        title,
        customerId,
        lines,
        terms,
        changeOrderFields: coFields,
        forAddress,
        internalNotes,
      }),
    })
    if (!discard) return
    draftAutosave.cancelPending()
    freshDraftRowIdRef.current = null
    void supabase
      .from('estimates')
      .delete()
      .eq('id', row.id)
      .eq('status', 'draft')
      .then(
        () => {},
        () => {
          /* best-effort — the Pipeline's Clean up empty drafts sweep catches stragglers */
        },
      )
  }
  useEffect(
    () => () => {
      freshDraftLeaveRef.current()
    },
    [routeSegment],
  )
  useEffect(() => {
    // Her loss scenario is "ran off to look something up": flush the pending
    // debounce the moment the tab is hidden, so the save lands before any
    // later hard reload can wipe it.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void draftAutosaveFlushRef.current()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

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
    const crm = extractContactFromCustomer(sel).email.trim()
    const payloadEmail = crm || sendEmailOverride.trim()
    if (!payloadEmail) {
      showToast('This customer has no email on file. Enter a send-to email below.', 'error')
      return
    }
    if (!SEND_EMAIL_RE.test(payloadEmail)) {
      showToast('Enter a valid email address.', 'error')
      return
    }
    // Tier-2 #42 (J17-F4): one confirm that names the recipient — this emails a
    // real customer. Rail decision 1's $0 soft gate (schedule-only change
    // orders are legitimate, silent $0 sends are not) folds into the same ask.
    recordNavClick(user.id, role, 'discard_guard_shown', 'estimate_send')
    const zeroNote = totalCents === 0 ? (isCO ? ' The net change to contract is $0.00.' : ' The total is $0.00.') : ''
    const okSend = await confirmDialog({
      title: isCO ? 'Send for signature?' : 'Send to customer?',
      message: `Send to ${payloadEmail}?${zeroNote}`,
      confirmLabel: totalCents === 0 ? 'Send anyway' : 'Send',
    })
    if (!okSend) return
    setSending(true)
    try {
      await saveDraft()
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        showToast('Not signed in', 'error')
        return
      }
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-estimate-to-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
          apikey: anon,
        },
        body: JSON.stringify({
          estimate_id: row.id,
          customer_email: payloadEmail,
          public_origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        accept_url?: string
        emailed?: boolean
        email_error?: string
        warning?: string
        error?: string
      }
      if (!res.ok || !json.ok) {
        showToast(json.error || 'Send failed', 'error')
        return
      }
      showToast(json.emailed ? 'Email sent.' : `Link ready. ${json.warning || json.email_error || ''}`, 'success')
      if (json.accept_url) {
        setLastAcceptUrl(json.accept_url)
        try {
          if (typeof sessionStorage !== 'undefined' && row.id) {
            sessionStorage.setItem(`${ESTIMATE_ACCEPT_URL_SESSION_PREFIX}${row.id}`, json.accept_url)
          }
        } catch {
          /* ignore */
        }
      }
      if (!json.emailed && json.accept_url) {
        void navigator.clipboard.writeText(json.accept_url)
      }
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Send failed'), 'error')
    } finally {
      setSending(false)
    }
  }

  const checkCustomerAttachmentUrl = useCallback(async () => {
    const u = normalizeCustomerAttachmentUrl(customerAttachmentUrl)
    if (!u) {
      showToast('Enter a valid https URL first.', 'error')
      return
    }
    setAttachmentCheckStatus('loading')
    setAttachmentCheckMessage('')
    const result = await checkGoogleDriveAttachmentUrl(customerAttachmentUrl)
    if (result.status === 'error' && result.message === 'Not signed in.') {
      showToast('Not signed in', 'error')
    }
    setAttachmentCheckStatus(
      result.status === 'success' ? 'success' : result.status === 'warn' ? 'warn' : 'error',
    )
    setAttachmentCheckMessage(result.message)
  }, [customerAttachmentUrl, showToast])

  function openCreateJobModal() {
    if (!row || row.status !== 'customer_accepted' || row.job_ledger_id) return
    setCreateJobModalOpen(true)
  }

  function openUnlinkJobConfirm() {
    if (!row || row.status !== 'customer_accepted' || !row.job_ledger_id || unlinkingJob) return
    setUnlinkJobConfirmOpen(true)
  }

  function closeUnlinkJobConfirm() {
    if (unlinkingJob) return
    setUnlinkJobConfirmOpen(false)
  }

  async function confirmUnlinkLinkedJob() {
    if (!row || row.status !== 'customer_accepted' || !row.job_ledger_id || unlinkingJob) return
    setUnlinkingJob(true)
    try {
      await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .update({ job_ledger_id: null })
            .eq('id', row.id)
            .eq('status', 'customer_accepted'),
        'unlink estimate job',
      )
      showToast('Job unlinked', 'success')
      setUnlinkJobConfirmOpen(false)
      await load()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not unlink job'), 'error')
    } finally {
      setUnlinkingJob(false)
    }
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
    const target = rooms.find((r) => r.customer_id === row.customer_id) ?? (rooms.length === 1 ? rooms[0] : rooms.find((r) => r.customer_id === null))
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

  if (loading || !row) {
    return (
      <div className={`${ESTIMATES_PAGE_CLASS} estimates-page-shell--detail`}>
        <style>{estimateDetailPageCss}</style>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className={`${ESTIMATES_PAGE_CLASS} estimates-page-shell--detail`}>
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
          <section style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
              {staffResolvedExperience?.docLineItemsHeading ?? (isCO ? 'Impact on cost' : 'Line items')}
            </h2>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-700)' }}>
              <EstimateLineItemsTable lines={normalizeEstimateLineItemsFromJson(row.line_items_snapshot, { allowNegative: isCO })} />
            </div>
          </section>
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
              <div style={{ marginBottom: estimateOptions.length > 0 ? '0.9rem' : '0.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'stretch' }}>
                  {syncedEstimateOptions.map((o) => {
                    const on = o.key === viewedOptionKey
                    const total = o.key === viewedOptionKey ? totalCents : estimateOptionTotalCents(o)
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => switchViewedOption(o.key)}
                        aria-pressed={on}
                        title={on ? 'Editing this option' : 'Edit this option'}
                        style={{
                          font: 'inherit',
                          textAlign: 'left',
                          minWidth: '10rem',
                          border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                          boxShadow: on ? '0 0 0 1px #3b82f6 inset' : 'none',
                          background: on ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                          color: 'var(--text-strong)',
                          borderRadius: 9,
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.8rem' }}>
                          {o.recommended ? <span aria-label="Recommended" style={{ color: '#d97706' }}>★ </span> : null}
                          {o.name.trim() || 'Option'}
                        </span>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '0.95rem', fontVariantNumeric: 'tabular-nums' }}>
                          {o.kind === 'add_on' && syncedEstimateOptions.some((p) => p.kind === 'choice') ? `+ ${formatMoney(total)}` : formatMoney(total)}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {(o.key === viewedOptionKey ? lines : o.line_items).length} line item{(o.key === viewedOptionKey ? lines : o.line_items).length === 1 ? '' : 's'}
                          {on ? ' · editing' : ''}
                        </span>
                        {/* v2.3556: how this option is offered — the customer picks one choice, ticks any add-ons */}
                        <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: o.kind === 'add_on' ? 'var(--text-blue-800)' : 'var(--text-amber-700)' }}>
                          {o.kind === 'add_on' ? '+ add-on' : 'one of the choices'}
                        </span>
                      </button>
                    )
                  })}
                  {estimateOptions.length < MAX_ESTIMATE_OPTIONS ? (
                    <button
                      type="button"
                      onClick={addEstimateOption}
                      title={
                        estimateOptions.length === 0
                          ? 'Offer the customer a choice — turns this estimate into two options, starting from the current line items'
                          : 'Add another option (starts as a copy of the one you’re editing)'
                      }
                      style={{
                        font: 'inherit',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        color: 'var(--text-link)',
                        border: '1px dashed var(--border-strong)',
                        background: 'none',
                        borderRadius: 9,
                        padding: estimateOptions.length === 0 ? '0.4rem 0.8rem' : '0.5rem 0.9rem',
                        cursor: 'pointer',
                        alignSelf: 'center',
                      }}
                    >
                      ＋ Option
                    </button>
                  ) : null}
                </div>
                {viewedOption ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.55rem' }}>
                    <input
                      type="text"
                      value={viewedOption.name}
                      onChange={(e) => patchViewedOption({ name: e.target.value })}
                      placeholder="Option name"
                      aria-label="Option name"
                      style={{ ...estInputBase, width: '11rem' }}
                    />
                    <input
                      type="text"
                      value={viewedOption.description}
                      onChange={(e) => patchViewedOption({ description: e.target.value })}
                      placeholder="Pitch the customer sees under the name — why this option, what's the warranty…"
                      aria-label="Option description"
                      style={{ ...estInputBase, flex: '1 1 16rem' }}
                    />
                    {/* v2.3556: Offered as — a choice (the customer picks exactly one) or an add-on (they tick any) */}
                    <span role="group" aria-label="Offered as" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                      {(
                        [
                          ['choice', 'One of the choices', 'The customer picks exactly one choice; the ★ one is pre-selected'],
                          ['add_on', 'An add-on', 'Rides along with whatever they choose — they tick any; one you mark Start ticked begins ticked'],
                        ] as const
                      ).map(([kind, label, title]) => {
                        const on = viewedOption.kind === kind
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => setViewedOptionKind(kind)}
                            aria-pressed={on}
                            title={title}
                            style={{
                              font: 'inherit',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              border: 'none',
                              padding: '0.3rem 0.6rem',
                              background: on ? '#2563eb' : 'var(--surface)',
                              color: on ? 'white' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </span>
                    {(() => {
                      const starBlocked = viewedOption.kind === 'add_on' && syncedEstimateOptions.some((o) => o.kind === 'choice')
                      return (
                        <button
                          type="button"
                          onClick={() => setEstimateOptions((prev) => setRecommendedEstimateOption(prev, viewedOption.key))}
                          aria-pressed={viewedOption.recommended}
                          disabled={starBlocked}
                          title={
                            starBlocked
                              ? 'The star marks a choice — add-ons are never pre-selected'
                              : viewedOption.recommended
                                ? 'This is the recommended option — pre-selected on the customer page'
                                : 'Make this the recommended option'
                          }
                          style={{
                            font: 'inherit',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            border: '1px solid var(--border-strong)',
                            borderRadius: 6,
                            padding: '0.3rem 0.6rem',
                            background: viewedOption.recommended ? 'var(--bg-amber-tint)' : 'var(--surface)',
                            color: viewedOption.recommended ? 'var(--text-amber-700)' : 'var(--text-muted)',
                            cursor: starBlocked ? 'not-allowed' : 'pointer',
                            opacity: starBlocked ? 0.55 : 1,
                          }}
                        >
                          ★ Recommended
                        </button>
                      )
                    })()}
                    {/* v2.5018 (the owner's call of 2026-10-09): the office may pre-tick a recommended add-on; the customer unticks freely. */}
                    {viewedOption.kind === 'add_on' ? (
                      <button
                        type="button"
                        onClick={() =>
                          setEstimateOptions((prev) => {
                            const next = setEstimateAddOnPreticked(prev, viewedOption.key, !viewedOption.preticked)
                            setPreviewSelectedOptionKeys(defaultEstimateSelection(next))
                            return next
                          })
                        }
                        aria-pressed={viewedOption.preticked === true}
                        title={viewedOption.preticked ? 'Recommended: it starts ticked on the customer page, and they can untick it' : 'Recommend this add-on: it starts ticked on the customer page'}
                        style={{
                          font: 'inherit',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          border: '1px solid var(--border-strong)',
                          borderRadius: 6,
                          padding: '0.3rem 0.6rem',
                          background: viewedOption.preticked ? 'var(--bg-amber-tint)' : 'var(--surface)',
                          color: viewedOption.preticked ? 'var(--text-amber-700)' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Start ticked
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={removeViewedOption}
                      title={estimateOptions.length === 2 ? 'Remove this option — the estimate goes back to a single price' : 'Remove this option'}
                      style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.3rem 0.6rem', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      Remove option
                    </button>
                    <span style={{ flex: '1 1 16rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Choices: the customer picks exactly one. Add-ons: they tick any. Make every option an add-on when there is nothing to choose between.
                    </span>
                  </div>
                ) : null}
              </div>
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
                        !canManageEstimateCatalog && catalogLineItems.length === 0 ? '#9ca3af'
                        : catalogIconHovered ? '#1d4ed8'
                        : '#2563eb',
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
          <fieldset
            style={{
              marginTop: '1rem',
              marginLeft: 'auto',
              marginRight: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.75rem',
              maxWidth: 560,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <legend style={{ fontWeight: 500, padding: '0 0.35rem' }}>Supporting document (Optional)</legend>
            {isDraft ? (
              <>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500 }}>
                  Label
                  <input
                    type="text"
                    value={customerAttachmentLabel}
                    onChange={(e) => setCustomerAttachmentLabel(e.target.value)}
                    placeholder="e.g. Floor plan, Scope PDF"
                    maxLength={200}
                    style={{
                      ...estInputBase,
                      display: 'block',
                      width: '100%',
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      boxSizing: 'border-box',
                      font: 'inherit',
                    }}
                  />
                </label>
                <label style={{ display: 'block', marginTop: '0.65rem', fontSize: '0.85rem', fontWeight: 500 }}>
                  Document URL (https only)
                  <input
                    type="url"
                    inputMode="url"
                    value={customerAttachmentUrl}
                    onChange={(e) => setCustomerAttachmentUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/…"
                    style={{
                      ...estInputBase,
                      display: 'block',
                      width: '100%',
                      marginTop: '0.25rem',
                      padding: '0.5rem',
                      boxSizing: 'border-box',
                      font: 'inherit',
                    }}
                  />
                </label>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => void checkCustomerAttachmentUrl()}
                    disabled={attachmentCheckStatus === 'loading' || !customerAttachmentUrlIsCheckable}
                    style={
                      customerAttachmentUrlIsCheckable ?
                        estSmallPrimaryButton(attachmentCheckStatus === 'loading')
                      : {
                          ...estSmallSecondaryButton(),
                          cursor: 'not-allowed',
                          opacity: 0.65,
                        }
                    }
                  >
                    {attachmentCheckStatus === 'loading' ? 'Checking…' : 'Check link'}
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Drive or Docs URLs only. Does not block sending — hints only.
                  </span>
                </div>
                {attachmentCheckStatus === 'success' && attachmentCheckMessage ? (
                  <p
                    role="status"
                    style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-green-600)', lineHeight: 1.45 }}
                  >
                    {attachmentCheckMessage}
                  </p>
                ) : null}
                {attachmentCheckStatus === 'warn' && attachmentCheckMessage ? (
                  <p
                    role="status"
                    style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-amber-700)', lineHeight: 1.45 }}
                  >
                    {attachmentCheckMessage}
                  </p>
                ) : null}
                {attachmentCheckStatus === 'error' && attachmentCheckMessage ? (
                  <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-red-700)', lineHeight: 1.45 }}>
                    {attachmentCheckMessage}
                  </p>
                ) : null}
              </>
            ) : customerAttachmentPreview ? (
              <div style={{ fontSize: '0.9rem' }}>
                <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>
                  {customerAttachmentPreview.label?.trim() || 'Supporting document'}
                </p>
                <a
                  href={customerAttachmentPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ wordBreak: 'break-all' }}
                >
                  {customerAttachmentPreview.url}
                </a>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-faint)' }}>No supporting document for this quote.</p>
            )}
            <details style={{ margin: '0.65rem 0 0', fontSize: '0.85rem', color: 'var(--text-700)', textAlign: 'center' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500, color: 'var(--text-gray-800)' }}>
                How to share a file in Google Drive
              </summary>
              <div style={{ textAlign: 'left', marginTop: '0.5rem' }}>
                <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.45 }}>
                  <li>Open the file in Drive, then choose Share.</li>
                  <li>
                    Set access to <strong>Anyone with the link</strong> and role <strong>Viewer</strong> (or your org’s
                    equivalent for external viewers).
                  </li>
                  <li>Copy the link and paste it below.</li>
                </ol>
                <p style={{ margin: '0.5rem 0 0', lineHeight: 1.45 }}>
                  Some <strong>Google Workspace</strong> policies prevent “anyone with the link” for people outside your
                  org. If that applies, customers may still see a sign-in wall even when the steps above are correct.
                </p>
                <p style={{ margin: '0.5rem 0 0', lineHeight: 1.45 }}>
                  Official help:{' '}
                  <a
                    href="https://support.google.com/drive/answer/2494822"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share files from Google Drive
                  </a>
                  .
                </p>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.45 }}>
                  <li>
                    If you are unsure the customer can open it, open the link in a <strong>private or incognito</strong>{' '}
                    window (signed out) to double-check.
                  </li>
                </ul>
              </div>
            </details>
          </fieldset>
          <section
            id="est-step-delivery"
            className={'est-backstage-card est-region-tint' + (railFlashStep === 'delivery' ? ' estimate-customer-search-highlight' : '')}
          >
            <h2 className="est-backstage-head">
              {railStepDot('delivery')}Delivery
              <span className="est-backstage-sub">The customer never sees this section.</span>
            </h2>
          <fieldset
            style={{
              marginTop: '1rem',
              marginLeft: 'auto',
              marginRight: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '0.75rem',
              maxWidth: 560,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <legend style={{ fontWeight: 500, padding: '0 0.35rem' }}>Email when customer accepts</legend>
            <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Choose who gets an email when the customer submits acceptance. Check <strong>Notify me</strong> for
              yourself, then search below to add anyone else.
            </p>
            {user?.id ? (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  marginBottom: '0.75rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={acceptNotifyUserIds.includes(user.id)}
                  onChange={(e) => {
                    const on = e.target.checked
                    setAcceptNotifyUserIds((prev) => {
                      const others = prev.filter((id) => id !== user.id)
                      if (on) return [...new Set([user.id, ...others])]
                      return others
                    })
                  }}
                  style={{ marginTop: '0.15rem', flexShrink: 0 }}
                />
                <span>
                  <span style={{ fontWeight: 600 }}>Notify me</span>
                  <span style={{ fontWeight: 500 }}> · {profileName?.trim() || 'You'}</span>
                  <span style={{ color: 'var(--text-muted)' }}> · {user.email?.trim() || '—'}</span>
                </span>
              </label>
            ) : null}
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
              Also notify
            </div>
            <SearchableMultiSelect
              id="estimate-accept-notify-others"
              options={acceptNotifyOtherSelectOptions}
              value={acceptNotifyOtherIds}
              onChange={(next) => {
                setAcceptNotifyUserIds((prev) => {
                  const selfOn = user?.id ? prev.includes(user.id) : false
                  const base = selfOn && user?.id ? [user.id] : []
                  return [...new Set([...base, ...next])]
                })
              }}
              listAriaLabel="Additional acceptance notify recipients"
              pinSelectedToTop
            />
          </fieldset>
          <div style={{ marginTop: '1rem' }}>
            <label htmlFor="estimate-linked-project" style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>
              Project
            </label>
            <SearchableSelect
              id="estimate-linked-project"
              value={linkedProjectId}
              onChange={setLinkedProjectId}
              options={(projectsForPicker ?? []).map((p) => ({
                value: p.id,
                label: `${p.name ?? 'Unnamed project'}${formatProjectNumberLabel(p.project_number) ? ` — ${formatProjectNumberLabel(p.project_number)}` : ''}`,
              }))}
              emptyOption={{ value: '', label: 'Not linked' }}
              placeholder="Not linked"
              listAriaLabel="Linked project"
            />
          </div>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ fontWeight: 500 }}>Internal notes</span>
            <AutosizeTextarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              minRows={1}
              extraLines={internalNotes.trim() ? 1 : 0}
              style={{ ...estInputBase, marginTop: '0.25rem', padding: '0.5rem', fontFamily: 'inherit' }}
            />
          </label>
          </section>
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
        <div style={{ marginTop: '1rem' }}>
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Acceptance notify recipients</div>
            {acceptNotifyResolvedUsers.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>No staff email recipients were set for this quote.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {acceptNotifyResolvedUsers.map((u) => (
                  <li key={u.id} style={{ marginBottom: '0.25rem' }}>
                    {u.name?.trim() || '—'} · {u.email?.trim() || '—'}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              This list was locked when the quote was sent.
            </p>
          </div>
          {row.status === 'customer_accepted' ? (
            <div
              key={`customer-accepted-record-${row.id}`}
              style={{
                marginTop: 0,
                padding: '1rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                maxWidth: 'min(640px, 100%)',
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--surface)',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <EstimateCustomerDocument
                title={row.title ?? ''}
                forLine={acceptancePreviewForLine}
                validUntil={row.valid_until ?? null}
                lineItemsSnapshot={row.line_items_snapshot}
                termsSnapshot={row.terms_snapshot ?? ''}
                totalCents={row.total_cents}
                headerBrand={acceptanceDocHeaderBrand}
                lineItemsHeading={staffResolvedExperience?.docLineItemsHeading ?? (isCO ? 'Impact on cost' : 'Line items')}
                termsHeading={staffResolvedExperience?.docTermsHeading ?? 'Terms'}
                totalLabel={staffResolvedExperience?.docTotalLabel ?? (isCO ? 'Net change to contract' : 'Total')}
                changeOrder={isCO ? coFields : null}
              />
              {customerAttachmentPreview ? (
                <div style={{ marginTop: '1.25rem' }}>
                  <EstimateCustomerAttachmentCard attachment={customerAttachmentPreview} />
                </div>
              ) : null}
            </div>
          ) : (
            <p>
              {isCO ? (
                <>
                  <strong>Net change to contract:</strong> {formatSignedCentsUsd(row.total_cents)}
                </>
              ) : (
                <>
                  <strong>Total:</strong> {formatMoney(row.total_cents)}
                </>
              )}
            </p>
          )}
          {(row.customer_id || row.customer_email) && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-700)' }}>
              {row.customer_id ? (
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Customer:</strong>{' '}
                  {(() => {
                    const displayName =
                      customers.find((c) => c.id === row.customer_id)?.name?.trim() || row.customer_id
                    return (
                      <button
                        type="button"
                        onClick={() => setDetailCustomerSnapshotId(row.customer_id)}
                        title="View customer"
                        aria-label={`View customer ${displayName}`}
                        style={{
                          margin: 0,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          font: 'inherit',
                          color: 'var(--text-link)',
                          textDecoration: 'underline',
                          textUnderlineOffset: '2px',
                        }}
                      >
                        {displayName}
                      </button>
                    )
                  })()}
                </p>
              ) : null}
              {row.customer_email && (
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Email used for link:</strong> {row.customer_email}
                </p>
              )}
            </div>
          )}
          {row.status === 'customer_accepted' && (
            <>
              {isBidProposalDocKind(row.doc_kind) && row.bid_id ? (
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', background: 'var(--bg-violet-100)', color: 'var(--text-indigo-800)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                  Signed bid-room proposal — the record of a GC signature.{' '}
                  <Link to={`/bids?bidId=${row.bid_id}`} style={{ fontWeight: 600 }}>
                    Open the bid
                  </Link>
                </div>
              ) : null}
              <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Customer acceptance</h2>
              {(() => {
                // Estimate Options (v2.2462): what they chose, and what they passed on.
                // v2.3556: several options may have been accepted (a choice plus add-ons, or
                // add-ons alone) — the key list first, the single key for older acceptances.
                const offered = normalizeEstimateOptionsFromJson(row.options_snapshot)
                if (offered.length < 2) return null
                const record = describeAcceptedEstimateRecord(
                  offered,
                  acceptedEstimateOptionKeys(row),
                  formatMoney,
                  row.total_cents,
                )
                return (
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-700)', margin: '0.25rem 0 0.5rem' }} data-testid="estimate-accepted-record">
                    <div>
                      <strong>{record.headline}</strong> <span style={{ color: 'var(--text-muted)' }}>{record.offeredNote}</span>
                    </div>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                      {record.addOnLines.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                      {record.notChosenLines.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )
              })()}
              <ul style={{ fontSize: '0.9rem', color: 'var(--text-700)' }}>
                <li>Name: {row.acceptor_printed_name || '—'}</li>
                <li>
                  At:{' '}
                  {row.acceptor_consented_at?.trim() ? (
                    <>
                      {new Date(row.acceptor_consented_at).toLocaleString()}
                      {` ${formatEstimateUpdatedRelativeCompact(row.acceptor_consented_at)}`}
                    </>
                  ) : (
                    '—'
                  )}
                </li>
                <li>
                  IP: <IpAddressMapButton ip={row.acceptor_ip} />
                </li>
                {acceptorSignatureSignedUrl ? (
                  <li style={{ marginTop: '0.75rem', listStyle: 'none', marginLeft: '-1rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Signature</div>
                    <img
                      src={acceptorSignatureSignedUrl}
                      alt="Customer signature"
                      style={{ maxWidth: 400, width: '100%', border: '1px solid var(--border)', borderRadius: 6 }}
                    />
                  </li>
                ) : row.acceptor_signature_storage_path ? (
                  <li style={{ marginTop: '0.5rem' }}>Signature: (loading preview…)</li>
                ) : row.acceptor_printed_name?.trim() ? (
                  <li style={{ marginTop: '0.75rem', listStyle: 'none', marginLeft: '-1rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Signature</div>
                    <div style={{ maxWidth: 400 }}>
                      <EstimateAcceptTypedSignatureLine
                        printedName={row.acceptor_printed_name ?? ''}
                        consentAtIso={row.acceptor_consented_at}
                      />
                    </div>
                  </li>
                ) : null}
              </ul>
              <EstimateDetailCustomerActivitySection
                estimateId={row.id}
                status="customer_accepted"
                defaultOpen={false}
                loading={estimateCustomerEventsLoading}
                events={estimateCustomerEvents}
              />
              <div id={ESTIMATE_JOB_SECTION_HASH} style={{ marginTop: '1rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1rem', margin: 0 }}>Job</h2>
                {!row.job_ledger_id ? (
                  <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                    <button type="button" onClick={openCreateJobModal} style={estimateDetailCreateJobButtonStyle}>
                      {isCO ? 'Apply change order to job' : 'Create job from estimate'}
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.65rem',
                    }}
                  >
                    <span>
                      {(() => {
                        const hcp = estimateLinkedJobHcp(row)
                        return (
                          <>
                            Linked job:{' '}
                            <Link to={`/jobs?edit=${row.job_ledger_id}`}>{hcp ? `Job #${hcp}` : 'Open in Jobs'}</Link>
                          </>
                        )
                      })()}
                    </span>
                    <button
                      type="button"
                      onClick={openUnlinkJobConfirm}
                      disabled={unlinkingJob || loading || saving}
                      aria-label="Remove job link from this estimate"
                      style={{
                        ...estSmallSecondaryButton(),
                        cursor: unlinkingJob || loading || saving ? 'not-allowed' : 'pointer',
                        opacity: unlinkingJob || loading || saving ? 0.65 : 1,
                      }}
                    >
                      {unlinkingJob ? 'Unlinking…' : 'Unlink job'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
          {row.status === 'sent' && (
            <>
              <EstimateDetailCustomerActivitySection
                estimateId={row.id}
                status="sent"
                defaultOpen
                loading={estimateCustomerEventsLoading}
                events={estimateCustomerEvents}
              />
              {row.bid_room_id ? (
                <p style={{ marginTop: '1rem', color: 'var(--text-amber-800)' }}>
                  In the bid room — the GC reviews and signs this change order on their room page, alongside the proposal.
                </p>
              ) : (
                <EstimateResendLinkPanel
                  sentTo={row.customer_email?.trim() || null}
                  verdict={resendVerdict}
                  busy={resending || loading}
                  onResend={() => void resendCustomerLink()}
                  resent={resentInfo}
                  onCopyUrl={copyResentUrl}
                />
              )}
              <EstimateCustomerAcceptLinkButtons
                customerAcceptUrl={customerAcceptUrl}
                isDraft={isDraft}
                resendAvailable={resendVerdict.ok}
                onCopy={copyCustomerAcceptUrl}
                onOpen={openCustomerAcceptUrl}
                style={{ marginTop: '0.75rem' }}
              />
              <EstimateRecordDeclineControl
                busy={recordingDecline || loading}
                onRecord={(note, channel) => void recordStaffDecline(note, channel)}
                style={{ marginTop: '1rem' }}
              />
            </>
          )}
          {row.status === 'declined' && (
            <>
              <p style={{ marginTop: '1rem', color: 'var(--text-700)' }}>
                <strong>Declined.</strong> Nothing more is waiting on the customer — the row sits in the Pipeline's
                Declined bucket. To quote again, start a New estimate from the Estimates page.
              </p>
              <EstimateDetailCustomerActivitySection
                estimateId={row.id}
                status="declined"
                defaultOpen
                loading={estimateCustomerEventsLoading}
                events={estimateCustomerEvents}
              />
            </>
          )}
        </div>
      )}

      <EstimateDraftCustomerGate active={draftNeedsCustomer} onBlockedInteraction={requestCustomerFirst}>
        <details
          style={{
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>Customer experience</summary>
        <div style={{ marginTop: '1rem' }}>
          {row.status !== 'sent' ? (
            <EstimateCustomerAcceptLinkButtons
              customerAcceptUrl={customerAcceptUrl}
              isDraft={isDraft}
              resendAvailable={resendVerdict.ok}
              onCopy={copyCustomerAcceptUrl}
              onOpen={openCustomerAcceptUrl}
              style={{ marginBottom: '1rem' }}
            />
          ) : null}
          {!isDraft && row.customer_experience_sent ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Shown below is the copy customers see — saved when this estimate was sent.
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setCustomerPreviewTab('email')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 4,
                border: '1px solid var(--border-strong)',
                background: customerPreviewTab === 'email' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                color: 'var(--text-700)',
                fontWeight: customerPreviewTab === 'email' ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setCustomerPreviewTab('page')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 4,
                border: '1px solid var(--border-strong)',
                background: customerPreviewTab === 'page' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                color: 'var(--text-700)',
                fontWeight: customerPreviewTab === 'page' ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Acceptance page
            </button>
            <button
              type="button"
              onClick={() => setCustomerPreviewTab('thankyou')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 4,
                border: '1px solid var(--border-strong)',
                background: customerPreviewTab === 'thankyou' ? 'var(--bg-blue-tint)' : 'var(--bg-subtle)',
                color: 'var(--text-700)',
                fontWeight: customerPreviewTab === 'thankyou' ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Thank you
            </button>
          </div>

          {customerPreviewTab === 'email' && customerEmailPreview && (
            <>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '1rem',
                  background: 'var(--bg-page)',
                  fontSize: '0.9rem',
                }}
              >
                <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>
                  <strong>From:</strong> {estimateEmailFrom(acceptanceDocHeaderBrand)}
                  {customerEmailPreview.replyTo ? <> · <strong>Reply-To:</strong> {customerEmailPreview.replyTo}</> : null}
                </p>
                <p style={{ margin: '0 0 0.5rem' }}>
                  <strong>To:</strong> {previewEmailTo}
                </p>
                <p style={{ margin: '0 0 0.5rem' }}>
                  <strong>Subject:</strong> {customerEmailPreview.subject}
                </p>
                <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>What the customer sees</p>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Built by the same code that sends it. The logo appears when an acceptance page logo is selected.
                </p>
                <iframe
                  title="Estimate email preview"
                  sandbox=""
                  srcDoc={customerEmailPreview.html}
                  style={{ width: '100%', height: 640, border: '1px solid var(--border)', borderRadius: 6 }}
                />
                <p style={{ margin: '0.75rem 0 0.35rem', fontWeight: 600 }}>Plain text</p>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '0.75rem',
                  }}
                >
                  {customerEmailPreview.text}
                </pre>
              </div>
              {isDraft ? renderCxDraftSectionFields(CX_OVERRIDE_SECTIONS[0]) : null}
            </>
          )}

          {customerPreviewTab === 'page' && staffResolvedExperience && (
            <>
              <div
                style={{
                  fontFamily: 'system-ui, sans-serif',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '1rem',
                  background: 'var(--surface)',
                  maxWidth: 'min(640px, 100%)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <EstimateAcceptBody
                  variant="staffPreview"
                  previewBanner={
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Preview — customers use a secure link to accept.</span>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => openStaffAcceptCustomerPreview()}
                          title="Opens authenticated staff preview in a new tab (same layout as the customer page). Does not submit acceptance."
                          style={estSecondaryButton()}
                        >
                          Preview as customer
                        </button>
                      </div>
                    </div>
                  }
                  estimate={{
                    title: isDraft ? title.trim() || '' : row.title || '',
                    for_line: acceptancePreviewForLine,
                    valid_until: isDraft
                      ? validUntil.trim()
                        ? validUntil.trim()
                        : null
                      : row.valid_until ?? null,
                    line_items_snapshot: isDraft ? lines : row.line_items_snapshot,
                    terms_snapshot: isDraft ? terms : row.terms_snapshot ?? '',
                    total_cents: isDraft ? totalCents : row.total_cents,
                  }}
                  options={isDraft ? syncedEstimateOptions : normalizeEstimateOptionsFromJson(row.options_snapshot)}
                  selectedOptionKeys={previewSelectedOptionKeys}
                  onToggleOption={(key) =>
                    setPreviewSelectedOptionKeys((prev) =>
                      toggleEstimateOptionSelection(isDraft ? syncedEstimateOptions : normalizeEstimateOptionsFromJson(row.options_snapshot), prev, key),
                    )
                  }
                  experience={staffResolvedExperience}
                  printedName={
                    !isDraft && row.status === 'customer_accepted'
                      ? row.acceptor_printed_name?.trim() ?? ''
                      : ''
                  }
                  agreed={false}
                  onPrintedNameChange={() => {}}
                  onAgreedChange={() => {}}
                  formError={null}
                  submitting={false}
                  onSubmit={() => undefined}
                  headerBrand={acceptanceDocHeaderBrand}
                  customerAttachment={customerAttachmentPreview}
                  staffAcceptedRecord={
                    !isDraft && row.status === 'customer_accepted'
                      ? {
                          printedName: row.acceptor_printed_name?.trim() ?? '',
                          consentedAtIso: row.acceptor_consented_at,
                          drawSignatureUrl: row.acceptor_signature_storage_path?.trim()
                            ? acceptorSignatureSignedUrl
                            : null,
                          drawSignatureLoading:
                            !!(row.acceptor_signature_storage_path?.trim()) &&
                            !acceptorSignatureSignedUrl,
                          ip: row.acceptor_ip,
                          userAgent: row.acceptor_user_agent,
                          recordId: signedRecordId('E', row.estimate_number, row.id),
                          estimateRowId: row.id,
                        }
                      : null
                  }
                />
              </div>
              {isDraft
                ? renderCxDraftSectionFields(CX_OVERRIDE_SECTIONS[1], {
                    omitKeys: acceptanceCxOmitKeys(),
                  })
                : null}
            </>
          )}

          {customerPreviewTab === 'thankyou' && staffResolvedExperience && (
            <>
              <div
                style={{
                  fontFamily: 'system-ui, sans-serif',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 0,
                  background: 'var(--surface)',
                  maxWidth: 'min(640px, 100%)',
                  width: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <EstimateCustomerThankYou
                  previewBanner="Preview — customers see this after submitting acceptance, or if they open the link after it was already used."
                  title={staffResolvedExperience.thankYouTitle}
                  body={staffResolvedExperience.thankYouBody}
                />
              </div>
              {isDraft ? renderCxDraftSectionFields(CX_OVERRIDE_SECTIONS[2]) : null}
            </>
          )}
        </div>
        </details>
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

      {unlinkJobConfirmOpen && row ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002,
            paddingTop: 'var(--app-top-chrome, 0px)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlink-job-confirm-title"
            aria-describedby="unlink-job-confirm-desc"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 440,
              margin: '0 1rem',
            }}
          >
            <h2 id="unlink-job-confirm-title" style={{ margin: '0 0 1rem', fontSize: '1.25rem' }}>
              Unlink job
            </h2>
            <p id="unlink-job-confirm-desc" style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
              Remove the job link from this estimate? The job will stay in Jobs; only the link here is cleared.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={closeUnlinkJobConfirm}
                disabled={unlinkingJob}
                style={estSecondaryButton(unlinkingJob)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unlinkingJob}
                onClick={() => {
                  void confirmUnlinkLinkedJob()
                }}
                style={estPrimaryButton(!!unlinkingJob)}
              >
                {unlinkingJob ? 'Unlinking…' : 'Unlink'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CreateJobFromEstimateModal
        open={createJobModalOpen && row != null}
        estimate={row}
        customerIdForPayload={customerId}
        linkedCustomerPrefill={linkedCustomerPrefillForCreateJobModal}
        onClose={() => setCreateJobModalOpen(false)}
        onSuccess={(jobId) => {
          void (async () => {
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