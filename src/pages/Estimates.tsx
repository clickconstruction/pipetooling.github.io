import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../hooks/useAuth'
import type { Tables } from '../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import CustomerSearchCombobox from '../components/customers/CustomerSearchCombobox'
import NewCustomerForm from '../components/NewCustomerForm'
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
  fetchEstimateCatalogEvents,
  loadEditorDisplayByUserId,
  replaceEstimateCatalogFromPayload,
  fetchEstimateCatalogLive,
  type EstimateCatalogItemEventRow,
} from '../lib/estimateCatalogApi'
import CreateJobFromEstimateModal, {
  type LinkedCustomerPrefill,
} from '../components/estimates/CreateJobFromEstimateModal'
import { CustomerSnapshotModal } from '../components/customers/CustomerSnapshotModal'
import { AcceptHeaderBrandPicker } from '../components/estimates/AcceptHeaderBrandPicker'
import EstimateCustomerAttachmentCard from '../components/estimates/EstimateCustomerAttachmentCard'
import EstimateCustomerDocument, {
  estimatePublicLineItems,
  EstimateLineItemsTable,
} from '../components/estimates/EstimateCustomerDocument'
import EstimateCustomerAcceptLinkButtons from '../components/estimates/EstimateCustomerAcceptLinkButtons'
import IpAddressMapButton from '../components/estimates/IpAddressMapButton'
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
import { buildEstimateEmailHtml } from '../lib/estimateEmailHtmlPreview'
import {
  formatEstimateListUpdatedLines,
  formatEstimateUpdatedRelativeCompact,
} from '../lib/formatEstimateListUpdated'
import { formatNotificationDatetime } from '../utils/formatNotificationDatetime'
import { checkGoogleDriveAttachmentUrl } from '../lib/checkGoogleDriveAttachmentUrl'
import {
  normalizeCustomerAttachmentDraftForDb,
  normalizeCustomerAttachmentUrl,
  parseCustomerAttachmentSent,
  type CustomerAttachmentPayload,
} from '../lib/estimateCustomerAttachment'
import { pageUnderlineTabStyle } from '../lib/pageUnderlineTabStyle'
import { JobThreadNotesPanel, type JobThreadNoteRow } from '../components/JobThreadNotesPanel'
import { getDispatchNoteDisplayMeta } from '../utils/dispatchNoteDisplay'
import { useEstimateThreadNotes, type EstimateThreadNoteStats } from '../hooks/useEstimateThreadNotes'
import {
  computeEstimateLineExtendedCents,
  normalizeEstimateLineItemsFromJson,
  sumNormalizedLineItems,
  type EstimateLineItemNormalized,
} from '../lib/estimateLineItemNormalize'

const ESTIMATE_CATALOG_EDITOR_ROLES = new Set<UserRole>([
  'dev',
  'master_technician',
  'assistant',
  'estimator',
  'primary',
  'superintendent',
])

const SEND_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ESTIMATE_EMAIL_FROM_LABEL = 'PipeTooling <team@noreply.pipetooling.com>'

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
  status: 'sent' | 'customer_accepted'
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
          color: '#111827',
        }}
      >
        Customer activity
      </summary>
      {loading ? (
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>Loading…</p>
      ) : events.length === 0 ? (
        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>
          No link views or acceptance events recorded yet.
        </p>
      ) : (
        <ul
          style={{
            margin: '0.5rem 0 0',
            paddingLeft: '1.25rem',
            fontSize: '0.9rem',
            color: '#374151',
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
            return (
              <li key={ev.id} style={{ marginBottom: '0.35rem' }}>
                {estimateCustomerEventLabel(ev.event_type)}
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
      'Templates may include {{accept_url}}, {{title}}, and {{estimate_number}}. Leave blank to use organization defaults (dev: Settings → Estimate customer experience defaults).',
    keys: ['email_subject_template', 'email_body_template'],
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

type EstimateRow = Tables<'estimates'>
type EstimateListRow = Tables<'estimates'> & {
  customers: Pick<CustomerRow, 'name' | 'address' | 'contact_info'> | null
  jobs_ledger?: { hcp_number: string } | null
}

/** Detail load embeds linked job HCP when `job_ledger_id` is set. */
type EstimateDetailRow = Tables<'estimates'> & {
  jobs_ledger?: { hcp_number: string } | null
}

const ESTIMATE_JOB_SECTION_HASH = 'estimate-job'

/** Slim outline button for “Create job” in Estimates list Status column. */
const estimateListCreateJobButtonStyle: CSSProperties = {
  padding: '0.22rem 0.55rem',
  fontSize: '0.75rem',
  lineHeight: 1.2,
  fontWeight: 600,
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#f9fafb',
  color: '#111827',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

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

const estimatesFocusVisibleCss = `
  .${ESTIMATES_PAGE_CLASS} input:not([type="radio"]):not([type="checkbox"]):focus-visible,
  .${ESTIMATES_PAGE_CLASS} textarea:focus-visible,
  .${ESTIMATES_PAGE_CLASS} button:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
`

const ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS = 'estimate-customer-snapshot-cell-btn'

const estimatesListCustomerSnapshotBtnCss = `
  .${ESTIMATES_PAGE_CLASS} .${ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS}:hover {
    background: #f3f4f6;
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

const estimateDetailPageCss = `${estimatesFocusVisibleCss}\n${estimateCustomerSearchHighlightCss}`

const estInputBase: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: '0.875rem',
  boxSizing: 'border-box',
}

function estInputBlock(extra?: CSSProperties): CSSProperties {
  return {
    ...estInputBase,
    display: 'block',
    width: '100%',
    maxWidth: 480,
    marginTop: '0.25rem',
    padding: '0.5rem',
    ...extra,
  }
}

function estPrimaryButton(disabled: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: disabled ? '#9ca3af' : '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
  }
}

function estSecondaryButton(disabled?: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    color: '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
    opacity: disabled ? 0.65 : 1,
  }
}

function estSendButton(disabled: boolean): CSSProperties {
  return {
    ...estPrimaryButton(disabled),
    background: disabled ? '#9ca3af' : '#ea580c',
  }
}

function estDangerOutlineButton(disabled?: boolean): CSSProperties {
  return {
    padding: '0.5rem 1rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 4,
    color: '#b91c1c',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 500,
    fontSize: '0.875rem',
    opacity: disabled ? 0.65 : 1,
  }
}

function estSmallSecondaryButton(): CSSProperties {
  return {
    padding: '0.35rem 0.65rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: '1px solid #d1d5db',
    borderRadius: 4,
    background: '#f3f4f6',
    color: '#374151',
    cursor: 'pointer',
  }
}

function estSmallPrimaryButton(disabled: boolean): CSSProperties {
  return {
    padding: '0.35rem 0.65rem',
    fontSize: '0.8125rem',
    fontWeight: 500,
    border: 'none',
    borderRadius: 4,
    background: disabled ? '#9ca3af' : '#3b82f6',
    color: 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function estimateLinkedJobHcp(r: { jobs_ledger?: { hcp_number: string } | null }): string | null {
  const t = (r.jobs_ledger?.hcp_number ?? '').trim()
  return t || null
}
type LineItem = EstimateLineItemNormalized

const DEFAULT_DRAFT_FIRST_LINE_ITEM = 'Custom Service Visit'

/** New stub: default line item + empty description. Legacy stub: empty line item + default in description. */
function isDefaultDraftStubShape(line_item: string, description: string, amount_cents: number): boolean {
  if (amount_cents !== 0) return false
  const def = DEFAULT_DRAFT_FIRST_LINE_ITEM.toLowerCase()
  const li = line_item.trim().toLowerCase()
  const desc = description.trim().toLowerCase()
  if (li === def && desc === '') return true
  if (line_item.trim() === '' && desc === def) return true
  return false
}

function defaultDraftFirstLine(): LineItem {
  const quantity = 1
  const unit_price_cents = 0
  return {
    line_item: DEFAULT_DRAFT_FIRST_LINE_ITEM,
    description: '',
    quantity,
    unit_price_cents,
    amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents),
  }
}

function emptyDraftLine(): LineItem {
  const quantity = 1
  const unit_price_cents = 0
  return {
    line_item: '',
    description: '',
    quantity,
    unit_price_cents,
    amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents),
  }
}

function emptyCatalogEditRow(): EstimateCatalogLineItem {
  const quantity = 1
  const unit_price_cents = 0
  return {
    id: '',
    line_item: '',
    description: '',
    quantity,
    unit_price_cents,
    amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents),
  }
}

function lineItemsFromJson(raw: unknown): LineItem[] {
  return normalizeEstimateLineItemsFromJson(raw)
}

function sumLineItems(lines: LineItem[]): number {
  return sumNormalizedLineItems(lines)
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function statusLabel(s: EstimateRow['status']): string {
  switch (s) {
    case 'draft':
      return 'Draft'
    case 'sent':
      return 'Sent'
    case 'customer_accepted':
      return 'Accepted'
    case 'declined':
      return 'Declined'
    case 'superseded':
      return 'Superseded'
    default:
      return String(s)
  }
}

async function resolveMasterUserId(
  userId: string,
  role: UserRole | null,
): Promise<string | null> {
  if (role === 'dev' || role === 'master_technician') return userId
  if (role === 'assistant') {
    const { data } = await supabase
      .from('master_assistants')
      .select('master_id')
      .eq('assistant_id', userId)
      .limit(1)
      .maybeSingle()
    const mid = (data as { master_id: string } | null)?.master_id
    return mid ?? userId
  }
  return userId
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

function defaultEstimateTitle(customerName: string): string {
  const n = customerName.trim()
  if (!n) return 'Estimate for customer'
  return `Estimate for ${n}`
}

function isGenericEstimateTitle(t: string): boolean {
  const s = t.trim()
  return s === '' || s === 'New estimate' || s === 'Estimate'
}

function estimateListCustomerSubline(r: EstimateListRow): string {
  const cust = r.customers
  if (cust && (cust.name?.trim() || cust.address?.trim())) {
    return getCustomerDisplay({
      name: cust.name ?? '',
      address: cust.address ?? '',
    })
  }
  const email = r.customer_email?.trim()
  if (email) return email
  const addr = r.for_address?.trim()
  if (addr) return addr
  return '—'
}

/** For Stages tab Customer column: name on first line, address on second (when both exist). */
function estimateListCustomerColumnLines(r: EstimateListRow): { primary: string; secondary: string | null } {
  const cust = r.customers
  if (cust) {
    const name = (cust.name ?? '').trim()
    const address = (cust.address ?? '').trim()
    if (name && address) return { primary: name, secondary: address }
    if (name) return { primary: name, secondary: null }
    if (address) return { primary: address, secondary: null }
  }
  const email = r.customer_email?.trim()
  if (email) return { primary: email, secondary: null }
  const addr = r.for_address?.trim()
  if (addr) return { primary: addr, secondary: null }
  return { primary: '—', secondary: null }
}

function estimateListRowMatchesSearch(r: EstimateListRow, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if (String(r.estimate_number).toLowerCase().includes(t)) return true
  if ((r.title ?? '').toLowerCase().includes(t)) return true
  if (estimateListCustomerSubline(r).toLowerCase().includes(t)) return true
  if (statusLabel(r.status).toLowerCase().includes(t)) return true
  if (String(r.status).toLowerCase().includes(t)) return true
  if (formatMoney(r.total_cents).toLowerCase().includes(t)) return true
  return false
}

function sortEstimatesByUpdatedDesc(list: EstimateListRow[]): EstimateListRow[] {
  return [...list].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
}

/** Stages tab: draft → Unsent; sent + declined → Sent; customer_accepted → Accepted; superseded omitted. */
function splitFollowupRows(source: EstimateListRow[]): {
  unsent: EstimateListRow[]
  sent: EstimateListRow[]
  accepted: EstimateListRow[]
} {
  const unsent: EstimateListRow[] = []
  const sent: EstimateListRow[] = []
  const accepted: EstimateListRow[] = []
  for (const r of source) {
    switch (r.status) {
      case 'draft':
        unsent.push(r)
        break
      case 'sent':
      case 'declined':
        sent.push(r)
        break
      case 'customer_accepted':
        accepted.push(r)
        break
      case 'superseded':
        break
      default:
        break
    }
  }
  return {
    unsent: sortEstimatesByUpdatedDesc(unsent),
    sent: sortEstimatesByUpdatedDesc(sent),
    accepted: sortEstimatesByUpdatedDesc(accepted),
  }
}

type EstimateListStagesThread = {
  estimateThreadStatsByEstimateId: Record<string, EstimateThreadNoteStats>
  estimateThreadNotesByEstimateId: Record<string, JobThreadNoteRow[]>
  estimateThreadNotesLoadingId: string | null
  expandedEstimateThreadId: string | null
  toggleEstimateThreadExpanded: (estimateId: string) => void
  estimateThreadDraft: string
  setEstimateThreadDraft: (v: string) => void
  estimateThreadSubmittingId: string | null
  submitEstimateThreadNote: (estimateId: string) => void
  canPostNotes: boolean
}

type EstimateListTableProps = {
  rows: EstimateListRow[]
  setAcceptanceModalEstimateId: (id: string | null) => void
  setCreateJobFromListRow: (row: EstimateListRow | null) => void
  /** When true (Stages Unsent/Sent), show Customer as its own column; Title omits the grey subline. */
  showCustomerColumn?: boolean
  /** When set with a linked `customer_id`, Customer column opens CustomerSnapshotModal. */
  onCustomerSnapshotRequest?: (customerId: string) => void
  /** Estimates Stages: Last activity column + expandable thread notes. */
  stagesThread?: EstimateListStagesThread
}

const estimateListCustomerCellStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#6b7280',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

const estimateListCustomerColumnNameStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#111827',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

const estimateListCustomerSnapshotButtonStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  font: 'inherit',
  borderRadius: 4,
}

function EstimateListTable({
  rows,
  setAcceptanceModalEstimateId,
  setCreateJobFromListRow,
  showCustomerColumn = false,
  onCustomerSnapshotRequest,
  stagesThread,
}: EstimateListTableProps) {
  const { role: estimateListViewerRole } = useAuth()
  const showStagesActivity = stagesThread != null
  const threadColSpan = 6 + (showCustomerColumn ? 1 : 0)

  const tdShellStyle: CSSProperties = {
    padding: '0.5rem',
    verticalAlign: 'top',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '0.35rem',
  }

  function renderExpandButton(estimateId: string) {
    if (!stagesThread) return null
    const expanded = stagesThread.expandedEstimateThreadId === estimateId
    const stat = stagesThread.estimateThreadStatsByEstimateId[estimateId]
    const count = stat?.note_count ?? 0
    return (
      <button
        type="button"
        onClick={() => stagesThread.toggleEstimateThreadExpanded(estimateId)}
        aria-expanded={expanded}
        title={count > 0 ? `${count} thread note(s)` : 'Estimate notes thread'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '0.25rem',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#374151',
          fontSize: '0.75rem',
          lineHeight: 1.1,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        <span aria-hidden>{expanded ? '\u25BC' : '\u25B6'}</span>
        {count > 0 ? (
          <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>{count}</span>
        ) : null}
      </button>
    )
  }

  function lastActivityBodyInteractiveProps(
    st: EstimateListStagesThread,
    estimateId: string,
    title: string,
    expanded: boolean,
  ): {
    role: 'button'
    tabIndex: number
    title: string
    'aria-expanded': boolean
    onClick: () => void
    onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void
    style: CSSProperties
  } {
    return {
      role: 'button',
      tabIndex: 0,
      title,
      'aria-expanded': expanded,
      onClick: () => st.toggleEstimateThreadExpanded(estimateId),
      onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          st.toggleEstimateThreadExpanded(estimateId)
        }
      },
      style: {
        flex: 1,
        minWidth: 0,
        cursor: 'pointer',
      },
    }
  }

  function renderLastActivityCell(r: EstimateListRow) {
    if (!stagesThread) return null
    const st = stagesThread
    const estimateId = r.id
    const stat = st.estimateThreadStatsByEstimateId[estimateId]
    const count = stat?.note_count ?? 0
    const notes = st.estimateThreadNotesByEstimateId[estimateId]
    const lastNote = notes?.length ? notes[notes.length - 1] : undefined
    const fromThreadBody = (lastNote?.body ?? '').trim()
    const titleForEmpty = 'Estimate notes thread'
    const titleWithNotes = count > 0 ? `${count} thread note(s)` : titleForEmpty
    const expanded = st.expandedEstimateThreadId === estimateId

    if (count === 0 || !stat?.last_note_at) {
      return (
        <td style={tdShellStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 2,
              flexShrink: 0,
            }}
          >
            {renderExpandButton(estimateId)}
          </div>
          <div {...lastActivityBodyInteractiveProps(st, estimateId, titleForEmpty, expanded)}>
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>—</span>
          </div>
        </td>
      )
    }
    const meta = getDispatchNoteDisplayMeta(stat.last_note_at)
    const author = stat.last_note_author_name?.trim() || lastNote?.author?.name?.trim() || ''
    const body = (stat.last_note_body ?? '').trim() || fromThreadBody
    return (
      <td style={{ ...tdShellStyle, maxWidth: 280 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {renderExpandButton(estimateId)}
        </div>
        <div {...lastActivityBodyInteractiveProps(st, estimateId, titleWithNotes, expanded)}>
          <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginBottom: '0.2rem' }}>
            {author ? <span>{author}</span> : null}
            {author ? <span style={{ margin: '0 0.35rem' }}>·</span> : null}
            <span>{meta.weekdayTimeChicago}</span>
            <span style={{ marginLeft: '0.35rem' }}>({meta.daysAgoLabel})</span>
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              color: '#374151',
              lineHeight: 1.35,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              maxHeight: '4.2em',
              overflow: 'hidden',
            }}
          >
            {body || '—'}
          </div>
        </div>
      </td>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
          <th style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>#</th>
          <th style={{ padding: '0.5rem', lineHeight: 1.3 }}>
            <div>Title</div>
            {showCustomerColumn ? null : (
              <div style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280' }}>Customer</div>
            )}
          </th>
          {showCustomerColumn ? (
            <th style={{ padding: '0.5rem' }}>Customer</th>
          ) : null}
          <th style={{ padding: '0.5rem' }}>Status</th>
          <th style={{ padding: '0.5rem' }}>Total</th>
          <th style={{ padding: '0.5rem' }}>Updated</th>
          {showStagesActivity ? (
            <th style={{ padding: '0.5rem', minWidth: 200 }}>Last activity</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const updatedLines = formatEstimateListUpdatedLines(r.updated_at)
          const mainRow = (
            <>
              <td style={{ padding: '0.5rem', fontVariantNumeric: 'tabular-nums' }}>{r.estimate_number}</td>
              <td style={{ padding: '0.5rem', minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                    minWidth: 0,
                  }}
                >
                  <Link to={`/estimates/${r.estimate_number}`}>{r.title || '—'}</Link>
                  {showCustomerColumn ? null : (
                    <span style={estimateListCustomerCellStyle}>{estimateListCustomerSubline(r)}</span>
                  )}
                </div>
              </td>
              {showCustomerColumn ? (
                <td style={{ padding: '0.5rem', minWidth: 0 }}>
                  {(() => {
                    const { primary, secondary } = estimateListCustomerColumnLines(r)
                    const cust = r.customers
                    const hasCustomerName = cust != null && (cust.name ?? '').trim() !== ''
                    const primaryIsName = hasCustomerName && (secondary != null || (cust.address ?? '').trim() === '')
                    const cid = r.customer_id
                    const inner = (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.15rem',
                          minWidth: 0,
                        }}
                      >
                        <span style={primaryIsName ? estimateListCustomerColumnNameStyle : estimateListCustomerCellStyle}>
                          {primary}
                        </span>
                        {secondary ? <span style={estimateListCustomerCellStyle}>{secondary}</span> : null}
                      </div>
                    )
                    if (cid && onCustomerSnapshotRequest) {
                      const labelName = (cust?.name ?? primary).trim() || 'customer'
                      return (
                        <button
                          type="button"
                          className={ESTIMATE_LIST_CUSTOMER_SNAPSHOT_BTN_CLASS}
                          onClick={() => onCustomerSnapshotRequest(cid)}
                          style={estimateListCustomerSnapshotButtonStyle}
                          aria-label={`View customer details for ${labelName}`}
                        >
                          {inner}
                        </button>
                      )
                    }
                    return inner
                  })()}
                </td>
              ) : null}
              <td style={{ padding: '0.5rem' }}>
                {r.status === 'customer_accepted' ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.35rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setAcceptanceModalEstimateId(r.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: '#1d4ed8',
                        textDecoration: 'underline',
                        font: 'inherit',
                        textAlign: 'left',
                      }}
                      aria-label={`View acceptance record for estimate ${r.estimate_number}`}
                    >
                      Accepted — view
                    </button>
                    {r.job_ledger_id ? (
                      <Link
                        to={`/jobs?edit=${r.job_ledger_id}`}
                        style={{ fontSize: '0.85rem', fontWeight: 500, color: '#15803d' }}
                      >
                        {(() => {
                          const hcp = estimateLinkedJobHcp(r)
                          return hcp ? `Job #${hcp}` : 'Job linked'
                        })()}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCreateJobFromListRow(r)}
                        style={estimateListCreateJobButtonStyle}
                        title="Create a linked job from this estimate"
                        aria-label="Create job from estimate"
                      >
                        Create job
                      </button>
                    )}
                  </div>
                ) : (
                  statusLabel(r.status)
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{formatMoney(r.total_cents)}</td>
              <td style={{ padding: '0.5rem', color: '#6b7280' }}>
                {updatedLines ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      lineHeight: 1.25,
                    }}
                  >
                    <span>{updatedLines.short}</span>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{updatedLines.relative}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              {showStagesActivity ? renderLastActivityCell(r) : null}
            </>
          )

          if (!showStagesActivity) {
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {mainRow}
              </tr>
            )
          }

          const st = stagesThread
          const expanded = st.expandedEstimateThreadId === r.id
          return (
            <Fragment key={r.id}>
              <tr style={{ borderBottom: '1px solid #f3f4f6' }}>{mainRow}</tr>
              {expanded ? (
                <tr>
                  <td
                    colSpan={threadColSpan}
                    style={{
                      padding: '0.5rem 0.75rem',
                      background: '#f9fafb',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <JobThreadNotesPanel
                      sectionTitle="Estimate activity / notes"
                      showComposerLabel={false}
                      notes={st.estimateThreadNotesByEstimateId[r.id] ?? []}
                      loading={st.estimateThreadNotesLoadingId === r.id}
                      canPost={st.canPostNotes}
                      draft={st.estimateThreadDraft}
                      onDraftChange={st.setEstimateThreadDraft}
                      onSubmit={() => void st.submitEstimateThreadNote(r.id)}
                      submitting={st.estimateThreadSubmittingId === r.id}
                      viewerRole={estimateListViewerRole}
                    />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

type EstimateListTab = 'all' | 'followup'

function EstimateList() {
  const { user, role, profileName } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  /** `load()` only filters by this URL param; matches Jobs `?customer=`. */
  const customerParamForEstimatesReload = searchParams.get('customer')
  const [listTab, setListTab] = useState<EstimateListTab>('followup')
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

  async function createDraft() {
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
              line_items_snapshot: [defaultDraftFirstLine()],
              terms_snapshot: '',
              total_cents: 0,
            })
            .select('id, estimate_number')
            .single(),
        'create estimate',
      )
      const ins = inserted as { id: string; estimate_number: number } | null
      if (ins?.estimate_number != null) navigate(`/estimates/${ins.estimate_number}`)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create estimate'), 'error')
    } finally {
      setCreating(false)
    }
  }

  if (!user) return null

  const estimatesListEmptyLabel = customerParamForEstimatesReload?.trim()
    ? 'No estimates for this customer.'
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
    <div className={ESTIMATES_PAGE_CLASS} style={{ padding: '1rem', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`${estimatesFocusVisibleCss}${estimatesListCustomerSnapshotBtnCss}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Estimates</h1>
        <button type="button" onClick={() => void createDraft()} disabled={creating} style={estPrimaryButton(creating)}>
          {creating ? 'Creating…' : 'New estimate'}
        </button>
      </div>
      <div
        role="tablist"
        aria-label="Estimates views"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem',
          marginTop: '0.75rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={listTab === 'followup'}
          id="estimates-tab-stages"
          onClick={() => setListTab('followup')}
          style={pageUnderlineTabStyle(listTab === 'followup')}
        >
          Stages
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={listTab === 'all'}
          id="estimates-tab-ledger"
          onClick={() => setListTab('all')}
          style={pageUnderlineTabStyle(listTab === 'all')}
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
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            fontSize: '0.875rem',
          }}
        >
          <span style={{ color: '#1e40af' }}>Filtered by customer</span>
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
              background: 'white',
              border: '1px solid #93c5fd',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#1e40af',
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
          {loading ? (
            <p>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>{estimatesListEmptyLabel}</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>No estimates match your search.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <EstimateListTable
                rows={filteredRows}
                setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                setCreateJobFromListRow={setCreateJobFromListRow}
                showCustomerColumn
                onCustomerSnapshotRequest={setCustomerSnapshotId}
              />
            </div>
          )}
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
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>{estimatesListEmptyLabel}</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>No estimates match your search.</p>
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
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Unsent</h2>
                {followupBuckets.unsent.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>No estimates</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <EstimateListTable
                      rows={followupBuckets.unsent}
                      setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                      setCreateJobFromListRow={setCreateJobFromListRow}
                      showCustomerColumn
                      onCustomerSnapshotRequest={setCustomerSnapshotId}
                      stagesThread={estimatesStagesThread}
                    />
                  </div>
                )}
              </section>
              <section>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Sent</h2>
                {followupBuckets.sent.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>No estimates</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <EstimateListTable
                      rows={followupBuckets.sent}
                      setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                      setCreateJobFromListRow={setCreateJobFromListRow}
                      showCustomerColumn
                      onCustomerSnapshotRequest={setCustomerSnapshotId}
                      stagesThread={estimatesStagesThread}
                    />
                  </div>
                )}
              </section>
              <section>
                <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', fontWeight: 600 }}>Accepted</h2>
                {followupBuckets.accepted.length === 0 ? (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>No estimates</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <EstimateListTable
                      rows={followupBuckets.accepted}
                      setAcceptanceModalEstimateId={setAcceptanceModalEstimateId}
                      setCreateJobFromListRow={setCreateJobFromListRow}
                      showCustomerColumn
                      onCustomerSnapshotRequest={setCustomerSnapshotId}
                      stagesThread={estimatesStagesThread}
                    />
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
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const editCustomerModal = useEditCustomerModal()
  const navigate = useNavigate()
  const location = useLocation()
  const [row, setRow] = useState<EstimateDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [terms, setTerms] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
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
  const [unlinkingJob, setUnlinkingJob] = useState(false)
  const [unlinkJobConfirmOpen, setUnlinkJobConfirmOpen] = useState(false)
  const [customerPreviewTab, setCustomerPreviewTab] = useState<'email' | 'page' | 'thankyou'>('email')
  const [lastAcceptUrl, setLastAcceptUrl] = useState<string | null>(null)
  const [appCxSettings, setAppCxSettings] = useState<{ key: string; value_text: string | null }[]>([])
  const [catalogLineItems, setCatalogLineItems] = useState<EstimateCatalogLineItem[]>([])
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)
  const [catalogModalTab, setCatalogModalTab] = useState<'pick' | 'edit'>('pick')
  const [catalogEditRows, setCatalogEditRows] = useState<EstimateCatalogLineItem[]>([])
  const [catalogSaveBusy, setCatalogSaveBusy] = useState(false)
  const [catalogEventsByItemId, setCatalogEventsByItemId] = useState<Record<string, EstimateCatalogItemEventRow[]>>({})
  const [catalogHistoryOpenId, setCatalogHistoryOpenId] = useState<string | null>(null)
  const [catalogHistoryLoadingId, setCatalogHistoryLoadingId] = useState<string | null>(null)
  const [catalogEditorNames, setCatalogEditorNames] = useState<Map<string, string>>(() => new Map())
  const [catalogFilter, setCatalogFilter] = useState('')
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
    setDetailCustomerSnapshotId(null)
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

  useEffect(() => {
    if (!catalogModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCatalogModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [catalogModalOpen])

  const loadEstimateCustomerEvents = useCallback(async () => {
    const id = row?.id
    const st = row?.status
    if (!id || (st !== 'sent' && st !== 'customer_accepted')) {
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
    if (catalogModalOpen) setCatalogFilter('')
    else setCatalogHistoryOpenId(null)
  }, [catalogModalOpen])

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

      setRow(r)
      setAcceptHeaderBrand(parseAcceptHeaderBrand(r.accept_header_brand))
      setTerms(r.terms_snapshot ?? '')
      const parsedLines = lineItemsFromJson(r.line_items_snapshot)
      setLines(
        r.status === 'draft' && parsedLines.length === 0 ? [defaultDraftFirstLine()] : parsedLines,
      )
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
      setInternalNotes(r.internal_notes ?? '')
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
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
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
          if (matchCust?.name?.trim()) initialTitle = defaultEstimateTitle(matchCust.name)
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
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
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
  const customerAttachmentUrlIsCheckable = Boolean(normalizeCustomerAttachmentUrl(customerAttachmentUrl))
  const totalCents = sumLineItems(lines)
  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : undefined

  const linkedCustomerPrefillForCreateJobModal = useMemo((): LinkedCustomerPrefill | null => {
    if (!customerId) return null
    const c = customers.find((x) => x.id === customerId)
    if (!c) return null
    return { name: c.name ?? '', address: c.address ?? '' }
  }, [customerId, customers])
  const crmEmailForSelected = selectedCustomer ? extractContactFromCustomer(selectedCustomer).email.trim() : ''
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
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [customerAcceptUrl])

  const staffResolvedExperience = useMemo((): EstimateCustomerExperienceResolved | null => {
    if (!row) return null
    const snap = parseEstimateCustomerExperienceSnapshot(row.customer_experience_sent)
    if (snap) return snap
    return resolveEstimateCustomerExperience(appCxSettings, cxOverrideFields, {
      acceptUrl: acceptUrlForTemplatePreview,
      title: previewEmailTitle.trim() || '',
      estimateNumber: row.estimate_number,
    })
  }, [
    row,
    appCxSettings,
    cxOverrideFields,
    acceptUrlForTemplatePreview,
    previewEmailTitle,
  ])

  const customerEmailPreviewHtml = useMemo(() => {
    if (!staffResolvedExperience) return ''
    const body = staffResolvedExperience.emailBody
    const brand = acceptanceDocHeaderBrand
    if (!brand) return buildEstimateEmailHtml(body)
    const rel = acceptHeaderBrandImageSrc(brand)
    const imageUrl =
      typeof window !== 'undefined' ? new URL(rel, window.location.origin).href : rel
    return buildEstimateEmailHtml(body, {
      imageUrl,
      imageAlt: acceptHeaderBrandLabel(brand),
    })
  }, [staffResolvedExperience, acceptanceDocHeaderBrand])

  const cxTemplateDefaults = useMemo(
    () => mergeEstimateExperienceStrings(appCxSettings, {}),
    [appCxSettings],
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
          background: '#fafafa',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
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
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.35rem 0 0' }}>
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
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.75rem', marginBottom: 0 }}>
          Blank fields show organization defaults (built-in if unset in Settings). Only changes you make are saved as
          overrides.
        </p>
        {section.description ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0' }}>{section.description}</p>
        ) : null}
        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.75rem', marginBottom: 0 }}>
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
      (prevName.length > 0 && title.trim() === defaultEstimateTitle(prevName))
    if (shouldSetTitle) setTitle(defaultEstimateTitle(c.name ?? ''))
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

  async function saveDraft(options?: { quiet?: boolean }): Promise<boolean> {
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
            .update({
              title: title.trim() || 'Estimate',
              terms_snapshot: terms,
              line_items_snapshot: lines,
              total_cents: totalCents,
              valid_until: validUntil.trim() ? validUntil.trim() : null,
              for_address: forAddress.trim() ? forAddress.trim() : null,
              internal_notes: internalNotes.trim() ? internalNotes.trim() : null,
              customer_id: customerId,
              customer_email: resolveCustomerEmailForPersist(),
              customer_experience_overrides: buildCustomerExperienceOverridesPayload(),
              accept_header_brand: acceptHeaderBrand,
              customer_attachment_url: attDb.url,
              customer_attachment_label: attDb.label,
            })
            .eq('id', row.id)
            .eq('status', 'draft'),
        'save estimate',
      )
      if (!quiet) showToast('Saved', 'success')
      await load()
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

  async function sendToCustomer() {
    if (!row || row.status !== 'draft' || sending || !user) return
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
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
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

  async function deleteDraft() {
    if (!row || !isDraft) return
    if (!window.confirm('Delete this draft?')) return
    try {
      await withSupabaseRetry(
        async () => await supabase.from('estimates').delete().eq('id', row.id).eq('status', 'draft'),
        'delete estimate',
      )
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
      const line_item = patch.line_item !== undefined ? patch.line_item : cur.line_item
      const description = patch.description !== undefined ? patch.description : cur.description
      let quantity = patch.quantity !== undefined ? patch.quantity : cur.quantity
      if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
      const unit_price_cents =
        patch.unit_price_cents !== undefined ? patch.unit_price_cents : cur.unit_price_cents
      const amount_cents = computeEstimateLineExtendedCents(quantity, unit_price_cents)
      next[i] = { line_item, description, quantity, unit_price_cents, amount_cents }
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

  const catalogFiltered = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase()
    if (!q) return catalogLineItems
    return catalogLineItems.filter((c) => {
      if (c.line_item.toLowerCase().includes(q)) return true
      if (c.description.toLowerCase().includes(q)) return true
      if (String(c.quantity).includes(q)) return true
      if (String(c.unit_price_cents).includes(q)) return true
      if (String(c.amount_cents).includes(q)) return true
      return formatMoney(c.unit_price_cents).toLowerCase().includes(q)
        || formatMoney(c.amount_cents).toLowerCase().includes(q)
    })
  }, [catalogLineItems, catalogFilter])

  function catalogEntryToLineItem(entry: EstimateCatalogLineItem): LineItem {
    const quantity = Number(entry.quantity) > 0 ? Number(entry.quantity) : 1
    const unit_price_cents = Math.max(0, Math.round(entry.unit_price_cents))
    return {
      line_item: entry.line_item,
      description: entry.description,
      quantity,
      unit_price_cents,
      amount_cents: computeEstimateLineExtendedCents(quantity, unit_price_cents),
    }
  }

  function isBlankDraftLine(l: LineItem): boolean {
    return l.line_item.trim() === '' && l.description.trim() === '' && l.amount_cents === 0
  }

  /** Last row is empty or the default first-line placeholder (replace when inserting from catalog). */
  function isReplaceableStubLine(l: LineItem): boolean {
    if (isBlankDraftLine(l)) return true
    return isDefaultDraftStubShape(l.line_item, l.description, l.amount_cents)
  }

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
    setCatalogFilter('')
  }

  async function loadHistoryForCatalogItem(itemId: string) {
    setCatalogHistoryLoadingId(itemId)
    try {
      const evs = await fetchEstimateCatalogEvents(supabase, itemId)
      const names = await loadEditorDisplayByUserId(
        supabase,
        evs.map((e) => e.editor_user_id),
      )
      setCatalogEditorNames((prev) => new Map([...prev, ...names]))
      setCatalogEventsByItemId((prev) => ({ ...prev, [itemId]: evs }))
    } catch {
      showToast('Could not load history', 'error')
    } finally {
      setCatalogHistoryLoadingId(null)
    }
  }

  function catalogEventSummary(e: EstimateCatalogItemEventRow): string {
    const fmt = (c: number | null | undefined) => (c == null ? '—' : formatMoney(c))
    const fmtQty = (q: number | null | undefined) => (q == null ? '—' : String(q))
    const lineLbl = (line: string | null | undefined, desc: string | null | undefined) => {
      const a = (line ?? '').trim()
      const b = (desc ?? '').trim()
      if (a && b) return `"${a}" (${b})`
      if (a) return `"${a}"`
      if (b) return `"${b}"`
      return '—'
    }
    switch (e.action) {
      case 'create':
        return `Added: ${lineLbl(e.new_line_item, e.new_description)} · qty ${fmtQty(e.new_quantity)} × ${fmt(e.new_unit_price_cents)} = ${fmt(e.new_amount_cents)}`
      case 'update':
        return `Updated: ${lineLbl(e.prev_line_item, e.prev_description)} qty ${fmtQty(e.prev_quantity)} × ${fmt(e.prev_unit_price_cents)} → ${lineLbl(e.new_line_item, e.new_description)} qty ${fmtQty(e.new_quantity)} × ${fmt(e.new_unit_price_cents)}`
      case 'delete':
        return `Removed: ${lineLbl(e.prev_line_item, e.prev_description)} · qty ${fmtQty(e.prev_quantity)} × ${fmt(e.prev_unit_price_cents)}`
      case 'restore':
        return `Restored: ${lineLbl(e.new_line_item, e.new_description)} · qty ${fmtQty(e.new_quantity)} × ${fmt(e.new_unit_price_cents)} = ${fmt(e.new_amount_cents)}`
      default:
        return String(e.action)
    }
  }

  async function saveCatalogEdits() {
    setCatalogSaveBusy(true)
    try {
      await replaceEstimateCatalogFromPayload(supabase, catalogEditRows)
      showToast('Line item catalog saved', 'success')
      setCatalogEventsByItemId({})
      await loadCatalogFromDb()
      setCatalogModalTab('pick')
    } catch (err) {
      showToast(formatErrorMessage(err, 'Could not save catalog'), 'error')
    } finally {
      setCatalogSaveBusy(false)
    }
  }

  if (loading || !row) {
    return (
      <div className={ESTIMATES_PAGE_CLASS} style={{ padding: '1rem' }}>
        <style>{estimateDetailPageCss}</style>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div className={ESTIMATES_PAGE_CLASS} style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
      <style>{estimateDetailPageCss}</style>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/estimates">← Estimates</Link>
      </div>
      {isDraft && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div
            ref={customerSearchSectionRef}
            className={customerSearchHighlight ? 'estimate-customer-search-highlight' : undefined}
            style={{ width: '100%', maxWidth: 480, textAlign: 'left' }}
          >
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Customer</span>
            <CustomerSearchCombobox
              customers={customers}
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
                  color: '#374151',
                  padding: '0.5rem 0.75rem',
                  background: '#f9fafb',
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
                            color: '#b91c1c',
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
                        color: '#2563eb',
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
                          <span style={{ color: '#6b7280' }}>Loading…</span>
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
                        color: '#2563eb',
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
                    <div style={{ marginTop: '0.75rem' }}>
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
                  color: '#6b7280',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  lineHeight: 1.25,
                }}
              >
                # {row.estimate_number}
              </span>
          ) : (
            <h1 style={{ margin: 0 }}>
              <span style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: 600 }}>
                # {row.estimate_number}
              </span>{' '}
              {title || 'Estimate'}
            </h1>
          )}
        </div>
        <span style={{ fontWeight: 600, color: '#92400e' }}>{statusLabel(row.status)}</span>
      </div>

      {!isDraft && row.status !== 'customer_accepted' ? (
        <>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#374151' }}>
            <strong>For:</strong>{' '}
            {(() => {
              const cust = row.customer_id ? customers.find((c) => c.id === row.customer_id) : undefined
              const crm = cust?.address?.trim() ?? ''
              return row.for_address?.trim() || crm || '—'
            })()}
          </p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem', color: '#374151' }}>
            <strong>Acceptance page logo:</strong>{' '}
            {acceptanceDocHeaderBrand ? acceptHeaderBrandLabel(acceptanceDocHeaderBrand) : 'None'}
          </p>
          <section style={{ marginTop: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
              {staffResolvedExperience?.docLineItemsHeading ?? 'Line items'}
            </h2>
            <div style={{ fontSize: '0.9rem', color: '#374151' }}>
              <EstimateLineItemsTable lines={estimatePublicLineItems(row.line_items_snapshot)} />
            </div>
          </section>
        </>
      ) : null}

      {isDraft && (
        <>
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
                          color: '#2563eb',
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
                      color: '#dc2626',
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
                      border: validUntilPreset === n ? 'none' : '1px solid #d1d5db',
                      background: validUntilPreset === n ? '#ea580c' : '#f3f4f6',
                      color: validUntilPreset === n ? 'white' : '#374151',
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
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Line items</h2>
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
                      border: '1px solid #d1d5db',
                      background: '#f3f4f6',
                      color: '#374151',
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
            {catalogModalOpen ? (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Line item catalog"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1000,
                  background: 'rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem',
                }}
                onClick={() => setCatalogModalOpen(false)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    maxWidth: 560,
                    width: '100%',
                    maxHeight: 'min(85vh, 640px)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 10px 40px rgba(0,0,0,0.12)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Line item catalog</span>
                      {canManageEstimateCatalog ?
                        <>
                          <button
                            type="button"
                            aria-pressed={catalogModalTab === 'pick'}
                            onClick={() => setCatalogModalTab('pick')}
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              borderRadius: 4,
                              border: catalogModalTab === 'pick' ? 'none' : '1px solid #d1d5db',
                              background: catalogModalTab === 'pick' ? '#3b82f6' : '#f3f4f6',
                              color: catalogModalTab === 'pick' ? 'white' : '#374151',
                              cursor: 'pointer',
                            }}
                          >
                            Insert from catalog
                          </button>
                          <button
                            type="button"
                            aria-pressed={catalogModalTab === 'edit'}
                            onClick={() => {
                              setCatalogModalTab('edit')
                              setCatalogEditRows(catalogLineItems.map((r) => ({ ...r })))
                            }}
                            style={{
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              borderRadius: 4,
                              border: catalogModalTab === 'edit' ? 'none' : '1px solid #d1d5db',
                              background: catalogModalTab === 'edit' ? '#3b82f6' : '#f3f4f6',
                              color: catalogModalTab === 'edit' ? 'white' : '#374151',
                              cursor: 'pointer',
                            }}
                          >
                            Edit book
                          </button>
                        </>
                      : null}
                      <button
                        type="button"
                        onClick={() => setCatalogModalOpen(false)}
                        aria-label="Close"
                        style={{
                          ...estSmallSecondaryButton(),
                          marginLeft: 'auto',
                          minWidth: '2rem',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                    {catalogModalTab === 'pick' ? (
                      <input
                        type="search"
                        placeholder="Filter…"
                        value={catalogFilter}
                        onChange={(e) => setCatalogFilter(e.target.value)}
                        style={{
                          ...estInputBase,
                          width: '100%',
                          marginTop: '0.75rem',
                          padding: '0.5rem',
                          boxSizing: 'border-box',
                        }}
                      />
                    ) : null}
                  </div>
                  {catalogModalTab === 'pick' ? (
                    <ul
                      style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: '0.5rem',
                        overflowY: 'auto',
                        flex: 1,
                      }}
                    >
                      {catalogFiltered.length === 0 ? (
                        <li style={{ padding: '1rem', color: '#6b7280' }}>
                          {catalogLineItems.length === 0 ?
                            canManageEstimateCatalog ?
                              'No preset items yet. Use Edit book to add some.'
                            : 'No matching items.'
                          : 'No matching items.'}
                        </li>
                      ) : (
                        catalogFiltered.map((c) => (
                          <li key={c.id} style={{ marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'stretch' }}>
                              <button
                                type="button"
                                onClick={() => applyFromCatalogEntry(c)}
                                style={{
                                  flex: '1 1 auto',
                                  textAlign: 'left',
                                  padding: '0.6rem 0.75rem',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  background: '#fafafa',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                }}
                              >
                                <span style={{ display: 'block', fontWeight: 500 }}>
                                  {c.line_item.trim() || c.description.trim() || '—'}
                                </span>
                                <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums', fontSize: '0.8125rem' }}>
                                  {c.quantity} × {formatMoney(c.unit_price_cents)}
                                  {c.line_item.trim() && c.description.trim() ? ` · ${c.description.trim()}` : ''}
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-expanded={catalogHistoryOpenId === c.id}
                                onClick={() => {
                                  setCatalogHistoryOpenId((prev) => {
                                    const next = prev === c.id ? null : c.id
                                    if (next) void loadHistoryForCatalogItem(next)
                                    return next
                                  })
                                }}
                                style={{
                                  flexShrink: 0,
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.75rem',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 6,
                                  background: '#fff',
                                  cursor: 'pointer',
                                  alignSelf: 'stretch',
                                }}
                              >
                                {catalogHistoryOpenId === c.id ? '▼' : '▶'} History
                              </button>
                            </div>
                            {catalogHistoryOpenId === c.id ?
                              <div
                                style={{
                                  marginTop: '0.35rem',
                                  marginLeft: '0.25rem',
                                  padding: '0.5rem 0.65rem',
                                  background: '#f9fafb',
                                  borderRadius: 6,
                                  fontSize: '0.8rem',
                                  color: '#374151',
                                }}
                              >
                                {catalogHistoryLoadingId === c.id ?
                                  <span style={{ color: '#6b7280' }}>Loading…</span>
                                : (catalogEventsByItemId[c.id] ?? []).length === 0 ?
                                  <span style={{ color: '#6b7280' }}>No history yet.</span>
                                : (
                                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {(catalogEventsByItemId[c.id] ?? []).map((ev) => (
                                      <li
                                        key={ev.id}
                                        style={{
                                          padding: '0.35rem 0',
                                          borderBottom: '1px solid #e5e7eb',
                                        }}
                                      >
                                        <div style={{ fontWeight: 500 }}>
                                          {catalogEditorNames.get(ev.editor_user_id) ?? ev.editor_user_id}
                                        </div>
                                        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                                          {new Date(ev.edited_at).toLocaleString()}
                                        </div>
                                        <div style={{ marginTop: '0.2rem' }}>{catalogEventSummary(ev)}</div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            : null}
                          </li>
                        ))
                      )}
                    </ul>
                  ) : (
                    <div style={{ padding: '0.5rem 1rem 1rem', overflowY: 'auto', flex: 1 }}>
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
                        Changes apply for everyone. History is kept per line item.
                      </p>
                      {catalogEditRows.map((r, idx) => (
                        <div
                          key={r.id && r.id.trim() !== '' ? r.id : `new-row-${idx}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              alignItems: 'center',
                            }}
                          >
                            <input
                              value={r.line_item}
                              onChange={(e) => {
                                const v = e.target.value
                                setCatalogEditRows((prev) => {
                                  const next = [...prev]
                                  const cur = next[idx]
                                  if (!cur) return prev
                                  next[idx] = { ...cur, line_item: v }
                                  return next
                                })
                              }}
                              placeholder="Line item"
                              style={{
                                ...estInputBase,
                                flex: '1 1 120px',
                                padding: '0.5rem',
                                minWidth: 0,
                              }}
                            />
                            <input
                              className="no-spinner"
                              type="number"
                              min={0}
                              step="any"
                              value={r.quantity}
                              onChange={(e) => {
                                let q = Number(e.target.value)
                                if (!Number.isFinite(q) || q <= 0) q = 1
                                setCatalogEditRows((prev) => {
                                  const next = [...prev]
                                  const cur = next[idx]
                                  if (!cur) return prev
                                  const amount_cents = computeEstimateLineExtendedCents(q, cur.unit_price_cents)
                                  next[idx] = { ...cur, quantity: q, amount_cents }
                                  return next
                              })
                              }}
                              placeholder="Count"
                              title="Count"
                              style={{ ...estInputBase, width: 72, padding: '0.5rem' }}
                            />
                            <input
                              className="no-spinner"
                              type="number"
                              min={0}
                              step="0.01"
                              value={r.unit_price_cents ? r.unit_price_cents / 100 : ''}
                              onChange={(e) => {
                                const unit = Math.max(0, Math.round(Number(e.target.value || '0') * 100))
                                setCatalogEditRows((prev) => {
                                  const next = [...prev]
                                  const cur = next[idx]
                                  if (!cur) return prev
                                  const amount_cents = computeEstimateLineExtendedCents(cur.quantity, unit)
                                  next[idx] = { ...cur, unit_price_cents: unit, amount_cents }
                                  return next
                                })
                              }}
                              placeholder="Unit ($)"
                              style={{ ...estInputBase, width: 100, padding: '0.5rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => setCatalogEditRows((prev) => prev.filter((_, j) => j !== idx))}
                              style={estDangerOutlineButton()}
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            value={r.description}
                            onChange={(e) => {
                              const v = e.target.value
                              setCatalogEditRows((prev) => {
                                const next = [...prev]
                                const cur = next[idx]
                                if (!cur) return prev
                                next[idx] = { ...cur, description: v }
                                return next
                              })
                            }}
                            placeholder="Description (optional)"
                            aria-label="Description (optional)"
                            style={{
                              ...estInputBase,
                              width: '100%',
                              minWidth: 0,
                              boxSizing: 'border-box',
                              padding: '0.5rem',
                            }}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setCatalogEditRows((prev) => [...prev, emptyCatalogEditRow()])}
                          style={estSecondaryButton()}
                        >
                          Add row
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveCatalogEdits()}
                        disabled={catalogSaveBusy}
                        style={estPrimaryButton(catalogSaveBusy)}
                      >
                        {catalogSaveBusy ? 'Saving…' : 'Save catalog'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <ul
              style={{
                paddingLeft: '1.25rem',
                margin: 0,
                listStylePosition: 'outside',
              }}
            >
              {lines.map((ln, i) => (
                <li key={i} style={{ marginBottom: '0.35rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        placeholder="Line item"
                        value={ln.line_item}
                        onChange={(e) => updateLine(i, { line_item: e.target.value })}
                        style={{ ...estInputBase, flex: '1 1 120px', padding: '0.5rem', minWidth: 0 }}
                      />
                      <input
                        className="no-spinner"
                        type="number"
                        min={0}
                        step="any"
                        placeholder="Count"
                        title="Count"
                        value={ln.quantity}
                        onChange={(e) => {
                          let q = Number(e.target.value)
                          if (!Number.isFinite(q) || q <= 0) q = 1
                          updateLine(i, { quantity: q })
                        }}
                        style={{ ...estInputBase, width: 72, padding: '0.5rem' }}
                      />
                      <input
                        className="no-spinner"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Unit ($)"
                        value={ln.unit_price_cents ? ln.unit_price_cents / 100 : ''}
                        onChange={(e) =>
                          updateLine(i, { unit_price_cents: Math.round(Number(e.target.value || '0') * 100) })
                        }
                        style={{ ...estInputBase, width: 100, padding: '0.5rem' }}
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
                          border: '1px solid #fca5a5',
                          borderRadius: '50%',
                          background: '#fef2f2',
                          color: '#b91c1c',
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
              ))}
              <li style={{ marginBottom: '0.35rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    minHeight: 38,
                  }}
                >
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
                      border: '1px solid #d1d5db',
                      borderRadius: '50%',
                      background: '#f9fafb',
                      color: '#374151',
                      fontSize: '1.125rem',
                      fontWeight: 500,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
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
            </ul>
            <p style={{ fontWeight: 600, textAlign: 'right' }}>Total: {formatMoney(totalCents)}</p>
            {customerAttachmentPreview ?
              <EstimateCustomerAttachmentCard attachment={customerAttachmentPreview} />
            : (
              <section
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem 1.15rem',
                  border: '1px dashed #d1d5db',
                  borderRadius: 8,
                  background: '#fafafa',
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
                      background: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '1.25rem',
                      color: '#9ca3af',
                      fontWeight: 600,
                    }}
                    aria-hidden
                  >
                    PDF
                  </div>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <h2
                      id="estimate-draft-supporting-doc-placeholder-heading"
                      style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#9ca3af' }}
                    >
                      Supporting document
                    </h2>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.45 }}>
                      Preview — add a label and URL in Supporting document (customer) below.
                    </p>
                  </div>
                </div>
              </section>
            )}
            <section style={{ marginTop: '1.5rem' }}>
              <h2
                style={{
                  fontSize: '1.1rem',
                  margin: '0 0 0.5rem',
                  color: terms.trim() ? '#111827' : '#9ca3af',
                  transition: 'color 0.15s ease',
                }}
              >
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
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
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
          <fieldset
            style={{
              marginTop: '1rem',
              marginLeft: 'auto',
              marginRight: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '0.75rem',
              maxWidth: 560,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <legend style={{ fontWeight: 500, padding: '0 0.35rem' }}>Supporting document (customer)</legend>
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
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Drive or Docs URLs only. Does not block sending — hints only.
                  </span>
                </div>
                {attachmentCheckStatus === 'success' && attachmentCheckMessage ? (
                  <p
                    role="status"
                    style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#15803d', lineHeight: 1.45 }}
                  >
                    {attachmentCheckMessage}
                  </p>
                ) : null}
                {attachmentCheckStatus === 'warn' && attachmentCheckMessage ? (
                  <p
                    role="status"
                    style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b45309', lineHeight: 1.45 }}
                  >
                    {attachmentCheckMessage}
                  </p>
                ) : null}
                {attachmentCheckStatus === 'error' && attachmentCheckMessage ? (
                  <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b91c1c', lineHeight: 1.45 }}>
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
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>No supporting document for this quote.</p>
            )}
            <details style={{ margin: '0.65rem 0 0', fontSize: '0.85rem', color: '#374151', textAlign: 'center' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500, color: '#1f2937' }}>
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
            <button
              type="button"
              onClick={() => void sendToCustomer()}
              disabled={sending}
              style={estSendButton(sending)}
            >
              {sending ? 'Sending…' : 'Send to customer'}
            </button>
            <button type="button" onClick={() => void deleteDraft()} style={estDangerOutlineButton()}>
              Delete draft
            </button>
          </div>
        </>
      )}
      </EstimateDraftCustomerGate>

      {!isDraft && (
        <div style={{ marginTop: '1rem' }}>
          {row.status === 'customer_accepted' ? (
            <div
              key={`customer-accepted-record-${row.id}`}
              style={{
                marginTop: 0,
                padding: '1rem',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                maxWidth: 640,
                background: 'white',
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
                lineItemsHeading={staffResolvedExperience?.docLineItemsHeading ?? 'Line items'}
                termsHeading={staffResolvedExperience?.docTermsHeading ?? 'Terms'}
              />
              {customerAttachmentPreview ? (
                <div style={{ marginTop: '1.25rem' }}>
                  <EstimateCustomerAttachmentCard attachment={customerAttachmentPreview} />
                </div>
              ) : null}
            </div>
          ) : (
            <p>
              <strong>Total:</strong> {formatMoney(row.total_cents)}
            </p>
          )}
          {(row.customer_id || row.customer_email) && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
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
                          color: '#2563eb',
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
              <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Customer acceptance</h2>
              <ul style={{ fontSize: '0.9rem', color: '#374151' }}>
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
                      style={{ maxWidth: 400, width: '100%', border: '1px solid #e5e7eb', borderRadius: 6 }}
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
                      Create job from estimate
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
              <p style={{ marginTop: '1rem', color: '#92400e' }}>
                Waiting for customer. Contact them with the link from the email we sent (or ask an admin to resend).
              </p>
              <EstimateCustomerAcceptLinkButtons
                customerAcceptUrl={customerAcceptUrl}
                isDraft={isDraft}
                onCopy={copyCustomerAcceptUrl}
                onOpen={openCustomerAcceptUrl}
                style={{ marginTop: '0.75rem' }}
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
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <summary style={{ cursor: 'pointer', fontWeight: 600, userSelect: 'none' }}>Customer experience</summary>
        <div style={{ marginTop: '1rem' }}>
          {row.status !== 'sent' ? (
            <EstimateCustomerAcceptLinkButtons
              customerAcceptUrl={customerAcceptUrl}
              isDraft={isDraft}
              onCopy={copyCustomerAcceptUrl}
              onOpen={openCustomerAcceptUrl}
              style={{ marginBottom: '1rem' }}
            />
          ) : null}
          {!isDraft && row.customer_experience_sent ? (
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
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
                border: '1px solid #d1d5db',
                background: customerPreviewTab === 'email' ? '#eff6ff' : '#f9fafb',
                color: '#374151',
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
                border: '1px solid #d1d5db',
                background: customerPreviewTab === 'page' ? '#eff6ff' : '#f9fafb',
                color: '#374151',
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
                border: '1px solid #d1d5db',
                background: customerPreviewTab === 'thankyou' ? '#eff6ff' : '#f9fafb',
                color: '#374151',
                fontWeight: customerPreviewTab === 'thankyou' ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Thank you
            </button>
          </div>

          {customerPreviewTab === 'email' && staffResolvedExperience && (
            <>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '1rem',
                  background: '#fafafa',
                  fontSize: '0.9rem',
                }}
              >
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>
                  <strong>From:</strong> {ESTIMATE_EMAIL_FROM_LABEL}
                </p>
                <p style={{ margin: '0 0 0.5rem' }}>
                  <strong>To:</strong> {previewEmailTo}
                </p>
                <p style={{ margin: '0 0 0.5rem' }}>
                  <strong>Subject:</strong> {staffResolvedExperience.emailSubject}
                </p>
                <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>HTML preview</p>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
                  Matches the HTML email (centered logo when an acceptance page logo is selected).
                </p>
                <div
                  style={{
                    margin: 0,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '0.75rem',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                  // eslint-disable-next-line react/no-danger -- HTML is generated only via buildEstimateEmailHtml (escaped plain body)
                  dangerouslySetInnerHTML={{ __html: customerEmailPreviewHtml }}
                />
                <p style={{ margin: '0.75rem 0 0.35rem', fontWeight: 600 }}>Plain text</p>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '0.75rem',
                  }}
                >
                  {staffResolvedExperience.emailBody}
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
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '1rem',
                  background: 'white',
                  maxWidth: 640,
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
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 0,
                  background: 'white',
                  maxWidth: 640,
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
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '1rem 2rem 2rem',
              borderRadius: 8,
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
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
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unlink-job-confirm-title"
            aria-describedby="unlink-job-confirm-desc"
            style={{
              background: 'white',
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
            <p id="unlink-job-confirm-desc" style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: '#374151' }}>
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