import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
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
import EstimateCustomerAcceptLinkButtons from '../components/estimates/EstimateCustomerAcceptLinkButtons'
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
import { formatEstimateListUpdatedLines } from '../lib/formatEstimateListUpdated'
import { formatNotificationDatetime } from '../utils/formatNotificationDatetime'

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
      'Quote document labels (title; line items, total, terms; accept form below)—same order customers see on the public page. The expiry date line (“Expires on” + date) appears only when Valid until is set on this estimate; the prefix field below appears only when Valid until is filled in above. The document title fallback applies only when the estimate title is empty; the fallback field below appears only when the estimate title above is empty.',
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

/** Same look as list, slightly larger tap target on detail. */
const estimateDetailCreateJobButtonStyle: CSSProperties = {
  ...estimateListCreateJobButtonStyle,
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
}

function estimateLinkedJobHcp(r: { jobs_ledger?: { hcp_number: string } | null }): string | null {
  const t = (r.jobs_ledger?.hcp_number ?? '').trim()
  return t || null
}
type LineItem = { description: string; amount_cents: number }

function lineItemsFromJson(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const o = x as Record<string, unknown>
    return {
      description: String(o.description ?? ''),
      amount_cents: Math.max(0, Math.round(Number(o.amount_cents ?? 0))),
    }
  })
}

function sumLineItems(lines: LineItem[]): number {
  return lines.reduce((s, r) => s + r.amount_cents, 0)
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

function EstimateList() {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const [rows, setRows] = useState<EstimateListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [acceptanceModalEstimateId, setAcceptanceModalEstimateId] = useState<string | null>(null)
  const [createJobFromListRow, setCreateJobFromListRow] = useState<EstimateListRow | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          await supabase
            .from('estimates')
            .select('*, customers(name, address, contact_info), jobs_ledger(hcp_number)')
            .order('updated_at', { ascending: false })
            .limit(200),
        'load estimates',
      )
      setRows((data ?? []) as EstimateListRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load estimates'), 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

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
              line_items_snapshot: [],
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

  return (
    <div style={{ padding: '1rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Estimates</h1>
        <button type="button" onClick={() => void createDraft()} disabled={creating} style={{ padding: '0.5rem 1rem' }}>
          {creating ? 'Creating…' : 'New estimate'}
        </button>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
        Simple proposals with a customer acceptance link. After acceptance, link a job from the estimate detail page.
      </p>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>#</th>
                <th style={{ padding: '0.5rem', lineHeight: 1.3 }}>
                  <div>Title</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280' }}>Customer</div>
                </th>
                <th style={{ padding: '0.5rem' }}>Status</th>
                <th style={{ padding: '0.5rem' }}>Total</th>
                <th style={{ padding: '0.5rem' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const updatedLines = formatEstimateListUpdatedLines(r.updated_at)
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                        <span
                          style={{
                            fontSize: '0.85rem',
                            color: '#6b7280',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          {estimateListCustomerSubline(r)}
                        </span>
                      </div>
                    </td>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p style={{ marginTop: '1rem', color: '#6b7280' }}>No estimates yet.</p>}
        </div>
      )}
      <CustomerAcceptanceRecordModal
        open={acceptanceModalEstimateId != null}
        estimateId={acceptanceModalEstimateId}
        onClose={() => setAcceptanceModalEstimateId(null)}
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
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false)
  const [validUntil, setValidUntil] = useState('')
  const [validUntilPreset, setValidUntilPreset] = useState<ValidUntilPresetDays | null>(null)
  const [forAddress, setForAddress] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
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
  const customerNotesQueryCustomerId = row?.status === 'draft' && customerId ? customerId : null
  const {
    entries: customerNotesEntries,
    loading: customerNotesLoading,
    refetch: refetchCustomerNotes,
  } = useCustomerContactsForCustomer(customerNotesQueryCustomerId, (m) => showToast(m, 'error'))
  const titleInputRef = useRef<HTMLInputElement>(null)
  /** Tracks last persisted customer link for draft auto-save; `undefined` = skip first run after load/navigation. */
  const prevCustomerIdForAutosave = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    setLastAcceptUrl(null)
    setDraftTitleEditing(false)
    setValidUntilPreset(null)
    prevCustomerIdForAutosave.current = undefined
  }, [routeSegment])

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
      setLines(lineItemsFromJson(r.line_items_snapshot))
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

  const isDraft = row?.status === 'draft'
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
                    display: 'block',
                    width: '100%',
                    marginTop: '0.25rem',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
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
                  display: 'block',
                  width: '100%',
                  marginTop: '0.25rem',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
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
      next[i] = {
        description: patch.description !== undefined ? patch.description : cur.description,
        amount_cents: patch.amount_cents !== undefined ? patch.amount_cents : cur.amount_cents,
      }
      return next
    })
  }

  const lineItemRecentChips = useMemo(
    () => resolveRecentChips(lineItemRecentIds, catalogLineItems),
    [lineItemRecentIds, catalogLineItems],
  )

  const catalogFiltered = useMemo(() => {
    const q = catalogFilter.trim().toLowerCase()
    if (!q) return catalogLineItems
    return catalogLineItems.filter((c) => {
      if (c.description.toLowerCase().includes(q)) return true
      if (String(c.amount_cents).includes(q)) return true
      return formatMoney(c.amount_cents).toLowerCase().includes(q)
    })
  }, [catalogLineItems, catalogFilter])

  function applyFromCatalogEntry(entry: EstimateCatalogLineItem) {
    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.description.trim() === '' && last.amount_cents === 0) {
        const next = [...prev]
        next[next.length - 1] = { description: entry.description, amount_cents: entry.amount_cents }
        return next
      }
      return [...prev, { description: entry.description, amount_cents: entry.amount_cents }]
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
    switch (e.action) {
      case 'create':
        return `Added: ${e.new_description ?? '—'} — ${fmt(e.new_amount_cents)}`
      case 'update':
        return `Updated: "${e.prev_description ?? ''}" ${fmt(e.prev_amount_cents)} → "${e.new_description ?? ''}" ${fmt(e.new_amount_cents)}`
      case 'delete':
        return `Removed: "${e.prev_description ?? ''}" ${fmt(e.prev_amount_cents)}`
      case 'restore':
        return `Restored: ${e.new_description ?? '—'} — ${fmt(e.new_amount_cents)}`
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
      <div style={{ padding: '1rem' }}>
        <p>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 900, margin: '0 auto' }}>
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
          <div style={{ width: '100%', maxWidth: 480, textAlign: 'left' }}>
            <span style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem' }}>Customer</span>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
              Search by name, address, email, or phone. Used for the acceptance email.
            </p>
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
              onRequestEditSelected={
                editCustomerModal && customerId
                  ? () => {
                      const cid = customerId
                      editCustomerModal.openEditCustomerModal(cid, {
                        onSaved: async () => {
                          await refetchCustomersAfterEdit(cid)
                        },
                        onDeleted: (deletedId) => {
                          // Defer so we never setState on EstimateDetail during EditCustomerForm/Provider
                          // synchronous path (nested setState in setCustomerId updater caused cross-tree warnings).
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
                    }
                  : undefined
              }
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
                  <strong>CRM email:</strong> {crmEmailForSelected || '—'}
                </div>
                <div>
                  <strong>Phone:</strong> {extractContactFromCustomer(selectedCustomer).phone.trim() || '—'}
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
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <strong>Most recent note:</strong>{' '}
                      {customerNotesLoading && customerNotesEntries.length === 0 ? (
                        <span style={{ color: '#6b7280' }}>Loading…</span>
                      ) : customerNotesEntries[0]?.details?.trim() ? (
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {customerNotesEntries[0].details.trim()}
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>No notes yet.</span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-expanded={customerNotesExpanded}
                      onClick={() => setCustomerNotesExpanded((v) => !v)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        cursor: 'pointer',
                        padding: 0,
                        font: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      {customerNotesExpanded ? 'Collapse' : 'Expand'}
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
            {showSendEmailOverride && (
              <label style={{ display: 'block', marginTop: '1rem' }}>
                <span style={{ fontWeight: 500 }}>Send to email (override)</span>
                <p style={{ margin: '0.25rem 0 0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  This customer has no email on file. Enter the address to receive the acceptance link.
                </p>
                <input
                  type="email"
                  value={sendEmailOverride}
                  onChange={(e) => setSendEmailOverride(e.target.value)}
                  style={{ display: 'block', width: '100%', maxWidth: 480, marginTop: '0.25rem', padding: '0.5rem' }}
                />
              </label>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          {isDraft ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <h1 style={{ margin: 0 }}>
                <span style={{ color: '#6b7280', fontSize: '0.9rem', fontWeight: 600 }}>
                  # {row.estimate_number}
                </span>{' '}
                {title || 'Estimate'}
              </h1>
              <button
                type="button"
                aria-expanded={draftTitleEditing}
                aria-controls="estimate-draft-title-field"
                onClick={() => setDraftTitleEditing((v) => !v)}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.85rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: '#f9fafb',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {draftTitleEditing ? 'Done' : 'Edit title'}
              </button>
            </div>
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

      {!isDraft ? (
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
        </>
      ) : null}

      {isDraft && (
        <>
          {draftTitleEditing ? (
            <label id="estimate-draft-title-field" style={{ display: 'block', marginTop: '1rem' }}>
              <span style={{ fontWeight: 500 }}>Title</span>
              <input
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ display: 'block', width: '100%', maxWidth: 480, marginTop: '0.25rem', padding: '0.5rem' }}
              />
            </label>
          ) : null}
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ fontWeight: 500 }}>For:</span>
            {!customerId ? (
              <span style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginTop: '0.15rem' }}>
                Select a customer to enable.
              </span>
            ) : null}
            <input
              value={forAddress}
              onChange={(e) => setForAddress(e.target.value)}
              disabled={!customerId}
              placeholder={selectedCustomer?.address?.trim() || 'Customer address…'}
              style={{ display: 'block', width: '100%', maxWidth: 480, marginTop: '0.25rem', padding: '0.5rem' }}
            />
          </label>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ fontWeight: 500 }}>Valid until (optional)</span>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.25rem',
              }}
            >
              <input
                type="date"
                value={validUntil}
                onChange={(e) => {
                  const v = e.target.value
                  setValidUntil(v)
                  setValidUntilPreset(presetMatchingTodayOffset(v))
                }}
                style={{ padding: '0.5rem' }}
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
                    fontSize: '0.85rem',
                    borderRadius: 6,
                    border: validUntilPreset === n ? 'none' : '1px solid #d1d5db',
                    background: validUntilPreset === n ? '#ea580c' : '#f9fafb',
                    color: validUntilPreset === n ? 'white' : '#374151',
                    cursor: 'pointer',
                    fontWeight: validUntilPreset === n ? 600 : 400,
                  }}
                >
                  {n} days
                </button>
              ))}
            </div>
          </label>
          <fieldset
            style={{
              marginTop: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '0.75rem',
              maxWidth: 480,
            }}
          >
            <legend style={{ fontWeight: 500, padding: '0 0.35rem' }}>Acceptance page logo</legend>
            <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: '#6b7280' }}>
              Top-right on the customer-facing quote and acceptance form.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(
                [
                  { value: null, label: 'None' },
                  { value: 'elec', label: 'Electrical' },
                  { value: 'plum', label: 'Plumbing' },
                ] as { value: EstimateAcceptHeaderBrand | null; label: string }[]
              ).map((opt) => (
                <label
                  key={opt.value ?? 'none'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="acceptHeaderBrand"
                    checked={acceptHeaderBrand === opt.value}
                    onChange={() => setAcceptHeaderBrand(opt.value)}
                  />
                  <span style={{ minWidth: '5.5rem' }}>{opt.label}</span>
                  {opt.value ? (
                    <span
                      style={{
                        width: 140,
                        height: 56,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        background: '#fafafa',
                        boxSizing: 'border-box',
                      }}
                    >
                      <img
                        src={acceptHeaderBrandImageSrc(opt.value)}
                        alt={acceptHeaderBrandLabel(opt.value)}
                        width={140}
                        height={56}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                      />
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </fieldset>
          <section style={{ marginTop: '1rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Line items</h2>
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
              {lineItemRecentChips.map((c) => {
                const short =
                  c.description.length > 36 ? `${c.description.slice(0, 35)}…` : c.description || '(no description)'
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => applyFromCatalogEntry(c)}
                    title={`${c.description} — ${formatMoney(c.amount_cents)}`}
                    style={{
                      padding: '0.3rem 0.55rem',
                      fontSize: '0.8rem',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#f9fafb',
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
                    maxWidth: 560,
                    width: '100%',
                    maxHeight: 'min(85vh, 640px)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
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
                              fontSize: '0.85rem',
                              borderRadius: 6,
                              border: catalogModalTab === 'pick' ? 'none' : '1px solid #d1d5db',
                              background: catalogModalTab === 'pick' ? '#2563eb' : '#f9fafb',
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
                              fontSize: '0.85rem',
                              borderRadius: 6,
                              border: catalogModalTab === 'edit' ? 'none' : '1px solid #d1d5db',
                              background: catalogModalTab === 'edit' ? '#2563eb' : '#f9fafb',
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
                        style={{ marginLeft: 'auto' }}
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
                        style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', boxSizing: 'border-box' }}
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
                                <span style={{ display: 'block', fontWeight: 500 }}>{c.description || '—'}</span>
                                <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                                  {formatMoney(c.amount_cents)}
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
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
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
                            placeholder="Description"
                            style={{ flex: '1 1 200px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                          />
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={r.amount_cents ? r.amount_cents / 100 : ''}
                            onChange={(e) => {
                              const n = Math.round(Number(e.target.value || '0') * 100)
                              setCatalogEditRows((prev) => {
                                const next = [...prev]
                                const cur = next[idx]
                                if (!cur) return prev
                                next[idx] = { ...cur, amount_cents: Math.max(0, n) }
                                return next
                              })
                            }}
                            placeholder="Amount (USD)"
                            style={{ width: 120, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                          />
                          <button
                            type="button"
                            onClick={() => setCatalogEditRows((prev) => prev.filter((_, j) => j !== idx))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setCatalogEditRows((prev) => [...prev, { id: '', description: '', amount_cents: 0 }])
                          }
                        >
                          Add row
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveCatalogEdits()}
                        disabled={catalogSaveBusy}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: catalogSaveBusy ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {catalogSaveBusy ? 'Saving…' : 'Save catalog'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            {lines.map((ln, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  placeholder="Description"
                  value={ln.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  style={{ flex: '1 1 200px', padding: '0.5rem' }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount (USD)"
                  value={ln.amount_cents ? ln.amount_cents / 100 : ''}
                  onChange={(e) =>
                    updateLine(i, { amount_cents: Math.round(Number(e.target.value || '0') * 100) })
                  }
                  style={{ width: 120, padding: '0.5rem' }}
                />
                <button type="button" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setLines((p) => [...p, { description: '', amount_cents: 0 }])}>
              Add line
            </button>
            <p style={{ fontWeight: 600 }}>Total: {formatMoney(totalCents)}</p>
          </section>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ fontWeight: 500 }}>Terms</span>
            <AutosizeTextarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              minRows={1}
              extraLines={terms.trim() ? 1 : 0}
              style={{ marginTop: '0.25rem', padding: '0.5rem', fontFamily: 'inherit' }}
            />
          </label>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ fontWeight: 500 }}>Internal notes</span>
            <AutosizeTextarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              minRows={1}
              extraLines={internalNotes.trim() ? 1 : 0}
              style={{ marginTop: '0.25rem', padding: '0.5rem', fontFamily: 'inherit' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button type="button" onClick={() => void saveDraft()} disabled={saving}>
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => void sendToCustomer()}
              disabled={sending}
              style={{ background: '#ea580c', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 6 }}
            >
              {sending ? 'Sending…' : 'Send to customer'}
            </button>
            <button type="button" onClick={() => void deleteDraft()} style={{ color: '#b91c1c' }}>
              Delete draft
            </button>
          </div>
        </>
      )}

      {!isDraft && (
        <div style={{ marginTop: '1rem' }}>
          <p>
            <strong>Total:</strong> {formatMoney(row.total_cents)}
          </p>
          {(row.customer_id || row.customer_email) && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              {row.customer_id && (
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Customer:</strong>{' '}
                  {customers.find((c) => c.id === row.customer_id)?.name?.trim() || row.customer_id}
                </p>
              )}
              {row.customer_email && (
                <p style={{ margin: '0.25rem 0' }}>
                  <strong>Email used for link:</strong> {row.customer_email}
                </p>
              )}
            </div>
          )}
          {(row.status === 'sent' || row.status === 'customer_accepted') && (
            <div style={{ marginTop: '1rem' }}>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>Customer activity</h2>
              {estimateCustomerEventsLoading ? (
                <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>Loading…</p>
              ) : estimateCustomerEvents.length === 0 ? (
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
                  {estimateCustomerEvents.map((ev) => {
                    const meta = ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)
                      ? (ev.metadata as Record<string, unknown>)
                      : null
                    const sig =
                      ev.event_type === 'public_accept_submitted' && meta && meta.had_signature === true
                        ? ' (with signature)'
                        : ''
                    const clientIpSuffix = ev.client_ip?.trim() ? ` · ${ev.client_ip.trim()}` : ''
                    return (
                      <li key={ev.id} style={{ marginBottom: '0.35rem' }}>
                        {estimateCustomerEventLabel(ev.event_type)}
                        {sig}
                        {clientIpSuffix} — {formatNotificationDatetime(ev.occurred_at)}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
          {row.status === 'customer_accepted' && (
            <>
              <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Customer acceptance</h2>
              <ul style={{ fontSize: '0.9rem', color: '#374151' }}>
                <li>Name: {row.acceptor_printed_name || '—'}</li>
                <li>At: {row.acceptor_consented_at ? new Date(row.acceptor_consented_at).toLocaleString() : '—'}</li>
                <li>IP: {row.acceptor_ip || '—'}</li>
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
              <div id={ESTIMATE_JOB_SECTION_HASH}>
                <h2 style={{ fontSize: '1rem', marginTop: '1rem' }}>Job</h2>
                {!row.job_ledger_id ? (
                  <div style={{ marginTop: '0.5rem' }}>
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
                        background: 'none',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        padding: '0.25rem 0.5rem',
                        font: 'inherit',
                        fontSize: '0.875rem',
                        color: '#374151',
                        cursor: unlinkingJob || loading || saving ? 'not-allowed' : 'pointer',
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
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: customerPreviewTab === 'email' ? '#f3f4f6' : 'white',
                fontWeight: customerPreviewTab === 'email' ? 600 : 400,
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
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: customerPreviewTab === 'page' ? '#f3f4f6' : 'white',
                fontWeight: customerPreviewTab === 'page' ? 600 : 400,
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
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                background: customerPreviewTab === 'thankyou' ? '#f3f4f6' : 'white',
                fontWeight: customerPreviewTab === 'thankyou' ? 600 : 400,
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
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  borderRadius: 4,
                  cursor: unlinkingJob ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unlinkingJob}
                onClick={() => {
                  void confirmUnlinkLinkedJob()
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: unlinkingJob ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: unlinkingJob ? 'not-allowed' : 'pointer',
                }}
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
    </div>
  )
}

export default function Estimates() {
  const { id: routeSegment } = useParams<{ id: string }>()
  if (routeSegment) return <EstimateDetail routeSegment={routeSegment} />
  return <EstimateList />
}