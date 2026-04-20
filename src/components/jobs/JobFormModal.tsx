/* eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key */
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NO_CUSTOMER_TYPE_LABEL } from '../../constants/customerTypeLabels'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
import { useMercuryLedgerNicknames } from '../../hooks/useMercuryLedgerNicknames'
import { useToastContext } from '../../contexts/ToastContext'
import { parseCustomerImport } from '../../utils/parseCustomerImport'
import { nameSimilarity } from '../../utils/nameSimilarity'
import { formatPostgrestOrUnknownError, withSupabaseRetry } from '../../utils/errorHandling'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import CustomerAcceptanceRecordModal from '../estimates/CustomerAcceptanceRecordModal'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { resolveCustomerIdForJobPayload } from '../../lib/jobLedgerCustomer'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { prepareBilledInvoicesBeforeJobRevertToReadyToBill } from '../../lib/voidStripeInvoiceForRevert'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { setReturnEditJobFromStages } from '../../lib/returnEditJobFromStages'
import { normalizeJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'
import { invoiceCreatedCalendarDayOffset } from '../../lib/invoiceCreatedRelative'
import { formatMercuryCardChargesPostedDate } from '../../lib/formatMercuryCardChargesPostedDate'
import { fetchJobMaterialsCostSnapshot } from '../../lib/fetchJobMaterialsCostSnapshot'
import { abbreviatePaymentReferenceLabel } from '../../lib/abbreviatePaymentReference'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import type { JobMercuryAllocLine, JobSupplyInvoiceLine, JobTallyPartLine } from '../../lib/fetchJobMaterialsCostSnapshot'
import { MaterialsCostAccordionRow } from './JobFormMaterialsCostAccordion'
import JobProjectLinkChoiceModal from './JobProjectLinkChoiceModal'
import JobBidLinkChoiceModal, { type JobBidLinkOption } from './JobBidLinkChoiceModal'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { useNewProjectModal } from '../../contexts/NewProjectModalContext'
import BilledBillViewModal, { type InvoiceWithJobForBillView } from './BilledBillViewModal'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
import { laborItemsSubtotal } from '../../lib/peopleLaborJobItemLineCost'
import {
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
  stripeInvoiceFixtureLineLength,
} from '../../lib/stripeInvoiceLineDescription'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

type MaterialRow = { id: string; description: string; amount: number }

function materialRowHasUserContent(row: MaterialRow): boolean {
  return (row.description ?? '').trim() !== '' || Number(row.amount) !== 0
}

type MaterialsAccordionKey = 'supply' | 'mercury' | 'tally' | 'billed'

type PaymentRow = {
  id: string
  amount: number
  paid_on: string | null
  note: string | null
  payment_type: string | null
  reference_number: string | null
  /** Set when loaded from DB; payments applied to an invoice cannot be removed in this form. */
  invoice_id: string | null
  /** Set when loaded from DB; Bank Payments flow links a Mercury transaction. */
  mercury_transaction_id: string | null
}
type FixtureRow = {
  id: string
  name: string
  count: number
  /** Unit price in dollars; null when unset. */
  line_unit_price: number | null
  line_description: string
}

const FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: 0,
}

function localDateYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function newEmptyPaymentRow(): PaymentRow {
  return {
    id: crypto.randomUUID(),
    amount: 0,
    paid_on: localDateYYYYMMDD(),
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: null,
    mercury_transaction_id: null,
  }
}

function mercuryLinkedPaymentRow(row: PaymentRow): boolean {
  return row.mercury_transaction_id != null && String(row.mercury_transaction_id).trim().length > 0
}

/** Same roles as Accounts Receivable bank payment apply. */
function canUnlinkMercuryPayment(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'primary'
}

function paymentRowLinkedToInvoice(row: PaymentRow): boolean {
  return row.invoice_id != null && String(row.invoice_id).trim().length > 0
}

function jobsLedgerInvoiceIsStripeLinked(inv: JobsLedgerInvoiceRow): boolean {
  if ((inv.stripe_invoice_id ?? '').trim()) return true
  return (inv.external_send_channel ?? '').trim() === 'stripe'
}

function stripeBillInvoiceForPaymentRow(
  row: PaymentRow,
  job: JobWithDetails | null,
): JobsLedgerInvoiceRow | null {
  if (!job || !paymentRowLinkedToInvoice(row)) return null
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv || !jobsLedgerInvoiceIsStripeLinked(inv)) return null
  return inv
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Display `YYYY-MM-DD` for payment table cells (Stripe-locked rows use plain text, not date inputs). */
function formatPaymentDateForDisplay(isoYmd: string | null | undefined): string {
  const t = isoYmd?.trim()
  if (!t) return '—'
  const d = new Date(`${t}T12:00:00`)
  if (Number.isNaN(d.getTime())) return t
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Matches Outstanding billing note/memo sub-row cell styling in Edit Job. */
const PAYMENT_MEMO_SUB_ROW_CELL_STYLE: CSSProperties = {
  paddingTop: 0,
  paddingRight: '0.75rem',
  paddingBottom: '0.5rem',
  paddingLeft: '3.5rem',
  fontSize: '0.75rem',
  color: '#6b7280',
  wordBreak: 'break-word',
  lineHeight: 1.35,
}

const JOB_FIELD_CLIPBOARD_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#fff',
}

const JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '0.5rem',
  paddingRight: '2.5rem',
  border: 'none',
  outline: 'none',
  fontSize: '0.875rem',
  background: 'transparent',
}

function ClipboardPasteGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }} aria-hidden>
      <path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z" />
    </svg>
  )
}

async function pasteTextToField(ref: RefObject<HTMLInputElement | null>, setValue: (v: string) => void) {
  ref.current?.focus()
  if (!document.execCommand('paste')) {
    try {
      const text = await navigator.clipboard.readText()
      setValue(text)
    } catch {
      /* clipboard not available */
    }
  }
}

function parseMoneyInputToNumber(s: string): number {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

function parseMoneyInputToNumberOrNull(s: string): number | null {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

/** Gross (job total) minus payments minus ready_to_bill and billed invoice line amounts — same basis as Stages unallocated. */
function unallocatedBillableDollars(
  gross: number,
  paidSum: number,
  invoices: Array<{ status: string; amount: unknown }> | null | undefined,
): number {
  let alloc = 0
  for (const inv of invoices ?? []) {
    if (inv.status === 'ready_to_bill' || inv.status === 'billed') {
      alloc += Number(inv.amount) || 0
    }
  }
  return Math.max(0, gross - paidSum - alloc)
}

/** Break-off dollars for target combined % ((paid + break) / gross) * 100, clamped to remaining unallocated. */
function breakDollarsFromCombinedPct(
  combinedPct: number,
  gross: number,
  paidSum: number,
  remainingUnallocated: number,
): number {
  const rawBreak = (combinedPct / 100) * gross - paidSum
  const cents = Math.min(
    Math.round(remainingUnallocated * 100),
    Math.max(0, Math.round(rawBreak * 100)),
  )
  return cents / 100
}

const BREAK_OFF_COMBINED_SLIDER_STEP_PCT = 5

function snapBreakOffCombinedPctToStep(
  pct: number,
  min: number,
  max: number,
  step: number = BREAK_OFF_COMBINED_SLIDER_STEP_PCT,
): number {
  const snapped = Math.round(pct / step) * step
  return Math.min(max, Math.max(min, snapped))
}

function breakOffPrefillAmountStringFromJob(job: JobWithDetails): string {
  const gross = job.revenue != null ? Number(job.revenue) : 0
  const paid = (job.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = unallocatedBillableDollars(gross, paid, job.invoices)
  if (!(gross > 0) || !(remaining > 0)) return ''
  const paidCents = Math.round(paid * 100)
  const threshold80Cents = Math.round(0.8 * gross * 100)
  const rawTarget = paidCents > threshold80Cents ? 0.95 * gross : 0.8 * gross
  const useCents = Math.min(
    Math.round(remaining * 100),
    Math.max(0, Math.round(rawTarget * 100)),
  )
  const amount = useCents / 100
  return amount > 0 ? amount.toFixed(2) : ''
}

function sanitizeMoneyTyping(raw: string): string {
  const noComma = raw.replace(/,/g, '')
  let out = ''
  let dotSeen = false
  for (const c of noComma) {
    if (c >= '0' && c <= '9') out += c
    else if (c === '.' && !dotSeen) {
      dotSeen = true
      out += '.'
    }
  }
  return out
}

function jobLedgerHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}

type ProjectOption = {
  id: string
  name: string
  customer_id: string
  master_user_id: string
  customers: { name: string } | null
}

/** Above Job Detail modal (`1004`) so Edit Job can stack on top without closing detail. */
const JOB_FORM_OVERLAY_Z_INDEX = 1010
const JOB_FORM_NESTED_OVERLAY_Z_INDEX = JOB_FORM_OVERLAY_Z_INDEX + 1

function formatJobFormBidLinkTitle(summary: { project_name: string | null; bid_number: string | null } | null): string {
  if (!summary) return ''
  const name = (summary.project_name ?? '').trim() || 'Untitled'
  const n = summary.bid_number != null && String(summary.bid_number).trim() !== '' ? String(summary.bid_number).trim() : null
  return n ? `B${n} | ${name}` : name
}

function ReadOnlyPaymentRefCopy({
  refText,
  showToast,
}: {
  refText: string
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
}) {
  const { display, full } = useMemo(() => abbreviatePaymentReferenceLabel(refText), [refText])
  const onActivate = useCallback(async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        showToast('Clipboard not available', 'error')
        return
      }
      await navigator.clipboard.writeText(full)
      showToast('Reference copied', 'success')
    } catch {
      showToast('Could not copy reference', 'error')
    }
  }, [full, showToast])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        void onActivate()
      }
    },
    [onActivate],
  )

  return (
    <button
      type="button"
      onClick={() => void onActivate()}
      onKeyDown={onKeyDown}
      title="Copy full reference to clipboard"
      aria-label="Copy full reference to clipboard"
      style={{
        padding: 0,
        border: 'none',
        background: 'none',
        font: 'inherit',
        color: '#2563eb',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      {display}
    </button>
  )
}
/** Above Edit Job + nested create-customer overlay so View Bill stacks correctly. */
const JOB_FORM_BILL_VIEW_OVERLAY_Z_INDEX = JOB_FORM_NESTED_OVERLAY_Z_INDEX + 1

export type JobFormModalProps = {
  mode: 'new' | 'edit'
  editJobId: string | null
  initialJob: JobWithDetails | null
  newJobProjectId?: string | null
  billingCustomerHighlightInitial: boolean
  fixturesSectionHighlightInitial: boolean
  alsoOpenCreateCustomerModal: boolean
  onClose: () => void
  onSaved: (() => void) | null
  /** New job only: called with created id after insert succeeds. */
  onCreatedJobId?: ((jobId: string) => void) | null
}

export default function JobFormModal({
  mode,
  editJobId,
  initialJob,
  newJobProjectId = null,
  billingCustomerHighlightInitial,
  fixturesSectionHighlightInitial,
  alsoOpenCreateCustomerModal,
  onClose,
  onSaved,
  onCreatedJobId = null,
}: JobFormModalProps) {
  const { user: authUser, role: authRole } = useAuth()
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()
  const { showToast } = useToastContext()
  const billCustomer = useBillCustomerModal()
  const newProjectModal = useNewProjectModal()
  const navigate = useNavigate()
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onCreatedJobIdRef = useRef(onCreatedJobId)
  onCreatedJobIdRef.current = onCreatedJobId

  const [initDone, setInitDone] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [billViewInvoice, setBillViewInvoice] = useState<InvoiceWithJobForBillView | null>(null)
  const editingIdRef = useRef<string | null>(null)
  editingIdRef.current = editing?.id ?? null

  const refetchEditingFromBillView = useCallback(() => {
    const jobId = editingIdRef.current
    if (!jobId) return
    void fetchJobWithDetailsById(jobId).then((found) => {
      if (found) setEditing(found)
    })
  }, [])

  const stripeMemoBackfillKey = useMemo(() => {
    if (!editing?.id) return null
    const needIds = (editing.invoices ?? [])
      .filter(
        (i) =>
          i.status === 'billed' &&
          (i.stripe_invoice_id ?? '').trim() &&
          (i.hosted_invoice_url ?? '').trim() &&
          (!(i.stripe_invoice_memo ?? '').trim() || !(i.stripe_invoice_footer ?? '').trim()),
      )
      .map((i) => i.id)
      .sort()
      .join('|')
    if (!needIds) return null
    return `${editing.id}::${needIds}`
  }, [editing?.id, editing?.invoices])

  useEffect(() => {
    if (!stripeMemoBackfillKey || !editing?.id) return
    const jobId = editing.id
    const targets = (editing.invoices ?? []).filter(
      (i) =>
        i.status === 'billed' &&
        (i.stripe_invoice_id ?? '').trim() &&
        (i.hosted_invoice_url ?? '').trim() &&
        (!(i.stripe_invoice_memo ?? '').trim() || !(i.stripe_invoice_footer ?? '').trim()),
    )
    if (targets.length === 0) return

    let cancelled = false
    void (async () => {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token || cancelled) return
      for (const inv of targets) {
        if (cancelled) return
        await supabase.functions.invoke('get-stripe-invoice-details', {
          body: {
            jobs_ledger_invoice_id: inv.id,
            ...stripeModeInvokeBody(getBillingStripeModePref()),
          },
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      if (cancelled) return
      const found = await fetchJobWithDetailsById(jobId)
      if (!cancelled && found) setEditing(found)
    })()

    return () => {
      cancelled = true
    }
  }, [stripeMemoBackfillKey])
  const [sourceEstimateForJob, setSourceEstimateForJob] = useState<EstimatesRow | null>(null)
  const [sourceEstimateLoading, setSourceEstimateLoading] = useState(false)
  const [contractModalEstimateId, setContractModalEstimateId] = useState<string | null>(null)
  const [hcpNumber, setHcpNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [bidId, setBidId] = useState<string | null>(null)
  const [linkedBidSummary, setLinkedBidSummary] = useState<{
    project_name: string | null
    bid_number: string | null
  } | null>(null)
  const [bids, setBids] = useState<JobBidLinkOption[]>([])
  const [jobBidLinkChoiceOpen, setJobBidLinkChoiceOpen] = useState(false)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [creatingCustomerFromJob, setCreatingCustomerFromJob] = useState(false)
  const [createCustomerFromJobModalOpen, setCreateCustomerFromJobModalOpen] = useState(false)
  const [jobProjectLinkChoiceOpen, setJobProjectLinkChoiceOpen] = useState(false)
  const [createCustomerFromJobType, setCreateCustomerFromJobType] = useState<'residential' | 'commercial'>('residential')
  const [similarCustomersForCreate, setSimilarCustomersForCreate] = useState<CustomerRow[]>([])
  const [createCustomerFromJobModalLoading, setCreateCustomerFromJobModalLoading] = useState(false)
  const [customerExpanded, setCustomerExpanded] = useState(false)
  const [projectFilesPlansExpanded, setProjectFilesPlansExpanded] = useState(false)
  const [billingCustomerHighlight, setBillingCustomerHighlight] = useState(false)
  const [fixturesSectionHighlight, setFixturesSectionHighlight] = useState(false)
  const [dateMet, setDateMet] = useState('')
  const [lastBillDate, setLastBillDate] = useState('')
  const jobFormMissingFields: string[] = []
  if (!jobName.trim()) jobFormMissingFields.push('Job Name')
  if (!jobAddress.trim()) jobFormMissingFields.push('Job Address')
  const jobFormCanSubmit = jobFormMissingFields.length === 0
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [jobPlansLink, setJobPlansLink] = useState('')
  const [payments, setPayments] = useState<PaymentRow[]>(() => [newEmptyPaymentRow()])
  const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), description: '', amount: 0 }])
  const [fixtures, setFixtures] = useState<FixtureRow[]>([
    { id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '' },
  ])
  /** User opened "Add scope or notes" for this fixture row id (persists while row exists). */
  const [fixtureScopeExpandedById, setFixtureScopeExpandedById] = useState<Record<string, boolean>>({})
  const jobTotalBidDollars = useMemo(() => revenueDollarsFromFixtures(fixtures), [fixtures])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const [contractorsSearch, setContractorsSearch] = useState('')
  const [contractorsDropdownOpen, setContractorsDropdownOpen] = useState(false)
  const contractorsDropdownRef = useRef<HTMLDivElement | null>(null)
  const billingCustomerHighlightRef = useRef<HTMLDivElement | null>(null)
  const fixturesSectionHighlightRef = useRef<HTMLDivElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [newInvoiceAmountInputFocused, setNewInvoiceAmountInputFocused] = useState(false)
  const [breakOffSliderDragCombinedPct, setBreakOffSliderDragCombinedPct] = useState<number | null>(null)
  const billingBreakOffTrackRef = useRef<HTMLDivElement | null>(null)
  const breakOffSliderPointerActiveRef = useRef(false)
  const breakOffSliderLastDragCombinedRef = useRef(0)
  const breakOffSliderLastPointerXRef = useRef(0)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [movingJobToReadyToBill, setMovingJobToReadyToBill] = useState(false)
  const [paymentRemoveConfirmRowId, setPaymentRemoveConfirmRowId] = useState<string | null>(null)
  const [unlinkMercuryConfirmRowId, setUnlinkMercuryConfirmRowId] = useState<string | null>(null)
  const [deleteJobConfirmOpen, setDeleteJobConfirmOpen] = useState(false)
  const [unlinkingMercuryPaymentId, setUnlinkingMercuryPaymentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [materialsAccordionOpen, setMaterialsAccordionOpen] = useState<MaterialsAccordionKey | null>('billed')
  const [jobMaterialsSnapshotLoading, setJobMaterialsSnapshotLoading] = useState(false)
  const [supplyInvoiceTotal, setSupplyInvoiceTotal] = useState(0)
  const [supplyInvoiceRpcFailed, setSupplyInvoiceRpcFailed] = useState(false)
  const [supplyInvoiceLines, setSupplyInvoiceLines] = useState<JobSupplyInvoiceLine[]>([])
  const [mercuryAllocLines, setMercuryAllocLines] = useState<JobMercuryAllocLine[]>([])
  const [mercuryFetchFailed, setMercuryFetchFailed] = useState(false)
  const [tallyPartLines, setTallyPartLines] = useState<JobTallyPartLine[]>([])
  const [tallyFetchFailed, setTallyFetchFailed] = useState(false)
  const [editJobTeamLaborLoading, setEditJobTeamLaborLoading] = useState(false)
  const [editJobTeamLaborRow, setEditJobTeamLaborRow] = useState<TeamLaborRow | null>(null)
  const [editJobTeamLaborError, setEditJobTeamLaborError] = useState(false)
  const [editJobSubLaborLoading, setEditJobSubLaborLoading] = useState(false)
  const [editJobSubLaborData, setEditJobSubLaborData] = useState<{ count: number; total: number } | null>(null)
  const [editJobSubLaborError, setEditJobSubLaborError] = useState(false)

  const editJobEffectiveHcp = useMemo(
    () => (hcpNumber ?? '').trim() || (editing?.hcp_number ?? '').trim(),
    [hcpNumber, editing?.hcp_number],
  )

  const canLinkTeamLaborOnJobs = useMemo(
    () => authRole !== 'assistant' && authRole !== 'superintendent' && authRole !== 'primary',
    [authRole],
  )

  const canLinkSubLaborOnJobs = useMemo(() => authRole !== 'primary', [authRole])

  const showTeamLaborOpenOnJobsLink = useMemo(
    () =>
      canLinkTeamLaborOnJobs &&
      !editJobTeamLaborLoading &&
      !editJobTeamLaborError &&
      editJobTeamLaborRow != null,
    [canLinkTeamLaborOnJobs, editJobTeamLaborLoading, editJobTeamLaborError, editJobTeamLaborRow],
  )

  const showSubLaborOpenOnJobsLink = useMemo(
    () =>
      canLinkSubLaborOnJobs &&
      !!editJobEffectiveHcp &&
      !editJobSubLaborLoading &&
      !editJobSubLaborError &&
      editJobSubLaborData != null &&
      editJobSubLaborData.count > 0,
    [
      canLinkSubLaborOnJobs,
      editJobEffectiveHcp,
      editJobSubLaborLoading,
      editJobSubLaborError,
      editJobSubLaborData,
    ],
  )

  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)
  const jobFormProjectSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormProjectSelectRef = useRef<HTMLSelectElement | null>(null)
  const jobFormProjectDisconnectRef = useRef<HTMLButtonElement | null>(null)
  const jobFormJobFilesSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormJobPlansSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormGoogleDriveInputRef = useRef<HTMLInputElement | null>(null)
  const jobFormJobPlansInputRef = useRef<HTMLInputElement | null>(null)
  const jobFormBidSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormBidDisconnectRef = useRef<HTMLButtonElement | null>(null)
  const jobFormBidLinkButtonRef = useRef<HTMLButtonElement | null>(null)

  function getCustomerDisplay(c: CustomerRow): string {
    if (c.address) return `${c.name} - ${c.address}`
    return c.name
  }

  function extractContactFromCustomer(c: CustomerRow): { phone: string; email: string } {
    const ci = c.contact_info
    if (ci == null || typeof ci !== 'object') return { phone: '', email: '' }
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }

  function customerListImpliesLinkedRow(customersList: CustomerRow[], jobMasterUserId: string, customerNameTrimmed: string): boolean {
    const nameKey = customerNameTrimmed.trim().toLowerCase()
    if (!nameKey) return false
    const byName = customersList.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
    const byMaster = byName.filter((c) => c.master_user_id === jobMasterUserId)
    if (byMaster.length === 1) return true
    if (byMaster.length === 0 && byName.length === 1) return true
    return false
  }

  function customerTypeShortLabel(c: CustomerRow): string | null {
    const t = c.customer_type
    if (t === 'residential' || t === 'commercial') return t.charAt(0).toUpperCase() + t.slice(1)
    if (t == null || t === '') return NO_CUSTOMER_TYPE_LABEL
    return t
  }

  function closeForm() {
    setJobProjectLinkChoiceOpen(false)
    setJobBidLinkChoiceOpen(false)
    setContractModalEstimateId(null)
    setCreateCustomerFromJobModalOpen(false)
    setBillViewInvoice(null)
    setBillingCustomerHighlight(false)
    setFixturesSectionHighlight(false)
    setNewInvoiceAmount('')
    setNewInvoiceAmountInputFocused(false)
    setPaymentRemoveConfirmRowId(null)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
    onClose()
  }

  function applyEditJob(job: JobWithDetails, billingGate: boolean, fixturesGate: boolean) {
    setPaymentRemoveConfirmRowId(null)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
    setBillViewInvoice(null)
    setBillingCustomerHighlight(billingGate)
    setFixturesSectionHighlight(fixturesGate)
    setEditing(job)
    setHcpNumber(job.hcp_number ?? '')
    setJobName(job.job_name ?? '')
    setJobAddress(job.job_address ?? '')
    setCustomerName(job.customer_name ?? '')
    setCustomerEmail(job.customer_email ?? '')
    setCustomerPhone(job.customer_phone ?? '')
    setCustomerId(job.customer_id ?? null)
    setProjectId(job.project_id ?? null)
    setBidId(job.bid_id ?? null)
    setLinkedBidSummary(
      job.bid_id && job.linkedBid
        ? { project_name: job.linkedBid.project_name, bid_number: job.linkedBid.bid_number }
        : job.bid_id
          ? { project_name: null, bid_number: null }
          : null,
    )
    setCustomerSearch('')
    setCustomerExpanded(billingGate && !jobLedgerHasCustomerForBilling(job.customer_id))
    setLastBillDate(job.last_bill_date ? job.last_bill_date.slice(0, 10) : '')
    setGoogleDriveLink(job.google_drive_link ?? '')
    setJobPlansLink(job.job_plans_link ?? '')
    setProjectFilesPlansExpanded(false)
    setPayments(
      job.payments?.length
        ? job.payments.map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
            note: p.note ?? null,
            payment_type: p.payment_type ?? null,
            reference_number: p.reference_number ?? null,
            invoice_id: p.invoice_id ?? null,
            mercury_transaction_id: p.mercury_transaction_id ?? null,
          }))
        : [newEmptyPaymentRow()],
    )
    setMaterials(
      job.materials.length > 0
        ? job.materials.map((m) => ({ id: m.id, description: m.description, amount: Number(m.amount) }))
        : [{ id: crypto.randomUUID(), description: '', amount: 0 }],
    )
    setFixtures(
      job.fixtures.length > 0
        ? job.fixtures.map((f) => ({
            id: f.id,
            name: f.name,
            count: Number(f.count) || 1,
            line_unit_price: f.line_unit_price != null && Number.isFinite(Number(f.line_unit_price)) ? Number(f.line_unit_price) : null,
            line_description: f.line_description ?? '',
          }))
        : [{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '' }],
    )
    setFixtureScopeExpandedById({})
    setTeamMemberIds(job.team_members.map((t) => t.user_id))
    setContractorsSearch('')
    setContractorsDropdownOpen(false)
    setNewInvoiceAmountInputFocused(false)
    setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(job))
  }

  function resetNewForm(projectPrefill: string | null) {
    setBillViewInvoice(null)
    setEditing(null)
    setHcpNumber('')
    setJobName('')
    setJobAddress('')
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerId(null)
    setProjectId(projectPrefill)
    setBidId(null)
    setLinkedBidSummary(null)
    setCustomerSearch('')
    setDateMet('')
    setCustomerExpanded(true)
    setLastBillDate('')
    setGoogleDriveLink('')
    setJobPlansLink('')
    setProjectFilesPlansExpanded(!!projectPrefill)
    setPayments([newEmptyPaymentRow()])
    setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
    setFixtures([{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '' }])
    setFixtureScopeExpandedById({})
    setTeamMemberIds([])
    setContractorsSearch('')
    setContractorsDropdownOpen(false)
    setBillingCustomerHighlight(false)
    setFixturesSectionHighlight(false)
    setSourceEstimateForJob(null)
    setContractModalEstimateId(null)
    setNewInvoiceAmount('')
    setNewInvoiceAmountInputFocused(false)
    setPaymentRemoveConfirmRowId(null)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
  }

  useLayoutEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      setCustomersLoading(true)
      try {
        async function loadFormUsers() {
          if (!authUser?.id) return
          const [usersRes, meRes] = await Promise.all([
            supabase.from('users').select('id, name, email, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator', 'primary', 'superintendent']).order('name'),
            supabase.from('users').select('role').eq('id', authUser.id).single(),
          ])
          let usersList = (usersRes.data as UserRow[]) ?? []
          const role = (meRes.data as { role?: string } | null)?.role
          if (role === 'dev') {
            const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
            if (devUsers?.length) {
              const existingIds = new Set(usersList.map((u) => u.id))
              const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
              usersList = [...usersList, ...newDevs]
            }
          }
          if (!cancelled) setUsers(usersList)
        }

        const [{ data: custData }, { data: projData }, { data: bidData }] = await Promise.all([
          supabase.from('customers').select('id, name, address, contact_info, date_met, master_user_id, customer_type').order('name'),
          supabase.from('projects').select('id, name, customer_id, master_user_id, customers(name)').order('name'),
          supabase
            .from('bids')
            .select('id, project_name, bid_number, customer_id, customers(name)')
            .order('updated_at', { ascending: false })
            .limit(800),
        ])
        if (cancelled) return
        setCustomers((custData as CustomerRow[]) ?? [])
        setProjects((projData as ProjectOption[]) ?? [])
        setBids((bidData as JobBidLinkOption[]) ?? [])
        await loadFormUsers()
        if (cancelled) return

        if (mode === 'new') {
          resetNewForm(newJobProjectId)
          if (newJobProjectId) {
            const { data: pdata } = await supabase.from('projects').select('customer_id, customers(name, address, contact_info, date_met)').eq('id', newJobProjectId).single()
            if (cancelled || !pdata) {
              setInitDone(true)
              return
            }
            if (pdata.customer_id) {
              setCustomerId(pdata.customer_id)
              const c = (pdata as { customers?: { name: string; address: string | null; contact_info: unknown; date_met: string | null } }).customers
              if (c) {
                setCustomerName(c.name ?? '')
                setJobAddress(c.address ?? '')
                setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
                const ci = c.contact_info as { phone?: string; email?: string } | null
                if (ci) {
                  setCustomerEmail(ci.email ?? '')
                  setCustomerPhone(ci.phone ?? '')
                }
              }
            }
          }
        } else {
          let job: JobWithDetails | null = null
          if (editJobId) {
            const fetched = await fetchJobWithDetailsById(editJobId)
            job = fetched ?? initialJob
          } else {
            job = initialJob
          }
          if (cancelled) return
          if (!job) {
            showToast('Job not found or you do not have access.', 'error')
            onClose()
            return
          }
          applyEditJob(job, billingCustomerHighlightInitial, fixturesSectionHighlightInitial)
          if (alsoOpenCreateCustomerModal && (job.customer_name ?? '').trim()) {
            setCreateCustomerFromJobType('residential')
            setCreateCustomerFromJobModalOpen(true)
          }
        }
        if (!cancelled) setInitDone(true)
      } finally {
        if (!cancelled) setCustomersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id])

  useEffect(() => {
    if (!bidId) return
    const b = bids.find((x) => x.id === bidId)
    if (!b) return
    setLinkedBidSummary((prev) => {
      const label = formatJobFormBidLinkTitle(prev)
      if (label && label !== 'Untitled') return prev
      return { project_name: b.project_name, bid_number: b.bid_number }
    })
  }, [bids, bidId])

  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      setSourceEstimateForJob(null)
      setSourceEstimateLoading(false)
      return
    }
    let cancelled = false
    setSourceEstimateLoading(true)
    void (async () => {
      try {
        const est = await withSupabaseRetry(
          async () =>
            await supabase.from('estimates').select('*').eq('job_ledger_id', jobId).maybeSingle(),
          'load source estimate for job',
        )
        if (cancelled) return
        setSourceEstimateForJob((est ?? null) as EstimatesRow | null)
      } catch {
        if (!cancelled) setSourceEstimateForJob(null)
      } finally {
        if (!cancelled) setSourceEstimateLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editing?.id])

  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      setJobMaterialsSnapshotLoading(false)
      setSupplyInvoiceTotal(0)
      setSupplyInvoiceRpcFailed(false)
      setSupplyInvoiceLines([])
      setMercuryAllocLines([])
      setMercuryFetchFailed(false)
      setTallyPartLines([])
      setTallyFetchFailed(false)
      setMaterialsAccordionOpen('billed')
      return
    }
    let cancelled = false
    setJobMaterialsSnapshotLoading(true)
    setMaterialsAccordionOpen('billed')
    setSupplyInvoiceRpcFailed(false)
    setMercuryFetchFailed(false)
    setTallyFetchFailed(false)

    void (async () => {
      try {
        const snap = await fetchJobMaterialsCostSnapshot(jobId)
        if (cancelled) return
        setSupplyInvoiceTotal(snap.supplyInvoiceTotal)
        setSupplyInvoiceRpcFailed(snap.supplyInvoiceRpcFailed)
        setSupplyInvoiceLines(snap.supplyInvoiceLines)
        setMercuryAllocLines(snap.mercuryAllocLines)
        setMercuryFetchFailed(snap.mercuryFetchFailed)
        setTallyPartLines(snap.tallyPartLines)
        setTallyFetchFailed(snap.tallyFetchFailed)
      } finally {
        if (!cancelled) setJobMaterialsSnapshotLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editing?.id])

  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      setEditJobTeamLaborLoading(false)
      setEditJobTeamLaborRow(null)
      setEditJobTeamLaborError(false)
      setEditJobSubLaborLoading(false)
      setEditJobSubLaborData(null)
      setEditJobSubLaborError(false)
      return
    }

    const effectiveHcp = (hcpNumber ?? '').trim() || (editing?.hcp_number ?? '').trim()
    let cancelled = false

    setEditJobTeamLaborLoading(true)
    setEditJobTeamLaborError(false)
    setEditJobTeamLaborRow(null)

    void (async () => {
      try {
        const teamRows = await withSupabaseRetry(
          async () => ({ data: await loadTeamLaborData(supabase), error: null }),
          'loadTeamLaborData edit job',
        )
        if (!cancelled) {
          setEditJobTeamLaborRow(teamRows.find((r) => r.jobId === jobId) ?? null)
        }
      } catch {
        if (!cancelled) {
          setEditJobTeamLaborRow(null)
          setEditJobTeamLaborError(true)
        }
      } finally {
        if (!cancelled) setEditJobTeamLaborLoading(false)
      }
    })()

    if (!effectiveHcp) {
      setEditJobSubLaborLoading(false)
      setEditJobSubLaborData(null)
      setEditJobSubLaborError(false)
    } else {
      setEditJobSubLaborLoading(true)
      setEditJobSubLaborError(false)
      setEditJobSubLaborData(null)

      void (async () => {
        try {
          const [laborRes, settingsRes] = await Promise.all([
            supabase.from('people_labor_jobs').select('id, job_number, labor_rate, distance_miles').order('created_at', { ascending: false }),
            supabase.from('app_settings').select('key, value_num').in('key', ['drive_mileage_cost', 'drive_time_per_mile']),
          ])
          if (cancelled) return
          if (laborRes.error) throw new Error(laborRes.error.message)

          const hcpLower = effectiveHcp.toLowerCase()
          type LaborJobLite = { id: string; job_number: string | null; labor_rate: number | null; distance_miles?: number | null }
          const laborJobsData = (laborRes.data ?? []) as LaborJobLite[]
          const matching = laborJobsData.filter((j) => (j.job_number ?? '').trim().toLowerCase() === hcpLower)
          const settingsRows = settingsRes.data ?? []
          const byKey = new Map(settingsRows.map((r: { key: string; value_num: number | null }) => [r.key, r.value_num]))
          const mileageCost = byKey.get('drive_mileage_cost') ?? 0.7
          const timePerMile = byKey.get('drive_time_per_mile') ?? 0.02

          let labor = 0
          const jobIds = matching.map((j) => j.id)
                   if (jobIds.length > 0) {
            const { data: items, error: itemsErr } = await supabase
              .from('people_labor_job_items')
              .select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
              .in('job_id', jobIds)
              .order('sequence_order', { ascending: true })
            if (itemsErr) throw new Error(itemsErr.message)
            type SubLaborItemRow = {
              count: number
              hrs_per_unit: number
              is_fixed?: boolean
              labor_rate?: number | null
              direct_labor_amount?: number | null
            }
            const itemsByJob = new Map<string, SubLaborItemRow[]>()
            for (const it of (items ?? []) as Array<{ job_id: string } & SubLaborItemRow>) {
              if (!itemsByJob.has(it.job_id)) itemsByJob.set(it.job_id, [])
              itemsByJob.get(it.job_id)!.push({
                count: it.count,
                hrs_per_unit: it.hrs_per_unit,
                is_fixed: it.is_fixed,
                labor_rate: it.labor_rate,
                direct_labor_amount: it.direct_labor_amount,
              })
            }
            for (const job of matching) {
              const jobRate = job.labor_rate ?? 0
              const lineTotal = laborItemsSubtotal(itemsByJob.get(job.id) ?? [], jobRate)
              const miles = Number(job.distance_miles) || 0
              const driveCost =
                miles > 0 && jobRate > 0 ? miles * mileageCost + miles * timePerMile * jobRate : miles > 0 ? miles * mileageCost : 0
              labor += lineTotal + driveCost
            }
          }
          if (!cancelled) setEditJobSubLaborData({ count: matching.length, total: labor })
        } catch {
          if (!cancelled) {
            setEditJobSubLaborData(null)
            setEditJobSubLaborError(true)
          }
        } finally {
          if (!cancelled) setEditJobSubLaborLoading(false)
        }
      })()
    }

    return () => {
      cancelled = true
    }
  }, [editing?.id, editing?.hcp_number, hcpNumber])

  useEffect(() => {
    if (customerId && billingCustomerHighlight) {
      setBillingCustomerHighlight(false)
    }
  }, [customerId, billingCustomerHighlight])

  useEffect(() => {
    if (!billingCustomerHighlight) return
    const id = requestAnimationFrame(() => {
      billingCustomerHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [billingCustomerHighlight])

  useEffect(() => {
    if (!fixturesSectionHighlight) return
    const id = requestAnimationFrame(() => {
      fixturesSectionHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => cancelAnimationFrame(id)
  }, [fixturesSectionHighlight])

  useEffect(() => {
    if (!fixturesSectionHighlight) return
    const t = window.setTimeout(() => setFixturesSectionHighlight(false), 2500)
    return () => window.clearTimeout(t)
  }, [fixturesSectionHighlight])

  useEffect(() => {
    if (customerId && customers.length > 0) {
      const c = customers.find((x) => x.id === customerId)
      if (c) {
        setCustomerSearch(getCustomerDisplay(c))
        setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
      }
    }
  }, [customerId, customers])

  useEffect(() => {
    if (!createCustomerFromJobModalOpen || !authUser?.id) return
    setCreateCustomerFromJobModalLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
        .order('name')
      const all = (data as CustomerRow[]) ?? []
      const name = customerName.trim()
      if (!name) {
        setSimilarCustomersForCreate([])
        setCreateCustomerFromJobModalLoading(false)
        return
      }
      const nameLower = name.toLowerCase()
      const withSimilarity = all
        .map((c) => ({ c, sim: nameSimilarity(name, c.name ?? '') }))
        .filter(({ c, sim }) => sim >= 0.7 || (c.name ?? '').toLowerCase().includes(nameLower) || nameLower.includes((c.name ?? '').toLowerCase()))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 10)
        .map(({ c }) => c)
      setSimilarCustomersForCreate(withSimilarity)
      setCreateCustomerFromJobModalLoading(false)
    })()
  }, [createCustomerFromJobModalOpen, authUser?.id, customerName])

  useEffect(() => {
    if (!contractorsDropdownOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (contractorsDropdownRef.current && !contractorsDropdownRef.current.contains(e.target as Node)) {
        setContractorsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contractorsDropdownOpen])

  const billedMaterialsTotalDisplay = useMemo(() => {
    const sum = materials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return formatCurrency(sum)
  }, [materials])

  const mercuryCardTotal = useMemo(
    () => mercuryAllocLines.reduce((s, l) => s + Math.abs(Number(l.allocationAmount)), 0),
    [mercuryAllocLines],
  )

  const tallyPartsTotal = useMemo(() => tallyPartLines.reduce((s, l) => s + l.lineTotal, 0), [tallyPartLines])

  const toggleMaterialsAccordion = useCallback((key: MaterialsAccordionKey) => {
    setMaterialsAccordionOpen((prev) => (prev === key ? null : key))
  }, [])

  const scrollToProjectSection = useCallback(() => {
    setProjectFilesPlansExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormProjectSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        if (projectId) {
          jobFormProjectDisconnectRef.current?.focus()
        } else {
          jobFormProjectSelectRef.current?.focus()
        }
      })
    })
  }, [projectId])

  const scrollToJobFilesSection = useCallback(() => {
    setProjectFilesPlansExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormJobFilesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        jobFormGoogleDriveInputRef.current?.focus()
      })
    })
  }, [])

  const scrollToJobPlansSection = useCallback(() => {
    setProjectFilesPlansExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormJobPlansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        jobFormJobPlansInputRef.current?.focus()
      })
    })
  }, [])

  const scrollToBidSection = useCallback(() => {
    setProjectFilesPlansExpanded(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        jobFormBidSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        if (bidId) {
          jobFormBidDisconnectRef.current?.focus()
        } else {
          jobFormBidLinkButtonRef.current?.focus()
        }
      })
    })
  }, [bidId])

  const projectFilesPlansJumpLinkStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    margin: 0,
    cursor: 'pointer',
    color: '#2563eb',
    font: 'inherit',
    fontWeight: 400,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  }

  const projectFilesPlansPlainSegmentStyle: CSSProperties = {
    fontWeight: 400,
    color: '#6b7280',
    fontSize: 'inherit',
  }

  const projectFilesPlansPipeStyle: CSSProperties = {
    color: '#9ca3af',
    userSelect: 'none',
    fontWeight: 400,
    fontSize: 'inherit',
  }

  const paymentRemovePreview = useMemo(() => {
    if (!paymentRemoveConfirmRowId) return null
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row) return null
    const rev = jobTotalBidDollars
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const currentRem = Math.max(0, rev - paidSum)
    const rowAmt = Number(row.amount) || 0
    const newRem = Math.max(0, rev - (paidSum - rowAmt))
    return { rowAmt, jobTotal: rev, currentRem, newRem }
  }, [paymentRemoveConfirmRowId, payments, jobTotalBidDollars])

  const isSendFullUnallocatedToReadyToBill = useMemo(() => {
    if (!editing || editing.status !== 'working') return false
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const remaining = unallocatedBillableDollars(jobTotalBidDollars, paidSum, editing.invoices)
    if (!(remaining > 0)) return false
    const amt = parseMoneyInputToNumber(newInvoiceAmount)
    return Math.round(amt * 100) === Math.round(remaining * 100)
  }, [editing, newInvoiceAmount, jobTotalBidDollars, payments])

  const breakOffBillingTrackPercents = useMemo(() => {
    const total = jobTotalBidDollars
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    if (!(total > 0)) {
      return { paidPct: 0, breakPreviewPct: 0, hasTotal: false as const }
    }
    const paidPct = Math.min(100, (paidSum / total) * 100)
    const rawBreak = Math.max(0, parseMoneyInputToNumber(newInvoiceAmount))
    const breakPreviewPctUncapped = (rawBreak / total) * 100
    const maxBreakPreview = Math.max(0, 100 - paidPct)
    const breakPreviewPct = Math.min(maxBreakPreview, breakPreviewPctUncapped)
    return { paidPct, breakPreviewPct, hasTotal: true as const }
  }, [jobTotalBidDollars, payments, newInvoiceAmount])

  const jobCompleteTrackPct = useMemo(() => {
    const raw = editing?.pct_complete
    if (raw == null) return null
    const n = Number(raw)
    if (!Number.isFinite(n)) return null
    return Math.min(100, Math.max(0, n))
  }, [editing?.pct_complete])

  const breakOffPaidSum = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  )
  const breakOffRemaining = useMemo(
    () => unallocatedBillableDollars(jobTotalBidDollars, breakOffPaidSum, editing?.invoices),
    [jobTotalBidDollars, breakOffPaidSum, editing?.invoices],
  )
  const breakOffCombinedSliderBounds = useMemo(() => {
    const total = jobTotalBidDollars
    if (!(total > 0)) return { min: 0, max: 0 }
    const min = Math.min(100, Math.max(0, (breakOffPaidSum / total) * 100))
    const max = Math.min(100, Math.max(min, ((breakOffPaidSum + breakOffRemaining) / total) * 100))
    return { min, max }
  }, [jobTotalBidDollars, breakOffPaidSum, breakOffRemaining])

  const breakOffDraftCoveragePctDisplay = useMemo(() => {
    const total = jobTotalBidDollars
    if (!(total > 0)) return null
    const b = parseMoneyInputToNumber(newInvoiceAmount)
    const pct = Math.min(100, Math.max(0, ((breakOffPaidSum + b) / total) * 100))
    return Math.round(pct)
  }, [jobTotalBidDollars, breakOffPaidSum, newInvoiceAmount])

  const breakOffCombinedHandlePct = useMemo(() => {
    const total = jobTotalBidDollars
    if (!(total > 0)) return 0
    const { min, max } = breakOffCombinedSliderBounds
    if (breakOffSliderDragCombinedPct != null) {
      return Math.min(100, Math.max(0, breakOffSliderDragCombinedPct))
    }
    const b = parseMoneyInputToNumber(newInvoiceAmount)
    const raw = Math.min(100, Math.max(0, ((breakOffPaidSum + b) / total) * 100))
    if (newInvoiceAmountInputFocused) {
      return Math.min(100, Math.max(0, raw))
    }
    return snapBreakOffCombinedPctToStep(raw, min, max)
  }, [
    jobTotalBidDollars,
    breakOffCombinedSliderBounds,
    breakOffPaidSum,
    newInvoiceAmount,
    newInvoiceAmountInputFocused,
    breakOffSliderDragCombinedPct,
  ])

  const breakOffCombinedThumbLeftPct = useMemo(() => {
    const { min, max } = breakOffCombinedSliderBounds
    return Math.min(max, Math.max(min, breakOffCombinedHandlePct))
  }, [breakOffCombinedSliderBounds, breakOffCombinedHandlePct])

  const seedBreakOffSliderFromPointerX = useCallback(
    (clientX: number) => {
      const el = billingBreakOffTrackRef.current
      const total = jobTotalBidDollars
      if (!el || !(total > 0)) return
      const rect = el.getBoundingClientRect()
      const w = rect.width || 1
      const { min, max } = breakOffCombinedSliderBounds
           const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / w))
      const unsnapped = Math.min(max, Math.max(min, min + ratio * (max - min)))
      breakOffSliderLastDragCombinedRef.current = unsnapped
      const combined = snapBreakOffCombinedPctToStep(unsnapped, min, max)
      setBreakOffSliderDragCombinedPct(combined)
      const bd = breakDollarsFromCombinedPct(combined, total, breakOffPaidSum, breakOffRemaining)
      setNewInvoiceAmount(String(bd))
    },
    [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining],
  )

  const endBreakOffSliderPointerGesture = useCallback(() => {
    if (!breakOffSliderPointerActiveRef.current) return
    breakOffSliderPointerActiveRef.current = false
    breakOffSliderLastPointerXRef.current = 0
    setBreakOffSliderDragCombinedPct(null)
    const total = jobTotalBidDollars
    if (!(total > 0)) return
    const prev = breakOffSliderLastDragCombinedRef.current
    const { min, max } = breakOffCombinedSliderBounds
    const snapped = snapBreakOffCombinedPctToStep(prev, min, max)
    const bd = breakDollarsFromCombinedPct(snapped, total, breakOffPaidSum, breakOffRemaining)
    setNewInvoiceAmount(String(bd))
    setNewInvoiceAmountInputFocused(false)
  }, [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining])

  const onBillingBreakOffTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      breakOffSliderPointerActiveRef.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      setNewInvoiceAmountInputFocused(false)
      seedBreakOffSliderFromPointerX(e.clientX)
      breakOffSliderLastPointerXRef.current = e.clientX
    },
    [seedBreakOffSliderFromPointerX],
  )

  const onBillingBreakOffTrackPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!breakOffSliderPointerActiveRef.current) return
      const el = billingBreakOffTrackRef.current
      const total = jobTotalBidDollars
      if (!el || !(total > 0)) return
      const rect = el.getBoundingClientRect()
      const w = rect.width || 1
      const { min, max } = breakOffCombinedSliderBounds
      const clientX = e.clientX
      const d = clientX - breakOffSliderLastPointerXRef.current
      breakOffSliderLastPointerXRef.current = clientX
      let next = breakOffSliderLastDragCombinedRef.current + (d / w) * 100
      next = Math.min(max, Math.max(min, next))
      breakOffSliderLastDragCombinedRef.current = next
      const snapped = snapBreakOffCombinedPctToStep(next, min, max)
      setBreakOffSliderDragCombinedPct(snapped)
      setNewInvoiceAmount(
        String(breakDollarsFromCombinedPct(snapped, total, breakOffPaidSum, breakOffRemaining)),
      )
    },
    [jobTotalBidDollars, breakOffCombinedSliderBounds, breakOffPaidSum, breakOffRemaining],
  )

  const onBillingBreakOffTrackPointerUpCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      endBreakOffSliderPointerGesture()
    },
    [endBreakOffSliderPointerGesture],
  )

  const onBillingBreakOffTrackLostPointerCapture = useCallback(() => {
    endBreakOffSliderPointerGesture()
  }, [endBreakOffSliderPointerGesture])

  const onBreakOffSliderKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (breakOffSliderDragCombinedPct != null) return
      const total = jobTotalBidDollars
      if (!(total > 0)) return
      const { min, max } = breakOffCombinedSliderBounds
      const curSnapped = snapBreakOffCombinedPctToStep(
        breakOffCombinedThumbLeftPct,
        min,
        max,
      )
      let next = curSnapped
      const step = BREAK_OFF_COMBINED_SLIDER_STEP_PCT
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        next = Math.min(max, curSnapped + step)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        next = Math.max(min, curSnapped - step)
      } else if (e.key === 'Home') {
        e.preventDefault()
        next = min
      } else if (e.key === 'End') {
        e.preventDefault()
        next = max
      } else {
        return
      }
      next = Math.min(max, Math.max(min, next))
      const bd = breakDollarsFromCombinedPct(next, total, breakOffPaidSum, breakOffRemaining)
      setNewInvoiceAmount(String(bd))
      setNewInvoiceAmountInputFocused(false)
    },
    [
      breakOffSliderDragCombinedPct,
      jobTotalBidDollars,
      breakOffCombinedSliderBounds,
      breakOffCombinedThumbLeftPct,
      breakOffPaidSum,
      breakOffRemaining,
    ],
  )

  function getEditJobBillableRemaining(): number {
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return unallocatedBillableDollars(jobTotalBidDollars, paidSum, editing?.invoices)
  }

  async function moveWorkingJobToReadyToBillFromEdit() {
    if (!editing || editing.status !== 'working') return
    const remaining = getEditJobBillableRemaining()
    const amount = parseMoneyInputToNumber(newInvoiceAmount)
    if (!(remaining > 0) || Math.round(amount * 100) !== Math.round(remaining * 100)) {
      setError('Enter the full unallocated amount to move this job to Ready to Bill.')
      return
    }
    setMovingJobToReadyToBill(true)
    setError(null)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        setError('Not signed in')
        return
      }
      const prep = await prepareBilledInvoicesBeforeJobRevertToReadyToBill({
        jobId: editing.id,
        authRole: authRole ?? null,
        accessToken: token,
      })
      if (!prep.ok) {
        setError(prep.message)
        return
      }
      const data = await withSupabaseRetry(
        async () => supabase.rpc('update_job_status', { p_job_id: editing.id, p_to_status: 'ready_to_bill' }),
        'update_job_status working to ready_to_bill from edit job',
      )
      const result = data as { error?: string } | null
      if (result?.error) {
        setError(result.error)
        return
      }
      showToast('Job moved to Ready to Bill', 'success')
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmountInputFocused(false)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
      }
      onSavedRef.current?.()
    } catch (e: unknown) {
      const errObj = e as { message?: string }
      setError(errObj?.message ?? 'Failed to update job status')
    } finally {
      setMovingJobToReadyToBill(false)
    }
  }

  async function createInvoice() {
    if (!editing) return
    const amount = parseMoneyInputToNumber(newInvoiceAmount)
    if (!(amount > 0)) {
      setError('Enter a valid amount greater than 0')
      return
    }
    const remaining = getEditJobBillableRemaining()
    const amountToUseCents = Math.min(Math.round(amount * 100), Math.round(remaining * 100))
    const amountToUse = amountToUseCents / 100
    if (!(amountToUse > 0)) {
      setError('No remaining balance to bill')
      return
    }
    if (amountToUseCents < Math.round(amount * 100)) {
      showToast(`Adjusted to remaining unallocated ($${formatCurrency(amountToUse)})`, 'info')
      setNewInvoiceAmount(String(amountToUse))
    }
    if (editing.status === 'ready_to_bill' && Math.round(amountToUse * 100) === Math.round(remaining * 100)) {
      if (!jobLedgerHasCustomerForBilling(editing.customer_id)) {
        showToast('Link this job to a customer before billing.', 'error')
        return
      }
      const jobId = editing.id
      const ctx: JobBillingContext = {
        id: editing.id,
        master_user_id: editing.master_user_id,
        hcp_number: editing.hcp_number,
        job_name: editing.job_name,
        customer_id: editing.customer_id,
        customer_name: editing.customer_name,
        customer_email: editing.customer_email,
        job_address: editing.job_address,
        customer_phone: editing.customer_phone,
        last_work_date: editing.last_work_date,
      }
      billCustomer?.openBillCustomer({
        payload: { kind: 'job', job: ctx },
        onSuccess: async () => {
          onSavedRef.current?.()
          const found = await fetchJobWithDetailsById(jobId)
          if (found) setEditing(found)
        },
        onAfterEnsureSuccess: async () => {
          const found = await fetchJobWithDetailsById(jobId)
          if (found) setEditing(found)
        },
      })
      return
    }
    setCreatingInvoice(true)
    setError(null)
    try {
      const nextOrder = (editing.invoices ?? []).length
      const estBill = editing.last_bill_date?.trim().slice(0, 10) ?? null
      const { error: err } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: editing.id,
          amount: amountToUse,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: estBill,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (err) throw err
      if (editing.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: editing.id,
            }),
          'ensure RTB remainder after partial invoice'
        )
        const obj = raw as Record<string, unknown> | null
        if (obj && typeof obj.error === 'string' && obj.error.length > 0) {
          throw new Error(obj.error)
        }
      }
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmountInputFocused(false)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
      } else {
        setNewInvoiceAmount('')
        setNewInvoiceAmountInputFocused(false)
      }
      onSavedRef.current?.()
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingInvoice(false)
    }
  }

  function addMaterialRow() {
    setMaterials((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, newEmptyPaymentRow()])
  }

  function updatePaymentRow(id: string, updates: Partial<PaymentRow>) {
    setPayments((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const merged = { ...r, ...updates }
        if (stripeBillInvoiceForPaymentRow(r, editing) || mercuryLinkedPaymentRow(r)) {
          merged.amount = r.amount
          merged.paid_on = r.paid_on
          merged.mercury_transaction_id = r.mercury_transaction_id
          merged.invoice_id = r.invoice_id
        }
        return merged
      }),
    )
  }

  function removePaymentRow(id: string) {
    setPayments((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  function requestRemovePaymentRow(row: PaymentRow) {
    if (mercuryLinkedPaymentRow(row)) {
      showToast('This payment is linked to a bank transaction. Remove it from Jobs Stages → Bank Payments workflow if needed.', 'error')
      return
    }
    if (paymentRowLinkedToInvoice(row)) {
      showToast(
        'This payment is linked to an invoice and can’t be removed in Edit Job. Change it from Outstanding billing or the mark-paid flow.',
        'error',
      )
      return
    }
    if (payments.length <= 1) {
      showToast(
        'At least one payment line must stay in this form. Add another line first, or set this row’s amount to $0 if you don’t need a payment here.',
        'info',
      )
      return
    }
    setPaymentRemoveConfirmRowId(row.id)
  }

  function confirmRemovePaymentRow() {
    if (!paymentRemoveConfirmRowId) return
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row || payments.length <= 1 || paymentRowLinkedToInvoice(row) || mercuryLinkedPaymentRow(row)) {
      setPaymentRemoveConfirmRowId(null)
      return
    }
    removePaymentRow(paymentRemoveConfirmRowId)
    setPaymentRemoveConfirmRowId(null)
  }

  const executeUnlinkMercuryFromBankRow = useCallback(
    async (row: PaymentRow) => {
      const jobId = editing?.id
      if (!jobId || !mercuryLinkedPaymentRow(row) || !canUnlinkMercuryPayment(authRole)) {
        setUnlinkMercuryConfirmRowId(null)
        return
      }
      if (paymentRowLinkedToInvoice(row)) {
        showToast(
          'This payment is linked to an invoice and can’t be removed in Edit Job. Change it from Outstanding billing or the mark-paid flow.',
          'error',
        )
        setUnlinkMercuryConfirmRowId(null)
        return
      }
      const remaining = payments.filter((r) => r.id !== row.id)
      const paymentsMadeNum = remaining.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      setUnlinkingMercuryPaymentId(row.id)
      try {
        await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger_payments').delete().eq('id', row.id).eq('job_id', jobId),
          'jobs_ledger_payments_delete_mercury_row',
        )
        await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger').update({ payments_made: paymentsMadeNum }).eq('id', jobId),
          'jobs_ledger_update_payments_made_after_delete',
        )
        setPayments(remaining.length > 0 ? remaining : [newEmptyPaymentRow()])
        let refreshed = await fetchJobWithDetailsById(jobId)
        if (refreshed) setEditing(refreshed)

        const rev = Number(refreshed?.revenue) || 0
        const pm = Number(refreshed?.payments_made) || 0
        const shouldMoveToBilled =
          normalizeJobsLedgerStatus(refreshed?.status) === 'paid' && rev > pm + 0.01

        if (shouldMoveToBilled) {
          try {
            const data = await withSupabaseRetry(
              async () =>
                supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: 'billed' }),
              'update_job_status_unlink_mercury',
            )
            const result = data as { error?: string } | null
            if (result?.error) {
              showToast(
                `Payment removed, but the job could not be moved back to Billed: ${result.error}`,
                'error',
              )
            } else {
              refreshed = await fetchJobWithDetailsById(jobId)
              if (refreshed) setEditing(refreshed)
              showToast('Payment removed from job. Job moved back to Billed.', 'success')
            }
          } catch (e: unknown) {
            showToast(
              formatPostgrestOrUnknownError(e, 'Payment removed but failed to move job to Billed'),
              'error',
            )
          }
        } else {
          showToast(
            'Payment removed from job. The bank deposit is available in Accounts Receivable again.',
            'success',
          )
        }
        onSavedRef.current?.()
      } catch (e: unknown) {
        showToast(formatPostgrestOrUnknownError(e, 'Failed to remove payment and unlink bank'), 'error')
      } finally {
        setUnlinkingMercuryPaymentId(null)
        setUnlinkMercuryConfirmRowId(null)
      }
    },
    [editing?.id, authRole, showToast, payments],
  )

  function confirmUnlinkMercuryFromBankRow() {
    if (!unlinkMercuryConfirmRowId) return
    const row = payments.find((r) => r.id === unlinkMercuryConfirmRowId)
    if (!row || !mercuryLinkedPaymentRow(row) || !canUnlinkMercuryPayment(authRole)) {
      setUnlinkMercuryConfirmRowId(null)
      return
    }
    void executeUnlinkMercuryFromBankRow(row)
  }

  function updateMaterialRow(id: string, updates: Partial<MaterialRow>) {
    setMaterials((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function removeMaterialRow(id: string) {
    setMaterials((prev) => {
      if (prev.length > 1) {
        return prev.filter((r) => r.id !== id)
      }
      if (prev.length === 1 && prev[0]?.id === id) {
        const r = prev[0]
        return [{ ...r, description: '', amount: 0 }]
      }
      return prev
    })
  }

  function addFixtureRow() {
    setFixtures((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '' },
    ])
  }

  function updateFixtureRow(id: string, updates: Partial<FixtureRow>) {
    setFixtures((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function removeFixtureRow(id: string) {
    setFixtureScopeExpandedById((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setFixtures((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)))
  }

  async function handleCreateCustomerFromJob(customerType: 'residential' | 'commercial') {
    if (!authUser?.id) return
    const name = customerName.trim()
    if (!name) {
      showToast('Enter customer name first', 'error')
      return
    }
    setCreatingCustomerFromJob(true)
    setError(null)
    try {
      const contactInfo = (customerEmail.trim() || customerPhone.trim())
        ? { phone: customerPhone.trim() || null, email: customerEmail.trim() || null }
        : null
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          name,
          address: jobAddress.trim() || null,
          contact_info: contactInfo,
          customer_type: customerType,
          date_met: dateMet.trim() || null,
          master_user_id: authUser.id,
        })
        .select('id')
        .single()
      if (custErr) throw custErr
      const cid = (newCustomer as { id: string })?.id
      if (!cid) throw new Error('Failed to create customer')
      setCustomerId(cid)
      const c = { id: cid, name, address: jobAddress.trim() || null, contact_info: contactInfo, date_met: dateMet.trim() || null } as CustomerRow
      setCustomers((prev) => [...prev.filter((x) => x.id !== cid), c].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      setCustomerSearch(getCustomerDisplay(c))
      if (editing) {
        const { error: updErr } = await supabase.from('jobs_ledger').update({ customer_id: cid }).eq('id', editing.id)
        if (updErr) throw updErr
        const found = await fetchJobWithDetailsById(editing.id)
        if (found) setEditing(found)
        onSavedRef.current?.()
      }
      setCreateCustomerFromJobModalOpen(false)
      showToast('Customer created and linked', 'success')
    } catch (err: unknown) {
      console.error('JobFormModal create customer failed', err)
      const msg = formatPostgrestOrUnknownError(err, 'Failed to create customer')
      setError(msg)
      showToast(msg.split('\n')[0] ?? msg, 'error')
    } finally {
      setCreatingCustomerFromJob(false)
    }
  }

  async function handleLinkToSimilarCustomer(c: CustomerRow) {
    setCustomerId(c.id)
    setCustomerSearch(getCustomerDisplay(c))
    setCustomerName(c.name ?? '')
    setCustomerEmail(extractContactFromCustomer(c).email)
    setCustomerPhone(extractContactFromCustomer(c).phone)
    setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
    if (!jobAddress.trim()) setJobAddress(c.address ?? '')
    setCustomers((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev
      return [...prev, c].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    })
    if (editing) {
      const { error: updErr } = await supabase.from('jobs_ledger').update({ customer_id: c.id }).eq('id', editing.id)
      if (updErr) {
        const m = formatPostgrestOrUnknownError(updErr, updErr.message || 'Failed to link customer')
        showToast(m.split('\n')[0] ?? m, 'error')
        return
      }
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
    }
    setCreateCustomerFromJobModalOpen(false)
    showToast('Linked to existing customer', 'success')
  }

  async function handleCustomerImport() {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      if (!trimmed) {
        showToast('Clipboard is empty', 'error')
        return
      }
      const { name, address, email, phone } = parseCustomerImport(trimmed)
      if (name) setCustomerName(name)
      if (address) setJobAddress(address)
      if (email) setCustomerEmail(email)
      if (phone) setCustomerPhone(phone)
      const filled = [name, address, email, phone].filter(Boolean).length
      showToast(
        filled > 0 ? `Imported ${filled} field(s) from clipboard` : 'No recognizable fields in clipboard',
        filled > 0 ? 'success' : 'error',
      )
    } catch {
      showToast('Could not read clipboard', 'error')
    }
  }

  async function saveJob() {
    if (!authUser?.id) return
    setSaving(true)
    setError(null)
    const revNum = jobTotalBidDollars
    const paymentsMadeNum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const validPayments = payments.filter((p) => (Number(p.amount) || 0) > 0)
    const validMaterials = materials.filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    try {
      if (editing) {
        const proj = projectId ? projects.find((p) => p.id === projectId) : null
        const jobMasterForCustomer = projectId && proj ? proj.master_user_id : editing.master_user_id
        const resolvedCustomerId = resolveCustomerIdForJobPayload(
          customerId,
          jobMasterForCustomer,
          customerName.trim(),
          customers,
        )
        const masterUserIdForUpdate =
          projectId && proj
            ? proj.master_user_id
            : await resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId)
        const updatePayload = {
          hcp_number: hcpNumber.trim(),
          job_name: jobName.trim(),
          job_address: jobAddress.trim(),
          customer_id: resolvedCustomerId,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          last_bill_date: lastBillDate.trim() || null,
          google_drive_link: googleDriveLink.trim() || null,
          job_plans_link: jobPlansLink.trim() || null,
          revenue: revNum,
          payments_made: paymentsMadeNum,
          project_id: projectId || null,
          bid_id: bidId || null,
          master_user_id: masterUserIdForUpdate,
        }
        const { error: updateErr } = await supabase
          .from('jobs_ledger')
          .update(updatePayload)
          .eq('id', editing.id)
        if (updateErr) throw updateErr
        await supabase.from('jobs_ledger_payments').delete().eq('job_id', editing.id)
        for (const [i, p] of validPayments.entries()) {
          await supabase.from('jobs_ledger_payments').insert({
            job_id: editing.id,
            amount: Number(p.amount) || 0,
            sequence_order: i,
            paid_on: p.paid_on?.trim() ? p.paid_on.trim() : null,
            note: p.note?.trim() ? p.note.trim() : null,
            payment_type: p.payment_type?.trim() ? p.payment_type.trim() : null,
            reference_number: p.reference_number?.trim() ? p.reference_number.trim() : null,
            invoice_id: p.invoice_id,
            mercury_transaction_id: p.mercury_transaction_id,
          })
        }
        await supabase.from('jobs_ledger_materials').delete().eq('job_id', editing.id)
        for (const [i, m] of validMaterials.entries()) {
          await supabase.from('jobs_ledger_materials').insert({
            job_id: editing.id,
            description: m.description.trim(),
            amount: m.amount,
            sequence_order: i,
          })
        }
        await supabase.from('jobs_ledger_fixtures').delete().eq('job_id', editing.id)
        const validFixtures = fixtures.filter((f) => (f.name ?? '').trim())
        for (const [i, f] of validFixtures.entries()) {
          const unit = f.line_unit_price
          await supabase.from('jobs_ledger_fixtures').insert({
            job_id: editing.id,
            name: f.name.trim(),
            count: f.count,
            sequence_order: i,
            line_unit_price: unit != null && unit > 0 ? unit : null,
            line_description: (f.line_description ?? '').trim() ? (f.line_description ?? '').trim() : null,
          })
        }
        const { data: existingTeam } = await supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', editing.id)
        const existingTeamIds = new Set((existingTeam ?? []).map((t: { user_id: string }) => t.user_id))
        const toAdd = teamMemberIds.filter((id) => !existingTeamIds.has(id))
        const toRemove = [...existingTeamIds].filter((id) => !teamMemberIds.includes(id))
        for (const uid of toAdd) {
          await supabase.from('jobs_ledger_team_members').insert({ job_id: editing.id, user_id: uid })
        }
        for (const uid of toRemove) {
          await supabase.from('jobs_ledger_team_members').delete().eq('job_id', editing.id).eq('user_id', uid)
        }
      } else {
        const effectiveMasterId = await resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId || null)

        const resolvedCustomerIdNew = resolveCustomerIdForJobPayload(
          customerId,
          effectiveMasterId,
          customerName.trim(),
          customers,
        )
        const { data: inserted, error: insertErr } = await supabase
          .from('jobs_ledger')
          .insert({
            master_user_id: effectiveMasterId,
            hcp_number: hcpNumber.trim(),
            job_name: jobName.trim(),
            job_address: jobAddress.trim(),
            customer_id: resolvedCustomerIdNew,
            customer_name: customerName.trim() || null,
            customer_email: customerEmail.trim() || null,
            customer_phone: customerPhone.trim() || null,
            last_bill_date: lastBillDate.trim() || null,
            google_drive_link: googleDriveLink.trim() || null,
            job_plans_link: jobPlansLink.trim() || null,
            revenue: revNum,
            payments_made: paymentsMadeNum,
            project_id: projectId || null,
            bid_id: bidId || null,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        const jobId = inserted?.id
        if (jobId) {
          for (const [i, p] of validPayments.entries()) {
            await supabase.from('jobs_ledger_payments').insert({
              job_id: jobId,
              amount: Number(p.amount) || 0,
              sequence_order: i,
              paid_on: p.paid_on?.trim() ? p.paid_on.trim() : null,
              note: p.note?.trim() ? p.note.trim() : null,
              payment_type: p.payment_type?.trim() ? p.payment_type.trim() : null,
              reference_number: p.reference_number?.trim() ? p.reference_number.trim() : null,
              invoice_id: p.invoice_id,
              mercury_transaction_id: p.mercury_transaction_id,
            })
          }
          for (const [i, m] of validMaterials.entries()) {
            await supabase.from('jobs_ledger_materials').insert({
              job_id: jobId,
              description: m.description.trim(),
              amount: m.amount,
              sequence_order: i,
            })
          }
          const validFixturesIns = fixtures.filter((f) => (f.name ?? '').trim())
          for (const [i, f] of validFixturesIns.entries()) {
            const unit = f.line_unit_price
            await supabase.from('jobs_ledger_fixtures').insert({
              job_id: jobId,
              name: f.name.trim(),
              count: f.count,
              sequence_order: i,
              line_unit_price: unit != null && unit > 0 ? unit : null,
              line_description: (f.line_description ?? '').trim() ? (f.line_description ?? '').trim() : null,
            })
          }
          for (const uid of teamMemberIds) {
            await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
          }
          onCreatedJobIdRef.current?.(jobId)
        }
      }
      if (customerId && dateMet.trim()) {
        const c = customers.find((x) => x.id === customerId)
        if (c && !c.date_met) {
          await supabase.from('customers').update({ date_met: dateMet.trim() }).eq('id', customerId)
        }
      }
      closeForm()
      onSavedRef.current?.()
    } catch (err: unknown) {
      console.error('JobFormModal saveJob failed', err)
      setError(formatPostgrestOrUnknownError(err, 'Failed to save job'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteJob(id: string): Promise<boolean> {
    setDeletingId(id)
    const { error: err } = await supabase.from('jobs_ledger').delete().eq('id', id)
    if (err) {
      console.error('JobFormModal deleteJob failed', err)
      setError(formatPostgrestOrUnknownError(err, err.message || 'Failed to delete job'))
      setDeletingId(null)
      return false
    }
    onSavedRef.current?.()
    closeForm()
    setDeletingId(null)
    return true
  }

  async function confirmDeleteJob() {
    if (!editing) return
    await deleteJob(editing.id)
  }

  if (!initDone) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: JOB_FORM_OVERLAY_Z_INDEX,
        }}
      >
        <div style={{ background: 'white', padding: '1.25rem 1.5rem', borderRadius: 8, fontSize: '0.9375rem' }}>Loading…</div>
      </div>
    )
  }

  return (
    <>

    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: JOB_FORM_OVERLAY_Z_INDEX,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && closeForm()}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{editing ? 'Edit Job' : 'New Job'}</h2>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.25rem',
              justifyContent: 'flex-end',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: '#6b7280', userSelect: 'none' }}>Link to:</span>
            {bidId ? (
              <Link
                to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
                aria-label="Open linked bid"
                style={{
                  padding: '0.25rem 0.5rem',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontWeight: 500,
                  display: 'inline-block',
                }}
              >
                Bid
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setJobBidLinkChoiceOpen(true)}
                aria-label="Choose bid to link"
                style={{
                  color: '#2563eb',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  padding: '0.25rem 0.35rem',
                  cursor: 'pointer',
                  font: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Bid
              </button>
            )}
            <span style={{ color: '#9ca3af', userSelect: 'none' }} aria-hidden>
              |
            </span>
            {projectId ? (
              <Link
                to={`/workflows/${projectId}`}
                aria-label="Open linked project workflow"
                style={{
                  padding: '0.25rem 0.5rem',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  borderRadius: 4,
                  textDecoration: 'none',
                  fontWeight: 500,
                  display: 'inline-block',
                }}
              >
                Project
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setJobProjectLinkChoiceOpen(true)}
                aria-label="Choose project to link"
                style={{
                  color: '#2563eb',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  padding: '0.25rem 0.35rem',
                  cursor: 'pointer',
                  font: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Project
              </button>
            )}
          </div>
        </div>
        {editing && sourceEstimateLoading ? (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>Checking for linked estimate…</p>
        ) : null}
        {editing && !sourceEstimateLoading && sourceEstimateForJob ? (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.6rem 0.75rem',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 6,
              fontSize: '0.875rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <span>
              <strong>Source estimate:</strong>{' '}
              <Link
                to={`/estimates/${sourceEstimateForJob.estimate_number}`}
                style={{ color: '#15803d', fontWeight: 600 }}
              >
                #{sourceEstimateForJob.estimate_number}
              </Link>
              {sourceEstimateForJob.title?.trim() ? ` · ${sourceEstimateForJob.title.trim()}` : null}
            </span>
            <button
              type="button"
              onClick={() => setContractModalEstimateId(sourceEstimateForJob.id)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.8rem',
                background: 'white',
                border: '1px solid #86efac',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              View contract &amp; acceptance
            </button>
          </div>
        ) : null}
        {error && (
          <p
            style={{
              color: '#b91c1c',
              marginBottom: '0.75rem',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 110px', minWidth: 110 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>HCP</label>
              <input
                type="text"
                value={hcpNumber}
                onChange={(e) => setHcpNumber(e.target.value)}
                placeholder="HCP number"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name <span style={{ color: '#b91c1c' }}>*</span></label>
              <div style={{ ...JOB_FIELD_CLIPBOARD_WRAPPER_STYLE, position: 'relative' }}>
                <input
                  ref={jobNameInputRef}
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Job name"
                  style={JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE}
                />
                <button
                  type="button"
                  onClick={() => void pasteTextToField(jobNameInputRef, setJobName)}
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.25rem 0.4rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={jobName.trim() ? 'Replace with clipboard' : 'Paste from clipboard'}
                  aria-label={jobName.trim() ? 'Replace job name with clipboard' : 'Paste job name from clipboard'}
                >
                  <ClipboardPasteGlyph />
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 auto', minWidth: 140 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Last manual bill date</label>
              <input
                type="date"
                value={lastBillDate}
                onChange={(e) => setLastBillDate(e.target.value)}
                style={{ width: '100%', minWidth: 140, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address <span style={{ color: '#b91c1c' }}>*</span></label>
              <div style={{ ...JOB_FIELD_CLIPBOARD_WRAPPER_STYLE, position: 'relative' }}>
                <input
                  ref={jobAddressInputRef}
                  type="text"
                  value={jobAddress}
                  onChange={(e) => setJobAddress(e.target.value)}
                  placeholder="Address"
                  style={JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE}
                />
                <button
                  type="button"
                  onClick={() => void pasteTextToField(jobAddressInputRef, setJobAddress)}
                  style={{
                    position: 'absolute',
                    right: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0.25rem 0.4rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={jobAddress.trim() ? 'Replace with clipboard' : 'Paste from clipboard'}
                  aria-label={jobAddress.trim() ? 'Replace job address with clipboard' : 'Paste job address from clipboard'}
                >
                  <ClipboardPasteGlyph />
                </button>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: teamMemberIds.length > 0 ? '0.5rem' : 0,
              }}
            >
              <div ref={contractorsDropdownRef} style={{ position: 'relative', flex: '1 1 12rem', minWidth: 0 }}>
                <input
                  type="text"
                  value={contractorsSearch}
                  onChange={(e) => setContractorsSearch(e.target.value)}
                  onFocus={() => setContractorsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setContractorsDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setContractorsDropdownOpen(false)
                    if (e.key === 'Enter') {
                      const filtered = users.filter((u) => !teamMemberIds.includes(u.id) && u.name.toLowerCase().includes(contractorsSearch.toLowerCase().trim()))
                      const first = filtered[0]
                      if (first) {
                        e.preventDefault()
                        setTeamMemberIds((prev) => [...prev, first.id])
                        setContractorsSearch('')
                      }
                    }
                  }}
                  placeholder="Add People..."
                  style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                />
                {contractorsDropdownOpen && (() => {
                  const filtered = users.filter((u) => !teamMemberIds.includes(u.id) && u.name.toLowerCase().includes(contractorsSearch.toLowerCase().trim()))
                  if (filtered.length === 0 && !contractorsSearch.trim()) return null
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        marginTop: 2,
                        maxHeight: 200,
                        overflowY: 'auto',
                        zIndex: 9999,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      {filtered.length > 0 ? (
                        filtered.map((u, idx) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setTeamMemberIds((prev) => [...prev, u.id])
                              setContractorsSearch('')
                            }}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem',
                              textAlign: 'left',
                              background: 'white',
                              border: 'none',
                              borderBottom: idx < filtered.length - 1 ? '1px solid #e5e7eb' : 'none',
                              cursor: 'pointer',
                              color: '#111827',
                              fontSize: '0.875rem',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                          >
                            {u.name}
                          </button>
                        ))
                      ) : (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                          No matches
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            {teamMemberIds.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {teamMemberIds.map((id) => {
                  const u = users.find((x) => x.id === id)
                  return (
                    <span
                      key={id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        background: '#eff6ff',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                      }}
                    >
                      {u?.name ?? id}
                      <button
                        type="button"
                        onClick={() => setTeamMemberIds((prev) => prev.filter((x) => x !== id))}
                        title="Remove"
                        style={{
                          padding: 0,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: '#6b7280',
                          fontSize: '0.875rem',
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: customerExpanded ? '0.5rem' : 0 }}>
              <button
                type="button"
                aria-expanded={customerExpanded}
                onClick={() => setCustomerExpanded((p) => !p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 'inherit',
                  color: 'inherit',
                  flex: 1,
                  textAlign: 'left',
                  minWidth: 0,
                }}
              >
                {/* Match Project | Files | Plans | Bid row: fixed chevron slot + same gap as job-form-project-files-plans-trigger */}
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '1.25rem',
                    flexShrink: 0,
                  }}
                >
                  {customerExpanded ? '\u25BC' : '\u25B6'}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', minWidth: 0 }}>
                  Customer: {customerName.trim() || customerEmail.trim() || customerPhone.trim() ? (customerName.trim() || '—') : '—'}
                  {(() => {
                    const projRow = projectId ? projects.find((p) => p.id === projectId) : undefined
                    const masterForFormCustomer =
                      projRow?.master_user_id ?? editing?.master_user_id ?? authUser?.id ?? ''
                    const showFormNotInCustomers =
                      !!(customerName.trim() || customerEmail.trim() || customerPhone.trim()) &&
                      !customerId &&
                      !customerListImpliesLinkedRow(customers, masterForFormCustomer, customerName)
                    return showFormNotInCustomers ? (
                      <span
                        style={{
                          padding: '0.15rem 0.4rem',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: 4,
                        }}
                      >
                        Not in Customers
                      </span>
                    ) : null
                  })()}
                </span>
              </button>
              {customerExpanded && (
                <button
                  type="button"
                  onClick={handleCustomerImport}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    background: '#f9fafb',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Import
                </button>
              )}
            </div>
            {customerExpanded && (
              <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}>
                <div
                  ref={billingCustomerHighlightRef}
                  style={{
                    marginBottom: '0.75rem',
                    position: 'relative',
                    ...(billingCustomerHighlight
                      ? {
                          padding: '0.75rem',
                          borderRadius: 8,
                          background: '#fef2f2',
                          border: '2px solid #fecaca',
                        }
                      : {}),
                  }}
                >
                  {billingCustomerHighlight ? (
                    <p
                      role="status"
                      aria-live="polite"
                      style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#991b1c' }}
                    >
                      Link a customer before sending this invoice.
                    </p>
                  ) : null}
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Link to customer</label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      const value = e.target.value
                      setCustomerSearch(value)
                      setCustomerDropdownOpen(true)
                      if (customerId) {
                        const selected = customers.find((c) => c.id === customerId)
                        if (!selected || !value || getCustomerDisplay(selected).toLowerCase() !== value.toLowerCase()) {
                          setCustomerId(null)
                        }
                      }
                    }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 200)}
                    placeholder="Search customers (residential & commercial)…"
                    aria-label="Search customers to link, residential and commercial"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                  {customerDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        maxHeight: 180,
                        overflowY: 'auto',
                        zIndex: 100,
                        marginTop: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {customersLoading ? (
                        <div style={{ padding: '0.5rem', color: '#6b7280' }}>Loading…</div>
                      ) : (
                        (() => {
                          const q = customerSearch.toLowerCase()
                          const filtered = customers.filter((c) =>
                            (c.name || '').toLowerCase().includes(q) || (c.address || '').toLowerCase().includes(q)
                          )
                          return (
                            <>
                              {filtered.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setCustomerId(c.id)
                                setCustomerSearch(getCustomerDisplay(c))
                                setCustomerName(c.name)
                                setCustomerEmail(extractContactFromCustomer(c).email)
                                setCustomerPhone(extractContactFromCustomer(c).phone)
                                setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
                                if (!jobAddress.trim()) setJobAddress(c.address ?? '')
                                setCustomerDropdownOpen(false)
                              }}
                              style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 500 }}>{c.name}</span>
                                <span style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 500 }}>
                                  {customerTypeShortLabel(c)}
                                </span>
                              </div>
                              {c.address && <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                            </div>
                              ))}
                              {filtered.length === 0 && (
                                <div style={{ padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>No customers found</div>
                              )}
                            </>
                          )
                        })()
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {!customerId && (
                      <button
                        type="button"
                        disabled={!customerName.trim()}
                        onClick={() => setCreateCustomerFromJobModalOpen(true)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #d1d5db',
                          background: !customerName.trim() ? '#f3f4f6' : '#f9fafb',
                          borderRadius: 4,
                          cursor: !customerName.trim() ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Create customer from job
                      </button>
                    )}
                    {customerId && (
                      <button
                        type="button"
                        onClick={() => { setCustomerId(null); setCustomerSearch(''); setDateMet('') }}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer', color: '#6b7280' }}
                      >
                        Clear link
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Name</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Phone</label>
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Email</label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: 0 }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Date Met
                    {customerId && customers.find((c) => c.id === customerId)?.date_met && (
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>(edit in Customers)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={dateMet}
                    onChange={(e) => setDateMet(e.target.value)}
                    disabled={!!(customerId && customers.find((c) => c.id === customerId)?.date_met)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      background: customerId && customers.find((c) => c.id === customerId)?.date_met ? '#f9fafb' : 'white',
                      color: customerId && customers.find((c) => c.id === customerId)?.date_met ? '#6b7280' : 'inherit',
                      cursor: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'not-allowed' : 'text',
                    }}
                  />
                </div>
              </div>
            )}
            <div style={{ marginBottom: projectFilesPlansExpanded ? '0.5rem' : 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.25rem',
                width: '100%',
              }}
            >
              <button
                type="button"
                id="job-form-project-files-plans-trigger"
                aria-expanded={projectFilesPlansExpanded}
                aria-controls="job-form-project-files-plans-panel"
                aria-label="Expand or collapse project, files, plans, and bid"
                onClick={() => setProjectFilesPlansExpanded((p) => !p)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 'inherit',
                  color: 'inherit',
                  minWidth: '1.25rem',
                }}
              >
                <span aria-hidden>{projectFilesPlansExpanded ? '\u25BC' : '\u25B6'}</span>
              </button>
              {projectId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToProjectSection()
                  }}
                  style={projectFilesPlansJumpLinkStyle}
                  aria-label="Show Project"
                >
                  Project
                </button>
              ) : (
                <span style={projectFilesPlansPlainSegmentStyle}>Project</span>
              )}
              <span aria-hidden style={projectFilesPlansPipeStyle}>
                {' | '}
              </span>
              {googleDriveLink.trim() ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToJobFilesSection()
                  }}
                  style={projectFilesPlansJumpLinkStyle}
                  aria-label="Show Job Files"
                >
                  Files
                </button>
              ) : (
                <span style={projectFilesPlansPlainSegmentStyle}>Files</span>
              )}
              <span aria-hidden style={projectFilesPlansPipeStyle}>
                {' | '}
              </span>
              {jobPlansLink.trim() ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToJobPlansSection()
                  }}
                  style={projectFilesPlansJumpLinkStyle}
                  aria-label="Show Job Plans"
                >
                  Plans
                </button>
              ) : (
                <span style={projectFilesPlansPlainSegmentStyle}>Plans</span>
              )}
              <span aria-hidden style={projectFilesPlansPipeStyle}>
                {' | '}
              </span>
              {bidId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToBidSection()
                  }}
                  style={projectFilesPlansJumpLinkStyle}
                  aria-label="Show bid link"
                >
                  Bid
                </button>
              ) : (
                <span style={projectFilesPlansPlainSegmentStyle}>Bid</span>
              )}
            </div>
            {projectFilesPlansExpanded && (
              <div
                id="job-form-project-files-plans-panel"
                role="region"
                aria-label="Project, files, plans, and bid"
                style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}
              >
                <div ref={jobFormProjectSectionRef} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Project</label>
                  {projectId ? (
                    (() => {
                      const linkedName = projects.find((p) => p.id === projectId)?.name ?? 'project'
                      const disconnectLabel = `Disconnect from ${linkedName}`
                      return (
                        <>
                          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                            Linked to: <strong>{linkedName}</strong>
                          </p>
                          <button
                            ref={jobFormProjectDisconnectRef}
                            type="button"
                            onClick={() => {
                              setProjectId(null)
                              showToast('Unlinked from project. Save the job to apply.', 'info')
                            }}
                            title={disconnectLabel}
                            aria-label={disconnectLabel}
                            style={{
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.875rem',
                              border: '1px solid #d1d5db',
                              background: '#f9fafb',
                              borderRadius: 6,
                              cursor: 'pointer',
                              color: '#374151',
                              fontWeight: 500,
                            }}
                          >
                            {disconnectLabel}
                          </button>
                        </>
                      )
                    })()
                  ) : (
                    <>
                      <select
                        ref={jobFormProjectSelectRef}
                        value={projectId ?? ''}
                        onChange={(e) => {
                          const pid = e.target.value || null
                          setProjectId(pid)
                          if (pid) {
                            const proj = projects.find((p) => p.id === pid)
                            if (proj && !customerId) {
                              setCustomerId(proj.customer_id)
                            }
                          }
                        }}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                      >
                        <option value="">None</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.customers?.name ? ` (${p.customers.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, display: 'block' }}>
                        Link job to a multi-phase project for billing after each phase
                      </span>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div ref={jobFormJobFilesSectionRef} style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Files</label>
                    <input
                      ref={jobFormGoogleDriveInputRef}
                      type="url"
                      value={googleDriveLink}
                      onChange={(e) => setGoogleDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                    />
                    <a
                      href="https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => { e.preventDefault(); openInExternalBrowser('https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link') }}
                      style={{ fontSize: '0.8125rem', color: '#2563eb', marginTop: 4, display: 'inline-block' }}
                    >
                      job folders
                    </a>
                  </div>
                  <div ref={jobFormJobPlansSectionRef} style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
                    <input
                      ref={jobFormJobPlansInputRef}
                      type="url"
                      value={jobPlansLink}
                      onChange={(e) => setJobPlansLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
                    />
                  </div>
                </div>
                <div ref={jobFormBidSectionRef} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Bid proposal</label>
                  {bidId ? (
                    <>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#374151' }}>
                        Linked: <strong>{formatJobFormBidLinkTitle(linkedBidSummary)}</strong>
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <Link
                          to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
                          style={{
                            fontSize: '0.875rem',
                            padding: '0.35rem 0.65rem',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            borderRadius: 4,
                            textDecoration: 'none',
                            fontWeight: 500,
                          }}
                        >
                          Open cover letter
                        </Link>
                        <button
                          ref={jobFormBidDisconnectRef}
                          type="button"
                          onClick={() => {
                            setBidId(null)
                            setLinkedBidSummary(null)
                            showToast('Unlinked bid proposal. Save the job to apply.', 'info')
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.875rem',
                            border: '1px solid #d1d5db',
                            background: '#f9fafb',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: '#374151',
                            fontWeight: 500,
                          }}
                        >
                          Disconnect bid
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        ref={jobFormBidLinkButtonRef}
                        type="button"
                        onClick={() => setJobBidLinkChoiceOpen(true)}
                        style={{
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.875rem',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: '#2563eb',
                          fontWeight: 500,
                        }}
                      >
                        Link a bid proposal
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, display: 'block' }}>
                        Tie this job to a bid for quick access (optional)
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
          <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
          <div
            ref={fixturesSectionHighlightRef}
            style={{
              marginBottom: '1rem',
              borderRadius: 8,
              ...(fixturesSectionHighlight
                ? {
                    padding: '0.75rem',
                    background: '#eff6ff',
                    border: '2px solid #93c5fd',
                  }
                : {}),
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Specific Work (Fixtures / Tie-ins / Repair)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: '5.25rem' }} />
                <col style={{ width: 'calc(5.5rem + 4px + 1.75rem + 0.5rem)' }} />
              </colgroup>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line Item</th>
                  <th style={{ padding: '0.625rem 0.625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>Count</th>
                  <th
                    style={{
                      paddingTop: '0.625rem',
                      paddingBottom: '0.625rem',
                      paddingLeft: '0.625rem',
                      paddingRight: '0.375rem',
                      textAlign: 'center',
                      borderBottom: '1px solid #e5e7eb',
                      verticalAlign: 'middle',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Unit price
                  </th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((row, idx) => {
                  const descFieldId = `job-fixture-desc-${row.id}`
                  const stripeLenDescId = `job-fixture-stripe-len-${row.id}`
                  const scopeTrim = (row.line_description ?? '').trim()
                  const scopeExpanded =
                    scopeTrim.length > 0 || fixtureScopeExpandedById[row.id] === true
                  const stripeFixtureLineLen = stripeInvoiceFixtureLineLength(
                    row.name,
                    row.line_description,
                  )
                  const stripeLineOverLimit = stripeFixtureLineLen > STRIPE_INVOICE_LINE_DESCRIPTION_MAX
                  return (
                    <Fragment key={row.id}>
                      <tr style={{ borderBottom: 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem', paddingBottom: '0.35rem' }}>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
                            placeholder="Fixture or tie-in name"
                            style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td
                          style={{
                            paddingTop: '0.625rem',
                            paddingBottom: '0.35rem',
                            paddingLeft: '0.5rem',
                            paddingRight: '0.625rem',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <input
                            type="number"
                            min={1}
                            value={row.count}
                            onChange={(e) => updateFixtureRow(row.id, { count: Math.max(1, Number(e.target.value) || 1) })}
                            style={{
                              width: '4rem',
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              padding: '0.375rem 0.625rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                              textAlign: 'center',
                            }}
                          />
                        </td>
                        <td
                          style={{
                            paddingTop: '0.625rem',
                            paddingRight: '0.375rem',
                            paddingBottom: '0.35rem',
                            paddingLeft: '0.625rem',
                            verticalAlign: 'middle',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              gap: 4,
                              flexWrap: 'nowrap',
                            }}
                          >
                            <MoneyDecimalAmountInput
                              value={row.line_unit_price ?? 0}
                              onChange={(n) => updateFixtureRow(row.id, { line_unit_price: n === 0 ? null : n })}
                              placeholder="—"
                              aria-label="Unit price"
                              style={{
                                width: '5.5rem',
                                minWidth: '4.5rem',
                                flexShrink: 0,
                                boxSizing: 'border-box',
                                padding: '0.375rem 0.5rem',
                                border: '1px solid #d1d5db',
                                borderRadius: 6,
                                fontSize: '0.875rem',
                                textAlign: 'right',
                              }}
                            />
                            {fixtures.length === 1 ? (
                              <button
                                type="button"
                                onClick={addFixtureRow}
                                title="Add line item"
                                aria-label="Add line item"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                  flexShrink: 0,
                                  marginLeft: 'auto',
                                }}
                              >
                                +
                              </button>
                            ) : idx === fixtures.length - 1 ? (
                              <button
                                type="button"
                                onClick={addFixtureRow}
                                title="Add line item"
                                aria-label="Add line item"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                  flexShrink: 0,
                                  marginLeft: 'auto',
                                }}
                              >
                                +
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => removeFixtureRow(row.id)}
                                title="Remove"
                                aria-label="Remove line item"
                                style={{
                                  padding: '0.35rem',
                                  background: 'transparent',
                                  color: '#991b1c',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginLeft: 'auto',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden>
                                  <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr
                        style={{
                          borderBottom: idx < fixtures.length - 1 ? '1px solid #e5e7eb' : 'none',
                        }}
                      >
                        <td
                          colSpan={3}
                          style={{
                            padding: '0 0.75rem 0.625rem',
                            verticalAlign: 'top',
                            position: 'relative',
                          }}
                        >
                          {scopeExpanded ? (
                            <>
                              <div
                                id={stripeLenDescId}
                                aria-live="polite"
                                style={{
                                  fontSize: '0.75rem',
                                  color: stripeLineOverLimit ? '#d97706' : '#6b7280',
                                  marginBottom: 6,
                                }}
                              >
                                ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                              </div>
                              <label htmlFor={descFieldId} style={FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN}>
                                Optional scope or notes for this line
                              </label>
                              <textarea
                                id={descFieldId}
                                aria-describedby={stripeLenDescId}
                                value={row.line_description}
                                onChange={(e) =>
                                  updateFixtureRow(row.id, { line_description: e.target.value })
                                }
                                placeholder="Optional scope or notes"
                                rows={2}
                                style={{
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  padding: '0.375rem 0.625rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 6,
                                  fontSize: '0.875rem',
                                  resize: 'vertical',
                                  minHeight: '2.5rem',
                                  fontFamily: 'inherit',
                                }}
                              />
                            </>
                          ) : (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'baseline',
                                gap: '0.35rem',
                                marginBottom: 4,
                                fontSize: '0.75rem',
                              }}
                            >
                              <span
                                id={stripeLenDescId}
                                aria-live="polite"
                                style={{ color: stripeLineOverLimit ? '#d97706' : '#6b7280' }}
                              >
                                ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                              </span>
                              <button
                                type="button"
                                aria-expanded={false}
                                aria-controls={descFieldId}
                                aria-describedby={stripeLenDescId}
                                onClick={() =>
                                  setFixtureScopeExpandedById((prev) => ({
                                    ...prev,
                                    [row.id]: true,
                                  }))
                                }
                                style={{
                                  padding: '0.25rem 0',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: '2px',
                                }}
                              >
                                Add scope or notes
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', minWidth: 0, textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Total ($)</label>
                <div
                  aria-live="polite"
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${formatCurrency(jobTotalBidDollars)}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, display: 'block' }}>
                  Total of lines above.
                </span>
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 0, textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Remaining ($)</label>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${formatCurrency(getEditJobBillableRemaining())}
                </div>
              </div>
            </div>
          {editing && (
            <>
              {editing ? (
                <div
                  style={{
                    marginBottom: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      width: '100%',
                      minWidth: 0,
                      rowGap: '0.35rem',
                    }}
                  >
                    <label
                      htmlFor="edit-job-partial-invoice-amount"
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        color: '#374151',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isSendFullUnallocatedToReadyToBill ? 'Send to Ready to Bill:' : 'Break off Invoice:'}
                    </label>
                    <input
                      id="edit-job-partial-invoice-amount"
                      type="text"
                      inputMode="decimal"
                      value={
                        newInvoiceAmountInputFocused
                          ? newInvoiceAmount
                          : newInvoiceAmount.trim() === ''
                            ? ''
                            : formatCurrency(parseMoneyInputToNumber(newInvoiceAmount))
                      }
                      onFocus={() => setNewInvoiceAmountInputFocused(true)}
                      onBlur={() => {
                        setNewInvoiceAmountInputFocused(false)
                        const n = parseMoneyInputToNumberOrNull(newInvoiceAmount)
                        if (n == null) {
                          setNewInvoiceAmount('')
                          return
                        }
                        const rem = breakOffRemaining
                        let useCents = Math.min(Math.round(n * 100), Math.round(rem * 100))
                        let clamped = useCents / 100
                        const total = jobTotalBidDollars
                        if (total > 0) {
                          const { min, max } = breakOffCombinedSliderBounds
                          const rawC = Math.min(100, ((breakOffPaidSum + clamped) / total) * 100)
                          const snappedC = snapBreakOffCombinedPctToStep(rawC, min, max)
                          clamped = breakDollarsFromCombinedPct(snappedC, total, breakOffPaidSum, rem)
                        }
                        setNewInvoiceAmount(String(clamped))
                      }}
                      onChange={(e) => setNewInvoiceAmount(sanitizeMoneyTyping(e.target.value))}
                      placeholder="$0"
                      title={
                        isSendFullUnallocatedToReadyToBill
                          ? 'Full unallocated amount: moves job to Ready to Bill (no separate draft line for this amount).'
                          : 'Break off an amount to send through Ready to Bill. Job stays in Working.'
                      }
                      style={{
                        minWidth: isSendFullUnallocatedToReadyToBill ? '9rem' : '6rem',
                        width: isSendFullUnallocatedToReadyToBill ? '9rem' : '6rem',
                        flexShrink: 0,
                        boxSizing: 'border-box',
                        padding: '0.375rem 0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                        background: 'white',
                      }}
                    />
                    <button
                      type="button"
                      onClick={isSendFullUnallocatedToReadyToBill ? moveWorkingJobToReadyToBillFromEdit : createInvoice}
                      disabled={
                        movingJobToReadyToBill ||
                        creatingInvoice ||
                        !(parseMoneyInputToNumber(newInvoiceAmount) > 0)
                      }
                      title={isSendFullUnallocatedToReadyToBill ? 'Move job to Ready to Bill' : 'Create invoice'}
                      aria-label={isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : 'Create invoice'}
                      style={{
                        padding: isSendFullUnallocatedToReadyToBill ? '0.35rem 0.65rem' : '0.35rem 0.5rem',
                        fontSize: isSendFullUnallocatedToReadyToBill ? '0.8125rem' : '1rem',
                        fontWeight: 600,
                        lineHeight: 1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        background:
                          movingJobToReadyToBill ||
                          creatingInvoice ||
                          !(parseMoneyInputToNumber(newInvoiceAmount) > 0)
                            ? '#9ca3af'
                            : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor:
                          movingJobToReadyToBill ||
                          creatingInvoice ||
                          !(parseMoneyInputToNumber(newInvoiceAmount) > 0)
                            ? 'not-allowed'
                            : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: isSendFullUnallocatedToReadyToBill ? '7.5rem' : '1.75rem',
                      }}
                    >
                      {movingJobToReadyToBill ? '…' : creatingInvoice ? '…' : isSendFullUnallocatedToReadyToBill ? 'Ready to Bill' : '+'}
                    </button>
                    {breakOffDraftCoveragePctDisplay != null && breakOffDraftCoveragePctDisplay < 100 ? (
                      <span
                        title="Payments plus this draft amount as a share of Job Total."
                        style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {breakOffDraftCoveragePctDisplay}% of job total
                      </span>
                    ) : null}
                  </div>
                  {breakOffBillingTrackPercents.hasTotal ? (
                    <div style={{ width: '100%', minWidth: 0 }}>
                      <div
                        ref={billingBreakOffTrackRef}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: 34,
                          marginTop: 2,
                          touchAction: 'none',
                        }}
                        onPointerDown={onBillingBreakOffTrackPointerDown}
                        onPointerMove={onBillingBreakOffTrackPointerMove}
                        onPointerUp={onBillingBreakOffTrackPointerUpCancel}
                        onPointerCancel={onBillingBreakOffTrackPointerUpCancel}
                        onLostPointerCapture={onBillingBreakOffTrackLostPointerCapture}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 8,
                            height: 8,
                            background: '#e5e7eb',
                            borderRadius: 4,
                            zIndex: 0,
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 8,
                            height: 8,
                            width: `${breakOffBillingTrackPercents.paidPct}%`,
                            background: '#2563eb',
                            borderRadius:
                              breakOffBillingTrackPercents.breakPreviewPct > 0 ? '4px 0 0 4px' : 4,
                            zIndex: 1,
                          }}
                        />
                        {breakOffBillingTrackPercents.breakPreviewPct > 0 ? (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${breakOffBillingTrackPercents.paidPct}%`,
                              top: 8,
                              height: 8,
                              width: `${breakOffBillingTrackPercents.breakPreviewPct}%`,
                              background: '#93c5fd',
                              borderRadius: '0 4px 4px 0',
                              zIndex: 1,
                            }}
                          />
                        ) : null}
                        {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((pct) => {
                          const isMajor = pct % 20 === 0
                          const railTop = 8
                          const railH = 8
                          const minorH = 5
                          const h = isMajor ? railH : minorH
                          const top = isMajor ? railTop : railTop + (railH - minorH) / 2
                          return (
                            <div
                              key={pct}
                              style={{
                                position: 'absolute',
                                left: `${pct}%`,
                                top,
                                transform: 'translateX(-50%)',
                                width: 1,
                                height: h,
                                background: '#ffffff',
                                borderRadius: 1,
                                zIndex: 2,
                                pointerEvents: 'none',
                                boxShadow: '0 0 0 0.5px rgba(0, 0, 0, 0.12)',
                                opacity: isMajor ? 1 : 0.85,
                              }}
                            />
                          )
                        })}
                        {jobCompleteTrackPct != null ? (
                          <div
                            aria-hidden
                            style={{
                              position: 'absolute',
                              left: `${jobCompleteTrackPct}%`,
                              top: 7,
                              width: 10,
                              height: 10,
                              transform: 'translateX(-50%)',
                              borderRadius: '50%',
                              background: '#facc15',
                              border: '1px solid #ca8a04',
                              boxSizing: 'border-box',
                              zIndex: 3,
                              pointerEvents: 'none',
                            }}
                          />
                        ) : null}
                        <div
                          role="slider"
                          tabIndex={0}
                          aria-label={`Paid plus break-off through ${Math.round(breakOffCombinedHandlePct)}% of job total. Track shows ${Math.round(breakOffBillingTrackPercents.paidPct)}% paid and ${Math.round(breakOffBillingTrackPercents.breakPreviewPct)}% new invoice preview. ${jobCompleteTrackPct == null ? 'Field progress not set.' : `Field progress ${Math.round(jobCompleteTrackPct)}%.`}`}
                          aria-valuemin={Math.round(breakOffCombinedSliderBounds.min)}
                          aria-valuemax={Math.round(breakOffCombinedSliderBounds.max)}
                          aria-valuenow={Math.round(
                            Math.min(
                              breakOffCombinedSliderBounds.max,
                              Math.max(breakOffCombinedSliderBounds.min, breakOffCombinedHandlePct),
                            ),
                          )}
                          aria-orientation="horizontal"
                          data-breakoff-slider-thumb
                          onKeyDown={onBreakOffSliderKeyDown}
                          style={{
                            position: 'absolute',
                            left: `${breakOffCombinedThumbLeftPct}%`,
                            top: -2,
                            transform: 'translateX(-50%)',
                            zIndex: 5,
                            lineHeight: 0,
                            cursor: breakOffSliderDragCombinedPct != null ? 'grabbing' : 'grab',
                            padding: '6px 10px',
                            margin: '-6px -10px',
                            outline: 'none',
                          }}
                        >
                          <svg width="12" height="6" viewBox="0 0 12 6" aria-hidden>
                            <polygon
                              points="0,0 12,0 6,6"
                              fill="#22c55e"
                              stroke="#15803d"
                              strokeWidth="0.75"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            top: 20,
                            height: 14,
                          }}
                        >
                          {[20, 40, 60, 80].map((pct) => (
                            <span
                              key={`lbl-${pct}`}
                              style={{
                                position: 'absolute',
                                left: `${pct}%`,
                                transform: 'translateX(-50%)',
                                fontSize: '0.65rem',
                                color: '#6b7280',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {pct}%
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>
                      Add Specific Work lines to set Job Total for this chart.
                    </div>
                  )}
                  {breakOffBillingTrackPercents.hasTotal ? (
                    <div
                      role="group"
                      aria-label="Billing progress bar legend"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.65rem 1rem',
                        rowGap: '0.35rem',
                        width: '100%',
                        minWidth: 0,
                        marginTop: 2,
                      }}
                    >
                      {(
                        [
                          { color: '#2563eb', label: 'Paid', sub: '', circle: false },
                          { color: '#93c5fd', label: 'New Invoice', sub: '', circle: false },
                          {
                            color: '#facc15',
                            label:
                              jobCompleteTrackPct == null ? 'Job: Not set' : `Job: ${Math.round(jobCompleteTrackPct)}%`,
                            sub: '',
                            circle: true,
                          },
                        ] as {
                          color: string
                          label: string
                          sub: string
                          circle: boolean
                        }[]
                      ).map((item) => (
                        <div
                          key={item.label}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'flex-start',
                            gap: 6,
                            maxWidth: '100%',
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: item.circle ? '50%' : 3,
                              background: item.color,
                              border: item.circle ? '1px solid #ca8a04' : 'none',
                              boxSizing: 'border-box',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                          <span style={{ fontSize: '0.7rem', color: '#6b7280', lineHeight: 1.35, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: '#4b5563' }}>{item.label}</span>
                            {item.sub ? (
                              <>
                                {' — '}
                                {item.sub}
                              </>
                            ) : null}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {(editing.invoices ?? []).some((i) => i.status === 'ready_to_bill') && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9375rem' }}>Ready to Bill</h4>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                    Draft invoices not yet sent. After you bill, they move to Outstanding billing below.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem' }}>
                    {(editing.invoices ?? [])
                      .filter((i) => i.status === 'ready_to_bill')
                      .map((inv) => (
                        <li key={inv.id} style={{ marginBottom: '0.25rem' }}>
                          ${formatCurrency(Number(inv.amount))} — Ready to Bill
                          <button
                            type="button"
                            onClick={() => {
                              if (editing?.id) setReturnEditJobFromStages(editing.id)
                              onClose()
                              navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
                            }}
                            style={{ marginLeft: 8, padding: '0.15rem 0.35rem', fontSize: '0.75rem', background: '#e5e7eb', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            View in Stages
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!editing) return
                              if (!jobLedgerHasCustomerForBilling(editing.customer_id)) {
                                showToast('Link this job to a customer before billing.', 'error')
                                return
                              }
                              const ctx: JobBillingContext = {
                                id: editing.id,
                                master_user_id: editing.master_user_id,
                                hcp_number: editing.hcp_number,
                                job_name: editing.job_name,
                                customer_id: editing.customer_id,
                                customer_name: editing.customer_name,
                                customer_email: editing.customer_email,
                                job_address: editing.job_address,
                                customer_phone: editing.customer_phone,
                                last_work_date: editing.last_work_date,
                              }
                              billCustomer?.openBillCustomer({
                                payload: {
                                  kind: 'invoice',
                                  job: ctx,
                                  invoice: {
                                    id: inv.id,
                                    amount: inv.amount,
                                    status: inv.status,
                                  },
                                },
                                onSuccess: async () => {
                                  onSavedRef.current?.()
                                  const found = await fetchJobWithDetailsById(editing.id)
                                  if (found) setEditing(found)
                                },
                                onAfterEnsureSuccess: async () => {
                                  const found = await fetchJobWithDetailsById(editing.id)
                                  if (found) setEditing(found)
                                },
                              })
                            }}
                            style={{
                              marginLeft: 8,
                              padding: '0.15rem 0.35rem',
                              fontSize: '0.75rem',
                              background: '#dbeafe',
                              border: '1px solid #93c5fd',
                              borderRadius: 4,
                              cursor: 'pointer',
                              color: '#1e40af',
                            }}
                          >
                            Preview / Stripe bill…
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              {(editing.invoices ?? []).some((i) => i.status === 'billed') && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Outstanding billing</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        minWidth: 480,
                        borderCollapse: 'collapse',
                        fontSize: '0.875rem',
                        tableLayout: 'fixed',
                      }}
                    >
                      <colgroup>
                        <col style={{ width: '28%' }} />
                        <col style={{ width: '24%' }} />
                        <col style={{ width: '48%' }} />
                      </colgroup>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Billed</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(editing.invoices ?? [])
                          .filter((i) => i.status === 'billed')
                          .map((inv, idx, arr) => {
                            const sent =
                              inv.sent_to_customer_at != null && String(inv.sent_to_customer_at).trim()
                                ? String(inv.sent_to_customer_at).slice(0, 10)
                                : '—'
                            const hasStripeShare =
                              (inv.stripe_invoice_id ?? '').trim().length > 0 &&
                              (inv.hosted_invoice_url ?? '').trim().length > 0
                            const createdDayOffset = invoiceCreatedCalendarDayOffset(inv.created_at)
                            const noteLine = (inv.external_send_note ?? '').trim()
                            const memoLine = (inv.stripe_invoice_memo ?? '').trim()
                            const footerLine = (inv.stripe_invoice_footer ?? '').trim()
                            const hasDetailLine = Boolean(noteLine || memoLine || footerLine)
                            const rowSep = idx < arr.length - 1 ? '1px solid #e5e7eb' : 'none'
                            const btnGray: CSSProperties = {
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.75rem',
                              background: '#e5e7eb',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }
                            const parentCellPad = hasDetailLine ? '0.5rem 0.75rem 0.1rem' : '0.5rem 0.75rem'
                            return (
                              <Fragment key={inv.id}>
                                <tr style={{ borderBottom: hasDetailLine ? 'none' : rowSep }}>
                                  <td style={{ padding: parentCellPad, verticalAlign: 'top', wordBreak: 'break-word' }}>
                                    <div>
                                      {sent === '—'
                                        ? '—'
                                        : createdDayOffset !== null
                                          ? `${formatWorkDateYmdMonthDayShort(sent)} (+${createdDayOffset})`
                                          : formatWorkDateYmdMonthDayShort(sent)}
                                    </div>
                                  </td>
                                  <td style={{ padding: parentCellPad, textAlign: 'right', verticalAlign: 'top' }}>
                                    ${formatCurrency(Number(inv.amount ?? 0))}
                                  </td>
                                  <td style={{ padding: parentCellPad, verticalAlign: 'top', textAlign: 'right' }}>
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '0.35rem',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        width: '100%',
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onClose()
                                          navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
                                        }}
                                        style={btnGray}
                                      >
                                        Stages
                                      </button>
                                      {hasStripeShare ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!editing) return
                                            setBillViewInvoice({ ...inv, job: editing })
                                          }}
                                          style={btnGray}
                                        >
                                          Bill
                                        </button>
                                      ) : null}
                                      {hasStripeShare ? (
                                        <StripeInvoiceSharePanel
                                          hostedInvoiceUrl={inv.hosted_invoice_url!.trim()}
                                          stripeInvoiceId={(inv.stripe_invoice_id ?? '').trim()}
                                          customerEmail={editing.customer_email}
                                          customerName={editing.customer_name}
                                          jobName={editing.job_name}
                                          hcpNumber={editing.hcp_number}
                                          amountLabel={`$${formatCurrency(Number(inv.amount ?? 0))}`}
                                          compact
                                          paymentLinkActionsAsIcons
                                          omitPaymentLinksLabel
                                          unboxed
                                          inlineRow
                                          omitCustomerPayPage
                                          omitOpenInStripe
                                        />
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                                {hasDetailLine ? (
                                  <tr style={{ borderBottom: rowSep }}>
                                    <td
                                      colSpan={3}
                                      style={{
                                        paddingTop: 0,
                                        paddingRight: '0.75rem',
                                        paddingBottom: '0.5rem',
                                        paddingLeft: '3.5rem',
                                        fontSize: '0.75rem',
                                        color: '#6b7280',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.35,
                                      }}
                                    >
                                      {noteLine ? (
                                        <div
                                          style={{
                                            marginBottom: memoLine || footerLine ? '0.15rem' : 0,
                                          }}
                                        >
                                          <span style={{ fontWeight: 600, color: '#4b5563' }}>Note: </span>
                                          {noteLine}
                                        </div>
                                      ) : null}
                                      {memoLine ? (
                                        <div style={{ marginBottom: footerLine ? '0.15rem' : 0 }}>
                                          <span style={{ fontWeight: 600, color: '#4b5563' }}>Memo: </span>
                                          {memoLine}
                                        </div>
                                      ) : null}
                                      {footerLine ? (
                                        <div>
                                          <span style={{ fontWeight: 600, color: '#4b5563' }}>Footer: </span>
                                          {footerLine}
                                        </div>
                                      ) : null}
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments received</h4>
              <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: 480,
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '48%' }} />
                </colgroup>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Paid</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }} aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Last non–Stripe-locked row hosts the add (+) control. If all rows are Stripe-backed (-1), there is no inline +.
                    let lastUnlockedPaymentIdx = -1
                    for (let i = payments.length - 1; i >= 0; i--) {
                      const pr = payments[i]
                      if (pr && !stripeBillInvoiceForPaymentRow(pr, editing) && !mercuryLinkedPaymentRow(pr)) {
                        lastUnlockedPaymentIdx = i
                        break
                      }
                    }
                    return payments.map((row, idx) => {
                    const stripePaymentLocked = Boolean(stripeBillInvoiceForPaymentRow(row, editing))
                    const mercuryPaymentLocked = mercuryLinkedPaymentRow(row)
                    const paymentReadOnly = stripePaymentLocked || mercuryPaymentLocked
                    const noteTrim = (row.note ?? '').trim()
                    const ptTrim = (row.payment_type ?? '').trim()
                    const refTrim = (row.reference_number ?? '').trim()
                    const hasMemoSubRow =
                      !paymentReadOnly || noteTrim.length > 0 || ptTrim.length > 0 || refTrim.length > 0
                    const rowSep = idx < payments.length - 1 ? '1px solid #e5e7eb' : 'none'
                    const parentCellPad = hasMemoSubRow ? '0.5rem 0.75rem 0.1rem' : '0.5rem 0.75rem'
                    const paymentDateCellStyle = {
                      paddingTop: '0.5rem',
                      paddingBottom: hasMemoSubRow ? '0.1rem' : '0.5rem',
                      paddingLeft: '0.75rem',
                      paddingRight: '0.125rem',
                      verticalAlign: 'top' as const,
                      wordBreak: 'break-word' as const,
                      overflow: 'hidden' as const,
                    }
                    const paymentPaidCellStyle = {
                      paddingTop: '0.5rem',
                      paddingBottom: hasMemoSubRow ? '0.1rem' : '0.5rem',
                      paddingLeft: '0.125rem',
                      paddingRight: '0.75rem',
                      textAlign: 'right' as const,
                      verticalAlign: 'top' as const,
                      overflow: 'hidden' as const,
                    }
                    return (
                      <Fragment key={row.id}>
                        <tr style={{ borderBottom: hasMemoSubRow ? 'none' : rowSep }}>
                          <td style={paymentDateCellStyle}>
                            {stripePaymentLocked ? (
                              <span
                                style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}
                                title="Recorded from the Stripe invoice."
                                aria-label={`Payment date ${formatPaymentDateForDisplay(row.paid_on)}`}
                              >
                                {formatPaymentDateForDisplay(row.paid_on)}
                              </span>
                            ) : mercuryPaymentLocked ? (
                              <span
                                style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}
                                title="Recorded from Bank Payments (Mercury)."
                                aria-label={`Payment date ${formatPaymentDateForDisplay(row.paid_on)}`}
                              >
                                {formatPaymentDateForDisplay(row.paid_on)}
                              </span>
                            ) : (
                              <input
                                id={`edit-job-payment-date-${row.id}`}
                                type="date"
                                value={row.paid_on ?? ''}
                                onChange={(e) => updatePaymentRow(row.id, { paid_on: e.target.value ? e.target.value : null })}
                                aria-label="Payment date"
                                style={{
                                  width: '100%',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box',
                                  padding: '0.375rem 0.5rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 6,
                                  fontSize: '0.875rem',
                                }}
                              />
                            )}
                          </td>
                          <td style={paymentPaidCellStyle}>
                            {stripePaymentLocked ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  gap: '0.2rem',
                                  flexWrap: 'nowrap',
                                  minWidth: 0,
                                }}
                              >
                                {(() => {
                                  const stripeInv = stripeBillInvoiceForPaymentRow(row, editing)
                                  if (!stripeInv) return null
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!editing) return
                                        setBillViewInvoice({ ...stripeInv, job: editing })
                                      }}
                                      title="View Stripe bill"
                                      aria-label="View Stripe bill for this payment"
                                      style={{
                                        flexShrink: 0,
                                        padding: '0.2rem',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        color: '#2563eb',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 640 640"
                                        width={17}
                                        height={17}
                                        fill="currentColor"
                                        aria-hidden
                                      >
                                        <path d="M142 66.2C150.5 62.3 160.5 63.7 167.6 69.8L208 104.4L248.4 69.8C257.4 62.1 270.7 62.1 279.6 69.8L320 104.4L360.4 69.8C369.4 62.1 382.6 62.1 391.6 69.8L432 104.4L472.4 69.8C479.5 63.7 489.5 62.3 498 66.2C506.5 70.1 512 78.6 512 88L512 552C512 561.4 506.5 569.9 498 573.8C489.5 577.7 479.5 576.3 472.4 570.2L432 535.6L391.6 570.2C382.6 577.9 369.4 577.9 360.4 570.2L320 535.6L279.6 570.2C270.6 577.9 257.3 577.9 248.4 570.2L208 535.6L167.6 570.2C160.5 576.3 150.5 577.7 142 573.8C133.5 569.9 128 561.4 128 552L128 88C128 78.6 133.5 70.1 142 66.2zM232 200C218.7 200 208 210.7 208 224C208 237.3 218.7 248 232 248L408 248C421.3 248 432 237.3 432 224C432 210.7 421.3 200 408 200L232 200zM208 416C208 429.3 218.7 440 232 440L408 440C421.3 440 432 429.3 432 416C432 402.7 421.3 392 408 392L232 392C218.7 392 208 402.7 208 416zM232 296C218.7 296 208 306.7 208 320C208 333.3 218.7 344 232 344L408 344C421.3 344 432 333.3 432 320C432 306.7 421.3 296 408 296L232 296z" />
                                      </svg>
                                    </button>
                                  )
                                })()}
                                <span
                                  style={{
                                    color: '#111827',
                                    fontVariantNumeric: 'tabular-nums',
                                    minWidth: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="From the Stripe invoice allocation."
                                  aria-label={`Payment amount ${formatCurrency(Number(row.amount))} dollars`}
                                >
                                  ${formatCurrency(Number(row.amount))}
                                </span>
                              </div>
                            ) : mercuryPaymentLocked ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  gap: '0.35rem',
                                  flexWrap: 'wrap',
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    color: '#1d4ed8',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: 4,
                                    padding: '0.1rem 0.35rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  Mercury
                                </span>
                                <span
                                  style={{
                                    color: '#111827',
                                    fontVariantNumeric: 'tabular-nums',
                                    minWidth: 0,
                                  }}
                                  title="Linked to a Mercury bank transaction."
                                  aria-label={`Payment amount ${formatCurrency(Number(row.amount))} dollars`}
                                >
                                  ${formatCurrency(Number(row.amount))}
                                </span>
                              </div>
                            ) : (
                              <MoneyDecimalAmountInput
                                value={row.amount}
                                onChange={(amount) => updatePaymentRow(row.id, { amount })}
                                placeholder="0"
                                aria-label="Payment amount"
                                style={{
                                  width: '100%',
                                  maxWidth: '100%',
                                  boxSizing: 'border-box',
                                  padding: '0.375rem 0.5rem',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 6,
                                  fontSize: '0.875rem',
                                  textAlign: 'right',
                                }}
                              />
                            )}
                          </td>
                          <td
                            style={{
                              padding: parentCellPad,
                              verticalAlign: 'top',
                              textAlign: 'right',
                            }}
                          >
                            {stripePaymentLocked ? null : mercuryPaymentLocked && canUnlinkMercuryPayment(authRole) ? (
                              <button
                                type="button"
                                onClick={() => setUnlinkMercuryConfirmRowId(row.id)}
                                disabled={unlinkingMercuryPaymentId === row.id}
                                title="Remove this payment from the job and free the bank deposit in Accounts Receivable"
                                aria-label="Unlink bank deposit and remove this payment line"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  color: unlinkingMercuryPaymentId === row.id ? '#9ca3af' : '#1d4ed8',
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: 6,
                                  cursor: unlinkingMercuryPaymentId === row.id ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {unlinkingMercuryPaymentId === row.id ? 'Removing…' : 'Unlink and remove'}
                              </button>
                            ) : mercuryPaymentLocked ? null : idx === lastUnlockedPaymentIdx ? (
                              <button
                                type="button"
                                onClick={addPaymentRow}
                                title="Add payment line"
                                aria-label="Add payment line"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                }}
                              >
                                +
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => requestRemovePaymentRow(row)}
                                title="Remove"
                                aria-label="Remove payment row"
                                style={{
                                  padding: '0.35rem',
                                  background:
                                    payments.length <= 1 || paymentRowLinkedToInvoice(row) || mercuryPaymentLocked
                                      ? '#f3f4f6'
                                      : 'transparent',
                                  color:
                                    payments.length <= 1 || paymentRowLinkedToInvoice(row) || mercuryPaymentLocked
                                      ? '#9ca3af'
                                      : '#991b1c',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor:
                                    payments.length <= 1 || paymentRowLinkedToInvoice(row) || mercuryPaymentLocked
                                      ? 'not-allowed'
                                      : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                        {hasMemoSubRow ? (
                          <tr style={{ borderBottom: rowSep }}>
                            <td colSpan={3} style={PAYMENT_MEMO_SUB_ROW_CELL_STYLE}>
                              {paymentReadOnly ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {(ptTrim || refTrim) ? (
                                    <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                                      {ptTrim ? (
                                        <span style={{ marginRight: '0.75rem' }}>
                                          <span style={{ fontWeight: 600, color: '#4b5563' }}>Type: </span>
                                          {ptTrim}
                                        </span>
                                      ) : null}
                                      {refTrim ? (
                                        <span>
                                          <span style={{ fontWeight: 600, color: '#4b5563' }}>Ref: </span>
                                          <ReadOnlyPaymentRefCopy refText={refTrim} showToast={showToast} />
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <div>
                                    <span style={{ fontWeight: 600, color: '#4b5563' }}>Memo: </span>
                                    {noteTrim || '—'}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                    width: '100%',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#4b5563', flexShrink: 0 }}>Type: </span>
                                    <input
                                      id={`edit-job-payment-type-${row.id}`}
                                      type="text"
                                      value={row.payment_type ?? ''}
                                      onChange={(e) =>
                                        updatePaymentRow(row.id, {
                                          payment_type: e.target.value === '' ? null : e.target.value,
                                        })
                                      }
                                      placeholder="Optional"
                                      aria-label="Payment type"
                                      style={{
                                        flex: '1 1 8rem',
                                        minWidth: 0,
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '0.2rem 0.35rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: '#374151',
                                        background: 'white',
                                        lineHeight: 1.35,
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#4b5563', flexShrink: 0 }}>Ref: </span>
                                    <input
                                      id={`edit-job-payment-ref-${row.id}`}
                                      type="text"
                                      value={row.reference_number ?? ''}
                                      onChange={(e) =>
                                        updatePaymentRow(row.id, {
                                          reference_number: e.target.value === '' ? null : e.target.value,
                                        })
                                      }
                                      placeholder="Optional"
                                      aria-label="Payment reference"
                                      style={{
                                        flex: '1 1 10rem',
                                        minWidth: 0,
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '0.2rem 0.35rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: '#374151',
                                        background: 'white',
                                        lineHeight: 1.35,
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#4b5563', flexShrink: 0 }}>Memo: </span>
                                    <input
                                      id={`edit-job-payment-note-${row.id}`}
                                      type="text"
                                      value={row.note ?? ''}
                                      onChange={(e) =>
                                        updatePaymentRow(row.id, { note: e.target.value === '' ? null : e.target.value })
                                      }
                                      placeholder="Optional"
                                      aria-label="Payment memo"
                                      style={{
                                        flex: '1 1 12rem',
                                        minWidth: 0,
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '0.2rem 0.35rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: '#374151',
                                        background: 'white',
                                        lineHeight: 1.35,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                  })()}
                </tbody>
              </table>
              </div>
            </div>
          </div>
          {editing?.id ? (
            <>
              <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid #9ca3af', width: '50%' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Labor Cost</div>
              <div
                style={{
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '0.75rem 1rem',
                  marginBottom: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Team Labor</span>
                <span style={{ flex: '1 1 8rem', fontSize: '0.875rem', color: '#4b5563', textAlign: 'right', minWidth: 0 }}>
                  {editJobTeamLaborLoading
                    ? 'Loading…'
                    : editJobTeamLaborError
                      ? 'Couldn’t load'
                      : editJobTeamLaborRow
                        ? `${editJobTeamLaborRow.manHours.toLocaleString('en-US', { maximumFractionDigits: 1 })} h · $${formatCurrency(editJobTeamLaborRow.jobCost)} · ${editJobTeamLaborRow.people.length} people`
                        : 'No team labor for this job yet'}
                </span>
                {showTeamLaborOpenOnJobsLink ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editing?.id) return
                      onClose()
                      navigate(`/jobs?tab=combined-labor&teamLaborJob=${encodeURIComponent(editing.id)}`)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      textDecoration: 'underline',
                      flexShrink: 0,
                    }}
                  >
                    Open on Jobs →
                  </button>
                ) : null}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>Sub Labor</span>
                <span style={{ flex: '1 1 8rem', fontSize: '0.875rem', color: '#4b5563', textAlign: 'right', minWidth: 0 }}>
                  {editJobSubLaborLoading
                    ? 'Loading…'
                    : !editJobEffectiveHcp
                      ? 'Add an HCP to link sub labor'
                      : editJobSubLaborError
                        ? 'Couldn’t load'
                        : editJobSubLaborData
                          ? editJobSubLaborData.count === 0
                            ? 'No sub labor for this HCP'
                            : `${editJobSubLaborData.count} sub job${editJobSubLaborData.count === 1 ? '' : 's'} · $${formatCurrency(editJobSubLaborData.total)}`
                          : 'No sub labor for this HCP'}
                </span>
                {showSubLaborOpenOnJobsLink ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                      navigate(`/jobs?tab=sub_sheet_ledger&editLabor=${encodeURIComponent(editJobEffectiveHcp)}`)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      textDecoration: 'underline',
                      flexShrink: 0,
                    }}
                  >
                    Open on Jobs →
                  </button>
                ) : null}
              </div>
              </div>
            </>
          ) : null}
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151', marginBottom: '0.75rem' }}>Parts Cost</div>
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem', overflow: 'hidden' }}>
              {editing?.id ? (
                <>
                  <MaterialsCostAccordionRow
                    title="Supply house invoices"
                    totalDisplay={supplyInvoiceRpcFailed ? '—' : formatCurrency(supplyInvoiceTotal)}
                    expanded={materialsAccordionOpen === 'supply'}
                    onToggle={() => toggleMaterialsAccordion('supply')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {supplyInvoiceLines.length === 0 && supplyInvoiceTotal > 0 && !supplyInvoiceRpcFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
                        Allocated invoice total for this job; line detail is available to office roles in Materials.
                      </p>
                    ) : supplyInvoiceLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No supply house invoice allocations for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Supply house</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Invoice</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Allocated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplyInvoiceLines.map((ln, idx) => (
                            <tr key={`${ln.invoiceNumber}-${ln.invoiceDate}-${idx}`} style={{ borderBottom: idx < supplyInvoiceLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.supplyHouseName ?? '—'}</td>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.invoiceNumber}</td>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.invoiceDate || '—'}</td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ln.allocatedAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                  <MaterialsCostAccordionRow
                    title="Card charges"
                    totalDisplay={mercuryFetchFailed ? '—' : formatCurrency(mercuryCardTotal)}
                    expanded={materialsAccordionOpen === 'mercury'}
                    onToggle={() => toggleMaterialsAccordion('mercury')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {mercuryFetchFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>Could not load card allocations.</p>
                    ) : mercuryAllocLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No Mercury card splits for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Posted</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Card</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Counterparty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mercuryAllocLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < mercuryAllocLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{formatMercuryCardChargesPostedDate(ln.postedAt)}</td>
                              <td
                                style={{
                                  padding: '0.5rem 0.625rem',
                                  maxWidth: 140,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={
                                  ln.debitCardId
                                    ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId)
                                    : undefined
                                }
                              >
                                {ln.debitCardId
                                  ? nicknameByDebitCard[ln.debitCardId] ?? formatMercuryDebitCardIdCompact(ln.debitCardId)
                                  : '—'}
                              </td>
                              <td style={{ padding: '0.5rem 0.625rem' }}>{ln.counterpartyName ?? '—'}</td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Math.abs(ln.allocationAmount))}</td>
                              <td style={{ padding: '0.5rem 0.625rem', color: '#4b5563' }}>{ln.note ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                  <MaterialsCostAccordionRow
                    title="Parts from tally"
                    totalDisplay={tallyFetchFailed ? '—' : formatCurrency(tallyPartsTotal)}
                    expanded={materialsAccordionOpen === 'tally'}
                    onToggle={() => toggleMaterialsAccordion('tally')}
                    busy={jobMaterialsSnapshotLoading}
                  >
                    {tallyFetchFailed ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#b91c1c' }}>Could not load tally parts.</p>
                    ) : tallyPartLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>No tally parts for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'center', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tallyPartLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < tallyPartLines.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.625rem' }}>
                                {[ln.fixtureName, ln.partName].filter(Boolean).join(' · ') || '—'}
                              </td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'center' }}>{ln.quantity}</td>
                              <td style={{ padding: '0.5rem 0.625rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(ln.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </MaterialsCostAccordionRow>
                </>
              ) : null}
              <MaterialsCostAccordionRow
                title="Other job charges"
                totalDisplay={billedMaterialsTotalDisplay}
                expanded={materialsAccordionOpen === 'billed'}
                onToggle={() => toggleMaterialsAccordion('billed')}
                busy={false}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f9fafb' }}>
                    <tr>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Line Item</th>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Amount ($)</th>
                      <th style={{ padding: '0.625rem 0.5rem', minWidth: '4.5rem', width: '4.5rem', borderBottom: '1px solid #e5e7eb' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((row, idx) => {
                      const canRemove = materials.length > 1 || materialRowHasUserContent(row)
                      const removeTitle = materials.length > 1 ? 'Remove' : 'Clear row'
                      const showAddMaterialRow = materials.length === 1 || idx === materials.length - 1
                      return (
                      <tr key={row.id} style={{ borderBottom: idx < materials.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateMaterialRow(row.id, { description: e.target.value })}
                            placeholder="Item description"
                            style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.amount || ''}
                            onChange={(e) => updateMaterialRow(row.id, { amount: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            style={{ width: '6rem', padding: '0.375rem 0.625rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
                          />
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem', verticalAlign: 'middle' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 4,
                              flexWrap: 'nowrap',
                            }}
                          >
                            {showAddMaterialRow ? (
                              <button
                                type="button"
                                onClick={addMaterialRow}
                                title="Add line"
                                aria-label="Add line"
                                style={{
                                  padding: '0.35rem 0.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  lineHeight: 1,
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  minWidth: '1.75rem',
                                  flexShrink: 0,
                                }}
                              >
                                +
                              </button>
                            ) : null}
                            {canRemove ? (
                              <button
                                type="button"
                                onClick={() => removeMaterialRow(row.id)}
                                title={removeTitle}
                                aria-label={removeTitle}
                                style={{
                                  padding: '0.35rem',
                                  background: 'transparent',
                                  color: '#991b1c',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </MaterialsCostAccordionRow>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: '1.25rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {editing && authRole !== 'primary' && (
              <button
                type="button"
                onClick={() => setDeleteJobConfirmOpen(true)}
                disabled={deletingId === editing?.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: deletingId === editing?.id ? '#f3f4f6' : '#fee2e2',
                  color: deletingId === editing?.id ? '#9ca3af' : '#b91c1c',
                  border: 'none',
                  borderRadius: 4,
                  cursor: deletingId === editing?.id ? 'not-allowed' : 'pointer',
                }}
              >
                {deletingId === editing?.id ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={closeForm} style={{ padding: '0.5rem 1rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
            {!jobFormCanSubmit && !saving && jobFormMissingFields.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#FF6600', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {jobFormMissingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>
                    {f}
                  </span>
                ))}
              </span>
            )}
            <button
              type="button"
              onClick={saveJob}
              disabled={!jobFormCanSubmit || saving}
              title={!jobFormCanSubmit ? `Required: ${jobFormMissingFields.join(', ')}` : undefined}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: jobFormCanSubmit && !saving ? 'pointer' : 'not-allowed',
                fontWeight: 500,
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
      {paymentRemoveConfirmRowId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX,
          }}
          onClick={() => setPaymentRemoveConfirmRowId(null)}
        >
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Remove payment?</h2>
            {paymentRemovePreview ? (
              <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 0.75rem' }}>
                  This removes a payment of{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(paymentRemovePreview.rowAmt)}</strong> from this job.
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: '#6b7280' }}>Job total</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(paymentRemovePreview.jobTotal)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: '#6b7280' }}>Remaining ($) now</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(paymentRemovePreview.currentRem)}
                      </td>
                    </tr>
                    <tr style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.35rem 0', fontWeight: 600, color: '#111827' }}>Remaining ($) after removal</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#111827' }}>
                        ${formatCurrency(paymentRemovePreview.newRem)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>This payment line is no longer available.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setPaymentRemoveConfirmRowId(null)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemovePaymentRow}
                disabled={!paymentRemovePreview}
                style={{
                  padding: '0.5rem 1rem',
                  background: !paymentRemovePreview ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: !paymentRemovePreview ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Remove payment
              </button>
            </div>
          </div>
        </div>
      )}
      {unlinkMercuryConfirmRowId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX,
          }}
          onClick={() => {
            if (unlinkingMercuryPaymentId) return
            setUnlinkMercuryConfirmRowId(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-unlink-mercury-confirm-title"
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 520,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="job-form-unlink-mercury-confirm-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}
            >
              Unlink and remove?
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.75rem' }}>
                Remove this payment line from the job and unlink it from the bank deposit? The bank transaction will
                show those funds as available again in Jobs → Stages → Accounts Receivable.
              </p>
              <p
                style={{
                  margin:
                    normalizeJobsLedgerStatus(editing?.status) === 'paid' ? '0 0 0.75rem' : '0 0 1rem',
                }}
              >
                Only do this to fix a mistaken link or payment. Applying the same deposit again without fixing data
                could double-count.
              </p>
              {normalizeJobsLedgerStatus(editing?.status) === 'paid' ? (
                <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.8125rem' }}>
                  This job is Paid: if a balance remains after removing this payment, it will move back to Billed on
                  Stages.
                </p>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (unlinkingMercuryPaymentId) return
                  setUnlinkMercuryConfirmRowId(null)
                }}
                disabled={Boolean(unlinkingMercuryPaymentId)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: unlinkingMercuryPaymentId ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUnlinkMercuryFromBankRow}
                disabled={Boolean(unlinkingMercuryPaymentId)}
                style={{
                  padding: '0.5rem 1rem',
                  background: unlinkingMercuryPaymentId ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: unlinkingMercuryPaymentId ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {unlinkingMercuryPaymentId === unlinkMercuryConfirmRowId ? 'Removing…' : 'Unlink and remove'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteJobConfirmOpen && editing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX,
          }}
          onClick={() => {
            if (deletingId === editing.id) return
            setDeleteJobConfirmOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-delete-job-confirm-title"
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="job-form-delete-job-confirm-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}
            >
              Delete job from Billing?
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>HCP:</strong> {(editing.hcp_number ?? '').trim() || '—'}{' '}
                <strong>Job:</strong> {(editing.job_name ?? '').trim() || '—'}
              </p>
              <p style={{ margin: 0, color: '#6b7280' }}>
                This permanently removes the job from Billing. This cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (deletingId === editing.id) return
                  setDeleteJobConfirmOpen(false)
                }}
                disabled={deletingId === editing.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteJob()}
                disabled={deletingId === editing.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: deletingId === editing.id ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {deletingId === editing.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {jobBidLinkChoiceOpen && (
        <JobBidLinkChoiceModal
          open={jobBidLinkChoiceOpen}
          onClose={() => setJobBidLinkChoiceOpen(false)}
          zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
          bids={bids}
          customerId={customerId}
          onLinked={(id) => {
            const opt = bids.find((b) => b.id === id)
            setBidId(id)
            setLinkedBidSummary(
              opt
                ? { project_name: opt.project_name, bid_number: opt.bid_number }
                : { project_name: null, bid_number: null },
            )
            if (opt?.customer_id && !customerId) {
              setCustomerId(opt.customer_id)
            }
            setJobBidLinkChoiceOpen(false)
            setProjectFilesPlansExpanded(true)
            showToast('Bid linked. Save the job to keep changes.', 'info')
          }}
        />
      )}
      {jobProjectLinkChoiceOpen && (
        <JobProjectLinkChoiceModal
          open={jobProjectLinkChoiceOpen}
          onClose={() => setJobProjectLinkChoiceOpen(false)}
          zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
          projects={projects}
          customerId={customerId}
          onCreateNew={() => {
            setJobProjectLinkChoiceOpen(false)
            newProjectModal?.openNewProjectModal({
              prefill: {
                ...(customerId ? { customerId } : {}),
                ...(jobName.trim() ? { name: jobName.trim() } : {}),
                address: jobAddress.trim(),
                addressExplicit: true,
                ...(jobPlansLink.trim() ? { plansLink: jobPlansLink.trim() } : {}),
                ...(hcpNumber.trim() ? { hcp: hcpNumber.trim() } : {}),
                ...(editing?.id ? { linkJobId: editing.id, fromJobModal: true } : {}),
              },
            })
          }}
          onLinked={(pid) => {
            setProjectId(pid)
            const proj = projects.find((p) => p.id === pid)
            if (proj && !customerId) {
              setCustomerId(proj.customer_id)
            }
            setJobProjectLinkChoiceOpen(false)
            setProjectFilesPlansExpanded(true)
            showToast(`Linked to ${proj?.name ?? 'project'}. Save the job to keep changes.`, 'info')
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                jobFormProjectDisconnectRef.current?.focus()
              })
            })
          }}
        />
      )}
      {createCustomerFromJobModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX }} onClick={() => setCreateCustomerFromJobModalOpen(false)}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Create customer from job</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {customerName.trim() || '—'} · {jobAddress.trim() || '—'}
              {(customerEmail.trim() || customerPhone.trim()) && (
                <span> · {customerEmail.trim() || customerPhone.trim()}</span>
              )}
            </p>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Customer type</span>
              <div style={{ display: 'flex', gap: 0 }}>
                <button
                  type="button"
                  onClick={() => setCreateCustomerFromJobType('residential')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px 0 0 4px',
                    background: createCustomerFromJobType === 'residential' ? '#3b82f6' : 'white',
                    color: createCustomerFromJobType === 'residential' ? 'white' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Residential
                </button>
                <button
                  type="button"
                  onClick={() => setCreateCustomerFromJobType('commercial')}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0 4px 4px 0',
                    background: createCustomerFromJobType === 'commercial' ? '#3b82f6' : 'white',
                    color: createCustomerFromJobType === 'commercial' ? 'white' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  Commercial
                </button>
              </div>
            </label>
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ display: 'block', marginBottom: 4, fontSize: '0.875rem', fontWeight: 500 }}>Possible matches – link instead?</span>
              {createCustomerFromJobModalLoading ? (
                <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.875rem' }}>Loading…</div>
              ) : similarCustomersForCreate.length > 0 ? (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: 160, overflowY: 'auto' }}>
                  {similarCustomersForCreate.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleLinkToSimilarCustomer(c)}
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                    >
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.address && <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>{c.address}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '0.5rem', color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic' }}>No similar customers found</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCreateCustomerFromJobModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!customerName.trim() || creatingCustomerFromJob}
                onClick={() => handleCreateCustomerFromJob(createCustomerFromJobType)}
                style={{ padding: '0.5rem 1rem', background: !customerName.trim() || creatingCustomerFromJob ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: !customerName.trim() || creatingCustomerFromJob ? 'not-allowed' : 'pointer' }}
              >
                {creatingCustomerFromJob ? 'Creating…' : 'Create new customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

      <BilledBillViewModal
        invoice={billViewInvoice}
        onAfterStripeDetailsLoaded={refetchEditingFromBillView}
        onClose={() => {
          const jobId = editing?.id ?? null
          const invId = billViewInvoice?.id ?? null
          setBillViewInvoice(null)
          if (!jobId) return
          void (async () => {
            const tryRefetch = async () => {
              const found = await fetchJobWithDetailsById(jobId)
              if (found) setEditing(found)
              return found
            }
            for (let attempt = 0; attempt < 3; attempt++) {
              if (attempt > 0) await new Promise((r) => setTimeout(r, 280))
              const found = await tryRefetch()
              if (!found || !invId) break
              const inv = found.invoices.find((x) => x.id === invId)
              const stillNeeds =
                inv &&
                (inv.stripe_invoice_id ?? '').trim() &&
                (inv.hosted_invoice_url ?? '').trim() &&
                (!(inv.stripe_invoice_memo ?? '').trim() || !(inv.stripe_invoice_footer ?? '').trim())
              if (!stillNeeds) break
            }
          })()
        }}
        overlayZIndex={JOB_FORM_BILL_VIEW_OVERLAY_Z_INDEX}
      />
      <CustomerAcceptanceRecordModal
        open={contractModalEstimateId != null}
        estimateId={contractModalEstimateId}
        onClose={() => setContractModalEstimateId(null)}
      />
    </>
  )
}
