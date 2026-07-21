/* eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties, RefObject } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { NO_CUSTOMER_TYPE_LABEL } from '../../constants/customerTypeLabels'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { supabase } from '../../lib/supabase'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerDocTitle, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { parseCustomerImport } from '../../utils/parseCustomerImport'
import { nameSimilarity } from '../../utils/nameSimilarity'
import { formatPostgrestOrUnknownError, withSupabaseRetry } from '../../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../../lib/dispatchRequestHelpers'
import CustomerAcceptanceRecordModal from '../estimates/CustomerAcceptanceRecordModal'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { resolveCustomerIdForJobPayload } from '../../lib/jobLedgerCustomer'
import { filterActiveCustomersForPicker } from '../../lib/customerArchive'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { buildEditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import { MoneyLifecycleBar, PAID_COLOR, BILLED_COLOR, DRAFT_COLOR } from './MoneyLifecycleBar'
import { useBreakOffSlider } from './useBreakOffSlider'
import { useJobCostSnapshot } from './useJobCostSnapshot'
import { useJobMigrate } from './useJobMigrate'
import { JobFormInvoiceList } from './JobFormInvoiceList'
import { JobFormPaymentsTable } from './JobFormPaymentsTable'
import { JobFormPartsCostSection } from './JobFormPartsCostSection'
import { JobFormLaborCostPanel } from './JobFormLaborCostPanel'
import { JobFormBreakOffSection } from './JobFormBreakOffSection'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import { JobFormPeoplePicker } from './JobFormPeoplePicker'
import { JobFormDeleteMigrateModals } from './JobFormDeleteMigrateModals'
import {
  formatCurrency,
  parseMoneyInputToNumber,
} from '../../lib/jobs/jobFormMoney'
import {
  breakOffPrefillAmountStringFromJob,
  unallocatedBillableDollars,
} from '../../lib/jobs/jobFormBreakOff'
import type {
  FixtureRow,
  JobFormServiceType,
  MaterialRow,
  MeServiceTypeColumns,
  PaymentRow,
} from '../../lib/jobs/jobFormTypes'
import { pickDefaultServiceTypeId, visibleServiceTypesForJobForm } from '../../lib/jobs/jobFormServiceTypes'
import {
  materialRowHasUserContent,
  newEmptyPaymentRow,
  newJobFormHasBlockingContent,
  normalizeFixtureDisplayName,
  paymentRowsFromJob,
} from '../../lib/jobs/jobFormRows'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  mercuryLinkedPaymentRow,
  mercuryUnlinkBlockedByStripeHostedInvoice,
  paymentRowLinkedToInvoice,
  stripeBillInvoiceForPaymentRow,
} from '../../lib/jobs/jobFormPaymentPredicates'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import { resolveEditJobMasterUserId } from '../../lib/resolveEditJobMasterUserId'
import { getBillingStripeModePref, stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { prepareBilledInvoicesBeforeJobRevertToReadyToBill } from '../../lib/voidStripeInvoiceForRevert'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { findInvoiceWithJobFromJobs } from '../../lib/invoiceWithJobFromJobList'
import { normalizeJobsLedgerStatus } from '../../lib/jobsLedgerStatusPipeline'
import { mercuryCardTotalFromLines, tallyPartsTotalFromLines } from '../../lib/fetchJobMaterialsCostSnapshot'
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
import { loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
import { laborItemsSubtotal } from '../../lib/peopleLaborJobItemLineCost'
import {
  buildFixtureStripeLineDescriptionForStripe,
} from '../../lib/stripeInvoiceLineDescription'
import { SearchableSelect } from '../SearchableSelect'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }







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
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const prefixMap = useLedgerPrefixMap()
  const billCustomer = useBillCustomerModal()
  const jobDetailOpenerBridge = useJobDetailOpenerBridge()
  const newProjectModal = useNewProjectModal()
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const onCreatedJobIdRef = useRef(onCreatedJobId)
  onCreatedJobIdRef.current = onCreatedJobId

  const [initDone, setInitDone] = useState(false)
  const [editing, setEditing] = useState<JobWithDetails | null>(null)
  const [pctSaving, setPctSaving] = useState(false)
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
  /** Live money-lifecycle figures for the billing header bar (fixtures total + this form's payments + the job's invoices). */
  const billingBar = useMemo(
    () =>
      buildEditJobBillingBar({
        total: jobTotalBidDollars,
        payments: payments.map((p) => ({ amount: Number(p.amount) || 0, invoice_id: p.invoice_id })),
        invoices: (editing?.invoices ?? []).map((i) => ({ status: i.status, amount: i.amount, id: i.id })),
      }),
    [jobTotalBidDollars, payments, editing?.invoices],
  )
  // ---- Billing money autosave (editing mode only) -------------------------
  // Persists the money slice — line items, payments, and the derived
  // revenue/payments_made — ~1.2s after the user stops editing, using the same
  // delete+reinsert writes as handleSubmit. The baseline snapshot is captured
  // in the same commit that hydrates the form (hydrate sets editing + fixtures
  // + payments together), so autosave can never fire against pre-hydration
  // empty state and wipe rows. Job identity fields stay on explicit Save.
  const billingMoneySliceJson = useMemo(
    () =>
      JSON.stringify({
        f: fixtures.map((f) => ({ n: f.name, c: f.count, p: f.line_unit_price, d: f.line_description })),
        p: payments.map((p) => ({
          a: p.amount,
          o: p.paid_on,
          n: p.note,
          t: p.payment_type,
          r: p.reference_number,
          i: p.invoice_id,
          m: p.mercury_transaction_id,
        })),
      }),
    [fixtures, payments],
  )
  const [billingAutosaveStatus, setBillingAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autosaveBaselineRef = useRef<{ jobId: string; json: string } | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveRunningRef = useRef(false)
  const autosaveQueuedRef = useRef(false)
  const autosaveFixturesRef = useRef(fixtures)
  autosaveFixturesRef.current = fixtures
  const autosavePaymentsRef = useRef(payments)
  autosavePaymentsRef.current = payments
  const autosaveSliceRef = useRef(billingMoneySliceJson)
  autosaveSliceRef.current = billingMoneySliceJson
  const autosaveJobIdRef = useRef<string | null>(null)
  autosaveJobIdRef.current = editing?.id ?? null

  async function runBillingAutosave(): Promise<void> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return
    if (autosaveRunningRef.current) {
      autosaveQueuedRef.current = true
      return
    }
    autosaveRunningRef.current = true
    setBillingAutosaveStatus('saving')
    const sliceWritten = autosaveSliceRef.current
    try {
      const fx = autosaveFixturesRef.current
      const pays = autosavePaymentsRef.current
      const revNum = revenueDollarsFromFixtures(fx)
      const paymentsMadeNum = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const { error: updErr } = await supabase
        .from('jobs_ledger')
        .update({ revenue: revNum, payments_made: paymentsMadeNum })
        .eq('id', jobId)
      if (updErr) throw updErr
      const { error: delPayErr } = await supabase.from('jobs_ledger_payments').delete().eq('job_id', jobId)
      if (delPayErr) throw delPayErr
      const validPayments = pays.filter((p) => (Number(p.amount) || 0) > 0)
      for (const [i, p] of validPayments.entries()) {
        const { error: insPayErr } = await supabase.from('jobs_ledger_payments').insert({
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
        if (insPayErr) throw insPayErr
      }
      const { error: delFixErr } = await supabase.from('jobs_ledger_fixtures').delete().eq('job_id', jobId)
      if (delFixErr) throw delFixErr
      const validFixtures = fx.filter((f) => normalizeFixtureDisplayName(f.name ?? '').length > 0)
      for (const [i, f] of validFixtures.entries()) {
        const unit = f.line_unit_price
        const { error: insFixErr } = await supabase.from('jobs_ledger_fixtures').insert({
          job_id: jobId,
          name: normalizeFixtureDisplayName(f.name ?? ''),
          count: f.count,
          sequence_order: i,
          line_unit_price: unit != null && unit > 0 ? unit : null,
          line_description: (f.line_description ?? '').trim() ? (f.line_description ?? '').trim() : null,
        })
        if (insFixErr) throw insFixErr
      }
      autosaveBaselineRef.current = { jobId, json: sliceWritten }
      setBillingAutosaveStatus('saved')
      onSavedRef.current?.()
    } catch (autosaveErr) {
      setBillingAutosaveStatus('error')
      showToast(
        `Autosave failed: ${autosaveErr instanceof Error ? autosaveErr.message : String(autosaveErr)}`,
        'error',
      )
    } finally {
      autosaveRunningRef.current = false
      if (autosaveQueuedRef.current) {
        autosaveQueuedRef.current = false
        void runBillingAutosave()
      }
    }
  }
  const runBillingAutosaveRef = useRef(runBillingAutosave)
  runBillingAutosaveRef.current = runBillingAutosave

  /** Cancel any pending debounce and, if the money slice is dirty, save it NOW. */
  async function flushBillingAutosave(): Promise<void> {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
    const jobId = autosaveJobIdRef.current
    const base = autosaveBaselineRef.current
    if (jobId && base && base.jobId === jobId && base.json !== autosaveSliceRef.current) {
      await runBillingAutosave()
    }
  }

  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      autosaveBaselineRef.current = null
      return
    }
    const base = autosaveBaselineRef.current
    if (!base || base.jobId !== jobId) {
      // First sight of this job: the hydrate committed editing + fixtures +
      // payments together, so this snapshot is the persisted state.
      autosaveBaselineRef.current = { jobId, json: billingMoneySliceJson }
      setBillingAutosaveStatus('idle')
      return
    }
    if (base.json === billingMoneySliceJson) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null
      void runBillingAutosaveRef.current()
    }, 1200)
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [billingMoneySliceJson, editing?.id])

  // Same immediate-save contract as the Stages Progress & payment cell: writes
  // jobs_ledger.pct_complete on blur/Enter, outside the form's Save flow (the
  // form payload never touches pct_complete, so Save can't clobber it).
  async function commitPctComplete(pct: number | null) {
    if (!editing?.id) return
    setPctSaving(true)
    const { error: pctErr } = await supabase.from('jobs_ledger').update({ pct_complete: pct }).eq('id', editing.id)
    setPctSaving(false)
    if (pctErr) {
      showToast(`Could not save % done: ${pctErr.message}`, 'error')
      return
    }
    setEditing((prev) => (prev ? { ...prev, pct_complete: pct } : prev))
  }

  const breakOff = useBreakOffSlider({ jobTotalBidDollars, payments, editing })
  // Only these three are read/written by the shell's money-path handlers
  // (createInvoice / moveWorkingJobToReadyToBillFromEdit); the rest of the hook
  // output is consumed by JobFormBreakOffSection via the `breakOff` prop.
  const { newInvoiceAmount, setNewInvoiceAmount, setNewInvoiceAmountInputFocused } = breakOff
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
  const billingCustomerHighlightRef = useRef<HTMLDivElement | null>(null)
  const fixturesSectionHighlightRef = useRef<HTMLDivElement | null>(null)
  const jobPicturesLinkHighlightRef = useRef<HTMLDivElement | null>(null)
  const jobPicturesLinkInputRef = useRef<HTMLInputElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [movingJobToReadyToBill, setMovingJobToReadyToBill] = useState(false)
  const [paymentRemoveConfirmRowId, setPaymentRemoveConfirmRowId] = useState<string | null>(null)
  const [unlinkMercuryConfirmRowId, setUnlinkMercuryConfirmRowId] = useState<string | null>(null)
  const [deleteJobConfirmOpen, setDeleteJobConfirmOpen] = useState(false)
  const migrate = useJobMigrate(editing?.id ?? null)
  // Only the fields the shell's own handlers/effects touch — the rest of the
  // hook output is consumed by JobFormDeleteMigrateModals via the `migrate` prop.
  const { migratingJob, setMigratingJob, resetMigrate } = migrate
  const [unlinkingMercuryPaymentId, setUnlinkingMercuryPaymentId] = useState<string | null>(null)
  const [paymentRemoveRpcBusy, setPaymentRemoveRpcBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    materialsAccordionOpen,
    jobMaterialsSnapshotLoading,
    supplyInvoiceTotal,
    supplyInvoiceRpcFailed,
    supplyInvoiceLines,
    mercuryAllocLines,
    mercuryFetchFailed,
    tallyPartLines,
    tallyFetchFailed,
    mercuryCardTotal,
    tallyPartsTotal,
    toggleMaterialsAccordion,
  } = useJobCostSnapshot(editing?.id ?? null)
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

  /** Edit-mode header trade pill (PLUM/ELEC/HVAC) — shortcut to this job on Jobs → Stages. */
  const headerTradePill = useMemo(() => {
    if (!editing || !formServiceTypeId) return null
    const name = serviceTypes.find((s) => s.id === formServiceTypeId)?.name ?? null
    return buildServiceTypeTradePill(name)
  }, [editing, formServiceTypeId, serviceTypes])

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
    resetMigrate()
    onClose()
  }

  function applyEditJob(job: JobWithDetails, billingGate: boolean, fixturesGate: boolean, picturesGate: boolean) {
    setPaymentRemoveConfirmRowId(null)
    setPaymentRemoveRpcBusy(false)
    setUnlinkMercuryConfirmRowId(null)
    setDeleteJobConfirmOpen(false)
    resetMigrate()
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

  const billedMaterialsTotalDisplay = useMemo(() => {
    const sum = materials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return formatCurrency(sum)
  }, [materials])


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


  function getEditJobBillableRemaining(): number {
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return unallocatedBillableDollars(jobTotalBidDollars, paidSum, editing?.invoices)
  }

  async function moveWorkingJobToReadyToBillFromEdit() {
    if (!editing || editing.status !== 'working') return
    // Make the DB match the on-screen totals before the status/invoice writes.
    await flushBillingAutosave()
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
    // Make the DB match the on-screen totals before the invoice is written.
    await flushBillingAutosave()
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
    // Full save supersedes any pending billing autosave — cancel the debounce
    // so the two never race; the baseline is refreshed after a successful save.
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
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

        // The full save just persisted the money slice too — refresh the
        // autosave baseline so it doesn't re-write the same data afterwards.
        autosaveBaselineRef.current = { jobId: editing.id, json: autosaveSliceRef.current }
        setBillingAutosaveStatus('idle')

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
          {headerTradePill && editing ? (
            <button
              type="button"
              onClick={() => {
                const jobId = editing.id
                onClose()
                navigate(`/jobs?tab=stages&stagesJob=${encodeURIComponent(jobId)}`)
              }}
              title="Open this job in Jobs → Stages (closes Edit Job without saving)"
              aria-label="Open this job in Jobs → Stages. Closes Edit Job without saving."
              style={{ ...headerTradePill.style, marginTop: 0, cursor: 'pointer', flexShrink: 0 }}
            >
              {headerTradePill.label}
            </button>
          ) : null}
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
                border: '1px solid var(--border-blue)',
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
                  border: '1px solid var(--border-blue)',
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
                  border: '1px solid var(--border-blue)',
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
                  border: '1px solid var(--border-blue)',
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
              border: '1px solid var(--border-green)',
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
                border: '1px solid var(--border-green)',
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
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
          <JobFormPeoplePicker users={users} teamMemberIds={teamMemberIds} setTeamMemberIds={setTeamMemberIds} />
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
                              style={{ padding: '0.5rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
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
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '0.75rem',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0.4rem 0.65rem',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-800)' }}>Billing</span>
              {editing?.id && billingAutosaveStatus !== 'idle' && (
                <span
                  aria-live="polite"
                  style={{
                    fontSize: '0.75rem',
                    color: billingAutosaveStatus === 'error' ? 'var(--text-red-600)' : 'var(--text-muted)',
                  }}
                >
                  {billingAutosaveStatus === 'saving'
                    ? 'Saving…'
                    : billingAutosaveStatus === 'saved'
                      ? 'Saved'
                      : 'Autosave failed — use Save'}
                </span>
              )}
            </div>
            <MoneyLifecycleBar
              hasBar={billingBar.hasBar}
              barTitle={[
                `Job total ${'$'}${formatCurrency(billingBar.total)} — paid ${'$'}${formatCurrency(billingBar.paid)}, billed unpaid ${'$'}${formatCurrency(billingBar.billedUnpaid)}, draft ${'$'}${formatCurrency(billingBar.draft)}`,
                editing?.pct_complete != null ? `field progress ${Math.round(editing.pct_complete)}% (yellow dot)` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              pctComplete={editing?.pct_complete ?? null}
              pctSaving={pctSaving}
              onPctCommit={editing?.id ? commitPctComplete : undefined}
              total={billingBar.total}
              segments={[
                { key: 'paid', frac: billingBar.paidFrac, color: PAID_COLOR },
                { key: 'billed', frac: billingBar.billedFrac, color: BILLED_COLOR },
                { key: 'draft', frac: billingBar.draftFrac, color: DRAFT_COLOR },
              ]}
              rows={[
                // Labels lead with each slice's OWN share of the job total (slices +
                // the unbilled remainder sum to 100%), matching the Stages legend.
                {
                  key: 'paid',
                  label: billingBar.hasBar ? `${Math.round(billingBar.paidFrac * 100)}% Paid` : 'Paid',
                  value: billingBar.paid,
                  dot: PAID_COLOR,
                },
                {
                  key: 'billed',
                  label: billingBar.hasBar
                    ? `${Math.round(billingBar.billedFrac * 100)}% Billed`
                    : 'Billed',
                  value: billingBar.billedUnpaid,
                  dot: BILLED_COLOR,
                },
                ...(billingBar.draft > 0
                  ? [
                      {
                        key: 'draft',
                        label: billingBar.hasBar
                          ? `${Math.round(billingBar.draftFrac * 100)}% Draft (not sent)`
                          : 'Draft (not sent)',
                        value: billingBar.draft,
                        dot: DRAFT_COLOR,
                      },
                    ]
                  : []),
              ]}
              bottomRow={{
                label: 'Remaining to bill',
                value: billingBar.remaining,
                title: 'Job Total minus payments and every draft or sent bill',
              }}
            />
          </div>
          <JobFormFixturesSection
            fixtures={fixtures}
            fixtureScopeExpandedById={fixtureScopeExpandedById}
            setFixtureScopeExpandedById={setFixtureScopeExpandedById}
            fixturesSectionHighlight={fixturesSectionHighlight}
            fixturesSectionHighlightRef={fixturesSectionHighlightRef}
            updateFixtureRow={updateFixtureRow}
            addFixtureRow={addFixtureRow}
            removeFixtureRow={removeFixtureRow}
            setStripeFixturePreviewRowId={setStripeFixturePreviewRowId}
            jobTotalDollars={jobTotalBidDollars}
          />
          <div style={{ marginBottom: '1rem' }}>
          {editing && (
            <>
              <div style={{ fontWeight: 400, textDecoration: 'underline', fontSize: '0.9375rem', color: 'var(--text-700)', marginBottom: '0.15rem' }}>② Invoices</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Creating an invoice breaks off the invoice as a card that starts in <strong>Stage: Ready to Bill</strong> right away separate from this form.
              </div>
              {editing ? (
                <JobFormBreakOffSection
                  breakOff={breakOff}
                  jobTotalBidDollars={jobTotalBidDollars}
                  movingJobToReadyToBill={movingJobToReadyToBill}
                  creatingInvoice={creatingInvoice}
                  createInvoice={createInvoice}
                  moveWorkingJobToReadyToBillFromEdit={moveWorkingJobToReadyToBillFromEdit}
                />
              ) : null}
              <JobFormInvoiceList
                editing={editing}
                payments={payments}
                canApplyAgreedWriteDown={canApplyAgreedWriteDown}
                onClose={onClose}
                onSavedRef={onSavedRef}
                setEditing={setEditing}
                setBillViewInvoice={setBillViewInvoice}
                setAgreedWriteDownInvoice={setAgreedWriteDownInvoice}
                refreshEditingJobAndHydratePayments={refreshEditingJobAndHydratePayments}
              />
            </>
          )}
            <JobFormPaymentsTable
              editing={editing}
              payments={payments}
              persistedLedgerPaymentIds={persistedLedgerPaymentIds}
              unlinkingMercuryPaymentId={unlinkingMercuryPaymentId}
              updatePaymentRow={updatePaymentRow}
              addPaymentRow={addPaymentRow}
              requestRemovePaymentRow={requestRemovePaymentRow}
              setUnlinkMercuryConfirmRowId={setUnlinkMercuryConfirmRowId}
              setBillViewInvoice={setBillViewInvoice}
            />
          </div>
          <JobFormLaborCostPanel
            editing={editing}
            editJobTeamLaborLoading={editJobTeamLaborLoading}
            editJobTeamLaborError={editJobTeamLaborError}
            editJobTeamLaborRow={editJobTeamLaborRow}
            editJobSubLaborLoading={editJobSubLaborLoading}
            editJobSubLaborError={editJobSubLaborError}
            editJobSubLaborData={editJobSubLaborData}
            editJobEffectiveHcp={editJobEffectiveHcp}
            showTeamLaborOpenOnJobsLink={showTeamLaborOpenOnJobsLink}
            showSubLaborOpenOnJobsLink={showSubLaborOpenOnJobsLink}
            onClose={onClose}
          />
          <JobFormPartsCostSection
            editing={editing}
            hideTitle={!!editing?.id}
            materialsAccordionOpen={materialsAccordionOpen}
            toggleMaterialsAccordion={toggleMaterialsAccordion}
            jobMaterialsSnapshotLoading={jobMaterialsSnapshotLoading}
            supplyInvoiceTotal={supplyInvoiceTotal}
            supplyInvoiceRpcFailed={supplyInvoiceRpcFailed}
            supplyInvoiceLines={supplyInvoiceLines}
            mercuryCardTotal={mercuryCardTotal}
            mercuryFetchFailed={mercuryFetchFailed}
            mercuryAllocLines={mercuryAllocLines}
            tallyPartsTotal={tallyPartsTotal}
            tallyFetchFailed={tallyFetchFailed}
            tallyPartLines={tallyPartLines}
            billedMaterialsTotalDisplay={billedMaterialsTotalDisplay}
            materials={materials}
            addMaterialRow={addMaterialRow}
            updateMaterialRow={updateMaterialRow}
            removeMaterialRow={removeMaterialRow}
          />
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
      <JobFormDeleteMigrateModals
        editing={editing}
        deleteJobConfirmOpen={deleteJobConfirmOpen}
        setDeleteJobConfirmOpen={setDeleteJobConfirmOpen}
        deletingId={deletingId}
        migrate={migrate}
        hasMigrateableCosts={hasMigrateableCosts}
        costCheckErrored={costCheckErrored}
        costSnapshotStillLoading={costSnapshotStillLoading}
        reassignRequired={reassignRequired}
        partsCostStyleTotal={partsCostStyleTotal}
        materialsBilledTotalForMigrate={materialsBilledTotalForMigrate}
        editJobTeamLaborRow={editJobTeamLaborRow}
        editJobSubLaborData={editJobSubLaborData}
        confirmDeleteJob={confirmDeleteJob}
        migrateJobLedgerCostsAndDelete={migrateJobLedgerCostsAndDelete}
        nestedOverlayZIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
        migrateOverlayZIndex={JOB_FORM_MIGRATE_OVERLAY_Z_INDEX}
      />
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
                      style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
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
