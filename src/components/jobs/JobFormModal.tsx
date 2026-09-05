/* eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { JOB_FORM_SECTION_HEADER_STYLE } from '../../lib/jobFormSectionHeaderStyle'
import { supabase } from '../../lib/supabase'
import { titleCaseAddress } from '../../lib/addressTitleCase'
import { type CustomerAddressRow } from '../../lib/jobs/lienProperty'

/** Slim customer_addresses row for the property-record picker (v2.2638). */
type PropertyCandidateRow = Pick<
  CustomerAddressRow,
  'id' | 'customer_id' | 'address' | 'county' | 'legal_description' | 'owner_name' | 'owner_company' | 'owner_mailing_address'
>
import { fetchUserDisplayNames, userDisplayLabel } from '../../lib/userDisplayNames'
import { billsAheadRemedyHint } from '../../lib/jobs/editJobInvoiceSendBack'
import { useAuth } from '../../hooks/useAuth'
import { useJobHazmatIncidents } from '../../hooks/useJobHazmatIncidents'
import { sumHazmatRiderFees, type JobHazmatIncidentRow } from '../../lib/hazmatIncidents'
import { linkHazmatFeeIncidentToInvoice } from '../../lib/hazmatFeeEdit'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { parseCustomerImport } from '../../utils/parseCustomerImport'
import {
  OperationTimeoutError,
  formatPostgrestOrUnknownError,
  withOperationTimeout,
  withSupabaseRetry,
} from '../../utils/errorHandling'
import {
  buildBillingSliceJson,
  buildEditJobIdentityUpdatePayload,
  buildIdentitySliceJson,
  buildMaterialsSliceJson,
  buildTeamSliceJson,
  diffTeamMemberIds,
  fixtureInsertRows,
  identitySliceReadyToSave,
  materialInsertRows,
  paymentInsertRows,
  shouldDemotePaidJobToBilled,
  type JobIdentityFormFields,
} from '../../lib/jobs/jobFormAutosaveSlices'
import { diffPaymentRows } from '../../lib/jobs/paymentRowsDiff'
import { composePctAutoNoteBody } from '../../lib/jobs/stagesPctNote'
import { postJobThreadNoteBody } from '../../lib/jobs/postJobThreadNote'
import {
  buildJobFormUndoSnapshot,
  invoiceSetKey,
  jobFormUndoAvailable,
  sanitizeRestoredFixtureLinks,
  type JobFormUndoSnapshot,
} from '../../lib/jobs/jobFormUndo'
import { useJobFormAutosaveSlice } from './useJobFormAutosaveSlice'
import { notifyDispatchRequestsChanged } from '../../lib/dispatchRequestHelpers'
import { JobFormSourceEstimateBanner } from './JobFormSourceEstimateBanner'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { resolveCustomerIdForJobPayload, resolveGcCustomerIdForJobPayload } from '../../lib/jobLedgerCustomer'
import { groupVersionsByGc, resolveWinningPacket, type GcPacket } from '../../lib/bids/gcPackets'
import { latestSendByVersion, type VersionSendRow } from '../../lib/bids/versionSends'
import { setGcPacketOutcome } from '../../lib/bids/gcPacketOutcome'
import { PickWinningGcModal, type WinningGcOption } from './PickWinningGcModal'
import {
  resolveDevelopmentIdForJobPayload,
  validateNewDevelopmentName,
  type JobFormDevelopmentRow,
} from '../../lib/jobs/jobDevelopments'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { buildEditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import { MoneyLifecycleBar, PAID_COLOR, BILLED_COLOR, DRAFT_COLOR } from './MoneyLifecycleBar'
import { useBreakOffSlider } from './useBreakOffSlider'
import { useJobCostSnapshot } from './useJobCostSnapshot'
import { useJobMigrate } from './useJobMigrate'
import { JobFormInvoiceList } from './JobFormInvoiceList'
import { JobFormHazmatRiderRows } from './JobFormHazmatRidersStrip'
import { JobFormPaymentsTable } from './JobFormPaymentsTable'
import { JobFormPartsCostSection } from './JobFormPartsCostSection'
import { JobFormLaborCostPanel } from './JobFormLaborCostPanel'
import { JobFormBreakOffSection, JobFormBreakOffTrack } from './JobFormBreakOffSection'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import { JobFormPeoplePicker } from './JobFormPeoplePicker'
import { JobFormAccountManSection } from './JobFormAccountManSection'
import { JobFormDeleteMigrateModals } from './JobFormDeleteMigrateModals'
import JobStatusStepper from './JobStatusStepper'
import {
  formatCurrency,
  parseMoneyInputToNumber,
} from '../../lib/jobs/jobFormMoney'
import {
  breakOffPrefillAmountStringFromJob,
  unallocatedBillableDollars,
} from '../../lib/jobs/jobFormBreakOff'
import { ensureRemainderResyncOutcome } from '../../lib/jobs/ensureRtbRemainderResult'
import type {
  FixtureRow,
  JobFormServiceType,
  MaterialRow,
  MeServiceTypeColumns,
  PaymentRow,
} from '../../lib/jobs/jobFormTypes'
import { pickDefaultServiceTypeId, visibleServiceTypesForJobForm } from '../../lib/jobs/jobFormServiceTypes'
import {
  fixtureRowHasUserContent,
  materialRowHasUserContent,
  newEmptyPaymentRow,
  newJobFormHasBlockingContent,
  paymentRowsFromJob,
} from '../../lib/jobs/jobFormRows'
import { moveRowById } from '../../lib/jobs/jobFormReorder'
import {
  buildJobSegmentsBar,
  dollarCoverageForSegments,
  exactSingleSegmentMatchForAmount,
  linkableSelectedIds,
  segmentBoundaryMarks,
  segmentSelectionNetSummary,
  selectedSegmentSequencePositions,
} from '../../lib/jobs/jobSegmentsCoverage'
import { InvoicesSectionHeading, JobFormSegmentsBar, JobFormSegmentsCreateAction } from './JobFormSegmentsBar'
import { MultipleSegmentGeneratorModal } from './MultipleSegmentGeneratorModal'
import type { SegmentGeneratorPayloadLine } from '../../lib/jobs/segmentGenerator'
import {
  canRemovePaymentRowFromForm,
  canUnlinkMercuryPayment,
  mercuryLinkedPaymentRow,
  mercuryUnlinkBlockedByStripeHostedInvoice,
  paymentRowLinkedToInvoice,
  stripeBillInvoiceForPaymentRow,
} from '../../lib/jobs/jobFormPaymentPredicates'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import {
  getHideHcpFieldCached,
  refreshHideHcpFieldCache,
  shouldHideHcpEntryField,
} from '../../lib/hideHcpFieldSetting'
import { resolveEditJobMasterUserId } from '../../lib/resolveEditJobMasterUserId'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { prepareBilledInvoicesBeforeJobRevertToReadyToBill, stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
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
import { JobFormBillToEditor, type BillToEditorInvoice } from './JobFormBillToEditor'
import { loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
import { laborItemsSubtotal } from '../../lib/peopleLaborJobItemLineCost'
import {
  buildFixtureStripeLineDescriptionForStripe,
} from '../../lib/stripeInvoiceLineDescription'
import { JobFormHeaderRow } from './JobFormHeaderRow'
import { JobFormIdentityFields } from './JobFormIdentityFields'
import { JobFormLinksSection } from './JobFormLinksSection'
import { JobFormCustomerSection } from './JobFormCustomerSection'
import { JobFormEditFactRows } from './JobFormEditFactRows'
import { JobFormCreateCustomerModal } from './JobFormCreateCustomerModal'
import { extractContactFromCustomer, getCustomerDisplay } from '../../lib/jobs/jobFormCustomerDisplay'
import { formatJobFormBidLinkTitle } from '../../lib/jobs/jobFormBidLinkTitle'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type EstimatesRow = Database['public']['Tables']['estimates']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }







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
  /**
   * Job-window embedding (v2.1675): the tabbed Job window renders this form as
   * its Edit + Bill panes. When set, the form skips its own overlay/card chrome
   * (the window provides them), hides the header title / Job Detail bridge /
   * footer Close, and shows ONE region at a time — everything stays mounted
   * (display-toggled) so tab switches never lose state. 'edit' = identity,
   * team, customer, links, line items; 'bill' = the billing half (segment bar,
   * invoices, payments, labor + parts cost).
   */
  embeddedRegion?: 'edit' | 'bill' | null
  /**
   * Embedding only: receives the guarded close (autosave flush) so the window's
   * ✕ can route through it. Called with null on unmount.
   */
  registerRequestClose?: ((fn: (() => Promise<boolean>) | null) => void) | null
  /**
   * Embedding only: true while the Job tab has a stacked satellite open
   * (Reports / Calendar / …) — folded into the Escape gate so Esc closes the
   * satellite, never the whole window underneath it.
   */
  externalEscBlocked?: boolean
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
  embeddedRegion = null,
  registerRequestClose = null,
  externalEscBlocked = false,
}: JobFormModalProps) {
  const embedded = embeddedRegion !== null
  const { user: authUser, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  /** Phone footer layout (v2.1239): status line above one deliberate button row. */
  const narrowViewport = useNarrowViewport640()
  const prefixMap = useLedgerPrefixMap()
  const { incidents: hazmatIncidents, hazmatInvoiceIds, refresh: refreshHazmatIncidents } = useJobHazmatIncidents(editJobId)
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
  // Per-invoice "Bill to" editor (v2.1086) — shell-owned so the invoice list
  // AND the RIDERS "Bill separately…" flow can both open it.
  const [billToEditorInvoice, setBillToEditorInvoice] = useState<BillToEditorInvoice | null>(null)
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
            // A5: dev-gated pref — non-devs pinned live (the invoice row's own
            // mode wins server-side since A3 regardless).
            ...stripeModeInvokeBody(stripeModeForBillingFromRole(authRole)),
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
  const [hcpNumber, setHcpNumber] = useState('')
  const [clickNumber, setClickNumber] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [accountManagerUserId, setAccountManagerUserId] = useState<string | null>(null)
  /** Hide the legacy HCP entry field (v2.1533) — decided per open; edit-mode hydrate re-decides with the job's value. */
  const [hideHcpEntryField, setHideHcpEntryField] = useState<boolean>(() =>
    shouldHideHcpEntryField(getHideHcpFieldCached(), ''),
  )
  useEffect(() => {
    // Refresh the localStorage mirror for NEXT open; this open uses the cache.
    void refreshHideHcpFieldCache(supabase)
  }, [])
  const [accountManagerRelationship, setAccountManagerRelationship] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  /** Optional GC (General Contractor) — a second customers link, like bids' GC/Builder (v2.1176). */
  const [gcCustomerId, setGcCustomerId] = useState<string | null>(null)
  /** Property record link (v2.2638): customer_addresses row this job sits at — feeds lien documents. */
  const [customerAddressId, setCustomerAddressId] = useState<string | null>(null)
  const [propertyCandidates, setPropertyCandidates] = useState<PropertyCandidateRow[]>([])
  /** Optional development (group of jobs) — a developments row id (v2.1199). */
  const [developmentId, setDevelopmentId] = useState<string | null>(null)
  const [developments, setDevelopments] = useState<JobFormDevelopmentRow[]>([])
  /** The linked bid's GC (bids.customer_id + name) — drives the picker's "Use bid's GC" chip. */
  const [linkedBidGc, setLinkedBidGc] = useState<{ id: string; name: string } | null>(null)
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
  // Per-GC Phase 3 (docs/PER_GC_BID_PLAN.md): a multi-GC bid becoming a job asks which GC gave it.
  const [winningGcPick, setWinningGcPick] = useState<{
    bidId: string
    bidName: string
    options: WinningGcOption[]
    writesWin: boolean
    bidOutcome: string | null
    agreedValue: number | null
    packets: GcPacket[]
  } | null>(null)
  /** Auto-picked trade on new-job load; changing away from this counts as “content” for hiding Import. */
  const initialNewJobServiceTypeIdRef = useRef('')
  /** Avoid duplicate applyPrefillFromBid before bidId state updates (e.g. Strict Mode). */
  const newJobPrefillBidAppliedRef = useRef<string | null>(null)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customersLoading, setCustomersLoading] = useState(false)
  const [creatingCustomerFromJob, setCreatingCustomerFromJob] = useState(false)
  const [createCustomerFromJobModalOpen, setCreateCustomerFromJobModalOpen] = useState(false)
  const [jobProjectLinkChoiceOpen, setJobProjectLinkChoiceOpen] = useState(false)
  /** True while the source-estimate banner's acceptance-record modal is open (pauses Escape-to-close). */
  const [bannerOverlayOpen, setBannerOverlayOpen] = useState(false)
  const [customerExpanded, setCustomerExpanded] = useState(false)
  const [projectFilesPlansExpanded, setProjectFilesPlansExpanded] = useState(false)
  const [billingCustomerHighlight, setBillingCustomerHighlight] = useState(false)
  const [fixturesSectionHighlight, setFixturesSectionHighlight] = useState(false)
  const [jobPicturesLinkHighlight, setJobPicturesLinkHighlight] = useState(false)
  const [dateMet, setDateMet] = useState('')
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [jobPicturesLink, setJobPicturesLink] = useState('')
  const [jobPlansLink, setJobPlansLink] = useState('')
  const [payments, setPayments] = useState<PaymentRow[]>(() => [newEmptyPaymentRow()])
  const refreshEditingJobAndHydratePayments = useCallback((jobId: string) => {
    void fetchJobWithDetailsById(jobId).then((found) => {
      if (!found) return
      setEditing(found)
      setPayments(paymentRowsFromJob(found))
      hydratedPaymentIdsRef.current = (found.payments ?? []).map((p) => p.id)
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
    { id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null },
  ])
  /** User opened "Add scope or notes" for this fixture row id (persists while row exists). */
  const [fixtureScopeExpandedById, setFixtureScopeExpandedById] = useState<Record<string, boolean>>({})
  // v2.1223: one preview for the whole job — the dialog lists every line item's
  // Stripe line, opened from the ① Line Items title row (per-row eyes removed).
  const [stripeFixturePreviewOpen, setStripeFixturePreviewOpen] = useState(false)
  // Named rows only — mirrors the save filter; a blank placeholder row has no Stripe line.
  const stripeFixturePreviewRows = useMemo(
    () => fixtures.filter((f) => (f.name ?? '').trim() !== ''),
    [fixtures],
  )
  useEffect(() => {
    if (!stripeFixturePreviewOpen) return
    const onKeyDown = (ev: WindowEventMap['keydown']) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        setStripeFixturePreviewOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stripeFixturePreviewOpen])
  const jobTotalBidDollars = useMemo(() => revenueDollarsFromFixtures(fixtures), [fixtures])
  // v2.1029: rider (hazmat) fees count toward the Job Total — display, billing
  // math, AND the revenue written on save (previously saving recomputed
  // revenue from fixtures alone, silently wiping the fee's revenue bump).
  const riderFeesDollars = useMemo(() => sumHazmatRiderFees(hazmatIncidents), [hazmatIncidents])
  const jobTotalWithRidersDollars = jobTotalBidDollars + riderFeesDollars
  /** Live money-lifecycle figures for the billing header bar (fixtures total + this form's payments + the job's invoices). */
  const billingBar = useMemo(
    () =>
      buildEditJobBillingBar({
        total: jobTotalWithRidersDollars,
        payments: payments.map((p) => ({ amount: Number(p.amount) || 0, invoice_id: p.invoice_id })),
        invoices: (editing?.invoices ?? []).map((i) => ({ status: i.status, amount: i.amount, id: i.id })),
      }),
    [jobTotalWithRidersDollars, payments, editing?.invoices],
  )
  // ---- Billing money autosave (editing mode only) -------------------------
  // Persists the money slice — line items, payments, and the derived
  // revenue/payments_made — ~1.2s after the user stops editing, using the same
  // delete+reinsert writes as handleSubmit. The baseline snapshot is captured
  // in the same commit that hydrates the form (hydrate sets editing + fixtures
  // + payments together), so autosave can never fire against pre-hydration
  // empty state and wipe rows. Job identity fields stay on explicit Save.
  const fixtureInvoiceStatusById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const inv of editing?.invoices ?? []) map[inv.id] = inv.status
    return map
  }, [editing?.invoices])

  // One segments build feeds the % done bar's boundary ticks (v2.1130) and the
  // ② Invoices dollar-coverage model (v2.1132).
  const billingSegments = useMemo(
    () => buildJobSegmentsBar({ fixtures, riderFeesDollars, invoiceStatusById: fixtureInvoiceStatusById }),
    [fixtures, riderFeesDollars, fixtureInvoiceStatusById],
  )
  const billingBarMarks = useMemo(() => segmentBoundaryMarks(billingSegments), [billingSegments])
  // Money paid or invoiced by dollar amount (no line-item links): hatches the
  // ② strip, locks fully covered rows, and caps segment invoicing at the
  // slider's Remaining. Same payments+invoices basis as useBreakOffSlider.
  const segmentCoverage = useMemo(() => {
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return dollarCoverageForSegments({
      segments: billingSegments,
      grossDollars: jobTotalWithRidersDollars,
      paidDollars: paidSum,
      invoices: editing?.invoices,
    })
  }, [billingSegments, jobTotalWithRidersDollars, payments, editing?.invoices])

  // ② Invoices segment bar (v2.1070): which unbilled line items are picked
  // for the next "create invoice from selected segments" action.
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(new Set())
  const [creatingSegmentInvoice, setCreatingSegmentInvoice] = useState(false)
  const [billingFeeSeparatelyId, setBillingFeeSeparatelyId] = useState<string | null>(null)

  const [segmentGeneratorOpen, setSegmentGeneratorOpen] = useState(false)

  // v2.1100: Escape closes the modal through the same guarded closeForm() as a
  // backdrop click — but not while a nested overlay is open (each is gated by
  // its shell flag below; the banner's acceptance-record modal reports through
  // bannerOverlayOpen and owns its own Escape). closeForm is hoisted; the ref
  // keeps the listener on the current render's closure.
  const escCloseBlocked =
    externalEscBlocked ||
    jobBidLinkChoiceOpen ||
    jobImportSourceOpen ||
    jobProjectLinkChoiceOpen ||
    createCustomerFromJobModalOpen ||
    segmentGeneratorOpen ||
    bannerOverlayOpen ||
    stripeFixturePreviewOpen ||
    billViewInvoice != null ||
    agreedWriteDownInvoice != null ||
    billToEditorInvoice != null
  const closeFormRef = useRef<() => Promise<boolean>>()
  closeFormRef.current = closeForm
  useEffect(() => {
    if (escCloseBlocked) return
    const onKeyDown = (ev: WindowEventMap['keydown']) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return
      void closeFormRef.current?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [escCloseBlocked])

  // Job-window embedding: hand the shell the guarded close (autosave flush) so
  // its ✕ routes through the same path as the Close button and Escape.
  useEffect(() => {
    if (!registerRequestClose) return
    registerRequestClose(() => closeFormRef.current?.() ?? Promise.resolve(true))
    return () => registerRequestClose(null)
  }, [registerRequestClose])

  function addGeneratedSegmentsToJob(lines: SegmentGeneratorPayloadLine[]) {
    if (lines.length > 0) {
      setFixtures((prev) => {
        const rows = lines.map((l) => ({ id: crypto.randomUUID(), ...l, line_description: '' }))
        // A lone untouched placeholder row is replaced instead of kept above the result.
        const base = prev.length === 1 && prev[0] && !fixtureRowHasUserContent(prev[0]) ? [] : prev
        return [...base, ...rows]
      })
    }
    setSegmentGeneratorOpen(false)
  }

  // A deleted invoice releases its DB fixture rows via ON DELETE SET NULL;
  // mirror that into local state so a later save can't reinsert the stale
  // invoice_id (FK violation) and the segment bar unbills immediately.
  function clearFixtureLinksForDeletedInvoice(invoiceId: string) {
    setFixtures((prev) => prev.map((r) => (r.invoice_id === invoiceId ? { ...r, invoice_id: null } : r)))
  }

  function toggleSegmentSelected(fixtureRowId: string) {
    const next = new Set(selectedSegmentIds)
    if (next.has(fixtureRowId)) next.delete(fixtureRowId)
    else next.add(fixtureRowId)
    setSelectedSegmentIds(next)
    // Selecting segments MOVES the Make Invoice bar to the selection total
    // but never locks it (v2.1152) — the user can still drag the slider or
    // edit the amount afterward and use New Invoice instead of the
    // segment-linked create. Deselecting everything restores the prefill.
    // Net of coverage: the bar mirrors what the segment create will bill.
    const { netDollars, count } = segmentSelectionNetSummary(fixtures, next, segmentCoverage)
    // Clamp to the unallocated remainder — the net can still exceed it when
    // dollar coverage landed on unselected rows, and the bar clamps anyway.
    const syncDollars = Math.min(netDollars, breakOff.breakOffRemaining)
    setNewInvoiceAmount(
      count > 0 && syncDollars > 0
        ? syncDollars.toFixed(2)
        : editing
          ? breakOffPrefillAmountStringFromJob(editing)
          : '',
    )
    setNewInvoiceAmountInputFocused(false)
  }

  const billingMoneySliceJson = useMemo(() => buildBillingSliceJson(fixtures, payments), [fixtures, payments])
  const autosaveFixturesRef = useRef(fixtures)
  autosaveFixturesRef.current = fixtures
  const autosavePaymentsRef = useRef(payments)
  autosavePaymentsRef.current = payments
  /**
   * B5: ids of the payment rows this form last knew to be persisted —
   * hydration ids on load/refresh, then each successful billing-slice
   * persist's upsert ids. Drives diffPaymentRows so the slice deletes only
   * rows the form owns; rows born mid-edit (e.g. a Stripe webhook payment)
   * are invisible to the diff and survive autosaves. Deliberately NOT reset
   * by Undo — it tracks DB reality, not form state.
   */
  const hydratedPaymentIdsRef = useRef<string[]>([])
  const autosaveRiderFeesRef = useRef(riderFeesDollars)
  autosaveRiderFeesRef.current = riderFeesDollars
  const autosaveJobIdRef = useRef<string | null>(null)
  autosaveJobIdRef.current = editing?.id ?? null

  /**
   * The billing-slice WRITES — the same delete+reinsert sequence as always
   * (payloads now built by the jobFormAutosaveSlices kernel). Baseline,
   * debounce, and in-flight bookkeeping live in useJobFormAutosaveSlice.
   */
  async function persistBillingSlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return true
    try {
      const fx = autosaveFixturesRef.current
      const pays = autosavePaymentsRef.current
      const revNum = revenueDollarsFromFixtures(fx) + autosaveRiderFeesRef.current
      // B4 (FRAGILITY_REMEDIATION_PLAN.md): payments_made is a DB-trigger-
      // maintained cache of SUM(jobs_ledger_payments.amount) since B3 — the
      // row rewrite below keeps it in sync; the client no longer writes it.
      const { error: updErr } = await supabase
        .from('jobs_ledger')
        .update({ revenue: revNum })
        .eq('id', jobId)
      if (updErr) throw updErr
      // B5: diff instead of delete-all+reinsert — stable row ids (no
      // activity-event churn) and rows born mid-edit survive.
      const { deleteIds, upserts } = diffPaymentRows(jobId, hydratedPaymentIdsRef.current, pays)
      if (deleteIds.length > 0) {
        const { error: delPayErr } = await supabase
          .from('jobs_ledger_payments')
          .delete()
          .in('id', deleteIds)
          .eq('job_id', jobId)
        if (delPayErr) throw delPayErr
      }
      if (upserts.length > 0) {
        const { error: upsertPayErr } = await supabase
          .from('jobs_ledger_payments')
          .upsert(upserts, { onConflict: 'id' })
        if (upsertPayErr) throw upsertPayErr
      }
      hydratedPaymentIdsRef.current = upserts.map((u) => u.id)
      const { error: delFixErr } = await supabase.from('jobs_ledger_fixtures').delete().eq('job_id', jobId)
      if (delFixErr) throw delFixErr
      for (const row of fixtureInsertRows(jobId, fx)) {
        const { error: insFixErr } = await supabase.from('jobs_ledger_fixtures').insert(row)
        if (insFixErr) throw insFixErr
      }
      return true
    } catch (autosaveErr) {
      showToast(
        `Autosave failed: ${autosaveErr instanceof Error ? autosaveErr.message : String(autosaveErr)}`,
        'error',
      )
      return false
    }
  }

  const billingAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: billingMoneySliceJson,
    save: persistBillingSlice,
    onSaved: () => onSavedRef.current?.(),
  })
  const billingAutosaveStatus = billingAutosave.status
  const flushBillingAutosave = billingAutosave.flush

  // ---- Identity / materials / team autosave slices (v2.1079) ---------------

  // Identity: ONE scalar jobs_ledger UPDATE (no delete+reinsert). Gated on the
  // same required fields as the Save button so a half-cleared field mid-retype
  // never persists as blank; while invalid the slice stays dirty and unsaved.
  const identityFields: JobIdentityFormFields = {
    hcpNumber,
    clickNumber,
    jobName,
    jobAddress,
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    gcCustomerId,
    developmentId,
    googleDriveLink,
    jobPicturesLink,
    jobPlansLink,
    projectId: projectId ?? '',
    bidId: bidId ?? '',
    serviceTypeId: formServiceTypeId,
    accountManagerUserId,
    accountManagerRelationship,
    customerAddressId,
  }
  const identityFieldsRef = useRef(identityFields)
  identityFieldsRef.current = identityFields
  const identitySliceJson = buildIdentitySliceJson(identityFields)
  const projectsRef = useRef(projects)
  projectsRef.current = projects
  const customersRef = useRef(customers)
  customersRef.current = customers
  const developmentsRef = useRef(developments)
  developmentsRef.current = developments
  const editingMasterUserIdRef = useRef<string | null>(null)
  editingMasterUserIdRef.current = editing?.master_user_id ?? null
  /** Last PERSISTED pictures link — drives the blank→set dispatch auto-close. */
  const persistedPicturesLinkRef = useRef('')

  // Property-record candidates (v2.2638): the job customer's + GC's saved
  // addresses. Fail-soft; a stale link (customer changed away from the row's
  // owner) is cleared only after a SUCCESSFUL load proves it foreign.
  useEffect(() => {
    const ids = [customerId, gcCustomerId].filter((v): v is string => Boolean(v))
    if (ids.length === 0) {
      setPropertyCandidates([])
      if (customerAddressId) setCustomerAddressId(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('id, customer_id, address, county, legal_description, owner_name, owner_company, owner_mailing_address')
          .in('customer_id', ids)
          .order('sequence_order', { ascending: true })
        if (error || cancelled) return
        const rows = (data ?? []) as PropertyCandidateRow[]
        setPropertyCandidates(rows)
        if (customerAddressId && !rows.some((r) => r.id === customerAddressId)) {
          setCustomerAddressId(null)
        }
      } catch {
        // keep the current link; candidates just stay empty
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, gcCustomerId, open])

  /** Same auto-close saveJob performs when the pictures link goes blank→set. */
  async function autoClosePicturesDispatchRequests(jobId: string): Promise<void> {
    if (!authUser?.id) return
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
            .eq('job_ledger_id', jobId)
            .eq('pending_action', 'link_job_pictures')
            .eq('status', 'open'),
        'auto-close link_job_pictures dispatch requests',
      )
      notifyDispatchRequestsChanged()
    } catch (closeErr) {
      console.warn('auto-close dispatch_requests failed', closeErr)
    }
  }

  async function persistIdentitySlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    const existingMaster = editingMasterUserIdRef.current
    if (!jobId || !existingMaster) return true
    const fields = identityFieldsRef.current
    try {
      const proj = fields.projectId ? projectsRef.current.find((p) => p.id === fields.projectId) : null
      const payload = buildEditJobIdentityUpdatePayload({
        fields,
        existingJobMasterUserId: existingMaster,
        projectMasterUserId: proj?.master_user_id ?? null,
        customers: customersRef.current,
        developments: developmentsRef.current,
      })
      const { error: updErr } = await supabase.from('jobs_ledger').update(payload).eq('id', jobId)
      if (updErr) throw updErr
      const newPicturesLink = fields.jobPicturesLink.trim()
      if (newPicturesLink && !persistedPicturesLinkRef.current) {
        await autoClosePicturesDispatchRequests(jobId)
      }
      persistedPicturesLinkRef.current = newPicturesLink
      return true
    } catch (identityErr) {
      showToast(
        `Autosave failed: ${identityErr instanceof Error ? identityErr.message : String(identityErr)}`,
        'error',
      )
      return false
    }
  }

  const identityAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: identitySliceJson,
    save: persistIdentitySlice,
    enabled: identitySliceReadyToSave(identityFields),
    onSaved: () => onSavedRef.current?.(),
  })

  // Materials: same delete+reinsert shape as the billing slice.
  const materialsSliceJson = buildMaterialsSliceJson(materials)
  const autosaveMaterialsRef = useRef(materials)
  autosaveMaterialsRef.current = materials

  async function persistMaterialsSlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return true
    try {
      const { error: delMatErr } = await supabase.from('jobs_ledger_materials').delete().eq('job_id', jobId)
      if (delMatErr) throw delMatErr
      for (const row of materialInsertRows(jobId, autosaveMaterialsRef.current)) {
        const { error: insMatErr } = await supabase.from('jobs_ledger_materials').insert(row)
        if (insMatErr) throw insMatErr
      }
      return true
    } catch (matErr) {
      showToast(`Autosave failed: ${matErr instanceof Error ? matErr.message : String(matErr)}`, 'error')
      return false
    }
  }

  const materialsAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: materialsSliceJson,
    save: persistMaterialsSlice,
    onSaved: () => onSavedRef.current?.(),
  })

  // Team: already-incremental diff writes; short debounce batches rapid toggles.
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([])
  // Mirror of the DB team-removal trigger (v2.1466): un-teaming the Account
  // Man clears the pick immediately in the open form too.
  useEffect(() => {
    if (accountManagerUserId && !teamMemberIds.includes(accountManagerUserId)) {
      setAccountManagerUserId(null)
      setAccountManagerRelationship(null)
    }
  }, [accountManagerUserId, teamMemberIds])
  const teamSliceJson = buildTeamSliceJson(teamMemberIds)
  const autosaveTeamIdsRef = useRef(teamMemberIds)
  autosaveTeamIdsRef.current = teamMemberIds

  async function persistTeamSlice(): Promise<boolean> {
    const jobId = autosaveJobIdRef.current
    if (!jobId) return true
    try {
      const { data: existingTeam, error: teamReadErr } = await supabase
        .from('jobs_ledger_team_members')
        .select('user_id')
        .eq('job_id', jobId)
      if (teamReadErr) throw teamReadErr
      const { toAdd, toRemove } = diffTeamMemberIds(
        autosaveTeamIdsRef.current,
        (existingTeam ?? []).map((t: { user_id: string }) => t.user_id),
      )
      for (const uid of toAdd) {
        const { error: insErr } = await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
        if (insErr) throw insErr
      }
      for (const uid of toRemove) {
        const { error: delErr } = await supabase
          .from('jobs_ledger_team_members')
          .delete()
          .eq('job_id', jobId)
          .eq('user_id', uid)
        if (delErr) throw delErr
      }
      return true
    } catch (teamErr) {
      showToast(`Autosave failed: ${teamErr instanceof Error ? teamErr.message : String(teamErr)}`, 'error')
      return false
    }
  }

  const teamAutosave = useJobFormAutosaveSlice({
    jobId: editing?.id ?? null,
    sliceJson: teamSliceJson,
    save: persistTeamSlice,
    debounceMs: 400,
    onSaved: () => onSavedRef.current?.(),
  })

  /** Every edit-mode autosave slice, in close-flush order. */
  const editAutosaveSlices = [billingAutosave, identityAutosave, materialsAutosave, teamAutosave]

  /** Flush every dirty enabled slice (visibility handler, best-effort). */
  async function flushAllAutosaveSlices(): Promise<void> {
    for (const slice of editAutosaveSlices) await slice.flush()
  }
  const flushAllAutosaveSlicesRef = useRef(flushAllAutosaveSlices)
  flushAllAutosaveSlicesRef.current = flushAllAutosaveSlices

  // ---- Undo-to-opened (v2.1081) --------------------------------------------
  // Snapshot every slice's form state on hydrate, re-based whenever the job's
  // invoice SET changes (created/deleted) so Undo never crosses an
  // invoice-lifecycle event. Restoring just sets React state — the autosave
  // engine persists the revert like any other edit.
  const undoSnapshotRef = useRef<{ jobId: string; invoicesKey: string; snap: JobFormUndoSnapshot } | null>(null)
  const editingInvoicesKey = invoiceSetKey((editing?.invoices ?? []).map((i) => i.id))
  useEffect(() => {
    const jobId = editing?.id ?? null
    if (!jobId) {
      undoSnapshotRef.current = null
      return
    }
    const cur = undoSnapshotRef.current
    if (!cur || cur.jobId !== jobId || cur.invoicesKey !== editingInvoicesKey) {
      undoSnapshotRef.current = {
        jobId,
        invoicesKey: editingInvoicesKey,
        snap: buildJobFormUndoSnapshot({
          identity: identityFieldsRef.current,
          fixtures: autosaveFixturesRef.current,
          payments: autosavePaymentsRef.current,
          materials: autosaveMaterialsRef.current,
          teamMemberIds: autosaveTeamIdsRef.current,
        }),
      }
    }
  }, [editing?.id, editingInvoicesKey])

  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false)
  const undoAvailable =
    !!editing &&
    jobFormUndoAvailable(
      undoSnapshotRef.current && undoSnapshotRef.current.jobId === (editing?.id ?? null)
        ? undoSnapshotRef.current.snap
        : null,
      { billing: billingMoneySliceJson, identity: identitySliceJson, materials: materialsSliceJson, team: teamSliceJson },
    )

  function performUndo() {
    const snapRec = undoSnapshotRef.current
    if (!snapRec || snapRec.jobId !== (editing?.id ?? null)) return
    const s = snapRec.snap
    const validInvoiceIds = new Set((editing?.invoices ?? []).map((i) => i.id))
    setFixtures(sanitizeRestoredFixtureLinks(s.fixtures, validInvoiceIds))
    setPayments(s.payments.map((r) => ({ ...r })))
    setMaterials(s.materials.map((r) => ({ ...r })))
    setTeamMemberIds([...s.teamMemberIds])
    setHcpNumber(s.identity.hcpNumber)
    setClickNumber(s.identity.clickNumber)
    setJobName(s.identity.jobName)
    setJobAddress(s.identity.jobAddress)
    setCustomerId(s.identity.customerId)
    setCustomerName(s.identity.customerName)
    setCustomerEmail(s.identity.customerEmail)
    setCustomerPhone(s.identity.customerPhone)
    setGcCustomerId(s.identity.gcCustomerId)
    setDevelopmentId(s.identity.developmentId)
    setGoogleDriveLink(s.identity.googleDriveLink)
    setJobPicturesLink(s.identity.jobPicturesLink)
    setJobPlansLink(s.identity.jobPlansLink)
    setProjectId(s.identity.projectId || null)
    setBidId(s.identity.bidId || null)
    setFormServiceTypeId(s.identity.serviceTypeId)
    setAccountManagerUserId(s.identity.accountManagerUserId)
    setAccountManagerRelationship(s.identity.accountManagerRelationship)
    setCustomerAddressId(s.identity.customerAddressId)
    setSelectedSegmentIds(new Set())
    setUndoConfirmOpen(false)
    showToast('Reverted to how the job looked when you opened it — the revert auto-saves.', 'success')
  }

  /** Footer chip state, worst-first across the four slices (v2.1080). */
  const identityBlocked = identityAutosave.isDirty() && !identitySliceReadyToSave(identityFields)
  const editAutosaveAggregate: 'saving' | 'error' | 'blocked' | 'pending' | 'saved' =
    editAutosaveSlices.some((s) => s.status === 'saving')
      ? 'saving'
      : editAutosaveSlices.some((s) => s.status === 'error')
        ? 'error'
        : identityBlocked
          ? 'blocked'
          : editAutosaveSlices.some((s) => s.isDirty())
            ? 'pending'
            : 'saved'

  // Closing the modal must not drop a pending autosave: cancel the debounce,
  // wait out any in-flight write, and save whatever is still dirty before
  // onClose unmounts everything. 'error' keeps the modal open with an explicit
  // Retry / Close-without-saving choice — silent loss is never the default.
  const [closeFlushState, setCloseFlushState] = useState<'idle' | 'saving' | 'error'>('idle')
  const closeFlushStateRef = useRef(closeFlushState)
  closeFlushStateRef.current = closeFlushState

  // Same immediate-save contract as the Stages Progress & payment cell: writes
  // jobs_ledger.pct_complete on blur/Enter, outside the form's Save flow (the
  // form payload never touches pct_complete, so Save can't clobber it).
  // Every real change also posts an auto thread note (best-effort) so Job
  // activity shows office edits made from Edit Job; unchanged blurs no-op.
  async function commitPctComplete(pct: number | null) {
    if (!editing?.id) return
    const previous = editing.pct_complete ?? null
    if (pct === previous) return
    setPctSaving(true)
    if (authUser?.id) {
      await postJobThreadNoteBody(editing.id, authUser.id, composePctAutoNoteBody(pct, previous))
    }
    const { error: pctErr } = await supabase.from('jobs_ledger').update({ pct_complete: pct }).eq('id', editing.id)
    setPctSaving(false)
    if (pctErr) {
      showToast(`Could not save % done: ${pctErr.message}`, 'error')
      return
    }
    setEditing((prev) => (prev ? { ...prev, pct_complete: pct } : prev))
  }

  const breakOff = useBreakOffSlider({ jobTotalBidDollars: jobTotalWithRidersDollars, payments, editing })
  // Only these three are read/written by the shell's money-path handlers
  // (createInvoice / moveWorkingJobToReadyToBillFromEdit); the rest of the hook
  // output is consumed by JobFormBreakOffSection via the `breakOff` prop.
  const { newInvoiceAmount, setNewInvoiceAmount, setNewInvoiceAmountInputFocused } = breakOff
  // Team chips can reference users outside the picker's role-filtered list — a
  // dev on the crew, or an ARCHIVED crew member (the users SELECT policy hides
  // archived rows from non-dev viewers, so a direct select returned nothing and
  // assistants saw raw uuids — v2.1652). Resolve through the SECURITY DEFINER
  // name RPC instead; archived people label as "Name (archived)".
  useEffect(() => {
    const missing = teamMemberIds.filter((id) => !users.some((u) => u.id === id))
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      const resolved = await fetchUserDisplayNames(missing)
      if (cancelled || resolved.length === 0) return
      setUsers((prev) => {
        const have = new Set(prev.map((u) => u.id))
        const add = resolved
          .filter((n) => !have.has(n.id))
          .map((n) => ({ id: n.id, name: userDisplayLabel(n), email: null, role: n.role }) as UserRow)
        return add.length ? [...prev, ...add] : prev
      })
    })()
    return () => {
      cancelled = true
    }
  }, [teamMemberIds, users])
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

  /** Edit-mode trade pill (PLUM/ELEC/HVAC) beside the Service type select — shortcut to this job on Jobs → Stages. */
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

  /** Shell-owned (not moved into JobFormLinksSection): the project-link modal's onLinked focuses it. */
  const jobFormProjectDisconnectRef = useRef<HTMLButtonElement | null>(null)
  const jobFormGoogleDriveInputRef = useRef<HTMLInputElement | null>(null)

  /** The original unconditional close: reset transient UI state and unmount. */
  function finishClose() {
    setJobProjectLinkChoiceOpen(false)
    setJobBidLinkChoiceOpen(false)
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
    setUndoConfirmOpen(false)
    resetMigrate()
    onClose()
  }

  /**
   * Close WITHOUT flushing. For paths where the job row no longer exists
   * (delete, migrate+delete) — flushing there would reinsert child rows for a
   * dead job — and for the explicit "Close without saving" choice on a failed
   * close-flush.
   */
  function closeFormWithoutSaving() {
    for (const slice of editAutosaveSlices) slice.clearBaseline()
    setCloseFlushState('idle')
    finishClose()
  }

  /**
   * Guarded close: flush a dirty billing autosave before unmounting so a
   * click-away inside the ~1.2s debounce window can't silently drop edits.
   * Resolves true when the modal actually closed (callers that navigate
   * afterwards must check).
   */
  /**
   * True when closing must do work beyond the slice flushes: the paid→billed
   * demote (a balance reappeared on a Paid job) or the customers.date_met
   * backfill. These rode the edit-mode Save button until v2.1080; they must
   * run on EVERY edit-mode close — autosave may have persisted the balance
   * change long before the user closes, so dirtiness alone can't gate them.
   */
  function editCloseSideEffectsNeeded(): boolean {
    if (!editing?.id) return false
    const dateMetNeeded = !!(
      customerId &&
      dateMet.trim() &&
      customers.some((x) => x.id === customerId && !x.date_met)
    )
    if (dateMetNeeded) return true
    const revNum = revenueDollarsFromFixtures(autosaveFixturesRef.current) + autosaveRiderFeesRef.current
    const paymentsMadeNum = autosavePaymentsRef.current.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return shouldDemotePaidJobToBilled(normalizeJobsLedgerStatus(editing.status) ?? '', revNum, paymentsMadeNum)
  }

  /** The Save-button side effects, now run at close time (best-effort: they toast on failure but never block the close). */
  async function runEditCloseSideEffects(): Promise<void> {
    const jobId = editing?.id
    if (!jobId) return
    try {
      if (customerId && dateMet.trim()) {
        const c = customers.find((x) => x.id === customerId)
        if (c && !c.date_met) {
          // A typed date is a human call — stamp it manual so the clock-session
          // fill (v2.1696) never overwrites it.
          await supabase.from('customers').update({ date_met: dateMet.trim(), date_met_source: 'manual' }).eq('id', customerId)
        }
      }
    } catch (dateMetErr) {
      console.warn('customers.date_met backfill failed', dateMetErr)
    }
    const revNum = revenueDollarsFromFixtures(autosaveFixturesRef.current) + autosaveRiderFeesRef.current
    const paymentsMadeNum = autosavePaymentsRef.current.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    if (shouldDemotePaidJobToBilled(normalizeJobsLedgerStatus(editing?.status) ?? '', revNum, paymentsMadeNum)) {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('update_job_status', { p_job_id: jobId, p_to_status: 'billed' }),
          'update_job_status_close_paid_to_billed',
        )
        const result = data as { error?: string } | null
        if (result?.error) {
          showToast(`The job could not be moved back to Billed: ${result.error}`, 'error')
        } else {
          showToast('Job moved back to Billed (balance still due).', 'success')
          onSavedRef.current?.()
        }
      } catch (demoteErr: unknown) {
        showToast(formatPostgrestOrUnknownError(demoteErr, 'Failed to move job back to Billed'), 'error')
      }
    }
  }

  async function closeForm(): Promise<boolean> {
    if (closeFlushStateRef.current === 'saving') return false
    for (const slice of editAutosaveSlices) slice.cancelPending()
    if (!editAutosaveSlices.some((s) => s.needsFlush() || s.isRunning()) && !editCloseSideEffectsNeeded()) {
      finishClose()
      return true
    }
    setCloseFlushState('saving')
    try {
      const outcome = await withOperationTimeout(
        (async () => {
          for (const slice of editAutosaveSlices) {
            const sliceOutcome = await slice.flushForClose()
            if (sliceOutcome === 'failed') return 'failed' as const
          }
          await runEditCloseSideEffects()
          return 'saved' as const
        })(),
        15000,
        'Saving your latest changes',
      )
      if (outcome === 'failed') {
        setCloseFlushState('error')
        return false
      }
      setCloseFlushState('idle')
      finishClose()
      return true
    } catch (flushErr) {
      // Timeout: the request is NOT cancelled — it may still land.
      setCloseFlushState('error')
      if (!(flushErr instanceof OperationTimeoutError)) {
        console.error('JobFormModal close-flush failed', flushErr)
      }
      return false
    }
  }

  // Tab switch / phone backgrounding mid-edit never hits the close handler —
  // flush the pending debounce when the page goes hidden so the window for
  // losing edits on a hard tab close shrinks to near-zero.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void flushAllAutosaveSlicesRef.current()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

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
    // Per modal-open decision (v2.1533): never re-evaluated mid-edit, so the
    // field can't vanish while someone is typing in it.
    setHideHcpEntryField(shouldHideHcpEntryField(getHideHcpFieldCached(), job.hcp_number))
    setAccountManagerUserId(job.account_manager_user_id ?? null)
    setAccountManagerRelationship(job.account_manager_relationship ?? null)
    setClickNumber(job.click_number ?? '')
    setJobName(job.job_name ?? '')
    setJobAddress(job.job_address ?? '')
    setCustomerName(job.customer_name ?? '')
    setCustomerEmail(job.customer_email ?? '')
    setCustomerPhone(job.customer_phone ?? '')
    setCustomerId(job.customer_id ?? null)
    setGcCustomerId(job.gc_customer_id ?? null)
    setCustomerAddressId(job.customer_address_id ?? null)
    setDevelopmentId(job.development_id ?? null)
    setLinkedBidGc(
      job.linkedBid?.customer_id && job.linkedBid.customers
        ? { id: job.linkedBid.customer_id, name: (job.linkedBid.customers.name ?? '').trim() || '—' }
        : null,
    )
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
    setGoogleDriveLink(job.google_drive_link ?? '')
    setJobPicturesLink(job.job_pictures_link ?? '')
    persistedPicturesLinkRef.current = (job.job_pictures_link ?? '').trim()
    setJobPlansLink(job.job_plans_link ?? '')
    setProjectFilesPlansExpanded(false)
    setPayments(paymentRowsFromJob(job))
    hydratedPaymentIdsRef.current = (job.payments ?? []).map((p) => p.id)
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
            invoice_id: f.invoice_id ?? null,
          }))
        : [{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }],
    )
    setFixtureScopeExpandedById({})
    setSelectedSegmentIds(new Set())
    setTeamMemberIds(job.team_members.map((t) => t.user_id))
    setNewInvoiceAmountInputFocused(false)
    setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(job))
  }

  function resetNewForm(projectPrefill: string | null) {
    setBillViewInvoice(null)
    setEditing(null)
    setHcpNumber('')
    setAccountManagerUserId(null)
    setAccountManagerRelationship(null)
    setClickNumber('')
    setJobName('')
    setJobAddress('')
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerId(null)
    setGcCustomerId(null)
    setCustomerAddressId(null)
    setDevelopmentId(null)
    setLinkedBidGc(null)
    setProjectId(projectPrefill)
    setBidId(null)
    setLinkedBidSummary(null)
    setCustomerSearch('')
    setDateMet('')
    setCustomerExpanded(true)
    setGoogleDriveLink('')
    setJobPicturesLink('')
    setJobPlansLink('')
    setProjectFilesPlansExpanded(!!projectPrefill)
    setPayments([newEmptyPaymentRow()])
    setMaterials([{ id: crypto.randomUUID(), description: '', amount: 0 }])
    setFixtures([{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }])
    setFixtureScopeExpandedById({})
    setSelectedSegmentIds(new Set())
    setTeamMemberIds([])
    setBillingCustomerHighlight(false)
    setFixturesSectionHighlight(false)
    setJobPicturesLinkHighlight(false)
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
    async (bidRowId: string, forcedGc?: WinningGcOption) => {
      try {
        const row = await withSupabaseRetry(
          async () =>
            await supabase
              .from('bids')
              .select(
                'id, project_name, bid_number, service_type_id, customer_id, address, drive_link, plans_link, outcome, bid_date_sent, agreed_value, customers(name, address, contact_info, date_met)',
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
          outcome: string | null
          bid_date_sent: string | null
          agreed_value: number | string | null
          customers: {
            name: string
            address: string | null
            contact_info: unknown
            date_met: string | null
          } | null
        }
        // Per-GC Phase 3: on a multi-GC bid, the job's GC is the WINNING packet's — one recorded
        // winner imports silently; otherwise ask once (the pick records the Won when undecided).
        let chosen: WinningGcOption | null = forcedGc ?? null
        if (!chosen) {
          const [vRes, sRes, rRes] = await Promise.all([
            supabase.from('bid_versions').select('id, name, customer_id, sort_order, created_at, outcome').eq('bid_id', b.id).order('sort_order'),
            supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', b.id),
            supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', b.id),
          ])
          const versions = (vRes.data ?? []) as Array<{ id: string; name: string; customer_id: string | null; sort_order: number; created_at: string | null; outcome: string | null }>
          const gcIds = [...new Set(versions.map((v) => v.customer_id).filter((x): x is string => !!x))]
          let gcNames: Record<string, string> = {}
          if (gcIds.length > 0) {
            const { data } = await supabase.from('customers').select('id, name').in('id', gcIds)
            gcNames = Object.fromEntries(((data ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]))
          }
          const recipients = ((rRes.data ?? []) as Array<{ customer_id: string; customers: { name: string } | null }>).map((r) => ({ customerId: r.customer_id, name: r.customers?.name ?? '…' }))
          const packets = groupVersionsByGc(versions, {
            bidGcName: b.customers?.name ?? null,
            gcNames,
            latestSends: latestSendByVersion((sRes.data ?? []) as VersionSendRow[]),
            bidDateSent: b.bid_date_sent ?? null,
            recipients,
          })
          const options: WinningGcOption[] = packets.map((p) => ({ key: p.key, customerId: p.gcId, name: p.name, sentOn: p.sentOn, value: p.sentValue, outcome: p.outcome, sharedLetter: !!p.sharedLetter }))
          // A bid with recipients but no versions has no own packet — the bid's GC is still a choice.
          if (b.customer_id && !packets.some((p) => p.key === '')) {
            const ownName = (customers.find((c) => c.id === b.customer_id)?.name ?? b.customers?.name ?? '').trim() || 'the GC'
            options.unshift({ key: '', customerId: null, name: ownName, sentOn: b.bid_date_sent ?? null, value: null, outcome: null, sharedLetter: true })
          }
          if (options.length > 1) {
            const { winner, multiple } = resolveWinningPacket(packets)
            if (winner) {
              chosen = { key: winner.key, customerId: winner.gcId, name: winner.name, sentOn: winner.sentOn, value: winner.sentValue, outcome: winner.outcome, sharedLetter: false }
              if (b.agreed_value == null && winner.sentValue != null) {
                void supabase.from('bids').update({ agreed_value: winner.sentValue }).eq('id', b.id).is('agreed_value', null).then(() => undefined)
              }
            } else {
              setWinningGcPick({
                bidId: b.id,
                bidName: (b.project_name ?? '').trim() || (b.bid_number ?? 'This bid'),
                options,
                writesWin: !multiple,
                bidOutcome: b.outcome ?? null,
                agreedValue: b.agreed_value == null ? null : Number(b.agreed_value),
                packets,
              })
              return
            }
          }
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
        // Creating a job FROM a bid: the WINNING GC is the job's GC (per-GC Phase 3; the bid's own
        // GC when there's only one — the v2.1182 rule, now packet-aware).
        const effGcId = chosen ? (chosen.customerId ?? b.customer_id) : b.customer_id
        const effIsOwn = effGcId === b.customer_id
        setLinkedBidGc(
          effGcId
            ? {
                id: effGcId,
                name:
                  (customers.find((c) => c.id === effGcId)?.name ?? (effIsOwn ? b.customers?.name : chosen?.name) ?? '').trim() || '—',
              }
            : null,
        )
        setGcCustomerId(effGcId ?? null)
        if (effGcId) {
          setCustomerId(effGcId)
          let src: { name: string | null; contact_info: unknown; date_met: string | null } | null =
            customers.find((c) => c.id === effGcId) ?? null
          if (!src && effIsOwn) src = b.customers
          if (!src) {
            const fetched = await withSupabaseRetry(
              async () => await supabase.from('customers').select('name, contact_info, date_met').eq('id', effGcId).maybeSingle(),
              'job form import bid gc',
            )
            src = (fetched as { name: string | null; contact_info: unknown; date_met: string | null } | null) ?? null
          }
          if (src) {
            setCustomerName(src.name ?? '')
            setDateMet(src.date_met ? (src.date_met.split('T')[0] ?? '') : '')
            const ci = src.contact_info as { phone?: string; email?: string } | null
            setCustomerEmail(ci?.email ?? '')
            setCustomerPhone(ci?.phone ?? '')
          } else {
            setCustomerName((chosen?.name ?? '').trim())
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

  const handleWinningGcPick = useCallback(
    async (opt: WinningGcOption) => {
      const pick = winningGcPick
      setWinningGcPick(null)
      if (!pick) return
      if (pick.writesWin && !opt.sharedLetter) {
        const packet = pick.packets.find((p) => p.key === opt.key)
        const versionIds = (packet?.versions ?? []).map((v) => v.id)
        if (versionIds.length > 0) {
          const packetsAfter = pick.packets.map((p) => ({
            key: p.key,
            name: p.name,
            outcome: p.key === opt.key ? 'won' : p.outcome,
            sentOn: p.sentOn,
            versionIds: p.versions.map((v) => v.id),
            sharedLetter: !!p.sharedLetter,
          }))
          const res = await setGcPacketOutcome({ bidId: pick.bidId, bidOutcome: pick.bidOutcome, versionIds, outcome: 'won', packetsAfter })
          if (res.error) {
            showToast(res.error, 'error')
          } else {
            window.dispatchEvent(new CustomEvent('bid-gc-outcome-changed', { detail: { bidId: pick.bidId } }))
            showToast(
              res.autoLost.length > 0
                ? `${opt.name} marked won on the bid — ${res.autoLost.join(', ')} marked lost (GC lost the project).`
                : `${opt.name} marked won on the bid.`,
              'success',
            )
          }
          if (pick.agreedValue == null && opt.value != null) {
            await supabase.from('bids').update({ agreed_value: opt.value }).eq('id', pick.bidId).is('agreed_value', null)
          }
        }
      } else if (opt.sharedLetter && opt.key.startsWith('shared:')) {
        showToast(`${opt.name} rode the shared letter — nothing recorded on the bid.`, 'info')
      }
      void applyPrefillFromBid(pick.bidId, opt)
    },
    [winningGcPick, applyPrefillFromBid, showToast],
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
        setLinkedBidGc(null)
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
                invoice_id: null,
              }))
            : [{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }]
        setFixtures(nextFixtures)
        setFixtureScopeExpandedById({})
        setSelectedSegmentIds(new Set())
        const estimateCustomerId = e.customer_id
        if (estimateCustomerId) {
          setCustomerId(estimateCustomerId)
          let cList = customers.find((c) => c.id === estimateCustomerId)
          if (!cList) {
            const fetched = await withSupabaseRetry(
              async () =>
                await supabase
                  .from('customers')
                  .select('id, name, address, contact_info, date_met, date_met_source, master_user_id, customer_type, archived_at')
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
          { data: devData },
        ] = await Promise.all([
          supabase.from('customers').select('id, name, address, contact_info, date_met, date_met_source, master_user_id, customer_type, archived_at').order('name'),
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
          supabase.from('developments').select('id, name, master_user_id, archived_at').order('name'),
        ])
        if (cancelled) return
        const allServiceTypes = (stData as JobFormServiceType[] | null) ?? []
        setCustomers((custData as CustomerRow[]) ?? [])
        setProjects((projData as ProjectOption[]) ?? [])
        setDevelopments((devData as JobFormDevelopmentRow[]) ?? [])
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

  const billedMaterialsTotalDisplay = useMemo(() => {
    const sum = materials.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    return formatCurrency(sum)
  }, [materials])


  const paymentRemovePreview = useMemo(() => {
    if (!paymentRemoveConfirmRowId) return null
    const row = payments.find((r) => r.id === paymentRemoveConfirmRowId)
    if (!row) return null
    const rev = jobTotalWithRidersDollars
    const paidSum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    const currentRem = Math.max(0, rev - paidSum)
    const rowAmt = Number(row.amount) || 0
    const newRem = Math.max(0, rev - (paidSum - rowAmt))
    return { rowAmt, jobTotal: rev, currentRem, newRem }
  }, [paymentRemoveConfirmRowId, payments, jobTotalWithRidersDollars])

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
    return unallocatedBillableDollars(jobTotalWithRidersDollars, paidSum, editing?.invoices)
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

  async function createInvoiceFromSelectedSegments() {
    if (!editing) return
    const fixturesNow = autosaveFixturesRef.current
    // The invoice bills the selection NET of dollar coverage — money already
    // paid or invoiced by amount against these rows is subtracted, so a
    // partially covered segment bills only what's left on it.
    const { netDollars, coveredDollars, count } = segmentSelectionNetSummary(
      fixturesNow,
      selectedSegmentIds,
      segmentCoverage,
    )
    if (count === 0 || !(netDollars > 0)) {
      setError('Select at least one unbilled segment first')
      return
    }
    // Cents-exact backstop for the UI clamp (v2.1132): never invoice past the
    // slider's Remaining — dollar invoices already cover that money.
    if (Math.round(netDollars * 100) > Math.round(segmentCoverage.remainingDollars * 100)) {
      setError(
        `This selection would bill more than the $${formatCurrency(segmentCoverage.remainingDollars)} left on the job — void or delete an existing bill first.`,
      )
      return
    }
    setCreatingSegmentInvoice(true)
    setError(null)
    try {
      // Flush so the DB rows match this exact fixtures array — the link
      // UPDATE below keys on the sequence_order positions the flush wrote.
      await flushBillingAutosave()
      const positions = selectedSegmentSequencePositions(fixturesNow, selectedSegmentIds)
      const linkedRowIds = new Set(linkableSelectedIds(fixturesNow, selectedSegmentIds))
      const nextOrder = (editing.invoices ?? []).length
      const { data: created, error: insErr } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: editing.id,
          amount: netDollars,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: null,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (insErr) throw insErr
      const newInvoiceId = (created as { id: string }).id
      if (positions.length > 0) {
        const { error: linkErr } = await supabase
          .from('jobs_ledger_fixtures')
          .update({ invoice_id: newInvoiceId })
          .eq('job_id', editing.id)
          .in('sequence_order', positions)
        if (linkErr) throw linkErr
      }
      // Mirror the links into local state so the next delete+reinsert keeps
      // them (the refetch below re-hydrates editing, not the fixtures state).
      setFixtures((prev) => prev.map((r) => (linkedRowIds.has(r.id) ? { ...r, invoice_id: newInvoiceId } : r)))
      // The invoice above is already written — a failed remainder re-sync must
      // not read as a failed create (it did for Taunya on job 978: the RPC's
      // zero-remainder envelope surfaced as "Nothing left to bill" with a
      // stale screen while her invoice existed). Refetch either way; report a
      // real re-sync failure alongside the created invoice, not instead of it.
      let ensureFailure: string | null = null
      if (editing.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: editing.id,
            }),
          'ensure RTB remainder after segment invoice'
        )
        const outcome = ensureRemainderResyncOutcome(raw)
        if (!outcome.ok) ensureFailure = outcome.error
      }
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
        setNewInvoiceAmountInputFocused(false)
      }
      setSelectedSegmentIds(new Set())
      onSavedRef.current?.()
      if (ensureFailure) {
        setError(`Invoice created, but the remainder draft did not re-sync: ${ensureFailure}`)
      } else {
        showToast(
          `Invoice created for the remaining $${formatCurrency(netDollars)} on ${count} segment${count === 1 ? '' : 's'}${coveredDollars > 0 ? ` ($${formatCurrency(coveredDollars)} already covered was subtracted)` : ''}`,
          'success',
        )
      }
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice from segments'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingSegmentInvoice(false)
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
      // v2.2467: a typed amount that IS exactly one segment's remaining net is
      // that segment — link it so the bill lists that line instead of the
      // whole job prorated. flushBillingAutosave() above makes the DB rows
      // match this fixtures array, same contract as the segment-select path.
      const fixturesNow = autosaveFixturesRef.current
      const segmentMatch = exactSingleSegmentMatchForAmount(fixturesNow, segmentCoverage, amountToUseCents)
      const nextOrder = (editing.invoices ?? []).length
      const { data: created, error: err } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: editing.id,
          amount: amountToUse,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: null,
          is_primary_rtb_bundle: false,
        })
        .select('id')
        .single()
      if (err) throw err
      const newInvoiceId = (created as { id: string }).id
      if (segmentMatch) {
        const positions = selectedSegmentSequencePositions(fixturesNow, new Set([segmentMatch.fixtureId]))
        const { error: linkErr } =
          positions.length > 0
            ? await supabase
                .from('jobs_ledger_fixtures')
                .update({ invoice_id: newInvoiceId })
                .eq('job_id', editing.id)
                .in('sequence_order', positions)
            : { error: null }
        if (linkErr) {
          // The invoice itself is fine — it just bills as an unlinked dollar
          // carve (whole-job prorated lines), exactly as before this feature.
          showToast(
            `Invoice created, but it could not be attached to "${segmentMatch.label}" — the bill will list all line items prorated.`,
            'error',
          )
        } else {
          setFixtures((prev) =>
            prev.map((r) => (r.id === segmentMatch.fixtureId ? { ...r, invoice_id: newInvoiceId } : r)),
          )
          showToast(
            `Billed as "${segmentMatch.label}" — the amount matched that stage exactly, so the bill lists just that line.`,
            'success',
          )
        }
      }
      // Invoice already written — a failed remainder re-sync is reported, not
      // treated as a failed create (fully-allocated envelopes are success).
      let ensureFailure: string | null = null
      if (editing.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: editing.id,
            }),
          'ensure RTB remainder after partial invoice'
        )
        const outcome = ensureRemainderResyncOutcome(raw)
        if (!outcome.ok) ensureFailure = outcome.error
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
      if (ensureFailure) {
        setError(`Invoice created, but the remainder draft did not re-sync: ${ensureFailure}`)
      }
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to create invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setCreatingInvoice(false)
    }
  }

  /**
   * "Bill separately…" on a RIDERS row (v2.1087): split the hazmat fee onto
   * its own non-primary invoice, repoint the incident to it (RPC — the table
   * has no client write policies), re-sync the primary remainder, then open
   * the Bill-to editor so the office picks who pays it (e.g. the tenant).
   * A fee already sitting on its own unsent non-primary draft skips straight
   * to the editor.
   */
  async function billHazmatFeeSeparately(row: JobHazmatIncidentRow) {
    if (!editing) return
    const fee = Number(row.fee_amount)
    if (!(fee > 0)) {
      setError('This fee has no amount to bill')
      return
    }
    const invoices = editing.invoices ?? []
    const linked = row.invoice_id ? invoices.find((i) => i.id === row.invoice_id) : undefined
    if (
      linked &&
      linked.status === 'ready_to_bill' &&
      !linked.is_primary_rtb_bundle &&
      !(linked.stripe_invoice_id ?? '').trim() &&
      !(linked.sent_to_customer_at ?? '').trim() &&
      !(linked.external_send_channel ?? '').trim()
    ) {
      setBillToEditorInvoice(linked)
      return
    }
    setBillingFeeSeparatelyId(row.id)
    setError(null)
    try {
      // Same discipline as createInvoiceFromSelectedSegments: flush first so
      // the DB totals match the screen before the invoice math runs.
      await flushBillingAutosave()
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(row.incident_at ?? ''))
      const memo = m
        ? `Biohazard remediation fee — incident ${m[2]}/${m[3]}/${m[1]}`
        : 'Biohazard remediation fee'
      const nextOrder = invoices.length
      const { data: created, error: insErr } = await supabase
        .from('jobs_ledger_invoices')
        .insert({
          job_id: editing.id,
          amount: fee,
          status: 'ready_to_bill',
          sequence_order: nextOrder,
          estimated_bill_date: null,
          is_primary_rtb_bundle: false,
          stripe_invoice_memo: memo,
        })
        .select('id')
        .single()
      if (insErr) throw insErr
      const newInvoiceId = (created as { id: string }).id
      const linkRes = await linkHazmatFeeIncidentToInvoice(row.id, newInvoiceId)
      if (!linkRes.ok) {
        throw new Error(linkRes.error ?? 'Fee invoice created, but linking the incident to it failed')
      }
      // Fee invoice + link already written — fully-allocated envelopes are
      // success; only a real re-sync failure is surfaced (after the refetch).
      let ensureFailure: string | null = null
      if (editing.status === 'ready_to_bill') {
        const raw = await withSupabaseRetry(
          () =>
            supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: editing.id,
            }),
          'ensure RTB remainder after fee split'
        )
        const outcome = ensureRemainderResyncOutcome(raw)
        if (!outcome.ok) ensureFailure = outcome.error
      }
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) {
        setEditing(found)
        setNewInvoiceAmount(breakOffPrefillAmountStringFromJob(found))
        setNewInvoiceAmountInputFocused(false)
      }
      refreshHazmatIncidents()
      onSavedRef.current?.()
      if (ensureFailure) {
        setError(`Fee invoice created, but the remainder draft did not re-sync: ${ensureFailure}`)
      } else {
        showToast(`Fee split to its own invoice ($${formatCurrency(fee)}). Now choose who pays it.`, 'success')
      }
      setBillToEditorInvoice({
        id: newInvoiceId,
        amount: fee,
        bill_to_name: null,
        bill_to_email: null,
        bill_to_phone: null,
      })
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; hint?: string }
      const msg = err?.message || 'Failed to split the fee to its own invoice'
      const extra = [err?.details, err?.hint].filter(Boolean).join(' ')
      setError(extra ? `${msg}. ${extra}` : msg)
    } finally {
      setBillingFeeSeparatelyId(null)
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
      showToast('This payment is linked to a bank transaction. Remove it from Jobs Pipeline → Bank Payments workflow if needed.', 'error')
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
      { id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null },
    ])
  }

  function updateFixtureRow(id: string, updates: Partial<FixtureRow>) {
    setFixtures((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)))
  }

  function moveFixtureRowInList(id: string, direction: 'up' | 'down') {
    setFixtures((prev) => moveRowById(prev, id, direction))
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
          date_met_source: dateMet.trim() ? 'manual' : null,
          master_user_id: customerMasterId,
        })
        .select('id')
        .single()
      if (custErr) throw custErr
      const cid = (newCustomer as { id: string })?.id
      if (!cid) throw new Error('Failed to create customer')
      setCustomerId(cid)
      // master_user_id is REQUIRED here: the identity autosave re-resolves the
      // customer link through resolveCustomerIdForJobPayload, which drops any
      // pick whose master doesn't match the job's — omitting it made the
      // autosave null the link right after creation (create-customer bug).
      const c = { id: cid, name, address: jobAddress.trim() || null, contact_info: contactInfo, date_met: dateMet.trim() || null, master_user_id: customerMasterId } as CustomerRow
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
    // Edit mode: persist the link FIRST — if the DB rejects it (e.g. the
    // customer↔master backstop trigger), the form state stays untouched instead
    // of diverging from the row.
    if (editing) {
      const { error: updErr } = await supabase.from('jobs_ledger').update({ customer_id: c.id }).eq('id', editing.id)
      if (updErr) {
        const m = formatPostgrestOrUnknownError(updErr, updErr.message || 'Failed to link customer')
        showToast(m.split('\n')[0] ?? m, 'error')
        return
      }
    }
    setCustomerId(c.id)
    setCustomerSearch(getCustomerDisplay(c))
    setCustomerName(c.name ?? '')
    const contact = extractContactFromCustomer(c)
    // A linked customer with no email/phone on file must not wipe what's
    // already typed on the job — keep the job's value as the fallback.
    setCustomerEmail((prev) => contact.email || prev)
    setCustomerPhone((prev) => contact.phone || prev)
    setDateMet(c.date_met ? (c.date_met.split('T')[0] ?? '') : '')
    if (!jobAddress.trim()) setJobAddress(c.address ?? '')
    setCustomers((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev
      return [...prev, c].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    })
    if (editing) {
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

  /**
   * Inline "+ New development" from the Links section picker. Inserts a
   * name-only developments row under the job's effective master, prepends it
   * to the options, and returns the new id (null on failure — error toasted).
   */
  async function createDevelopmentFromPicker(rawName: string): Promise<string | null> {
    if (!authUser?.id) return null
    const check = validateNewDevelopmentName(rawName, developments)
    if (!check.ok) {
      showToast(check.error, 'error')
      return null
    }
    try {
      const masterId = editing?.master_user_id ?? (await resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId || null))
      const { data: inserted, error: insErr } = await supabase
        .from('developments')
        .insert({ master_user_id: masterId, name: check.name })
        .select('id, name, master_user_id, archived_at')
        .single()
      if (insErr) throw insErr
      const row = inserted as JobFormDevelopmentRow
      setDevelopments((prev) => [row, ...prev])
      showToast(`Development "${check.name}" created.`, 'success')
      return row.id
    } catch (devErr) {
      showToast(
        `Could not create development: ${devErr instanceof Error ? devErr.message : String(devErr)}`,
        'error',
      )
      return null
    }
  }

  /**
   * CREATE a job — New Job mode only. v2.1080 removed the edit-mode Save
   * button: every edit-mode write flows through the autosave slices, and the
   * paid→billed demote + customers.date_met backfill ride the close guard
   * (`runEditCloseSideEffects`).
   */
  async function createJob() {
    if (!authUser?.id) return
    if (!formServiceTypeId.trim()) {
      showToast('Service type is required', 'error')
      return
    }
    setSaving(true)
    setError(null)
    const revNum = jobTotalWithRidersDollars
    // B4: payments_made is trigger-maintained from the payment rows inserted
    // below (B3); the insert leaves it at its DB default.
    try {
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
          job_address: titleCaseAddress(jobAddress.trim()),
          customer_id: resolvedCustomerIdNew,
          gc_customer_id: resolveGcCustomerIdForJobPayload(gcCustomerId, effectiveMasterId, customers),
          customer_address_id: customerAddressId,
          development_id: resolveDevelopmentIdForJobPayload(developmentId, effectiveMasterId, developments),
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          google_drive_link: googleDriveLink.trim() || null,
          job_pictures_link: jobPicturesLink.trim() || null,
          job_plans_link: jobPlansLink.trim() || null,
          revenue: revNum,
          project_id: projectId || null,
          bid_id: bidId || null,
          service_type_id: formServiceTypeId.trim(),
          account_manager_user_id: accountManagerUserId,
          account_manager_relationship: accountManagerUserId ? accountManagerRelationship || 'primary' : null,
        })
        .select('id')
        .single()
      if (insertErr) throw insertErr
      const jobId = inserted?.id
      if (jobId) {
        for (const row of paymentInsertRows(jobId, payments)) {
          await supabase.from('jobs_ledger_payments').insert(row)
        }
        for (const row of materialInsertRows(jobId, materials)) {
          await supabase.from('jobs_ledger_materials').insert(row)
        }
        for (const row of fixtureInsertRows(jobId, fixtures)) {
          await supabase.from('jobs_ledger_fixtures').insert(row)
        }
        for (const uid of teamMemberIds) {
          await supabase.from('jobs_ledger_team_members').insert({ job_id: jobId, user_id: uid })
        }
        onCreatedJobIdRef.current?.(jobId)
      }
      if (customerId && dateMet.trim()) {
        const c = customers.find((x) => x.id === customerId)
        if (c && !c.date_met) {
          // A typed date is a human call — stamp it manual so the clock-session
          // fill (v2.1696) never overwrites it.
          await supabase.from('customers').update({ date_met: dateMet.trim(), date_met_source: 'manual' }).eq('id', customerId)
        }
      }
      await closeForm()
      onSavedRef.current?.()
    } catch (err: unknown) {
      console.error('JobFormModal createJob failed', err)
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
    closeFormWithoutSaving()
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
      closeFormWithoutSaving()
      showToast(
        typeof (payload as { note_body?: unknown }).note_body === 'string'
          ? 'Costs and job total moved to the target job; this job was removed. A "Combined" note was posted to the target\'s activity.'
          : 'Costs and job total moved to the target job; this job was removed. Open the target job to verify Specific Work and Job Total.',
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

  /**
   * Same shape as {@link migrateJobLedgerCostsAndDelete}, but the target is a
   * BID. Costs, labor, reports and dispatch/estimator requests move; job-only
   * records and the job's revenue are destroyed (a bid has no revenue column),
   * which is why the modal shows the RPC's own dry-run counts first.
   */
  async function migrateJobLedgerCostsToBidAndDelete(
    fromId: string,
    toBidId: string,
    allowBilled = true,
  ): Promise<boolean> {
    setMigratingJob(true)
    try {
      const { data, error: rpcErr } = await supabase.rpc('migrate_job_ledger_costs_to_bid_and_delete', {
        p_from: fromId,
        p_to_bid: toBidId,
        p_allow_billed: allowBilled,
        p_dry_run: false,
      })
      if (rpcErr) {
        console.error('migrate_job_ledger_costs_to_bid_and_delete', rpcErr)
        const msg = formatPostgrestOrUnknownError(rpcErr, rpcErr.message || 'Failed to migrate job to bid')
        setError(msg)
        showToast(msg, 'error')
        return false
      }
      const payload = data as { ok?: boolean; error?: string; code?: string } | null
      if (!payload?.ok) {
        const msg =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'Could not migrate this job to the bid.'
        setError(msg)
        showToast(msg, 'error')
        return false
      }
      onSavedRef.current?.()
      closeFormWithoutSaving()
      showToast(
        'Costs, labor and reports moved to the bid; this job was removed. Open Bids → Bid Costs to verify.',
        'success',
      )
      return true
    } catch (err: unknown) {
      console.error('migrateJobLedgerCostsToBidAndDelete', err)
      const msg = formatPostgrestOrUnknownError(err, 'Failed to migrate job to bid')
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
    if (embedded) {
      return (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          Loading…
        </div>
      )
    }
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

  // Job-window embedding: the shell owns the overlay/card/scroll, so both
  // wrapper divs go style-less; everything inside stays byte-identical.
  return (
    <>

    <div
      style={
        embedded
          ? undefined
          : {
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: JOB_FORM_OVERLAY_Z_INDEX,
              // Safe-area padding keeps the card off the phone's status bar (v2.1747).
              padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
            }
      }
      onClick={(e) => {
        if (!embedded && e.target === e.currentTarget) void closeForm()
      }}
    >
      <div
        style={
          embedded
            ? undefined
            : {
                background: 'var(--surface)',
                borderRadius: 8,
                padding: '1.5rem',
                maxWidth: 560,
                width: '100%',
                // min(…, 100%): see JobWindowModal v2.1747 — 90vh alone overflows the
                // padded overlay on phones and the top slides under the status bar.
                maxHeight: 'min(90vh, 100%)',
                overflow: 'auto',
              }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div style={!embedded || embeddedRegion === 'edit' ? undefined : { display: 'none' }}>
        <JobFormHeaderRow
          mode={mode}
          isEditing={!!editing}
          editingId={editing?.id ?? null}
          embedded={embedded}
          importBlocked={newJobImportBlockedByContent}
          bidId={bidId}
          projectId={projectId}
          onOpenImport={() => setJobImportSourceOpen(true)}
          onJobDetailClick={() => {
            const id = editing?.id
            if (!id) return
            void (async () => {
              const closed = await closeForm()
              if (closed) jobDetailOpenerBridge?.requestOpenJobDetail(id)
            })()
          }}
          onOpenBidLinkChoice={() => setJobBidLinkChoiceOpen(true)}
          onOpenProjectLinkChoice={() => setJobProjectLinkChoiceOpen(true)}
          nestedOverlayZIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
        />
        <JobFormSourceEstimateBanner jobId={editing?.id ?? null} onOverlayOpenChange={setBannerOverlayOpen} />
        </div>
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
          {/* EDIT region — identity, team, customer, links, line items. In the
              Job window only one region shows at a time; both stay mounted so
              tab switches never lose state. */}
          <div style={{ display: !embedded || embeddedRegion === 'edit' ? 'flex' : 'none', flexDirection: 'column', gap: '0.75rem' }}>
          <JobFormIdentityFields
            embedded={embedded}
            hcpNumber={hcpNumber}
            setHcpNumber={setHcpNumber}
            hideHcpNumberField={hideHcpEntryField}
            clickNumber={clickNumber}
            setClickNumber={setClickNumber}
            jobName={jobName}
            setJobName={setJobName}
            jobAddress={jobAddress}
            setJobAddress={setJobAddress}
            formServiceTypeId={formServiceTypeId}
            setFormServiceTypeId={setFormServiceTypeId}
            serviceTypeOptions={jobFormServiceTypeSelectOptions}
            tradePill={headerTradePill}
            onTradePillClick={() => {
              if (!editing) return
              const jobId = editing.id
              void (async () => {
                const closed = await closeForm()
                if (closed) navigate(`/jobs?tab=stages&stagesJob=${encodeURIComponent(jobId)}`)
              })()
            }}
          />
          {editing ? (
            /* Edit mode (v2.1681, "option C"): people + customer read as fact
               rows — label · value · pencil — with the classic editors inside
               each opened row. New Job keeps the always-open form below. */
            <JobFormEditFactRows
              contractJob={initialJob ?? editing}
              workOrderJob={initialJob ?? editing}
              workOrderAuthUserId={authUser?.id}
              users={users}
              teamMemberIds={teamMemberIds}
              setTeamMemberIds={setTeamMemberIds}
              accountManagerUserId={accountManagerUserId}
              setAccountManagerUserId={setAccountManagerUserId}
              accountManagerRelationship={accountManagerRelationship}
              setAccountManagerRelationship={setAccountManagerRelationship}
              customerId={customerId}
              setCustomerId={setCustomerId}
              gcCustomerId={gcCustomerId}
              setGcCustomerId={setGcCustomerId}
              linkedBidGc={linkedBidGc}
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              dateMet={dateMet}
              setDateMet={setDateMet}
              googleDriveLink={googleDriveLink}
              setGoogleDriveLink={setGoogleDriveLink}
              jobPicturesLink={jobPicturesLink}
              setJobPicturesLink={setJobPicturesLink}
              jobAddress={jobAddress}
              customerAddressId={customerAddressId}
              setCustomerAddressId={setCustomerAddressId}
              propertyCandidates={propertyCandidates}
              setJobAddress={setJobAddress}
              customers={customers}
              customersLoading={customersLoading}
              masterForFormCustomer={
                (projectId ? projects.find((p) => p.id === projectId) : undefined)?.master_user_id ??
                editing?.master_user_id ??
                authUser?.id ??
                ''
              }
              customerExpandedGate={customerExpanded}
              billingCustomerHighlight={billingCustomerHighlight}
              jobPicturesLinkHighlight={jobPicturesLinkHighlight}
              billingCustomerHighlightRef={billingCustomerHighlightRef}
              jobPicturesLinkHighlightRef={jobPicturesLinkHighlightRef}
              jobPicturesLinkInputRef={jobPicturesLinkInputRef}
              googleDriveInputRef={jobFormGoogleDriveInputRef}
              onImport={handleCustomerImport}
              onOpenCreateCustomerModal={() => setCreateCustomerFromJobModalOpen(true)}
              projectId={projectId}
              setProjectId={setProjectId}
              projects={projects}
              jobPlansLink={jobPlansLink}
              setJobPlansLink={setJobPlansLink}
              bidId={bidId}
              setBidId={setBidId}
              linkedBidSummary={linkedBidSummary}
              setLinkedBidSummary={setLinkedBidSummary}
              onOpenBidLinkChoice={() => setJobBidLinkChoiceOpen(true)}
              projectDisconnectRef={jobFormProjectDisconnectRef}
              developmentId={developmentId}
              setDevelopmentId={setDevelopmentId}
              developments={developments}
              onCreateDevelopment={createDevelopmentFromPicker}
              projectLinksGate={projectFilesPlansExpanded}
            />
          ) : (
            <>
              <JobFormAccountManSection
                users={users}
                teamMemberIds={teamMemberIds}
                accountManagerUserId={accountManagerUserId}
                setAccountManagerUserId={setAccountManagerUserId}
                accountManagerRelationship={accountManagerRelationship}
                setAccountManagerRelationship={setAccountManagerRelationship}
              />
              <JobFormPeoplePicker users={users} teamMemberIds={teamMemberIds} setTeamMemberIds={setTeamMemberIds} />
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            {!editing ? (
              <JobFormCustomerSection
                expanded={customerExpanded}
                setExpanded={setCustomerExpanded}
                customerId={customerId}
                setCustomerId={setCustomerId}
                gcCustomerId={gcCustomerId}
                setGcCustomerId={setGcCustomerId}
                linkedBidGc={linkedBidGc}
                customerSearch={customerSearch}
                setCustomerSearch={setCustomerSearch}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerEmail={customerEmail}
                setCustomerEmail={setCustomerEmail}
                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                dateMet={dateMet}
                setDateMet={setDateMet}
                googleDriveLink={googleDriveLink}
                setGoogleDriveLink={setGoogleDriveLink}
                jobPicturesLink={jobPicturesLink}
                setJobPicturesLink={setJobPicturesLink}
                jobAddress={jobAddress}
                setJobAddress={setJobAddress}
                customers={customers}
                customersLoading={customersLoading}
                masterForFormCustomer={
                  (projectId ? projects.find((p) => p.id === projectId) : undefined)?.master_user_id ??
                  authUser?.id ??
                  ''
                }
                billingCustomerHighlight={billingCustomerHighlight}
                jobPicturesLinkHighlight={jobPicturesLinkHighlight}
                billingCustomerHighlightRef={billingCustomerHighlightRef}
                jobPicturesLinkHighlightRef={jobPicturesLinkHighlightRef}
                jobPicturesLinkInputRef={jobPicturesLinkInputRef}
                googleDriveInputRef={jobFormGoogleDriveInputRef}
                onImport={handleCustomerImport}
                onOpenCreateCustomerModal={() => setCreateCustomerFromJobModalOpen(true)}
              />
            ) : null}
            {!editing ? (
              <JobFormLinksSection
                expanded={projectFilesPlansExpanded}
                setExpanded={setProjectFilesPlansExpanded}
                projectId={projectId}
                setProjectId={setProjectId}
                customerId={customerId}
                setCustomerId={setCustomerId}
                projects={projects}
                jobPlansLink={jobPlansLink}
                setJobPlansLink={setJobPlansLink}
                bidId={bidId}
                setBidId={setBidId}
                linkedBidSummary={linkedBidSummary}
                setLinkedBidSummary={setLinkedBidSummary}
                onOpenBidLinkChoice={() => setJobBidLinkChoiceOpen(true)}
                projectDisconnectRef={jobFormProjectDisconnectRef}
                developmentId={developmentId}
                setDevelopmentId={setDevelopmentId}
                developments={developments}
                onCreateDevelopment={createDevelopmentFromPicker}
              />
            ) : null}
          </div>
          </div>
          {/* BILL region — the money half: line items (the job's scope and
              Job Total — moved here from Edit, owner call v2.1683), summary
              bar, segments + break-off, invoices, payments, labor + parts
              cost. */}
          <div style={{ display: !embedded || embeddedRegion === 'bill' ? 'flex' : 'none', flexDirection: 'column', gap: '0.75rem' }}>
          <JobFormFixturesSection
            fixtures={fixtures}
            riderRows={editing && hazmatIncidents.length > 0 ? <JobFormHazmatRiderRows job={editing} incidents={hazmatIncidents} onChanged={refreshHazmatIncidents} onBillSeparately={(row) => void billHazmatFeeSeparately(row)} billSeparatelyBusyId={billingFeeSeparatelyId} /> : null}
            riderFeesDollars={riderFeesDollars}
            fixtureScopeExpandedById={fixtureScopeExpandedById}
            setFixtureScopeExpandedById={setFixtureScopeExpandedById}
            fixturesSectionHighlight={fixturesSectionHighlight}
            fixturesSectionHighlightRef={fixturesSectionHighlightRef}
            updateFixtureRow={updateFixtureRow}
            addFixtureRow={addFixtureRow}
            removeFixtureRow={removeFixtureRow}
            moveFixtureRow={moveFixtureRowInList}
            invoiceStatusById={fixtureInvoiceStatusById}
            onOpenSegmentGenerator={() => setSegmentGeneratorOpen(true)}
            onOpenStripeFixturePreview={() => setStripeFixturePreviewOpen(true)}
            jobTotalDollars={jobTotalBidDollars}
          />
          {/* Job window (v2.1687): no divider and no "Billing" title — the Bill
              tab reads as ONE section from Line Items down. The standalone/New
              Job form keeps both (it has no tab to say "Bill" for it). */}
          {!embedded && (
            <hr style={{ margin: '0.75rem auto', border: 'none', borderTop: '1px solid var(--border-400)', width: '50%' }} />
          )}
          {/* Embedded: the negative margin cancels the region's flex gap plus
              the residual line-box air so "% done" sits flush under the Job
              Total (owner call, v2.1707). */}
          <div style={{ marginBottom: '1rem', ...(embedded ? { marginTop: '-1.15rem' } : {}) }}>
            {!embedded ? (
              <div
                style={{
                  ...JOB_FORM_SECTION_HEADER_STYLE,
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.75rem',
                }}
              >
                <span>Billing</span>
                {/* v2.1144: the steady-state "Saved" is noise — only in-flight and
                    failure states earn header space. */}
                {editing?.id && (billingAutosaveStatus === 'saving' || billingAutosaveStatus === 'error') && (
                  <span
                    aria-live="polite"
                    style={{
                      fontSize: '0.75rem',
                      color: billingAutosaveStatus === 'error' ? 'var(--text-red-600)' : 'var(--text-muted)',
                    }}
                  >
                    {billingAutosaveStatus === 'saving' ? 'Saving…' : 'Autosave failed — edit again to retry'}
                  </span>
                )}
              </div>
            ) : (
              /* Titleless Bill tab still surfaces autosave trouble — the status
                 line renders only while saving or failed. */
              editing?.id && (billingAutosaveStatus === 'saving' || billingAutosaveStatus === 'error') ? (
                <div
                  aria-live="polite"
                  style={{
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    marginBottom: '0.5rem',
                    color: billingAutosaveStatus === 'error' ? 'var(--text-red-600)' : 'var(--text-muted)',
                  }}
                >
                  {billingAutosaveStatus === 'saving' ? 'Saving…' : 'Autosave failed — edit again to retry'}
                </div>
              ) : null
            )}
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
              marks={billingBarMarks}
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
          <div style={{ marginBottom: '1rem' }}>
          {editing && (
            <>
              <InvoicesSectionHeading
                sampleDollars={billingSegments[0]?.dollars ?? null}
                jobLabel={editing.hcp_number?.trim() ? `Job ${editing.hcp_number.trim()}` : null}
              />
              <JobFormSegmentsBar
                fixtures={fixtures}
                trackSlot={
                  <JobFormBreakOffTrack
                    breakOff={breakOff}
                    billsAheadRemedyHint={billsAheadRemedyHint(editing.invoices ?? [], payments)}
                  />
                }
                axisTotalDollars={jobTotalBidDollars}
                riderFeesDollars={riderFeesDollars}
                invoiceStatusById={fixtureInvoiceStatusById}
                selectedIds={selectedSegmentIds}
                onToggleSegment={toggleSegmentSelected}
                coverage={segmentCoverage}
              />
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
              <JobFormSegmentsCreateAction
                fixtures={fixtures}
                riderFeesDollars={riderFeesDollars}
                invoiceStatusById={fixtureInvoiceStatusById}
                selectedIds={selectedSegmentIds}
                onCreateInvoiceFromSelection={createInvoiceFromSelectedSegments}
                creatingFromSelection={creatingSegmentInvoice}
                coverage={segmentCoverage}
              />
              <JobFormInvoiceList
                editing={editing}
                payments={payments}
                canApplyAgreedWriteDown={canApplyAgreedWriteDown}
                hazmatInvoiceIds={hazmatInvoiceIds}
                onClose={onClose}
                onSavedRef={onSavedRef}
                setEditing={setEditing}
                setBillViewInvoice={setBillViewInvoice}
                setAgreedWriteDownInvoice={setAgreedWriteDownInvoice}
                refreshEditingJobAndHydratePayments={refreshEditingJobAndHydratePayments}
                onInvoiceDeleted={clearFixtureLinksForDeletedInvoice}
                onEditBillTo={setBillToEditorInvoice}
                nestedOverlayZIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
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
        </div>
        {closeFlushState === 'error' && (
          <div
            role="alert"
            style={{
              marginTop: '1.25rem',
              padding: '0.6rem 0.75rem',
              background: 'var(--bg-red-100)',
              border: '1px solid var(--border-red)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', fontWeight: 500 }}>
              Your latest changes could not be saved — the server may not have responded. They may or may not have
              saved.
            </span>
            <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void closeForm()}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Retry and close
              </button>
              <button
                type="button"
                onClick={() => setCloseFlushState('idle')}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: 'var(--bg-200)',
                  color: 'var(--text-700)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={closeFormWithoutSaving}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: 'transparent',
                  color: 'var(--text-red-700)',
                  border: '1px solid var(--border-red)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Close without saving
              </button>
            </span>
          </div>
        )}
        {/* Tappable status strip (v2.1773): quick stage moves + the Collections
            flag, right above the footer. Edit region only — the Bill tab has
            its own billing actions. */}
        {editing && embeddedRegion !== 'bill' ? (
          <JobStatusStepper
            job={{
              id: editing.id,
              status: editing.status,
              collections_at: editing.collections_at ?? null,
              hcp_number: editing.hcp_number,
              click_number: editing.click_number,
              job_name: editing.job_name,
              revenue: editing.revenue,
              payments_made: editing.payments_made,
            }}
            authRole={authRole}
            onChanged={() => onSavedRef.current?.()}
          />
        ) : null}
        {(() => {
          // Footer pieces shared by both layouts (v2.1239): desktop keeps the
          // two-cluster space-between row; phone edit mode stacks a full-width
          // centered status line over one deliberate [Delete][Undo][Close] row.
          const narrowEditFooter = editing && narrowViewport
          const deleteButton =
            // In the Job window Delete lives on the Edit tab only (owner call).
            editing && authRole !== 'primary' && (!embedded || embeddedRegion === 'edit') ? (
              <button
                type="button"
                onClick={() => setDeleteJobConfirmOpen(true)}
                disabled={deletingId === editing?.id || migratingJob}
                style={{
                  padding: '0.5rem 1rem',
                  flexShrink: 0,
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
            ) : null
          const undoConfirmCluster = (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                ...(narrowEditFooter ? { justifyContent: 'center', flexWrap: 'wrap' as const } : {}),
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Revert everything since opening?</span>
              <button
                type="button"
                onClick={performUndo}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: 'var(--bg-red-100)',
                  color: 'var(--text-red-700)',
                  border: '1px solid var(--border-red)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Revert
              </button>
              <button
                type="button"
                onClick={() => setUndoConfirmOpen(false)}
                style={{
                  padding: '0.3rem 0.7rem',
                  background: 'var(--bg-200)',
                  color: 'var(--text-700)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Keep
              </button>
            </span>
          )
          const undoButton = (
            <button
              type="button"
              onClick={() => setUndoConfirmOpen(true)}
              disabled={!undoAvailable}
              title={
                undoAvailable
                  ? 'Revert every change made since this modal was opened (or since the last invoice was created/deleted)'
                  : 'Nothing to undo'
              }
              style={{
                padding: '0.5rem 1rem',
                flexShrink: 0,
                background: 'transparent',
                color: undoAvailable ? 'var(--text-700)' : 'var(--text-faint)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                cursor: undoAvailable ? 'pointer' : 'not-allowed',
              }}
            >
              {narrowEditFooter ? 'Undo' : 'Undo changes'}
            </button>
          )
          const requiredList =
            !jobFormCanSubmit && !saving && jobFormMissingFields.length > 0 ? (
              <span
                style={{
                  fontSize: '0.8rem',
                  color: '#FF6600',
                  display: 'inline-block',
                  ...(narrowEditFooter ? { textAlign: 'center' as const } : {}),
                }}
              >
                <span style={{ display: 'block' }}>Required:</span>
                {jobFormMissingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>
                    {f}
                  </span>
                ))}
              </span>
            ) : null
          const statusSpan = (
            <span
              aria-live="polite"
              style={{
                fontSize: '0.8rem',
                fontWeight: 500,
                ...(narrowEditFooter ? { textAlign: 'center' as const } : {}),
                color:
                  editAutosaveAggregate === 'error'
                    ? 'var(--text-red-600)'
                    : editAutosaveAggregate === 'saved'
                      ? 'var(--text-green-600)'
                      : 'var(--text-muted)',
              }}
            >
              {editAutosaveAggregate === 'saving'
                ? 'Saving…'
                : editAutosaveAggregate === 'error'
                  ? 'Autosave failed — edit the field again to retry'
                  : editAutosaveAggregate === 'blocked'
                    ? 'Waiting on required fields'
                    : editAutosaveAggregate === 'pending'
                      ? 'Unsaved changes…'
                      : 'All changes saved'}
            </span>
          )
          // Embedded: the window's ✕ (wired to the same guarded close) replaces
          // the footer Close.
          const closeButton = embedded ? null : (
            <button
              type="button"
              onClick={() => void closeForm()}
              disabled={closeFlushState === 'saving'}
              style={{
                padding: '0.5rem 1rem',
                ...(narrowEditFooter ? { flex: 1, fontWeight: 500 } : {}),
                background: 'var(--bg-200)',
                color: closeFlushState === 'saving' ? 'var(--text-faint)' : 'var(--text-700)',
                border: 'none',
                borderRadius: 4,
                cursor: closeFlushState === 'saving' ? 'wait' : 'pointer',
              }}
            >
              {closeFlushState === 'saving' ? 'Saving…' : editing ? 'Close' : 'Cancel'}
            </button>
          )
          if (narrowEditFooter) {
            return (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {requiredList}
                {statusSpan}
                {undoConfirmOpen ? undoConfirmCluster : null}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {deleteButton}
                  {!undoConfirmOpen ? undoButton : null}
                  {closeButton}
                </div>
              </div>
            )
          }
          return (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>{deleteButton}</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {editing ? (undoConfirmOpen ? undoConfirmCluster : undoButton) : null}
                {requiredList}
                {/* Edit mode ends [status → Close] so Close anchors the corner (v2.1235);
                    create mode keeps the conventional [Cancel → Create Job]. */}
                {editing ? (
                  <>
                    {statusSpan}
                    {closeButton}
                  </>
                ) : (
                  <>
                    {closeButton}
                    <button
                      type="button"
                      onClick={createJob}
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
                      {saving ? 'Creating…' : 'Create Job'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })()}
      </div>
      {paymentRemoveConfirmRowId && (
        <div
          style={{
            position: 'fixed',
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
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
              maxHeight: 'min(90vh, 100%)',
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
      {stripeFixturePreviewOpen && (
        <div
          style={{
            position: 'fixed',
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: JOB_FORM_NESTED_OVERLAY_Z_INDEX,
          }}
          onClick={() => setStripeFixturePreviewOpen(false)}
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
              maxHeight: 'min(90vh, 100%)',
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
              Stripe line descriptions
            </h2>
            {stripeFixturePreviewRows.length === 0 ? (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                No named line items yet.
              </p>
            ) : (
              stripeFixturePreviewRows.map((f) => (
                <div
                  key={f.id}
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
                    marginBottom: '0.5rem',
                  }}
                >
                  {buildFixtureStripeLineDescriptionForStripe(f.name, f.line_description)}
                </div>
              ))
            )}
            <p
              style={{
                margin: '0.5rem 0 1rem',
                fontSize: '0.8125rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              One Stripe invoice line per line item: &quot;line item&quot; - &quot;scope notes&quot;
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setStripeFixturePreviewOpen(false)}
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
            padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
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
              maxHeight: 'min(90vh, 100%)',
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
        migrateJobLedgerCostsToBidAndDelete={migrateJobLedgerCostsToBidAndDelete}
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
            setLinkedBidGc(
              opt?.customer_id
                ? {
                    id: opt.customer_id,
                    name: (customers.find((c) => c.id === opt.customer_id)?.name ?? '').trim() || '—',
                  }
                : null,
            )
            // Linking a bid to an EXISTING job: fill the GC only when empty —
            // never overwrite a GC someone set deliberately (v2.1182).
            if (opt?.customer_id) {
              setGcCustomerId((prev) => prev ?? opt.customer_id)
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
      {winningGcPick && (
        <PickWinningGcModal
          bidName={winningGcPick.bidName}
          options={winningGcPick.options}
          writesWin={winningGcPick.writesWin}
          onPick={(opt) => void handleWinningGcPick(opt)}
          onCancel={() => setWinningGcPick(null)}
        />
      )}
      {segmentGeneratorOpen && (
        <MultipleSegmentGeneratorModal
          open={segmentGeneratorOpen}
          initialTotalDollars={jobTotalBidDollars}
          zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
          onCancel={() => setSegmentGeneratorOpen(false)}
          onAddToJob={addGeneratedSegmentsToJob}
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
      <JobFormCreateCustomerModal
        open={createCustomerFromJobModalOpen}
        onClose={() => setCreateCustomerFromJobModalOpen(false)}
        customerName={customerName}
        jobAddress={jobAddress}
        customerEmail={customerEmail}
        customerPhone={customerPhone}
        creatingCustomerFromJob={creatingCustomerFromJob}
        onCreate={(t) => void handleCreateCustomerFromJob(t)}
        onLinkSimilar={(c) => void handleLinkToSimilarCustomer(c)}
        resolveJobMasterUserId={async () => {
          if (editing) {
            return resolveEditJobMasterUserId({
              projectId,
              projectMasterUserId: projectId ? (projects.find((p) => p.id === projectId)?.master_user_id ?? null) : null,
              existingJobMasterUserId: editing.master_user_id,
            })
          }
          if (!authUser?.id) return null
          return resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId || null)
        }}
        overlayZIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
      />
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
      {billToEditorInvoice ? (
        <JobFormBillToEditor
          invoice={billToEditorInvoice}
          jobCustomerName={editing?.customer_name ?? null}
          onClose={() => setBillToEditorInvoice(null)}
          onSaved={() => {
            const jobId = editing?.id ?? editingIdRef.current
            if (jobId) {
              void (async () => {
                const found = await fetchJobWithDetailsById(jobId)
                if (found) setEditing(found)
              })()
            }
            onSavedRef.current?.()
          }}
          zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
        />
      ) : null}
    </>
  )
}
