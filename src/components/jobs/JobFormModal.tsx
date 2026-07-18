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
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { effectiveJobLedgerNumber, formatBidLedgerDocTitle, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { parseCustomerImport } from '../../utils/parseCustomerImport'
import { nameSimilarity } from '../../utils/nameSimilarity'
import { formatPostgrestOrUnknownError, withSupabaseRetry } from '../../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../../lib/dispatchRequestHelpers'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import AutosizeTextarea from '../AutosizeTextarea'
import CustomerAcceptanceRecordModal from '../estimates/CustomerAcceptanceRecordModal'
import { MoneyDecimalAmountInput } from '../MoneyDecimalAmountInput'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { resolveCustomerIdForJobPayload } from '../../lib/jobLedgerCustomer'
import { filterActiveCustomersForPicker } from '../../lib/customerArchive'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import { resolveEditJobMasterUserId } from '../../lib/resolveEditJobMasterUserId'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { prepareBilledInvoicesBeforeJobRevertToReadyToBill } from '../../lib/voidStripeInvoiceForRevert'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { findInvoiceWithJobFromJobs } from '../../lib/invoiceWithJobFromJobList'
import { setReturnEditJobFromStages } from '../../lib/returnEditJobFromStages'
import { normalizeJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'
import { invoiceCreatedCalendarDayOffset } from '../../lib/invoiceCreatedRelative'
import { formatMercuryCardChargesPostedDate } from '../../lib/formatMercuryCardChargesPostedDate'
import { fetchJobMaterialsCostSnapshot } from '../../lib/fetchJobMaterialsCostSnapshot'
import { abbreviatePaymentReferenceLabel } from '../../lib/abbreviatePaymentReference'
import { formatMercuryDebitCardIdCompact } from '../../lib/mercuryRawDebitCard'
import {
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
  type JobMercuryAllocLine,
  type JobSupplyInvoiceLine,
  type JobTallyPartLine,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import { MaterialsCostAccordionRow } from './JobFormMaterialsCostAccordion'
import JobChargesTimelineStandalone from './JobChargesTimelineStandalone'
import JobProjectLinkChoiceModal from './JobProjectLinkChoiceModal'
import JobBidLinkChoiceModal, { type JobBidLinkOption } from './JobBidLinkChoiceModal'
import { JobFormImportEstimateOrBidModal } from './JobFormImportEstimateOrBidModal'
import {
  fixturesPayloadForCreateJobFromEstimate,
} from '../../lib/createJobFromEstimateSubmit'
import { normalizeEstimateLineItemsFromJson } from '../../lib/estimateLineItemNormalize'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import { useJobDetailOpenerBridge } from '../../contexts/JobDetailOpenerBridgeContext'
import { useNewProjectModal } from '../../contexts/NewProjectModalContext'
import BilledBillViewModal, { type InvoiceWithJobForBillView } from './BilledBillViewModal'
import AgreedWriteDownModal from './AgreedWriteDownModal'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
import { laborItemsSubtotal } from '../../lib/peopleLaborJobItemLineCost'
import {
  buildFixtureStripeLineDescriptionForStripe,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
  stripeInvoiceFixtureLineLength,
} from '../../lib/stripeInvoiceLineDescription'
import { SearchableSelect } from '../SearchableSelect'
import type { UserRole } from '../../hooks/useAuth'
import { fieldRoleServiceTypeIdsForUser, isAssistantLike, isSubcontractorLikeRole } from '../../lib/subcontractorLikeRole'
import { showJobCostBreakdownTeamLabor } from '../../lib/jobDetailModalRole'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type JobFormServiceType = { id: string; name: string; color: string | null }

type MeServiceTypeColumns = {
  role?: string
  estimator_service_type_ids?: string[] | null
  primary_service_type_ids?: string[] | null
  superintendent_service_type_ids?: string[] | null
  subcontractor_service_type_ids?: string[] | null
  helpers_service_type_ids?: string[] | null
}

function visibleServiceTypesForJobForm(types: JobFormServiceType[], me: MeServiceTypeColumns | null): JobFormServiceType[] {
  if (types.length === 0) return []
  const role = me?.role
  if (role === 'estimator' && me?.estimator_service_type_ids && me.estimator_service_type_ids.length > 0) {
    const f = types.filter((st) => me.estimator_service_type_ids!.includes(st.id))
    return f.length > 0 ? f : types
  }
  if (role === 'primary' && me?.primary_service_type_ids && me.primary_service_type_ids.length > 0) {
    const f = types.filter((st) => me.primary_service_type_ids!.includes(st.id))
    return f.length > 0 ? f : types
  }
  if (role === 'superintendent' && me?.superintendent_service_type_ids && me.superintendent_service_type_ids.length > 0) {
    const f = types.filter((st) => me.superintendent_service_type_ids!.includes(st.id))
    return f.length > 0 ? f : types
  }
  if (isSubcontractorLikeRole(role as UserRole)) {
    const fieldIds = fieldRoleServiceTypeIdsForUser(role as UserRole, me ?? {})
    if (fieldIds && fieldIds.length > 0) {
      const f = types.filter((st) => fieldIds.includes(st.id))
      return f.length > 0 ? f : types
    }
  }
  return types
}

function pickDefaultServiceTypeId(types: { id: string; name: string }[]): string | undefined {
  if (types.length === 0) return undefined
  if (types.length === 1) return types[0]!.id
  const plumb = types.find((st) => st.name === 'Plumbing')
  if (plumb) return plumb.id
  const elec = types.find((st) => st.name === 'Electrical')
  if (elec) return elec.id
  return types[0]!.id
}
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

/** Collapses newlines and internal whitespace; trims ends. Single logical line for DB / Stripe. */
function normalizeFixtureDisplayName(raw: string): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim()
}

function fixtureRowHasUserContent(row: FixtureRow): boolean {
  if (normalizeFixtureDisplayName(row.name ?? '') !== '') return true
  if ((row.line_description ?? '').trim() !== '') return true
  if (row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price))) return true
  const c = Number(row.count)
  if (Number.isFinite(c) && c !== 1) return true
  return false
}

function paymentRowHasUserContent(row: PaymentRow): boolean {
  if (Number(row.amount) !== 0) return true
  if ((row.note ?? '').trim() !== '') return true
  if ((row.reference_number ?? '').trim() !== '') return true
  if ((row.payment_type ?? '').trim() !== '') return true
  if (row.invoice_id != null && String(row.invoice_id).trim() !== '') return true
  if (row.mercury_transaction_id != null && String(row.mercury_transaction_id).trim() !== '') return true
  return false
}

/** True when the New Job sheet has any user-visible content; hides **Import** to avoid accidental overwrites. */
function newJobFormHasBlockingContent(args: {
  jobName: string
  jobAddress: string
  hcpNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  dateMet: string
  customerId: string | null
  bidId: string | null
  projectId: string | null
  formServiceTypeId: string
  /** Set on new-job init so auto-picked trade does not hide Import. */
  initialNewJobServiceTypeId: string
  googleDriveLink: string
  jobPicturesLink: string
  jobPlansLink: string
  lastBillDate: string
  fixtures: FixtureRow[]
  materials: MaterialRow[]
  payments: PaymentRow[]
  teamMemberIds: string[]
}): boolean {
  if (args.jobName.trim() || args.jobAddress.trim() || args.hcpNumber.trim()) return true
  if (
    args.customerId ||
    args.customerName.trim() ||
    args.customerEmail.trim() ||
    args.customerPhone.trim() ||
    args.dateMet.trim()
  ) {
    return true
  }
  if (args.bidId || args.projectId) return true
  if (
    args.formServiceTypeId.trim() !== '' &&
    args.formServiceTypeId !== args.initialNewJobServiceTypeId
  ) {
    return true
  }
  if (
    args.googleDriveLink.trim() ||
    args.jobPicturesLink.trim() ||
    args.jobPlansLink.trim() ||
    args.lastBillDate.trim()
  ) {
    return true
  }
  if (args.fixtures.length > 1 || args.fixtures.some(fixtureRowHasUserContent)) return true
  if (args.materials.length > 1 || args.materials.some(materialRowHasUserContent)) return true
  if (args.payments.length > 1 || args.payments.some(paymentRowHasUserContent)) return true
  if (args.teamMemberIds.length > 0) return true
  return false
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

function paymentRowsFromJob(job: JobWithDetails): PaymentRow[] {
  if (job.payments?.length) {
    return job.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paid_on: p.paid_on ? String(p.paid_on).slice(0, 10) : null,
      note: p.note ?? null,
      payment_type: p.payment_type ?? null,
      reference_number: p.reference_number ?? null,
      invoice_id: p.invoice_id ?? null,
      mercury_transaction_id: p.mercury_transaction_id ?? null,
    }))
  }
  return [newEmptyPaymentRow()]
}

function mercuryLinkedPaymentRow(row: PaymentRow): boolean {
  return row.mercury_transaction_id != null && String(row.mercury_transaction_id).trim().length > 0
}

/** Same roles as Accounts Receivable bank payment apply. */
function canUnlinkMercuryPayment(role: string | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'primary'
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

/** Mercury unlink RPC rejects Stripe-hosted invoices; hide/disable unlink when this applies. */
function mercuryUnlinkBlockedByStripeHostedInvoice(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (!job || !paymentRowLinkedToInvoice(row)) return false
  const inv = (job.invoices ?? []).find((i) => i.id === row.invoice_id)
  if (!inv) return false
  return jobsLedgerInvoiceIsStripeLinked(inv)
}

/** Manual payment lines that may be removed from the form (persist on Save); Stripe/Mercury/invoice-linked excluded. */
function canRemovePaymentRowFromForm(row: PaymentRow, job: JobWithDetails | null): boolean {
  if (mercuryLinkedPaymentRow(row)) return false
  if (paymentRowLinkedToInvoice(row)) return false
  if (stripeBillInvoiceForPaymentRow(row, job)) return false
  return true
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
  color: 'var(--text-muted)',
  wordBreak: 'break-word',
  lineHeight: 1.35,
}

const JOB_FIELD_CLIPBOARD_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
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
const JOB_FORM_MIGRATE_OVERLAY_Z_INDEX = JOB_FORM_NESTED_OVERLAY_Z_INDEX + 1
/** Above other job-form overlays so Import-from search stacks on top. */
const JOB_FORM_IMPORT_SOURCE_OVERLAY_Z_INDEX = JOB_FORM_MIGRATE_OVERLAY_Z_INDEX + 1

function formatJobFormBidLinkTitle(
  prefixMap: LedgerPrefixMap,
  summary: {
    project_name: string | null
    bid_number: string | null
    service_type_id?: string | null
  } | null,
): string {
  if (!summary) return ''
  const name = (summary.project_name ?? '').trim() || 'Untitled'
  const n = summary.bid_number != null && String(summary.bid_number).trim() !== '' ? String(summary.bid_number).trim() : null
  return n ? formatBidLedgerDocTitle(prefixMap, summary.service_type_id ?? null, n, name) : name
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
        color: 'var(--text-link)',
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
  /** When set on a new job, prefill runs after init (same as Import → bid). */
  newJobPrefillBidId?: string | null
  billingCustomerHighlightInitial: boolean
  fixturesSectionHighlightInitial: boolean
  /** Scroll to / focus / flash the Customer Pictures input (dispatch "Add Customer Pictures URL"). */
  jobPicturesLinkHighlightInitial: boolean
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
  newJobPrefillBidId = null,
  billingCustomerHighlightInitial,
  fixturesSectionHighlightInitial,
  jobPicturesLinkHighlightInitial,
  alsoOpenCreateCustomerModal,
  onClose,
  onSaved,
  onCreatedJobId = null,
}: JobFormModalProps) {
  const { user: authUser, role: authRole } = useAuth()
  const { nicknameByDebitCard } = useMercuryLedgerNicknames()
  const { showToast } = useToastContext()
  const prefixMap = useLedgerPrefixMap()
  const billCustomer = useBillCustomerModal()
  const jobDetailOpenerBridge = useJobDetailOpenerBridge()
  const newProjectModal = useNewProjectModal()
  const navigate = useNavigate()
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onCreatedJobIdRef = useRef(onCreatedJobId)
  onCreatedJobIdRef.current = onCreatedJobId

  const [initDone, setInitDone] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [billViewInvoice, setBillViewInvoice] = useState<InvoiceWithJobForBillView | null>(null)
  const [agreedWriteDownInvoice, setAgreedWriteDownInvoice] = useState<
    Database['public']['Tables']['jobs_ledger_invoices']['Row'] | null
  >(null)
  const editingIdRef = useRef<string | null>(null)
  editingIdRef.current = editing?.id ?? null

  const refetchEditingFromBillView = useCallback(() => {
    const jobId = editingIdRef.current
    if (!jobId) return
    void fetchJobWithDetailsById(jobId).then((found) => {
      if (found) {
        setEditing(found)
        setBillViewInvoice((prev) => {
          if (!prev) return null
          const merged = findInvoiceWithJobFromJobs([found], prev.id)
          return merged ?? prev
        })
      }
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
  const [clickNumber, setClickNumber] = useState('')
  const [hcpHelpOpen, setHcpHelpOpen] = useState(false)
  const hcpHelpRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hcpHelpOpen) return
    function onDocMouseDown(e: globalThis.MouseEvent) {
      if (hcpHelpRef.current && !hcpHelpRef.current.contains(e.target as Node)) setHcpHelpOpen(false)
    }
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setHcpHelpOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [hcpHelpOpen])
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
    service_type_id?: string | null
  } | null>(null)
  const [bids, setBids] = useState<JobBidLinkOption[]>([])
  const [serviceTypes, setServiceTypes] = useState<JobFormServiceType[]>([])
  const [meServiceTypeColumns, setMeServiceTypeColumns] = useState<MeServiceTypeColumns | null>(null)
  const [formServiceTypeId, setFormServiceTypeId] = useState('')
  const [jobBidLinkChoiceOpen, setJobBidLinkChoiceOpen] = useState(false)
  const [jobImportSourceOpen, setJobImportSourceOpen] = useState(false)
  /** Auto-picked trade on new-job load; changing away from this counts as “content” for hiding Import. */
  const initialNewJobServiceTypeIdRef = useRef('')
  /** Avoid duplicate applyPrefillFromBid before bidId state updates (e.g. Strict Mode). */
  const newJobPrefillBidAppliedRef = useRef<string | null>(null)
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
  const [jobPicturesLinkHighlight, setJobPicturesLinkHighlight] = useState(false)
  const [dateMet, setDateMet] = useState('')
  const [lastBillDate, setLastBillDate] = useState('')
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [jobPicturesLink, setJobPicturesLink] = useState('')
  const [jobPlansLink, setJobPlansLink] = useState('')
  const [payments, setPayments] = useState<PaymentRow[]>(() => [newEmptyPaymentRow()])
  const refreshEditingJobAndHydratePayments = useCallback((jobId: string) => {
    void fetchJobWithDetailsById(jobId).then((found) => {
      if (!found) return
      setEditing(found)
      setPayments(paymentRowsFromJob(found))
      setBillViewInvoice((prev) => {
        if (!prev) return prev
        const row = found.invoices?.find((i) => i.id === prev.id)
        return row ? { ...row, job: found } : prev
      })
    })
  }, [])
  const canApplyAgreedWriteDown = useMemo(
    () =>
      authRole === 'dev' ||
      authRole === 'master_technician' ||
      isAssistantLike(authRole) ||
      authRole === 'primary',
    [authRole],
  )
  const agreedWriteDownInvoicePaidSum = useMemo(() => {
    if (!agreedWriteDownInvoice) return 0
    return payments
      .filter((p) => p.invoice_id === agreedWriteDownInvoice.id)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0)
  }, [agreedWriteDownInvoice, payments])
  const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), description: '', amount: 0 }])
  const [fixtures, setFixtures] = useState<FixtureRow[]>([
    { id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '' },
  ])
  /** User opened "Add scope or notes" for this fixture row id (persists while row exists). */
  const [fixtureScopeExpandedById, setFixtureScopeExpandedById] = useState<Record<string, boolean>>({})
  const [stripeFixturePreviewRowId, setStripeFixturePreviewRowId] = useState<string | null>(null)
  const stripeFixturePreviewRow = useMemo(
    () =>
      stripeFixturePreviewRowId
        ? fixtures.find((f) => f.id === stripeFixturePreviewRowId) ?? null
        : null,
    [fixtures, stripeFixturePreviewRowId],
  )
  useEffect(() => {
    if (!stripeFixturePreviewRowId) return
    const onKeyDown = (ev: WindowEventMap['keydown']) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        setStripeFixturePreviewRowId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stripeFixturePreviewRowId])
  const jobTotalBidDollars = useMemo(() => revenueDollarsFromFixtures(fixtures), [fixtures])
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  const newJobImportBlockedByContent = useMemo(() => {
    if (mode !== 'new' || editing) return false
    return newJobFormHasBlockingContent({
      jobName,
      jobAddress,
      hcpNumber,
      customerName,
      customerEmail,
      customerPhone,
      dateMet,
      customerId,
      bidId,
      projectId,
      formServiceTypeId,
      initialNewJobServiceTypeId: initialNewJobServiceTypeIdRef.current,
      googleDriveLink,
      jobPicturesLink,
      jobPlansLink,
      lastBillDate,
      fixtures,
      materials,
      payments,
      teamMemberIds,
    })
  }, [
    mode,
    editing,
    jobName,
    jobAddress,
    hcpNumber,
    customerName,
    customerEmail,
    customerPhone,
    dateMet,
    customerId,
    bidId,
    projectId,
    formServiceTypeId,
    googleDriveLink,
    jobPicturesLink,
    jobPlansLink,
    lastBillDate,
    fixtures,
    materials,
    payments,
    teamMemberIds,
  ])
  useEffect(() => {
    if (newJobImportBlockedByContent && jobImportSourceOpen) {
      setJobImportSourceOpen(false)
    }
  }, [newJobImportBlockedByContent, jobImportSourceOpen])
  const [contractorsSearch, setContractorsSearch] = useState('')
  const [contractorsDropdownOpen, setContractorsDropdownOpen] = useState(false)
  const contractorsDropdownRef = useRef<HTMLDivElement | null>(null)
  const billingCustomerHighlightRef = useRef<HTMLDivElement | null>(null)
  const fixturesSectionHighlightRef = useRef<HTMLDivElement | null>(null)
  const jobPicturesLinkHighlightRef = useRef<HTMLDivElement | null>(null)
  const jobPicturesLinkInputRef = useRef<HTMLInputElement | null>(null)
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
  const [migrateJobModalOpen, setMigrateJobModalOpen] = useState(false)
  const [migrateTargetSearch, setMigrateTargetSearch] = useState('')
  const [migrateTargetCandidates, setMigrateTargetCandidates] = useState<
    Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }>
  >([])
  const [migrateTargetSearchLoading, setMigrateTargetSearchLoading] = useState(false)
  const [migrateTargetJobId, setMigrateTargetJobId] = useState<string | null>(null)
  const [migrateTargetPreviewLoading, setMigrateTargetPreviewLoading] = useState(false)
  const [migrateTargetPreview, setMigrateTargetPreview] = useState<{
    supply: number
    tally: number
    mercury: number
    teamCost: number
    teamHours: number
  } | null>(null)
  const [migratingJob, setMigratingJob] = useState(false)
  const [unlinkingMercuryPaymentId, setUnlinkingMercuryPaymentId] = useState<string | null>(null)
  const [paymentRemoveRpcBusy, setPaymentRemoveRpcBusy] = useState(false)
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

  const visibleJobFormServiceTypes = useMemo(
    () => visibleServiceTypesForJobForm(serviceTypes, meServiceTypeColumns),
    [serviceTypes, meServiceTypeColumns],
  )

  const persistedLedgerPaymentIds = useMemo(
    () => new Set((editing?.payments ?? []).map((p) => p.id)),
    [editing?.payments],
  )

  /** Include current job's type when it is not in the role-filtered list (same idea as Bids). */
  const jobFormServiceTypeSelectOptions = useMemo(() => {
    const vis = visibleJobFormServiceTypes
    if (mode === 'edit' && formServiceTypeId && !vis.some((s) => s.id === formServiceTypeId)) {
      const fromAll = serviceTypes.find((s) => s.id === formServiceTypeId)
      if (fromAll) {
        return [fromAll, ...vis.filter((s) => s.id !== formServiceTypeId)]
      }
    }
    return vis
  }, [mode, formServiceTypeId, visibleJobFormServiceTypes, serviceTypes])

  const jobFormMissingFields = useMemo(() => {
    const m: string[] = []
    if (!jobName.trim()) m.push('Job Name')
    if (!jobAddress.trim()) m.push('Job Address')
    if (!formServiceTypeId.trim()) m.push('Service type')
    return m
  }, [jobName, jobAddress, formServiceTypeId])
  const jobFormCanSubmit = jobFormMissingFields.length === 0

  const editJobEffectiveHcp = useMemo(
    () => (hcpNumber ?? '').trim() || (editing?.hcp_number ?? '').trim(),
    [hcpNumber, editing?.hcp_number],
  )

  const canLinkTeamLaborOnJobs = useMemo(
    () => !isAssistantLike(authRole) && authRole !== 'superintendent' && authRole !== 'primary',
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

  const materialsBilledTotalForMigrate = useMemo(
    () => materials.reduce((s, m) => s + (Number(m.amount) || 0), 0),
    [materials],
  )

  const partsCostStyleTotal = useMemo(
    () =>
      supplyInvoiceTotal +
      tallyPartsTotalFromLines(tallyPartLines) +
      mercuryCardTotalFromLines(mercuryAllocLines),
    [supplyInvoiceTotal, tallyPartLines, mercuryAllocLines],
  )

  const costSnapshotStillLoading =
    jobMaterialsSnapshotLoading || editJobTeamLaborLoading || editJobSubLaborLoading

  const hasMigrateableCosts = useMemo(() => {
    if (partsCostStyleTotal > 0) return true
    if (materialsBilledTotalForMigrate > 0) return true
    if (materials.some(materialRowHasUserContent)) return true
    const team = editJobTeamLaborRow
    if (team && (team.jobCost > 0 || team.manHours > 0)) return true
    if (editJobSubLaborData && editJobSubLaborData.count > 0) return true
    return false
  }, [
    partsCostStyleTotal,
    materialsBilledTotalForMigrate,
    materials,
    editJobTeamLaborRow,
    editJobSubLaborData,
  ])

  // We couldn't confirm this job's costs if any cost source failed to load. Treated
  // like "has costs" so a delete can't slip through unverified (force-reassign).
  const costCheckErrored =
    editJobTeamLaborError ||
    editJobSubLaborError ||
    supplyInvoiceRpcFailed ||
    mercuryFetchFailed ||
    tallyFetchFailed

  // A job with costs (or whose costs we couldn't verify) must be reassigned to
  // another job before it can be deleted — there is no plain-delete escape hatch.
  const reassignRequired = hasMigrateableCosts || costCheckErrored

  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)
  const jobFormProjectSectionRef = useRef<HTMLDivElement | null>(null)
  const jobFormProjectSelectRef = useRef<HTMLSelectElement | null>(null)
  const jobFormProjectDisconnectRef = useRef<HTMLButtonElement | null>(null)
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
    setPaymentRemoveRpcBusy(false)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
    setMigrateJobModalOpen(false)
    setMigrateTargetSearch('')
    setMigrateTargetCandidates([])
    setMigrateTargetJobId(null)
    setMigrateTargetPreview(null)
    setMigrateTargetPreviewLoading(false)
    setMigrateTargetSearchLoading(false)
    setMigratingJob(false)
    onClose()
  }

  function applyEditJob(job: JobWithDetails, billingGate: boolean, fixturesGate: boolean, picturesGate: boolean) {
    setPaymentRemoveConfirmRowId(null)
    setPaymentRemoveRpcBusy(false)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
    setMigrateJobModalOpen(false)
    setMigrateTargetSearch('')
    setMigrateTargetCandidates([])
    setMigrateTargetJobId(null)
    setMigrateTargetPreview(null)
    setMigrateTargetPreviewLoading(false)
    setMigrateTargetSearchLoading(false)
    setMigratingJob(false)
    setBillViewInvoice(null)
    setBillingCustomerHighlight(billingGate)
    setFixturesSectionHighlight(fixturesGate)
    setJobPicturesLinkHighlight(picturesGate)
    setEditing(job)
    setHcpNumber(job.hcp_number ?? '')
    setClickNumber(job.click_number ?? '')
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
        ? {
            project_name: job.linkedBid.project_name,
            bid_number: job.linkedBid.bid_number,
            service_type_id: job.linkedBid.service_type_id ?? null,
          }
        : job.bid_id
          ? { project_name: null, bid_number: null, service_type_id: null }
          : null,
    )
    setFormServiceTypeId(job.service_type_id ?? '')
    setCustomerSearch('')
    setCustomerExpanded(picturesGate || (billingGate && !jobLedgerHasCustomerForBilling(job.customer_id)))
    setLastBillDate(job.last_bill_date ? job.last_bill_date.slice(0, 10) : '')
    setGoogleDriveLink(job.google_drive_link ?? '')
    setJobPicturesLink(job.job_pictures_link ?? '')
    setJobPlansLink(job.job_plans_link ?? '')
    setProjectFilesPlansExpanded(false)
    setPayments(paymentRowsFromJob(job))
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
    setClickNumber('')
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
    setJobPicturesLink('')
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
    setJobPicturesLinkHighlight(false)
    setSourceEstimateForJob(null)
    setContractModalEstimateId(null)
    setNewInvoiceAmount('')
    setNewInvoiceAmountInputFocused(false)
    setPaymentRemoveConfirmRowId(null)
    setPaymentRemoveRpcBusy(false)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
    setFormServiceTypeId('')
    setJobImportSourceOpen(false)
  }

  const applyPrefillFromBid = useCallback(
    async (bidRowId: string) => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('bids')
              .select(
                'id, project_name, bid_number, service_type_id, customer_id, address, drive_link, plans_link, customers(name, address, contact_info, date_met)',
              )
              .eq('id', bidRowId)
              .maybeSingle(),
          'job form import bid',
        )
        if (!row) {
          showToast('Bid not found.', 'error')
          return
        }
        const b = row as {
          id: string
          project_name: string | null
          bid_number: string | null
          service_type_id: string | null
          customer_id: string | null
          address: string | null
          drive_link: string | null
          plans_link: string | null
          customers: {
            name: string
            address: string | null
            contact_info: unknown
            date_met: string | null
          } | null
        }
        setBidId(b.id)
        setJobName((b.project_name ?? '').trim())
        setJobAddress((b.address ?? '').trim())
        setLinkedBidSummary({
          project_name: b.project_name,
          bid_number: b.bid_number,
          service_type_id: b.service_type_id ?? null,
        })
        setBids((prev) => {
          if (prev.some((x) => x.id === b.id)) return prev
          const opt: JobBidLinkOption = {
            id: b.id,
            project_name: b.project_name,
            bid_number: b.bid_number,
            customer_id: b.customer_id,
            customers: b.customers ? { name: b.customers.name } : null,
            service_type_id: b.service_type_id ?? null,
          }
          return [opt, ...prev]
        })
        const vis = visibleServiceTypesForJobForm(serviceTypes, meServiceTypeColumns)
        const allowed = new Set(vis.map((s) => s.id))
        if (b.service_type_id && allowed.has(b.service_type_id)) {
          setFormServiceTypeId(b.service_type_id)
        } else if (b.service_type_id) {
          showToast('Bid trade is not available for your role in this form; choose a service type.', 'info')
        }
        if (b.customer_id) {
          setCustomerId(b.customer_id)
          const cList = customers.find((c) => c.id === b.customer_id)
          if (cList) {
            setCustomerName(cList.name ?? '')
            setDateMet(cList.date_met ? (cList.date_met.split('T')[0] ?? '') : '')
            const ci = cList.contact_info as { phone?: string; email?: string } | null
            if (ci) {
              setCustomerEmail(ci.email ?? '')
              setCustomerPhone(ci.phone ?? '')
            } else {
              setCustomerEmail('')
              setCustomerPhone('')
            }
          } else if (b.customers) {
            setCustomerName(b.customers.name ?? '')
            setDateMet(b.customers.date_met ? (b.customers.date_met.split('T')[0] ?? '') : '')
            const ci = b.customers.contact_info as { phone?: string; email?: string } | null
            if (ci) {
              setCustomerEmail(ci.email ?? '')
              setCustomerPhone(ci.phone ?? '')
            } else {
              setCustomerEmail('')
              setCustomerPhone('')
            }
          } else {
            setCustomerName('')
            setCustomerEmail('')
            setCustomerPhone('')
            setDateMet('')
          }
        } else {
          setCustomerId(null)
          setCustomerName('')
          setCustomerEmail('')
          setCustomerPhone('')
          setDateMet('')
        }
        setGoogleDriveLink((prev) => (prev.trim() ? prev : (b.drive_link ?? '').trim()))
        setJobPlansLink((prev) => (prev.trim() ? prev : (b.plans_link ?? '').trim()))
        showToast('Imported from bid.', 'success')
      } catch (e) {
        showToast(formatPostgrestOrUnknownError(e, 'Could not load bid'), 'error')
      }
    },
    [customers, meServiceTypeColumns, serviceTypes, showToast],
  )

  const applyPrefillFromEstimate = useCallback(
    async (estimateId: string) => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('estimates')
              .select('id, customer_id, for_address, title, line_items_snapshot, job_ledger_id, customer_email')
              .eq('id', estimateId)
              .maybeSingle(),
          'job form import estimate',
        )
        if (!row) {
          showToast('Estimate not found.', 'error')
          return
        }
        const e = row as Pick<
          EstimatesRow,
          'id' | 'customer_id' | 'for_address' | 'title' | 'line_items_snapshot' | 'job_ledger_id' | 'customer_email'
        >
        if (e.job_ledger_id) {
          showToast('This estimate is already linked to a job.', 'warning')
          return
        }
        setBidId(null)
        setLinkedBidSummary(null)
        setJobName((e.title ?? '').trim())
        setJobAddress((e.for_address ?? '').trim())
        const lines = normalizeEstimateLineItemsFromJson(e.line_items_snapshot)
        const payload = fixturesPayloadForCreateJobFromEstimate(lines)
        const nextFixtures: FixtureRow[] =
          payload.length > 0
            ? payload.map((p) => ({
                id: crypto.randomUUID(),
                name: p.name,
                count: p.count,
                line_unit_price: p.line_unit_price,
                line_description: p.line_description ?? '',
              }))
            : [{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '' }]
        setFixtures(nextFixtures)
        setFixtureScopeExpandedById({})
        const estimateCustomerId = e.customer_id
        if (estimateCustomerId) {
          setCustomerId(estimateCustomerId)
          let cList = customers.find((c) => c.id === estimateCustomerId)
          if (!cList) {
            const fetched = await withSupabaseRetry(
              async () =>
                await supabase
                  .from('customers')
                  .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
                  .eq('id', estimateCustomerId)
                  .maybeSingle(),
              'job form import estimate customer',
            )
            if (fetched) {
              cList = fetched as CustomerRow
              setCustomers((prev) => (prev.some((c) => c.id === cList!.id) ? prev : [...prev, cList!]))
            }
          }
          if (cList) {
            setCustomerName(cList.name ?? '')
            setDateMet(cList.date_met ? (cList.date_met.split('T')[0] ?? '') : '')
            const ci = cList.contact_info as { phone?: string; email?: string } | null
            if (ci) {
              setCustomerEmail(ci.email ?? '')
              setCustomerPhone(ci.phone ?? '')
            } else {
              setCustomerEmail('')
              setCustomerPhone('')
            }
          } else {
            setCustomerName('')
            setCustomerEmail((e.customer_email ?? '').trim())
            setCustomerPhone('')
            setDateMet('')
          }
        } else {
          setCustomerId(null)
          setCustomerName('')
          setCustomerEmail((e.customer_email ?? '').trim())
          setCustomerPhone('')
          setDateMet('')
        }
        showToast('Imported from estimate.', 'success')
      } catch (err) {
        showToast(formatPostgrestOrUnknownError(err, 'Could not load estimate'), 'error')
      }
    },
    [customers, showToast],
  )

  useLayoutEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      setCustomersLoading(true)
      try {
        async function loadFormUsers(meRole: string | undefined) {
          if (!authUser?.id) return
          const { data: usersRes } = await supabase
            .from('users')
            .select('id, name, email, role')
            .in('role', ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller' as Database['public']['Enums']['user_role']])
            .order('name')
          let usersList = (usersRes as UserRow[]) ?? []
          if (meRole === 'dev') {
            const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
            if (devUsers?.length) {
              const existingIds = new Set(usersList.map((u) => u.id))
              const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
              usersList = [...usersList, ...newDevs]
            }
          }
          if (!cancelled) setUsers(usersList)
        }

        const [
          { data: custData },
          { data: projData },
          { data: bidData },
          { data: stData },
          { data: meRow },
        ] = await Promise.all([
          supabase.from('customers').select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at').order('name'),
          supabase.from('projects').select('id, name, customer_id, master_user_id, customers(name)').order('name'),
          supabase
            .from('bids')
            .select('id, project_name, bid_number, service_type_id, customer_id, customers(name)')
            .order('updated_at', { ascending: false })
            .limit(800),
          supabase.from('service_types').select('id, name, color, description, sequence_order').order('sequence_order', { ascending: true }),
          supabase
            .from('users')
            .select(
              'role, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids, subcontractor_service_type_ids, helpers_service_type_ids',
            )
            .eq('id', authUser.id)
            .single(),
        ])
        if (cancelled) return
        const allServiceTypes = (stData as JobFormServiceType[] | null) ?? []
        setCustomers((custData as CustomerRow[]) ?? [])
        setProjects((projData as ProjectOption[]) ?? [])
        setBids((bidData as JobBidLinkOption[]) ?? [])
        setServiceTypes(allServiceTypes)
        setMeServiceTypeColumns((meRow as MeServiceTypeColumns | null) ?? null)
        await loadFormUsers((meRow as MeServiceTypeColumns | null)?.role)
        if (cancelled) return

        if (mode === 'new') {
          resetNewForm(newJobProjectId)
          // Offer the next global job number (highest numeric HCP-or-C# + 1) as the
          // default C#, editable. Runs async; only fills if still mounted.
          void (async () => {
            try {
              const suggestion = await withSupabaseRetry(
                async () => await supabase.rpc('next_job_number_suggestion'),
                'next job number suggestion',
              )
              if (!cancelled && typeof suggestion === 'string' && suggestion.length > 0) {
                setClickNumber(suggestion)
              }
            } catch {
              /* leave C# blank if the suggestion can't be fetched */
            }
          })()
          const meSt = (meRow as MeServiceTypeColumns | null) ?? null
          const vis = visibleServiceTypesForJobForm(allServiceTypes, meSt)
          const defId = pickDefaultServiceTypeId(vis) ?? ''
          initialNewJobServiceTypeIdRef.current = defId
          setFormServiceTypeId(defId)
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
          applyEditJob(job, billingCustomerHighlightInitial, fixturesSectionHighlightInitial, jobPicturesLinkHighlightInitial)
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
    if (!initDone || mode !== 'new') return
    const pid = (newJobPrefillBidId ?? '').trim()
    if (!pid) return
    if (bidId === pid) return
    if (newJobPrefillBidAppliedRef.current === pid) return
    newJobPrefillBidAppliedRef.current = pid
    void applyPrefillFromBid(pid)
  }, [initDone, mode, newJobPrefillBidId, applyPrefillFromBid, bidId])

  useEffect(() => {
    if (!bidId) return
    const b = bids.find((x) => x.id === bidId)
    if (!b) return
    setLinkedBidSummary((prev) => {
      const label = formatJobFormBidLinkTitle(prefixMap, prev)
      if (label && label !== 'Untitled') return prev
      return {
        project_name: b.project_name,
        bid_number: b.bid_number,
        service_type_id: b.service_type_id ?? null,
      }
    })
  }, [bids, bidId, prefixMap])

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
    if (!migrateJobModalOpen || !editing?.id) {
      setMigrateTargetCandidates([])
      setMigrateTargetSearchLoading(false)
      return
    }
    const sourceJobId = editing.id
    const q = migrateTargetSearch.trim()
    if (q.length < 2) {
      setMigrateTargetCandidates([])
      setMigrateTargetSearchLoading(false)
      return
    }
    setMigrateTargetSearchLoading(true)
    let cancelledOuter = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(
            async () => supabase.rpc('search_jobs_ledger', { search_text: q }),
            'migrate job target search',
          )
          const rows = (raw ?? []) as Array<{ id: string; hcp_number: string; click_number?: string; job_name: string; job_address: string }>
          if (cancelledOuter) return
          setMigrateTargetCandidates(rows.filter((r) => r.id !== sourceJobId).slice(0, 30))
        } catch {
          if (!cancelledOuter) setMigrateTargetCandidates([])
        } finally {
          if (!cancelledOuter) setMigrateTargetSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelledOuter = true
      window.clearTimeout(timer)
    }
  }, [migrateJobModalOpen, migrateTargetSearch, editing?.id])

  useEffect(() => {
    const tid = migrateTargetJobId
    if (!tid) {
      setMigrateTargetPreview(null)
      setMigrateTargetPreviewLoading(false)
      return
    }
    let cancelled = false
    setMigrateTargetPreviewLoading(true)
    setMigrateTargetPreview(null)
    void (async () => {
      try {
        const snap = await fetchJobMaterialsCostSnapshot(tid)
        const teamRows = await loadTeamLaborData(supabase)
        const teamRow = teamRows.find((r) => r.jobId === tid) ?? null
        if (cancelled) return
        setMigrateTargetPreview({
          supply: snap.supplyInvoiceTotal,
          tally: tallyPartsTotalFromLines(snap.tallyPartLines),
          mercury: mercuryCardTotalFromLines(snap.mercuryAllocLines),
          teamCost: teamRow?.jobCost ?? 0,
          teamHours: teamRow?.manHours ?? 0,
        })
      } catch {
        if (!cancelled) setMigrateTargetPreview(null)
      } finally {
        if (!cancelled) setMigrateTargetPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [migrateTargetJobId])

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
    if (!jobPicturesLinkHighlight) return
    const id = requestAnimationFrame(() => {
      jobPicturesLinkHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const input = jobPicturesLinkInputRef.current
      if (input) {
        input.focus()
        try {
          input.select()
        } catch {
          // ignore environments where select() throws on empty inputs
        }
      }
    })
    return () => cancelAnimationFrame(id)
  }, [jobPicturesLinkHighlight])

  useEffect(() => {
    if (!jobPicturesLinkHighlight) return
    const t = window.setTimeout(() => setJobPicturesLinkHighlight(false), 2500)
    return () => window.clearTimeout(t)
  }, [jobPicturesLinkHighlight])

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
        .select('id, name, address, contact_info, date_met, master_user_id, customer_type, archived_at')
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
    color: 'var(--text-link)',
    font: 'inherit',
    fontWeight: 400,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  }

  const projectFilesPlansPlainSegmentStyle: CSSProperties = {
    fontWeight: 400,
    color: 'var(--text-muted)',
    fontSize: 'inherit',
  }

  const projectFilesPlansPipeStyle: CSSProperties = {
    color: 'var(--text-faint)',
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

  const paymentRemoveConfirmsPersistedRpc = useMemo(() => {
    if (!paymentRemoveConfirmRowId || !editing) return false
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row) return false
    return (
      persistedLedgerPaymentIds.has(row.id) &&
      !mercuryLinkedPaymentRow(row) &&
      !stripeBillInvoiceForPaymentRow(row, editing)
    )
  }, [paymentRemoveConfirmRowId, payments, editing, persistedLedgerPaymentIds])

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
        click_number: editing.click_number,
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
        onAfterOobUnwindSuccess: async () => {
          refreshEditingJobAndHydratePayments(jobId)
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
    setPayments((prev) => {
      const row = prev.find((r) => r.id === id)
      if (!row) return prev
      if (
        mercuryLinkedPaymentRow(row) ||
        paymentRowLinkedToInvoice(row) ||
        stripeBillInvoiceForPaymentRow(row, editing)
      ) {
        return prev
      }
      const next = prev.filter((r) => r.id !== id)
      if (next.length === 0) return [newEmptyPaymentRow()]
      return next
    })
  }

  function requestRemovePaymentRow(row: PaymentRow) {
    if (mercuryLinkedPaymentRow(row)) {
      showToast('This payment is linked to a bank transaction. Remove it from Jobs Stages → Bank Payments workflow if needed.', 'error')
      return
    }
    if (stripeBillInvoiceForPaymentRow(row, editing)) {
      showToast(
        'This payment is linked to a Stripe invoice and can’t be removed in Edit Job. Use Stripe reversal flows.',
        'error',
      )
      return
    }
    const persisted = Boolean(editing && persistedLedgerPaymentIds.has(row.id))
    const openConfirm =
      canRemovePaymentRowFromForm(row, editing) || (persisted && paymentRowLinkedToInvoice(row))
    if (!openConfirm) {
      if (paymentRowLinkedToInvoice(row)) {
        showToast(
          'This payment is linked to an invoice and can’t be removed in Edit Job. Change it from Outstanding billing or the mark-paid flow.',
          'error',
        )
      }
      return
    }
    setPaymentRemoveConfirmRowId(row.id)
  }

  async function confirmRemovePaymentRow() {
    if (!paymentRemoveConfirmRowId || !editing) return
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row) {
      setPaymentRemoveConfirmRowId(null)
      return
    }

    const persistedRpc =
      persistedLedgerPaymentIds.has(row.id) &&
      !mercuryLinkedPaymentRow(row) &&
      !stripeBillInvoiceForPaymentRow(row, editing)

    if (persistedRpc) {
      setPaymentRemoveRpcBusy(true)
      try {
        const raw = await withSupabaseRetry(
          async () =>
            supabase.rpc('remove_jobs_ledger_payment_and_reconcile', { p_payment_id: row.id }),
          'remove_jobs_ledger_payment_and_reconcile',
        )
        const payload = raw as { error?: string; ok?: boolean; warning?: string } | null
        if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
          showToast(payload.error, 'error')
          return
        }
        if (payload?.warning) {
          showToast(payload.warning, 'warning')
        } else {
          showToast('Payment removed.', 'success')
        }

        const found = await fetchJobWithDetailsById(editing.id)
        if (found) {
          setEditing(found)
          setPayments(paymentRowsFromJob(found))
        }
        setPaymentRemoveConfirmRowId(null)
        onSavedRef.current?.()
      } catch (e: unknown) {
        showToast(formatPostgrestOrUnknownError(e, 'Failed to remove payment'), 'error')
      } finally {
        setPaymentRemoveRpcBusy(false)
      }
      return
    }

    if (!canRemovePaymentRowFromForm(row, editing)) {
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
      if (mercuryUnlinkBlockedByStripeHostedInvoice(row, editing)) {
        showToast(
          'Stripe-hosted invoice payments cannot be removed here; use Stripe reversal flows.',
          'error',
        )
        setUnlinkMercuryConfirmRowId(null)
        return
      }
      setUnlinkingMercuryPaymentId(row.id)
      try {
        const raw = await withSupabaseRetry(
          async () =>
            supabase.rpc('remove_jobs_ledger_payment_and_reconcile', { p_payment_id: row.id }),
          'remove_jobs_ledger_payment_and_reconcile',
        )
        const payload = raw as { error?: string; ok?: boolean; warning?: string } | null
        if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) {
          showToast(payload.error, 'error')
          return
        }
        if (payload?.warning) {
          showToast(payload.warning, 'warning')
        } else {
          showToast(
            'Payment removed from job. The bank deposit is available in Accounts Receivable again.',
            'success',
          )
        }

        const found = await fetchJobWithDetailsById(jobId)
        if (found) {
          setEditing(found)
          setPayments(paymentRowsFromJob(found))
        }
        onSavedRef.current?.()
      } catch (e: unknown) {
        showToast(formatPostgrestOrUnknownError(e, 'Failed to remove payment and unlink bank'), 'error')
      } finally {
        setUnlinkingMercuryPaymentId(null)
        setUnlinkMercuryConfirmRowId(null)
      }
    },
    [editing, authRole, showToast],
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
    setStripeFixturePreviewRowId((cur) => (cur === id ? null : cur))
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
      // The customer must belong to the JOB's master (customer↔master invariant) — not the
      // person clicking. An assistant creating from another master's job with authUser.id here
      // used to mint a customer mastered to the assistant, which the jobs_ledger backstop
      // trigger then rejected at link time (and left an orphan duplicate behind).
      let customerMasterId: string | null = editing
        ? resolveEditJobMasterUserId({
            projectId,
            projectMasterUserId: projectId ? (projects.find((p) => p.id === projectId)?.master_user_id ?? null) : null,
            existingJobMasterUserId: editing.master_user_id,
          })
        : null
      if (!customerMasterId) {
        // New job: assistants act for their master; masters/devs own their own customers.
        const { data: adoption } = await supabase
          .from('master_assistants')
          .select('master_id')
          .eq('assistant_id', authUser.id)
          .limit(1)
          .maybeSingle()
        customerMasterId = (adoption as { master_id: string } | null)?.master_id ?? authUser.id
      }
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
          master_user_id: customerMasterId,
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
    if (!formServiceTypeId.trim()) {
      showToast('Service type is required', 'error')
      return
    }
    setSaving(true)
    setError(null)
    const revNum = jobTotalBidDollars
    const paymentsMadeNum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const validPayments = payments.filter((p) => (Number(p.amount) || 0) > 0)
    const validMaterials = materials.filter((m) => (m.description ?? '').trim() !== '' || Number(m.amount) !== 0)
    try {
      if (editing) {
        const proj = projectId ? projects.find((p) => p.id === projectId) : null
        // Editing preserves the job's owner (or follows the linked project's owner). Never
        // re-derive from job_owner_override here — that steers NEW jobs only; on edit it would
        // silently re-own the job and break the customer↔master invariant. Deriving the written
        // master and the customer-validation master from one value keeps them from diverging.
        const masterUserIdForUpdate = resolveEditJobMasterUserId({
          projectId,
          projectMasterUserId: proj?.master_user_id ?? null,
          existingJobMasterUserId: editing.master_user_id,
        })
        const resolvedCustomerId = resolveCustomerIdForJobPayload(
          customerId,
          masterUserIdForUpdate,
          customerName.trim(),
          customers,
        )
        const updatePayload = {
          hcp_number: hcpNumber.trim(),
          click_number: clickNumber.trim(),
          job_name: jobName.trim(),
          job_address: jobAddress.trim(),
          customer_id: resolvedCustomerId,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          last_bill_date: lastBillDate.trim() || null,
          google_drive_link: googleDriveLink.trim() || null,
          job_pictures_link: jobPicturesLink.trim() || null,
          job_plans_link: jobPlansLink.trim() || null,
          revenue: revNum,
          payments_made: paymentsMadeNum,
          project_id: projectId || null,
          bid_id: bidId || null,
          service_type_id: formServiceTypeId.trim(),
          master_user_id: masterUserIdForUpdate,
        }
        const { error: updateErr } = await supabase
          .from('jobs_ledger')
          .update(updatePayload)
          .eq('id', editing.id)
        if (updateErr) throw updateErr
        const trimmedJobPicturesLink = jobPicturesLink.trim()
        const previousJobPicturesLink = (editing.job_pictures_link ?? '').trim()
        if (trimmedJobPicturesLink && !previousJobPicturesLink) {
          try {
            await withSupabaseRetry(
              async () =>
                supabase
                  .from('dispatch_requests')
                  .update({
                    status: 'closed',
                    closed_at: new Date().toISOString(),
                    closed_by_user_id: authUser.id,
                    closed_note: 'Customer Pictures URL added',
                  })
                  .eq('job_ledger_id', editing.id)
                  .eq('pending_action', 'link_job_pictures')
                  .eq('status', 'open'),
              'auto-close link_job_pictures dispatch requests',
            )
            notifyDispatchRequestsChanged()
          } catch (closeErr) {
            console.warn('auto-close dispatch_requests failed', closeErr)
          }
        }
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
        const validFixtures = fixtures.filter((f) => normalizeFixtureDisplayName(f.name ?? '').length > 0)
        for (const [i, f] of validFixtures.entries()) {
          const unit = f.line_unit_price
          await supabase.from('jobs_ledger_fixtures').insert({
            job_id: editing.id,
            name: normalizeFixtureDisplayName(f.name ?? ''),
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

        const statusBeforeSave = normalizeJobsLedgerStatus(editing.status)
        if (statusBeforeSave === 'paid' && revNum > paymentsMadeNum + 0.01) {
          try {
            const data = await withSupabaseRetry(
              async () =>
                supabase.rpc('update_job_status', { p_job_id: editing.id, p_to_status: 'billed' }),
              'update_job_status_save_job_paid_to_billed',
            )
            const result = data as { error?: string } | null
            if (result?.error) {
              showToast(
                `Job saved, but the job could not be moved back to Billed: ${result.error}`,
                'error',
              )
            } else {
              showToast('Job saved. Job moved back to Billed (balance still due).', 'success')
            }
          } catch (e: unknown) {
            showToast(
              formatPostgrestOrUnknownError(e, 'Job saved but failed to move job to Billed'),
              'error',
            )
          }
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
            click_number: clickNumber.trim(),
            job_name: jobName.trim(),
            job_address: jobAddress.trim(),
            customer_id: resolvedCustomerIdNew,
            customer_name: customerName.trim() || null,
            customer_email: customerEmail.trim() || null,
            customer_phone: customerPhone.trim() || null,
            last_bill_date: lastBillDate.trim() || null,
            google_drive_link: googleDriveLink.trim() || null,
            job_pictures_link: jobPicturesLink.trim() || null,
            job_plans_link: jobPlansLink.trim() || null,
            revenue: revNum,
            payments_made: paymentsMadeNum,
            project_id: projectId || null,
            bid_id: bidId || null,
            service_type_id: formServiceTypeId.trim(),
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
          const validFixturesIns = fixtures.filter((f) => normalizeFixtureDisplayName(f.name ?? '').length > 0)
          for (const [i, f] of validFixturesIns.entries()) {
            const unit = f.line_unit_price
            await supabase.from('jobs_ledger_fixtures').insert({
              job_id: jobId,
              name: normalizeFixtureDisplayName(f.name ?? ''),
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

  async function migrateJobLedgerCostsAndDelete(
    fromId: string,
    toId: string,
    allowBilled = true,
  ): Promise<boolean> {
    setMigratingJob(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('migrate_job_ledger_costs_and_delete', {
        p_from: fromId,
        p_to: toId,
        p_allow_billed: allowBilled,
      })
      if (rpcErr) {
        console.error('migrate_job_ledger_costs_and_delete', rpcErr)
        const msg = formatPostgrestOrUnknownError(rpcErr, rpcErr.message || 'Failed to migrate job')
        setError(msg)
        showToast(msg, 'error')
        return false
      }
      const payload = data as { ok?: boolean; error?: string; code?: string } | null
      if (!payload?.ok) {
        const msg =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'Could not migrate and delete this job.'
        setError(msg)
        showToast(msg, 'error')
        return false
      }
      onSavedRef.current?.()
      closeForm()
      showToast(
        'Costs and job total moved to the target job; this job was removed. Open the target job to verify Specific Work and Job Total.',
        'success',
      )
      return true
    } catch (err: unknown) {
      console.error('migrateJobLedgerCostsAndDelete', err)
      const msg = formatPostgrestOrUnknownError(err, 'Failed to migrate job')
      setError(msg)
      showToast(msg, 'error')
      return false
    } finally {
      setMigratingJob(false)
    }
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
        <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, fontSize: '0.9375rem' }}>Loading…</div>
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
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', flexShrink: 0 }}>{editing ? 'Edit Job' : 'New Job'}</h2>
          <div ref={hcpHelpRef} style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setHcpHelpOpen((v) => !v)}
              aria-label="How the HCP # and C# work"
              aria-expanded={hcpHelpOpen}
              title="How the HCP # and C# work"
              style={{
                width: 20,
                height: 20,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: '1px solid #bfdbfe',
                background: hcpHelpOpen ? 'var(--bg-blue-200)' : 'var(--bg-blue-tint)',
                color: 'var(--text-blue-700)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                fontStyle: 'italic',
                fontFamily: 'Georgia, "Times New Roman", serif',
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              i
            </button>
            {hcpHelpOpen ? (
              <div
                role="dialog"
                aria-label="HCP # vs C# (Click Number)"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  width: 'max-content',
                  maxWidth: 340,
                  zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX,
                  background: 'var(--bg-blue-tint)',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.8125rem',
                  lineHeight: 1.5,
                  color: '#1e3a8a',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setHcpHelpOpen(false)}
                  aria-label="Close"
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 6,
                    border: 'none',
                    background: 'none',
                    color: 'var(--text-slate-500)',
                    fontSize: '1rem',
                    lineHeight: 1,
                    cursor: 'pointer',
                    padding: 2,
                  }}
                >
                  ×
                </button>
                <div style={{ fontWeight: 700, marginBottom: '0.35rem', paddingRight: '1rem' }}>
                  HCP # vs C# (Click Number)
                </div>
                <ul style={{ margin: '0 0 0.4rem', paddingLeft: '1.1rem' }}>
                  <li>
                    <strong>HCP #</strong> — the HouseCall Pro job number, for jobs imported from HouseCall Pro.
                  </li>
                  <li>
                    <strong>C# (Click Number)</strong> — for jobs created here in Click that have no HCP #.
                  </li>
                </ul>
                <div>
                  Wherever this job&rsquo;s number appears, it shows the <strong>HCP #</strong> if it has one; otherwise
                  the <strong>C#</strong>. An HCP # always takes precedence. Both use the same prefix (e.g. &ldquo;J&rdquo;),
                  so they look identical.
                </div>
              </div>
            ) : null}
          </div>
          {mode === 'new' && !editing && !newJobImportBlockedByContent ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setJobImportSourceOpen(true)}
                aria-label="Import from estimate or bid"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--text-blue-700)',
                  background: 'var(--bg-blue-tint)',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Import
              </button>
            </div>
          ) : editing?.id ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const id = editing?.id
                  if (!id) return
                  closeForm()
                  jobDetailOpenerBridge?.requestOpenJobDetail(id)
                }}
                aria-label="Close Edit Job and open Job Detail"
                title="Close Edit Job and open Job Detail"
                style={{
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--text-blue-700)',
                  background: 'var(--bg-blue-tint)',
                  border: '1px solid #bfdbfe',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Job Detail
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.25rem',
              justifyContent: 'flex-end',
              fontSize: '0.875rem',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'var(--text-muted)', userSelect: 'none' }}>Link to:</span>
            {bidId ? (
              <Link
                to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
                aria-label="Open linked bid"
                style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-blue-700)',
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
                  color: 'var(--text-link)',
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
            <span style={{ color: 'var(--text-faint)', userSelect: 'none' }} aria-hidden>
              |
            </span>
            {projectId ? (
              <Link
                to={`/workflows/${projectId}`}
                aria-label="Open linked project workflow"
                style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-blue-700)',
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
                  color: 'var(--text-link)',
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
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Checking for linked estimate…</p>
        ) : null}
        {editing && !sourceEstimateLoading && sourceEstimateForJob ? (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.6rem 0.75rem',
              background: 'var(--bg-green-tint)',
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
                background: 'var(--surface)',
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
              color: 'var(--text-red-700)',
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
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ flex: '0 0 110px', minWidth: 110 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>C#</label>
              <input
                type="text"
                value={clickNumber}
                onChange={(e) => setClickNumber(e.target.value)}
                placeholder="Click number"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
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
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label
                htmlFor="job-form-service-type"
                style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}
              >
                Service type <span style={{ color: 'var(--text-red-700)' }}>*</span>
              </label>
              <SearchableSelect
                id="job-form-service-type"
                value={formServiceTypeId}
                onChange={setFormServiceTypeId}
                options={jobFormServiceTypeSelectOptions.map((st) => ({ value: st.id, label: st.name }))}
                emptyOption={{ value: '', label: 'Select service type…' }}
                placeholder="Select service type…"
                required
                listAriaLabel="Service type"
                disabled={jobFormServiceTypeSelectOptions.length === 0}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 auto', minWidth: 140 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Last manual bill date</label>
              <input
                type="date"
                value={lastBillDate}
                onChange={(e) => setLastBillDate(e.target.value)}
                style={{ width: '100%', minWidth: 140, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
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
                  style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
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
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
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
                              background: 'var(--surface)',
                              border: 'none',
                              borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                              cursor: 'pointer',
                              color: 'var(--text-strong)',
                              fontSize: '0.875rem',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                          >
                            {u.name}
                          </button>
                        ))
                      ) : (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
                        background: 'var(--bg-blue-tint)',
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
                          color: 'var(--text-muted)',
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
                {/* Match Project | Plans | Bid row: fixed chevron slot + same gap as job-form-project-files-plans-trigger */}
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
                          background: 'var(--bg-amber-100)',
                          color: 'var(--text-amber-800)',
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
                    border: '1px solid var(--border-strong)',
                    background: 'var(--bg-subtle)',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Import
                </button>
              )}
            </div>
            {customerExpanded && (
              <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border)' }}>
                <div
                  ref={billingCustomerHighlightRef}
                  style={{
                    marginBottom: '0.75rem',
                    position: 'relative',
                    ...(billingCustomerHighlight
                      ? {
                          padding: '0.75rem',
                          borderRadius: 8,
                          background: 'var(--bg-red-tint)',
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
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                  {customerDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        maxHeight: 180,
                        overflowY: 'auto',
                        zIndex: 100,
                        marginTop: 2,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      {customersLoading ? (
                        <div style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Loading…</div>
                      ) : (
                        (() => {
                          const q = customerSearch.toLowerCase()
                          // Archived customers can't be linked to new/edited jobs; the
                          // currently-linked one stays selectable (keepId) so editing an
                          // existing link keeps working.
                          const filtered = filterActiveCustomersForPicker(customers, customerId).filter((c) =>
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
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-muted)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 500 }}>{c.name}</span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                  {customerTypeShortLabel(c)}
                                </span>
                              </div>
                              {c.address && <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>}
                            </div>
                              ))}
                              {filtered.length === 0 && (
                                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No customers found</div>
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
                          border: '1px solid var(--border-strong)',
                          background: !customerName.trim() ? 'var(--bg-muted)' : 'var(--bg-subtle)',
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
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        Clear link
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Name</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Phone</label>
                  <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Customer Email</label>
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Date Met
                    {customerId && customers.find((c) => c.id === customerId)?.date_met && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 4 }}>(edit in Customers)</span>
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
                      border: '1px solid var(--border-strong)',
                      borderRadius: 4,
                      background: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'var(--bg-subtle)' : 'var(--surface)',
                      color: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'var(--text-muted)' : 'inherit',
                      cursor: customerId && customers.find((c) => c.id === customerId)?.date_met ? 'not-allowed' : 'text',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 0 }}>
                  <label htmlFor="job-form-customer-job-files" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Customer Files
                  </label>
                  <input
                    id="job-form-customer-job-files"
                    ref={jobFormGoogleDriveInputRef}
                    type="url"
                    value={googleDriveLink}
                    onChange={(e) => setGoogleDriveLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                  <a
                    href="https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault()
                      openInExternalBrowser('https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link')
                    }}
                    style={{ fontSize: '0.8125rem', color: 'var(--text-link)', marginTop: 4, display: 'inline-block' }}
                  >
                    customer and job folders
                  </a>
                </div>
                <div
                  ref={jobPicturesLinkHighlightRef}
                  style={{
                    marginBottom: 0,
                    borderRadius: 8,
                    ...(jobPicturesLinkHighlight
                      ? {
                          padding: '0.75rem',
                          background: 'var(--bg-blue-tint)',
                          border: '2px solid #93c5fd',
                        }
                      : {}),
                  }}
                >
                  <label htmlFor="job-form-customer-job-pictures" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>
                    Customer Pictures
                  </label>
                  <input
                    id="job-form-customer-job-pictures"
                    ref={jobPicturesLinkInputRef}
                    type="url"
                    value={jobPicturesLink}
                    onChange={(e) => setJobPicturesLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                  />
                  <a
                    href="https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault()
                      openInExternalBrowser('https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link')
                    }}
                    style={{ fontSize: '0.8125rem', color: 'var(--text-link)', marginTop: 4, display: 'inline-block' }}
                  >
                    customer and job folders
                  </a>
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
                aria-label="Expand or collapse project, plans, and bid"
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
                aria-label="Project, plans, and bid"
                style={{ paddingLeft: '1.25rem', borderLeft: '2px solid var(--border)' }}
              >
                <div ref={jobFormProjectSectionRef} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Project</label>
                  {projectId ? (
                    (() => {
                      const linkedName = projects.find((p) => p.id === projectId)?.name ?? 'project'
                      const disconnectLabel = `Disconnect from ${linkedName}`
                      return (
                        <>
                          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
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
                              border: '1px solid var(--border-strong)',
                              background: 'var(--bg-subtle)',
                              borderRadius: 6,
                              cursor: 'pointer',
                              color: 'var(--text-700)',
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
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                      >
                        <option value="">None</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.customers?.name ? ` (${p.customers.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Link job to a multi-phase project for billing after each phase
                      </span>
                    </>
                  )}
                </div>
                <div ref={jobFormJobPlansSectionRef} style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Plans</label>
                    <input
                      ref={jobFormJobPlansInputRef}
                      type="url"
                      value={jobPlansLink}
                      onChange={(e) => setJobPlansLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                    />
                </div>
                <div ref={jobFormBidSectionRef} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Bid proposal</label>
                  {bidId ? (
                    <>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
                        Linked: <strong>{formatJobFormBidLinkTitle(prefixMap, linkedBidSummary)}</strong>
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <Link
                          to={`/bids?bidId=${encodeURIComponent(bidId)}&tab=cover-letter`}
                          style={{
                            fontSize: '0.875rem',
                            padding: '0.35rem 0.65rem',
                            background: 'var(--bg-blue-tint)',
                            color: 'var(--text-blue-700)',
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
                            border: '1px solid var(--border-strong)',
                            background: 'var(--bg-subtle)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            color: 'var(--text-700)',
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
                          border: '1px solid var(--border-strong)',
                          background: 'var(--surface)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          color: 'var(--text-link)',
                          fontWeight: 500,
                        }}
                      >
                        Link a bid proposal
                      </button>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                        Tie this job to a bid for quick access (optional)
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
          <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid var(--border-400)', width: '50%' }} />
          <div
            ref={fixturesSectionHighlightRef}
            style={{
              marginBottom: '1rem',
              borderRadius: 8,
              ...(fixturesSectionHighlight
                ? {
                    padding: '0.75rem',
                    background: 'var(--bg-blue-tint)',
                    border: '2px solid #93c5fd',
                  }
                : {}),
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)', marginBottom: '0.75rem' }}>Specific Work or Materials (Fixtures / Tie-ins / Repair)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: '5.25rem' }} />
                <col style={{ width: 'calc(5.5rem + 4px + 1.75rem + 0.5rem)' }} />
              </colgroup>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Line Item</th>
                  <th style={{ padding: '0.625rem 0.625rem', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>Count</th>
                  <th
                    style={{
                      paddingTop: '0.625rem',
                      paddingBottom: '0.625rem',
                      paddingLeft: '0.625rem',
                      paddingRight: '0.375rem',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--border)',
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
                  const nameFieldId = `job-fixture-name-${row.id}`
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
                        <td
                          style={{
                            padding: '0.625rem 0.75rem',
                            paddingBottom: '0.35rem',
                            minWidth: 0,
                            verticalAlign: 'top',
                          }}
                        >
                          <label htmlFor={nameFieldId} style={FIXTURE_SCOPE_FIELD_LABEL_VISUALLY_HIDDEN}>
                            Specific work or materials
                          </label>
                          <AutosizeTextarea
                            minRows={1}
                            extraLines={0}
                            id={nameFieldId}
                            value={row.name}
                            onChange={(e) => updateFixtureRow(row.id, { name: e.target.value })}
                            onBlur={() => {
                              const next = normalizeFixtureDisplayName(row.name ?? '')
                              if (next !== row.name) updateFixtureRow(row.id, { name: next })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.preventDefault()
                            }}
                            placeholder="Specific work or materials"
                            style={{
                              padding: '0.375rem 0.625rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 6,
                              fontSize: '0.875rem',
                              lineHeight: 1.4,
                              fontFamily: 'inherit',
                            }}
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
                            verticalAlign: 'top',
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
                              border: '1px solid var(--border-strong)',
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
                            verticalAlign: 'top',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              width: '100%',
                              alignItems: 'flex-start',
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
                                border: '1px solid var(--border-strong)',
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
                          borderBottom: idx < fixtures.length - 1 ? '1px solid var(--border)' : 'none',
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
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  justifyContent: 'space-between',
                                  alignItems: 'baseline',
                                  gap: '0.5rem',
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  id={stripeLenDescId}
                                  aria-live="polite"
                                  style={{
                                    fontSize: '0.75rem',
                                    color: stripeLineOverLimit ? '#d97706' : 'var(--text-muted)',
                                  }}
                                >
                                  ({stripeFixtureLineLen} / {STRIPE_INVOICE_LINE_DESCRIPTION_MAX})
                                </div>
                                <button
                                  type="button"
                                  aria-haspopup="dialog"
                                  aria-controls="stripe-fixture-line-preview-dialog"
                                  onClick={() => setStripeFixturePreviewRowId(row.id)}
                                  style={{
                                    padding: '0.25rem 0',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-link)',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '2px',
                                  }}
                                >
                                  Stripe preview
                                </button>
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
                                  border: '1px solid var(--border-strong)',
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
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                gap: '0.35rem',
                                marginBottom: 4,
                                fontSize: '0.75rem',
                              }}
                            >
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem' }}>
                                <span
                                  id={stripeLenDescId}
                                  aria-live="polite"
                                  style={{ color: stripeLineOverLimit ? '#d97706' : 'var(--text-muted)' }}
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
                                    color: 'var(--text-link)',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '2px',
                                  }}
                                >
                                  Add scope or notes
                                </button>
                              </div>
                              <button
                                type="button"
                                aria-haspopup="dialog"
                                aria-controls="stripe-fixture-line-preview-dialog"
                                onClick={() => setStripeFixturePreviewRowId(row.id)}
                                style={{
                                  padding: '0.25rem 0',
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  color: 'var(--text-link)',
                                  textDecoration: 'underline',
                                  textUnderlineOffset: '2px',
                                }}
                              >
                                Stripe preview
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
                    color: 'var(--text-700)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${formatCurrency(jobTotalBidDollars)}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Total of lines above.
                </span>
              </div>
              <div style={{ flex: '1 1 140px', minWidth: 0, textAlign: 'center' }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Remaining ($)</label>
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-700)',
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
                        color: 'var(--text-700)',
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
                        const useCents = Math.min(Math.round(n * 100), Math.round(rem * 100))
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
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        fontSize: '0.875rem',
                        background: 'var(--surface)',
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
                          color: 'var(--text-muted)',
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
                            background: 'var(--bg-200)',
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
                                background: 'var(--surface)',
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
                                color: 'var(--text-muted)',
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
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
                          { color: 'var(--text-link)', label: 'Paid', sub: '', circle: false },
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
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>{item.label}</span>
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
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
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
                            style={{ marginLeft: 8, padding: '0.15rem 0.35rem', fontSize: '0.75rem', background: 'var(--bg-200)', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            See in Stages
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
                                click_number: editing.click_number,
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
                                onAfterOobUnwindSuccess: async () => {
                                  refreshEditingJobAndHydratePayments(editing.id)
                                },
                              })
                            }}
                            style={{
                              marginLeft: 8,
                              padding: '0.15rem 0.35rem',
                              fontSize: '0.75rem',
                              background: 'var(--bg-blue-200)',
                              border: '1px solid #93c5fd',
                              borderRadius: 4,
                              cursor: 'pointer',
                              color: 'var(--text-blue-800)',
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
                      <thead style={{ background: 'var(--bg-subtle)' }}>
                        <tr>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Date</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Billed</th>
                          <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Actions</th>
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
                              background: 'var(--bg-200)',
                              border: 'none',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }
                            const parentCellPad = hasDetailLine ? '0.5rem 0.75rem 0.1rem' : '0.5rem 0.75rem'
                            const paidOnOutstandingInv = payments
                              .filter((p) => p.invoice_id === inv.id)
                              .reduce((s, p) => s + (Number(p.amount) || 0), 0)
                            const outstandingWriteDownRoom =
                              Number(inv.amount ?? 0) - paidOnOutstandingInv
                            const showSeeInStages =
                              arr.length !== 1 ||
                              jobTotalBidDollars <= 0 ||
                              Math.round(Number(inv.amount ?? 0) * 100) !==
                                Math.round(jobTotalBidDollars * 100)
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
                                      {showSeeInStages ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onClose()
                                            navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
                                          }}
                                          style={btnGray}
                                        >
                                          See in Stages
                                        </button>
                                      ) : null}
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
                                      {canApplyAgreedWriteDown ? (
                                        <button
                                          type="button"
                                          disabled={outstandingWriteDownRoom <= 0.005}
                                          title={
                                            outstandingWriteDownRoom <= 0.005
                                              ? 'No room for a discount (billed amount equals payments on this line).'
                                              : 'Lower billed amount (agreed discount; Stripe uses a credit note).'
                                          }
                                          onClick={() => setAgreedWriteDownInvoice(inv)}
                                          style={{
                                            padding: '0.15rem 0.45rem',
                                            fontSize: '0.75rem',
                                            borderRadius: 4,
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor:
                                              outstandingWriteDownRoom <= 0.005 ? 'not-allowed' : 'pointer',
                                            background:
                                              outstandingWriteDownRoom <= 0.005 ? '#93c5fd' : '#2563eb',
                                            color: '#ffffff',
                                            opacity: outstandingWriteDownRoom <= 0.005 ? 0.85 : 1,
                                          }}
                                        >
                                          Add discount
                                        </button>
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
                                        color: 'var(--text-muted)',
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
                                          <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Note: </span>
                                          {noteLine}
                                        </div>
                                      ) : null}
                                      {memoLine ? (
                                        <div style={{ marginBottom: footerLine ? '0.15rem' : 0 }}>
                                          <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Memo: </span>
                                          {memoLine}
                                        </div>
                                      ) : null}
                                      {footerLine ? (
                                        <div>
                                          <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Footer: </span>
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
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Paid</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }} aria-hidden />
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
                    const payRowCanRemove =
                      canRemovePaymentRowFromForm(row, editing) ||
                      Boolean(
                        editing &&
                          persistedLedgerPaymentIds.has(row.id) &&
                          paymentRowLinkedToInvoice(row) &&
                          !stripeBillInvoiceForPaymentRow(row, editing),
                      )
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
                                style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}
                                title="Recorded from the Stripe invoice."
                                aria-label={`Payment date ${formatPaymentDateForDisplay(row.paid_on)}`}
                              >
                                {formatPaymentDateForDisplay(row.paid_on)}
                              </span>
                            ) : mercuryPaymentLocked ? (
                              <span
                                style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}
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
                                  border: '1px solid var(--border-strong)',
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
                                        color: 'var(--text-link)',
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
                                    color: 'var(--text-strong)',
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
                                    color: 'var(--text-blue-700)',
                                    background: 'var(--bg-blue-tint)',
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
                                    color: 'var(--text-strong)',
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
                                  border: '1px solid var(--border-strong)',
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
                            {stripePaymentLocked ? null : mercuryPaymentLocked &&
                              canUnlinkMercuryPayment(authRole) &&
                              !mercuryUnlinkBlockedByStripeHostedInvoice(row, editing) ? (
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
                                  color: unlinkingMercuryPaymentId === row.id ? 'var(--text-faint)' : 'var(--text-blue-700)',
                                  background: 'var(--bg-blue-tint)',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: 6,
                                  cursor: unlinkingMercuryPaymentId === row.id ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {unlinkingMercuryPaymentId === row.id ? 'Removing…' : 'Unlink and remove'}
                              </button>
                            ) : mercuryPaymentLocked ? null : idx === lastUnlockedPaymentIdx ? (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  gap: '0.35rem',
                                  flexWrap: 'wrap',
                                }}
                              >
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
                                {payRowCanRemove ? (
                                  <button
                                    type="button"
                                    onClick={() => requestRemovePaymentRow(row)}
                                    title="Remove"
                                    aria-label="Remove payment row"
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
                                    }}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden><path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" /></svg>
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => requestRemovePaymentRow(row)}
                                disabled={!payRowCanRemove}
                                title="Remove"
                                aria-label="Remove payment row"
                                style={{
                                  padding: '0.35rem',
                                  background: !payRowCanRemove ? 'var(--bg-muted)' : 'transparent',
                                  color: !payRowCanRemove ? 'var(--text-faint)' : '#991b1c',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: !payRowCanRemove ? 'not-allowed' : 'pointer',
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
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-700)' }}>
                                      {ptTrim ? (
                                        <span style={{ marginRight: '0.75rem' }}>
                                          <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Type: </span>
                                          {ptTrim}
                                        </span>
                                      ) : null}
                                      {refTrim ? (
                                        <span>
                                          <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Ref: </span>
                                          <ReadOnlyPaymentRefCopy refText={refTrim} showToast={showToast} />
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <div>
                                    <span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Memo: </span>
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
                                    <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Type: </span>
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
                                        border: '1px solid var(--border-strong)',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: 'var(--text-700)',
                                        background: 'var(--surface)',
                                        lineHeight: 1.35,
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Ref: </span>
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
                                        border: '1px solid var(--border-strong)',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: 'var(--text-700)',
                                        background: 'var(--surface)',
                                        lineHeight: 1.35,
                                      }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-600)', flexShrink: 0 }}>Memo: </span>
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
                                        border: '1px solid var(--border-strong)',
                                        borderRadius: 4,
                                        fontSize: '0.75rem',
                                        color: 'var(--text-700)',
                                        background: 'var(--surface)',
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
              <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid var(--border-400)', width: '50%' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)', marginBottom: '0.75rem' }}>Labor Cost</div>
              <div
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
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
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)' }}>Team Labor</span>
                <span style={{ flex: '1 1 8rem', fontSize: '0.875rem', color: 'var(--text-600)', textAlign: 'right', minWidth: 0 }}>
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
                      color: 'var(--text-link)',
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
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)' }}>Sub Labor</span>
                <span style={{ flex: '1 1 8rem', fontSize: '0.875rem', color: 'var(--text-600)', textAlign: 'right', minWidth: 0 }}>
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
                      color: 'var(--text-link)',
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
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)', marginBottom: '0.75rem' }}>Parts Cost</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1rem', overflow: 'hidden' }}>
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
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Allocated invoice total for this job; line detail is available to office roles in Materials.
                      </p>
                    ) : supplyInvoiceLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No supply house invoice allocations for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Supply house</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Invoice</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Allocated</th>
                          </tr>
                        </thead>
                        <tbody>
                          {supplyInvoiceLines.map((ln, idx) => (
                            <tr key={`${ln.invoiceNumber}-${ln.invoiceDate}-${idx}`} style={{ borderBottom: idx < supplyInvoiceLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>Could not load card allocations.</p>
                    ) : mercuryAllocLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No Mercury card splits for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Posted</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Card</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Counterparty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mercuryAllocLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < mercuryAllocLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                              <td style={{ padding: '0.5rem 0.625rem', color: 'var(--text-600)' }}>{ln.note ?? '—'}</td>
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
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-red-700)' }}>Could not load tally parts.</p>
                    ) : tallyPartLines.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No tally parts for this job.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead style={{ background: 'var(--bg-subtle)' }}>
                          <tr>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'center', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: '0.5rem 0.625rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Line total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tallyPartLines.map((ln, idx) => (
                            <tr key={ln.id} style={{ borderBottom: idx < tallyPartLines.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                  <thead style={{ background: 'var(--bg-subtle)' }}>
                    <tr>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Line Item</th>
                      <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Amount ($)</th>
                      <th style={{ padding: '0.625rem 0.5rem', minWidth: '4.5rem', width: '4.5rem', borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((row, idx) => {
                      const canRemove = materials.length > 1 || materialRowHasUserContent(row)
                      const removeTitle = materials.length > 1 ? 'Remove' : 'Clear row'
                      const showAddMaterialRow = materials.length === 1 || idx === materials.length - 1
                      return (
                      <tr key={row.id} style={{ borderBottom: idx < materials.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '0.625rem 0.75rem' }}>
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateMaterialRow(row.id, { description: e.target.value })}
                            placeholder="Item description"
                            style={{ width: '100%', padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem' }}
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
                            style={{ width: '6rem', padding: '0.375rem 0.625rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.875rem', textAlign: 'right' }}
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
              {editing ? <JobChargesTimelineStandalone job={editing} includeTeamLabor={showJobCostBreakdownTeamLabor(authRole)} /> : null}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {editing && authRole !== 'primary' && (
              <>
                <button
                  type="button"
                  onClick={() => setDeleteJobConfirmOpen(true)}
                  disabled={deletingId === editing?.id || migratingJob}
                  style={{
                    padding: '0.5rem 1rem',
                    background:
                      deletingId === editing?.id || migratingJob ? 'var(--bg-muted)' : 'var(--bg-red-100)',
                    color: deletingId === editing?.id || migratingJob ? 'var(--text-faint)' : 'var(--text-red-700)',
                    border: 'none',
                    borderRadius: 4,
                    cursor: deletingId === editing?.id || migratingJob ? 'not-allowed' : 'pointer',
                  }}
                >
                  {deletingId === editing?.id ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={closeForm} style={{ padding: '0.5rem 1rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
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
          onClick={() => {
            if (!paymentRemoveRpcBusy) setPaymentRemoveConfirmRowId(null)
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 480,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Remove payment?</h2>
            {paymentRemovePreview ? (
              <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 0.75rem' }}>
                  This removes a payment of{' '}
                  <strong style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(paymentRemovePreview.rowAmt)}</strong> from this job.
                </p>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)' }}>
                  {paymentRemoveConfirmsPersistedRpc ? (
                    <>
                      This updates the database immediately (payments recorded on this job and any linked invoice status).
                    </>
                  ) : (
                    <>
                      The payment line is removed from this form now; click <strong>Save</strong> on the job to update the database.
                    </>
                  )}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: 'var(--text-muted)' }}>Job total</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(paymentRemovePreview.jobTotal)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem 0', color: 'var(--text-muted)' }}>Remaining ($) now</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        ${formatCurrency(paymentRemovePreview.currentRem)}
                      </td>
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.35rem 0', fontWeight: 600, color: 'var(--text-strong)' }}>Remaining ($) after removal</td>
                      <td style={{ padding: '0.35rem 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>
                        ${formatCurrency(paymentRemovePreview.newRem)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>This payment line is no longer available.</p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (!paymentRemoveRpcBusy) setPaymentRemoveConfirmRowId(null)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: paymentRemoveRpcBusy ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmRemovePaymentRow()}
                disabled={!paymentRemovePreview || paymentRemoveRpcBusy}
                style={{
                  padding: '0.5rem 1rem',
                  background: !paymentRemovePreview || paymentRemoveRpcBusy ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: !paymentRemovePreview || paymentRemoveRpcBusy ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {paymentRemoveRpcBusy ? 'Removing…' : 'Remove payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      {stripeFixturePreviewRow && (
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
          onClick={() => setStripeFixturePreviewRowId(null)}
        >
          <div
            id="stripe-fixture-line-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stripe-fixture-line-preview-title"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 560,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="stripe-fixture-line-preview-title"
              style={{
                margin: '0 0 0.75rem',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-strong)',
                textAlign: 'center',
              }}
            >
              Stripe line description (this row)
            </h2>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: '0.75rem',
                background: 'var(--bg-subtle)',
                borderRadius: 6,
                border: '1px solid var(--border)',
                color: 'var(--text-strong)',
                marginBottom: '1rem',
              }}
            >
              {buildFixtureStripeLineDescriptionForStripe(
                stripeFixturePreviewRow.name,
                stripeFixturePreviewRow.line_description,
              )}
            </div>
            <p
              style={{
                margin: '0 0 1rem',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              &quot;line item&quot; - &quot;scope notes&quot;
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setStripeFixturePreviewRowId(null)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Close
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
              background: 'var(--surface)',
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
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Unlink and remove?
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
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
                <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
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
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
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
              background: 'var(--surface)',
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
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Delete job from Billing?
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.5rem' }}>
                <strong>HCP:</strong> {effectiveJobLedgerNumber(editing.hcp_number, editing.click_number) || '—'}{' '}
                <strong>Job:</strong> {(editing.job_name ?? '').trim() || '—'}
              </p>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                This removes the job from Billing along with everything on it — invoices, payments, costs and
                reports. A dev can put it back for 90 days from <strong>Settings → Data &amp; migration → Recently
                deleted</strong>.
              </p>
              {hasMigrateableCosts && !costSnapshotStillLoading ? (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.65rem 0.75rem',
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid #fde68a',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
                    This job has costs attached
                  </p>
                  <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }}>
                    <li>
                      Parts, card charges &amp; supply invoices: ${formatCurrency(partsCostStyleTotal)}
                    </li>
                    <li>Billed materials: ${formatCurrency(materialsBilledTotalForMigrate)}</li>
                    {editJobTeamLaborRow &&
                    (editJobTeamLaborRow.jobCost > 0 || editJobTeamLaborRow.manHours > 0) ? (
                      <li>
                        Team labor (est.): ${formatCurrency(editJobTeamLaborRow.jobCost)} ·{' '}
                        {editJobTeamLaborRow.manHours} hrs
                      </li>
                    ) : null}
                  </ul>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    To delete this job you must first reassign these to another job — otherwise card
                    charges &amp; supply-invoice splits would be unlinked and tally parts &amp; materials
                    removed along with it.
                  </p>
                </div>
              ) : null}
              {costCheckErrored && !hasMigrateableCosts && !costSnapshotStillLoading ? (
                <div
                  style={{
                    marginTop: '0.85rem',
                    padding: '0.65rem 0.75rem',
                    background: 'var(--bg-amber-tint)',
                    border: '1px solid #fde68a',
                    borderRadius: 6,
                  }}
                >
                  <p style={{ margin: 0, color: 'var(--text-amber-800)' }}>
                    Couldn’t verify this job’s costs. To avoid losing any, reassign it to another job
                    instead of deleting.
                  </p>
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (deletingId === editing.id) return
                  setDeleteJobConfirmOpen(false)
                }}
                disabled={deletingId === editing.id}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              {costSnapshotStillLoading ? (
                <button
                  type="button"
                  disabled
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'not-allowed',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Checking costs…
                </button>
              ) : reassignRequired ? (
                <button
                  type="button"
                  onClick={() => {
                    if (deletingId === editing.id) return
                    setMigrateTargetSearch('')
                    setMigrateTargetJobId(null)
                    setMigrateTargetCandidates([])
                    setDeleteJobConfirmOpen(false)
                    setMigrateJobModalOpen(true)
                  }}
                  disabled={deletingId === editing.id}
                  style={{
                    padding: '0.5rem 1rem',
                    background: deletingId === editing.id ? '#9ca3af' : '#1d4ed8',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    cursor: deletingId === editing.id ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Reassign to another job…
                </button>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      )}
      {migrateJobModalOpen && editing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: JOB_FORM_MIGRATE_OVERLAY_Z_INDEX,
            padding: '1rem',
          }}
          onClick={() => {
            if (migratingJob) return
            setMigrateJobModalOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-form-migrate-delete-title"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 360,
              maxWidth: 520,
              maxHeight: '90vh',
              overflow: 'auto',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="job-form-migrate-delete-title"
              style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}
            >
              Migrate costs and delete this job
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
              Move labor, parts, materials, Specific Work, and related rows to another job, add this job’s{' '}
              <strong>Job total (revenue)</strong> to the target’s total, then remove{' '}
              <strong>HCP {effectiveJobLedgerNumber(editing.hcp_number, editing.click_number) || '—'}</strong> —{' '}
              <strong>{(editing.job_name ?? '').trim() || '—'}</strong>. <strong>Moving the costs cannot be
              reversed.</strong>
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', lineHeight: 1.45 }}>
              This job’s own invoices and recorded payments are deleted with it — only costs, labor, and revenue
              move to the target. A dev can restore the deleted job and those invoices/payments for 90 days
              (<strong>Settings → Data &amp; migration → Recently deleted</strong>), but anything moved to the target
              stays there.
            </p>
            {editJobSubLaborData != null && editJobSubLaborData.count > 0 ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-amber-800)', lineHeight: 1.45 }}>
                Subcontractor labor on this HCP is tracked separately from this billing job; it is not changed by
                migrate-delete. Update People Labor if the HCP should follow the target job.
              </p>
            ) : null}
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
              Target job
            </label>
            <input
              type="search"
              value={migrateTargetSearch}
              onChange={(e) => {
                setMigrateTargetSearch(e.target.value)
                setMigrateTargetJobId(null)
              }}
              placeholder="Search HCP, name, or address (2+ characters)"
              disabled={migratingJob}
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: 6,
                border: '1px solid var(--border-strong)',
                fontSize: '0.875rem',
                marginBottom: 8,
              }}
            />
            {migrateTargetSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
            ) : null}
            {migrateTargetSearch.trim().length >= 2 && migrateTargetCandidates.length === 0 && !migrateTargetSearchLoading ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No jobs match.</p>
            ) : null}
            <ul
              style={{
                listStyle: 'none',
                margin: '0 0 1rem',
                padding: 0,
                maxHeight: 200,
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {migrateTargetCandidates.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    disabled={migratingJob}
                    onClick={() => setMigrateTargetJobId(j.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 0.65rem',
                      border: 'none',
                      borderBottom: '1px solid #f3f4f6',
                      background: migrateTargetJobId === j.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      cursor: migratingJob ? 'not-allowed' : 'pointer',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <strong>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}</strong> — {(j.job_name ?? '').trim() || '—'}
                    <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{(j.job_address ?? '').trim() || '—'}</div>
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>Summary</div>
              <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', color: 'var(--text-muted)', fontWeight: 600 }} />
                    <th style={{ textAlign: 'right', padding: '4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Source</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Parts-style costs</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>${formatCurrency(partsCostStyleTotal)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                      {migrateTargetPreviewLoading
                        ? '…'
                        : migrateTargetPreview
                          ? `$${formatCurrency(migrateTargetPreview.supply + migrateTargetPreview.tally + migrateTargetPreview.mercury)}`
                          : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Billed materials</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                      ${formatCurrency(materialsBilledTotalForMigrate)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>—</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Team labor (est.)</td>
                    <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                      {editJobTeamLaborRow
                        ? `$${formatCurrency(editJobTeamLaborRow.jobCost)}`
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                      {migrateTargetPreviewLoading
                        ? '…'
                        : migrateTargetPreview
                          ? `$${formatCurrency(migrateTargetPreview.teamCost)}`
                          : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (migratingJob) return
                  setMigrateJobModalOpen(false)
                }}
                disabled={migratingJob}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: migratingJob ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={migratingJob || !migrateTargetJobId}
                onClick={() => {
                  if (!editing?.id || !migrateTargetJobId) return
                  void migrateJobLedgerCostsAndDelete(editing.id, migrateTargetJobId)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: migratingJob || !migrateTargetJobId ? '#9ca3af' : '#b91c1c',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: migratingJob || !migrateTargetJobId ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {migratingJob ? 'Working…' : 'Confirm migrate and delete'}
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
                ? {
                    project_name: opt.project_name,
                    bid_number: opt.bid_number,
                    service_type_id: opt.service_type_id ?? null,
                  }
                : { project_name: null, bid_number: null, service_type_id: null },
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
      {jobImportSourceOpen && (
        <JobFormImportEstimateOrBidModal
          open={jobImportSourceOpen}
          onClose={() => setJobImportSourceOpen(false)}
          zIndex={JOB_FORM_IMPORT_SOURCE_OVERLAY_Z_INDEX}
          onSelectBid={applyPrefillFromBid}
          onSelectEstimate={applyPrefillFromEstimate}
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
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 360, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Create customer from job</h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
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
                    border: '1px solid var(--border-strong)',
                    borderRadius: '4px 0 0 4px',
                    background: createCustomerFromJobType === 'residential' ? '#3b82f6' : 'var(--surface)',
                    color: createCustomerFromJobType === 'residential' ? 'white' : 'var(--text-700)',
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
                    border: '1px solid var(--border-strong)',
                    borderRadius: '0 4px 4px 0',
                    background: createCustomerFromJobType === 'commercial' ? '#3b82f6' : 'var(--surface)',
                    color: createCustomerFromJobType === 'commercial' ? 'white' : 'var(--text-700)',
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
                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</div>
              ) : similarCustomersForCreate.length > 0 ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: 160, overflowY: 'auto' }}>
                  {similarCustomersForCreate.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleLinkToSimilarCustomer(c)}
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                    >
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      {c.address && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.address}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>No similar customers found</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setCreateCustomerFromJobModalOpen(false)}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
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

      <AgreedWriteDownModal
        open={agreedWriteDownInvoice != null}
        onClose={() => setAgreedWriteDownInvoice(null)}
        invoice={agreedWriteDownInvoice}
        paidOnInvoice={agreedWriteDownInvoicePaidSum}
        isStripeHosted={(agreedWriteDownInvoice?.stripe_invoice_id ?? '').trim().length > 0}
        overlayZIndex={JOB_FORM_BILL_VIEW_OVERLAY_Z_INDEX}
        onSuccess={async () => {
          const jobId = editing?.id ?? editingIdRef.current
          if (jobId) refreshEditingJobAndHydratePayments(jobId)
          showToast('Discount applied.', 'success')
          onSavedRef.current?.()
        }}
      />
      <BilledBillViewModal
        invoice={billViewInvoice}
        onAfterStripeDetailsLoaded={refetchEditingFromBillView}
        onAfterOobUnwindSuccess={() => {
          const jobId = editingIdRef.current
          if (jobId) refreshEditingJobAndHydratePayments(jobId)
        }}
        onAfterVoidStripeInvoiceSuccess={() => {
          void onSavedRef.current?.()
        }}
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
