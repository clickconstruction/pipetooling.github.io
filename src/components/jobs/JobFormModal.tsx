/* eslint-disable react-hooks/exhaustive-deps -- mount-only init; parent remounts via key */
import type { JobFormFocusRow } from '../../lib/jobs/jobFormFocusRow'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import { JOB_FORM_SECTION_HEADER_STYLE } from '../../lib/jobFormSectionHeaderStyle'
import { supabase } from '../../lib/supabase'
import { fetchActiveUsers } from '../../lib/people/fetchActiveUsers'
import { fetchTwinUserIds } from '../../lib/fetchTwinUserIds'
import { partitionBidsByScope } from '../../lib/bidBoardScope'
import { titleCaseAddress } from '../../lib/addressTitleCase'
import { jobPartyMoveNotice, pickJobCustomer, pickJobGc } from '../../lib/jobs/jobPartyExclusive'

import { fetchUserDisplayNames, userDisplayLabel } from '../../lib/userDisplayNames'
import { billsAheadRemedyHint } from '../../lib/jobs/editJobInvoiceSendBack'
import { useAuth } from '../../hooks/useAuth'
import CustomerTermsBar from '../customers/CustomerTermsBar'
import CustomerTermsModal from '../customers/CustomerTermsModal'
import { useCustomerTermsWarning } from '../../hooks/useCustomerTermsWarning'
import { useJobHazmatIncidents } from '../../hooks/useJobHazmatIncidents'
import { useJobPropertyCandidates } from '../../hooks/useJobPropertyCandidates'
import { useStandingDiscountOffer } from '../../hooks/useStandingDiscountOffer'
import { useJobFormInvoiceActions } from '../../hooks/useJobFormInvoiceActions'
import { useJobFormImport, type JobImportWinningGcPick } from '../../hooks/useJobFormImport'
import { useJobFormPaymentActions } from '../../hooks/useJobFormPaymentActions'
import { useJobFormAutosaveEngine } from '../../hooks/useJobFormAutosaveEngine'
import { JobFormBillJobAccountNote } from './JobFormBillJobAccountNote'
import { sumHazmatRiderFees } from '../../lib/hazmatIncidents'
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
  identitySliceReadyToSave,
  type JobIdentityFormFields,
} from '../../lib/jobs/jobFormAutosaveSlices'
import { composePctAutoNoteBody } from '../../lib/jobs/stagesPctNote'
import { postJobThreadNoteBody } from '../../lib/jobs/postJobThreadNote'
import {
  buildJobFormUndoSnapshot,
  invoiceSetKey,
  jobFormUndoAvailable,
  sanitizeRestoredFixtureLinks,
  type JobFormUndoSnapshot,
} from '../../lib/jobs/jobFormUndo'
import { jobFormAutosaveAggregate, jobFormFooterShowsDelete, type JobFormCloseFlushState } from '../../lib/jobs/jobFormFooter'
import { JobFormSourceEstimateBanner } from './JobFormSourceEstimateBanner'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { resolveCustomerIdForJobPayload, resolveGcCustomerIdForJobPayload } from '../../lib/jobLedgerCustomer'
import { PickWinningGcModal } from './PickWinningGcModal'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { JOB_CREATED_FROM_BID_EVENT, jobCreatedTelemetryTarget, type JobCreatedFromBidDetail } from '../../lib/bids/wonMomentActions'
import { closeOpenJobFromBidRequests } from '../../lib/bids/openJobFromBidDispatchRequest'
import {
  resolveDevelopmentIdForJobPayload,
  validateNewDevelopmentName,
  type JobFormDevelopmentRow,
} from '../../lib/jobs/jobDevelopments'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { jobFormPaidDollars, jobFormRevenueDollars } from '../../lib/jobs/jobFormMoneyTotals'
import { mergePaymentRowUpdate, paymentRowsAfterRemove } from '../../lib/jobs/jobFormPaymentActions'
import { writeNewJobChildRows } from '../../lib/jobs/jobFormSliceWrites'
import { closeDateMetBackfillNeeded, closeDemoteToBilledNeeded } from '../../lib/jobs/jobFormCloseSideEffects'
import { buildEditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import { MoneyLifecycleBar, PAID_COLOR, BILLED_COLOR, DRAFT_COLOR } from './MoneyLifecycleBar'
import { useBreakOffSlider } from './useBreakOffSlider'
import { useJobCostSnapshot } from './useJobCostSnapshot'
import { useJobMigrate } from './useJobMigrate'
import { JobFormInvoiceList } from './JobFormInvoiceList'
import { JobFormUpcomingDraws } from './JobFormUpcomingDraws'
import { useJobStagePlanInputs } from '../../hooks/useJobStagePlanInputs'
import { drawLabelsByInvoiceId, stagePlanFromForm } from '../../lib/jobs/stagePlanForm'
import { fixtureRowsFromDb } from '../../lib/jobs/jobFormFixtureHydrate'
import { applyTargetJobTotal, discountRowIsLocked, isDiscountRow, newDiscountFixtureRow, syncDiscountRows } from '../../lib/jobs/discountLine'
import { discountSnapshot } from '../../lib/jobs/discountActivity'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { JobFormStagesGroup } from './JobFormStagesGroup'
import { JobFormStagesDrawer } from './JobFormStagesDrawer'
import { portalTokenUrl } from '../../lib/portal/gcPortalLink'
import { useGcPortalLinks } from '../../hooks/useGcPortalLinks'
import { JobFormHazmatRiderRows } from './JobFormHazmatRidersStrip'
import { JobFormPaymentsTable } from './JobFormPaymentsTable'
import { JobPaymentMoveModal } from './JobPaymentMoveModal'
import { JobFormPartsCostSection } from './JobFormPartsCostSection'
import { JobFormLaborCostPanel } from './JobFormLaborCostPanel'
import { JobFormBreakOffSection, JobFormBreakOffTrack } from './JobFormBreakOffSection'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import { JobFormPeoplePicker } from './JobFormPeoplePicker'
import { JobFormAccountManSection } from './JobFormAccountManSection'
import { JobFormDeleteMigrateModals } from './JobFormDeleteMigrateModals'
import { JobFormFooter } from './JobFormFooter'
import JobStatusStepper from './JobStatusStepper'
import { isJobFormFactRow } from '../../lib/jobs/jobFormFocusRow'

/** The ring the GC run's chips land in (v2.3819) — the ③ Payments received ring of v2.3795. */
const FOCUS_FIELD_RING = { borderRadius: 8, padding: '0.25rem 0.5rem', background: 'var(--bg-blue-tint)', border: '2px solid #93c5fd' } as const
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { breakOffPrefillAmountStringFromJob } from '../../lib/jobs/jobFormBreakOff'
import type {
  FixtureRow,
  JobFormServiceType,
  MaterialRow,
  MeServiceTypeColumns,
  PaymentRow,
  JobsLedgerInvoiceRow,
} from '../../lib/jobs/jobFormTypes'
import { pickDefaultServiceTypeId, visibleServiceTypesForJobForm } from '../../lib/jobs/jobFormServiceTypes'
import {
  fixtureRowHasUserContent,
  materialRowHasUserContent,
  newEmptyPaymentRow,
  newJobFormHasBlockingContent,
  paymentRowsFromJob,
} from '../../lib/jobs/jobFormRows'
import { newJobDraftIsDirty, type NewJobDraftSnapshot } from '../../lib/jobs/newJobDraftDirty'
import { moveRowById } from '../../lib/jobs/jobFormReorder'
import {
  buildJobSegmentsBar,
  dollarCoverageForSegments,
  segmentBoundaryMarks,
  segmentSelectionNetSummary,
} from '../../lib/jobs/jobSegmentsCoverage'
import { InvoicesSectionHeading, JobFormSegmentsBar, JobFormSegmentsCreateAction } from './JobFormSegmentsBar'
import { MultipleSegmentGeneratorModal } from './MultipleSegmentGeneratorModal'
import type { SegmentGeneratorPayloadLine } from '../../lib/jobs/segmentGenerator'
import { resolveEffectiveJobMasterUserId } from '../../lib/resolveEffectiveJobMasterUserId'
import {
  getHideHcpFieldCached,
  refreshHideHcpFieldCache,
  shouldHideHcpEntryField,
} from '../../lib/hideHcpFieldSetting'
import { resolveEditJobMasterUserId } from '../../lib/resolveEditJobMasterUserId'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import BilledPaymentConfirmationModal from './BilledPaymentConfirmationModal'
import UndoStripePartPaymentModal from './UndoStripePartPaymentModal'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { findInvoiceWithJobFromJobs } from '../../lib/invoiceWithJobFromJobList'
import { mercuryCardTotalFromLines, tallyPartsTotalFromLines } from '../../lib/fetchJobMaterialsCostSnapshot'
import JobProjectLinkChoiceModal from './JobProjectLinkChoiceModal'
import JobBidLinkChoiceModal, { type JobBidLinkOption } from './JobBidLinkChoiceModal'
import { JobFormImportEstimateOrBidModal } from './JobFormImportEstimateOrBidModal'
import { useJobDetailOpenerBridge } from '../../contexts/JobDetailOpenerBridgeContext'
import { useNewProjectModal } from '../../contexts/NewProjectModalContext'
import BilledBillViewModal, { type InvoiceWithJobForBillView } from './BilledBillViewModal'
import AgreedWriteDownModal from './AgreedWriteDownModal'
import { JobFormBillToEditor, type BillToEditorInvoice } from './JobFormBillToEditor'
import { parseJobBillToParty, shouldDefaultBillsToGc, type JobBillToParty } from '../../lib/jobs/billToParty'
import { shouldDefaultShowOtherParty } from '../../lib/jobs/billVisibility'
import { planPayerCarves } from '../../lib/jobs/splitByPayer'
import { JobFormMercuryUnlinkConfirm } from './JobFormMercuryUnlinkConfirm'
import { JobFormPaymentRemoveConfirm } from './JobFormPaymentRemoveConfirm'
import { JobFormStripeLinePreviewDialog } from './JobFormStripeLinePreviewDialog'
import { useJobFormLabor } from '../../hooks/useJobFormLabor'

import { JobFormHeaderRow } from './JobFormHeaderRow'
import { JobFormIdentityFields } from './JobFormIdentityFields'
import { JobFormLinksSection } from './JobFormLinksSection'
import { JobFormCustomerSection } from './JobFormCustomerSection'
import { JobFormEditFactRows } from './JobFormEditFactRows'
import { JobFormCreateCustomerModal } from './JobFormCreateCustomerModal'
import { extractContactFromCustomer, getCustomerDisplay } from '../../lib/jobs/jobFormCustomerDisplay'
import { formatJobFormBidLinkTitle } from '../../lib/jobs/jobFormBidLinkTitle'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

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
  /** Scroll to ③ Payments received and flash it — the Dashboard's bank-returned deposits card (v2.3795). */
  paymentsReceivedHighlightInitial?: boolean
  /** Scroll to / focus / flash the Customer Pictures input (dispatch "Add Customer Pictures URL"). */
  jobPicturesLinkHighlightInitial: boolean
  /** Open on the Property record row, expanded and flashed — the lien screens' property-kind door (v2.3667). */
  propertyRecordFocusInitial?: boolean
  /** Open on this fact row, expanded and ringed — the Lien desk's plain-value doors (v2.3697). */
  focusRowInitial?: JobFormFocusRow | null
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
   * team, customer, links; 'bill' = money in (line items, segment bar,
   * invoices, payments); 'costs' = money out (Cost Timeline, team + sub labor,
   * parts cost — split out of Bill, owner call).
   */
  embeddedRegion?: 'edit' | 'bill' | 'costs' | null
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
  /** Embedding only (Stage Plan PR 4): "Set stages on Bill →" asks the window to switch regions. */
  onRequestRegion?: (region: 'edit' | 'bill' | 'costs') => void
}

export default function JobFormModal({
  mode,
  editJobId,
  initialJob,
  newJobProjectId = null,
  newJobPrefillBidId = null,
  billingCustomerHighlightInitial,
  fixturesSectionHighlightInitial,
  paymentsReceivedHighlightInitial = false,
  jobPicturesLinkHighlightInitial,
  propertyRecordFocusInitial = false,
  focusRowInitial = null,
  alsoOpenCreateCustomerModal,
  onClose,
  onSaved,
  onCreatedJobId = null,
  embeddedRegion = null,
  registerRequestClose = null,
  externalEscBlocked = false,
  onRequestRegion,
}: JobFormModalProps) {
  const embedded = embeddedRegion !== null
  const { user: authUser, role: authRole } = useAuth()
  const confirmDialog = useConfirmDialog()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  // Tier-2 #42 (J1-N1): Escape acts only when this is the topmost open modal, so
  // closing New Job never also closes the Edit Bid underneath. Embedded in the
  // Job window the shell owns Escape — no registration.
  const isTopmostModal = useModalStackEntry(!embedded)
  /** Phone footer layout (v2.1239): status line above one deliberate button row. */
  const narrowViewport = useNarrowViewport640()
  const prefixMap = useLedgerPrefixMap()
  const { incidents: hazmatIncidents, hazmatInvoiceIds, refresh: refreshHazmatIncidents } = useJobHazmatIncidents(editJobId)
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
  /** New Job: `next_job_number_suggestion` in flight (v2.2909, J1-F3) — the C# box says "finding…" instead of sitting blank. */
  const [clickNumberSuggesting, setClickNumberSuggesting] = useState(false)
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
  /** Who pays (v2.3345): customer | gc | split — identity slice, see billToParty.ts. */
  const [billToParty, setBillToParty] = useState<JobBillToParty>('customer')
  /** Bills also go to (v2.3358): the party not billed is copied on every bill — identity slice. */
  const [billCopyOtherParty, setBillCopyOtherParty] = useState(false)
  /** Share this bill (v2.3377): a NEW job's memory (show_bills_to_other_party) — set by a flagged GC's pick, read by the create payload only; a saved job's memory lives on its Edit-tab row. */
  const [newJobShowOtherParty, setNewJobShowOtherParty] = useState(false)
  /** v2.3353: the GC id the standing-rule default was last applied for (or loaded with) — so a
      saved job's deliberate choice is never overridden, and each new GC pick is judged once. */
  const gcDefaultAppliedForRef = useRef<string | null>(null)
  // Their Word PR 4: the payer's payment terms + promise record as a bar above the customer rows.
  const [termsRefresh, setTermsRefresh] = useState(0)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  // Who pays (v2.3346): the bar describes the party the bills go to — the GC only when the rule says so.
  const termsPayerId = billToParty === 'gc' && gcCustomerId ? gcCustomerId : customerId || gcCustomerId || null
  const customerTerms = useCustomerTermsWarning(termsPayerId, termsRefresh)
  /** Property record link (v2.2638): customer_addresses row this job sits at — feeds lien documents. */
  const [customerAddressId, setCustomerAddressId] = useState<string | null>(null)
  /** Optional development (group of jobs) — a developments row id (v2.1199). */
  const [developmentId, setDevelopmentId] = useState<string | null>(null)
  const [developments, setDevelopments] = useState<JobFormDevelopmentRow[]>([])
  /** The linked bid's GC (bids.customer_id + name) — drives the picker's "Use bid's GC" chip. */
  const [linkedBidGc, setLinkedBidGc] = useState<{ id: string; name: string } | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [bidId, setBidId] = useState<string | null>(null)
  /** New job from a bid (v2.3302): snapshot the bid's estimate as the job's budget on save. On by default. */
  const [carryBidBudget, setCarryBidBudget] = useState(true)
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
  const [winningGcPick, setWinningGcPick] = useState<JobImportWinningGcPick | null>(null)
  /** Auto-picked trade on new-job load; changing away from this counts as “content” for hiding Import. */
  const initialNewJobServiceTypeIdRef = useRef('')
  /** Avoid duplicate applyPrefillFromBid before bidId state updates (e.g. Strict Mode). */
  const newJobPrefillBidAppliedRef = useRef<string | null>(null)
  // Tier-2 #42 (J1-F2) New Job discard guard: the sheet as it looked once init
  // (and any bid prefill) landed; closing compares against it. Armed → captured
  // on the next render so batched state lands first.
  const newJobInitialSnapshotRef = useRef<NewJobDraftSnapshot | null>(null)
  const newJobSnapshotArmedRef = useRef(false)
  const newJobDiscardPromptOpenRef = useRef(false)
  /** Set right before the post-create close — a saved job is not a discard. */
  const newJobSkipDiscardGuardRef = useRef(false)
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  /** The fact rows save a GC's billing email straight to customers (v2.3345); mirror it locally. */
  const patchCustomerRow = useCallback((id: string, patch: Partial<CustomerRow>) => {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])
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
  const [paymentsReceivedHighlight, setPaymentsReceivedHighlight] = useState(false)
  const paymentsReceivedHighlightRef = useRef<HTMLDivElement | null>(null)
  // The GC run's chips (v2.3819): land on the status stepper or the % done field, ringed for a moment, then plain.
  const [focusFieldFlash, setFocusFieldFlash] = useState<'status' | 'pct' | null>(focusRowInitial === 'status' || focusRowInitial === 'pct' ? focusRowInitial : null)
  const focusFieldRef = useRef<HTMLDivElement | null>(null)
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
    return jobFormPaidDollars(payments.filter((p) => p.invoice_id === agreedWriteDownInvoice.id))
  }, [agreedWriteDownInvoice, payments])
  const [materials, setMaterials] = useState<MaterialRow[]>([{ id: crypto.randomUUID(), description: '', amount: 0 }])
  const [fixturesRaw, setFixturesRaw] = useState<FixtureRow[]>([
    { id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null },
  ])
  // Discount rows (v2.3252+): every write to the line items runs the
  // invariant keeper — a percent's dollars re-derive from its basis, a dollar
  // amount caps at the basis, count 1, never a stage — so every reader below
  // (Job Total, segments, the plan, the save engine) sees rows that are
  // already true. `syncDiscountRows` returns the same array when nothing
  // moved, so this adds no renders.
  const fixtures = fixturesRaw
  const setFixtures = useCallback<Dispatch<SetStateAction<FixtureRow[]>>>((action) => {
    setFixturesRaw((prev) => syncDiscountRows(typeof action === 'function' ? action(prev) : action))
  }, [])
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
  // The preview's Escape listener lives in `JobFormStripeLinePreviewDialog` (v2.3872); one stable closer for it.
  const closeStripeFixturePreview = useCallback(() => setStripeFixturePreviewOpen(false), [])
  const jobTotalBidDollars = useMemo(() => revenueDollarsFromFixtures(fixtures), [fixtures])
  // v2.1029: rider (hazmat) fees count toward the Job Total — display, billing
  // math, AND the revenue written on save (previously saving recomputed
  // revenue from fixtures alone, silently wiping the fee's revenue bump).
  const riderFeesDollars = useMemo(() => sumHazmatRiderFees(hazmatIncidents), [hazmatIncidents])
  const jobTotalWithRidersDollars = useMemo(() => jobFormRevenueDollars(fixtures, riderFeesDollars), [fixtures, riderFeesDollars])
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
    const paidSum = jobFormPaidDollars(payments)
    return dollarCoverageForSegments({
      segments: billingSegments,
      grossDollars: jobTotalWithRidersDollars,
      paidDollars: paidSum,
      invoices: editing?.invoices,
      payments,
    })
  }, [billingSegments, jobTotalWithRidersDollars, payments, editing?.invoices])

  // Stage Plan (PR 2): the line items read as stages — windows, the sub orders
  // on them and their sheets come from the hook; line items, invoices and
  // payments are the form's own state, so the plan follows every edit live.
  const stagePlanInputs = useJobStagePlanInputs(editing?.id ?? null)
  const stagePlanToday = useMemo(() => todayYmdInAppTz(), [])
  const stagePlan = useMemo(
    () =>
      stagePlanFromForm({
        fixtures,
        windows: stagePlanInputs.inputs.windows,
        orders: stagePlanInputs.inputs.orders,
        sheets: stagePlanInputs.inputs.sheets,
        invoices: editing?.invoices ?? [],
        payments,
        todayYmd: stagePlanToday,
      }),
    [fixtures, stagePlanInputs.inputs, editing?.invoices, payments, stagePlanToday],
  )
  const drawLabelByInvoiceId = useMemo(() => drawLabelsByInvoiceId(stagePlan), [stagePlan])
  // Stage Plan PR 4: the Edit tab's read-out and the "as the customer sees it" drawer.
  const [stagesDrawerOpen, setStagesDrawerOpen] = useState(false)
  // The drawer's "Open the portal ↗": the GC's real link when one is minted, else the sample page.
  const stagesGcLinkIds = useMemo(() => (gcCustomerId ? [gcCustomerId] : []), [gcCustomerId])
  const stagesGcLinks = useGcPortalLinks(stagesGcLinkIds, stagesDrawerOpen)
  const stagesGcLink = gcCustomerId ? stagesGcLinks.links.get(gcCustomerId) ?? null : null
  const stagesGcName = useMemo(() => (gcCustomerId ? (customers.find((c) => c.id === gcCustomerId)?.name ?? '').trim() || null : (editing?.gcCustomer?.name ?? null)), [gcCustomerId, customers, editing?.gcCustomer?.name])

  // ② Invoices segment bar (v2.1070): which unbilled line items are picked
  // for the next "create invoice from selected segments" action.
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(new Set())

  const [segmentGeneratorOpen, setSegmentGeneratorOpen] = useState(false)

  // Escape-to-close lives below the payment/delete state it is gated on (v2.3839).
  const closeFormRef = useRef<() => Promise<boolean>>()
  closeFormRef.current = closeForm

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

  // Who pays (v2.3353): a GC that "pays as GC by default" flips a fresh job to GC
  // pays the moment it is picked (or imported from a won bid). Judged once per
  // GC id, only when the customers row is loaded, never over a saved choice.
  useEffect(() => {
    if (!gcCustomerId || gcCustomerId === gcDefaultAppliedForRef.current) return
    const gc = customers.find((c) => c.id === gcCustomerId)
    if (!gc) return
    gcDefaultAppliedForRef.current = gcCustomerId
    if (shouldDefaultBillsToGc({ gc, customerId, current: billToParty })) setBillToParty('gc')
    // Share this bill (v2.3377): the GC's card can start a fresh job's memory on.
    if (!editing && shouldDefaultShowOtherParty({ gc, customerId, current: newJobShowOtherParty })) setNewJobShowOtherParty(true)
  }, [gcCustomerId, customers, customerId, billToParty, editing, newJobShowOtherParty])

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
    billToParty,
    billCopyOtherParty,
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
  const customersRef = useRef(customers)
  customersRef.current = customers
  const partyIdsRef = useRef({ customerId, gcCustomerId })
  partyIdsRef.current = { customerId, gcCustomerId }
  /**
   * v2.3403: every customer / GC PICK goes through these two — a job's
   * customer and GC are never the same party. Picking the GC that is the
   * customer moves them (customer cleared, bills go to the GC); picking the
   * customer that is the GC drops the GC. Load and undo paths use the raw
   * setters so opening a job never rewrites it.
   */
  const pickGcCustomerId = useCallback((v: SetStateAction<string | null>) => {
    const next = typeof v === 'function' ? v(partyIdsRef.current.gcCustomerId) : v
    const r = pickJobGc(next, partyIdsRef.current)
    setGcCustomerId(r.gcCustomerId)
    if (r.moved === 'customer_to_gc') {
      setCustomerId(null)
      setCustomerSearch('')
      setCustomerName('')
      setCustomerEmail('')
      setCustomerPhone('')
      setDateMet('')
      setBillToParty('gc')
      showToast(jobPartyMoveNotice(r.moved, customersRef.current.find((c) => c.id === next)?.name) ?? '', 'info', 7000)
    }
  }, [showToast])
  const pickCustomerId = useCallback((v: SetStateAction<string | null>) => {
    const next = typeof v === 'function' ? v(partyIdsRef.current.customerId) : v
    const r = pickJobCustomer(next, partyIdsRef.current)
    setCustomerId(r.customerId)
    if (r.moved === 'gc_cleared') {
      setGcCustomerId(null)
      setBillToParty((cur) => (cur === 'gc' ? 'customer' : cur))
      showToast(jobPartyMoveNotice(r.moved, customersRef.current.find((c) => c.id === next)?.name) ?? '', 'info', 7000)
    }
  }, [showToast])
  // Property-record candidates (v2.2638): the job customer's + GC's saved addresses. Called here,
  // where the loader's effect always ran, so the order of the form's effects is unchanged.
  const { propertyCandidates, setPropertyCandidates } = useJobPropertyCandidates({ customerId, gcCustomerId, customerAddressId, setCustomerAddressId })

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
  // The save engine (the Job form map's order #9): the four edit-mode autosave slices — billing,
  // identity, materials, team, registered in that order — with their mirror refs and writers.
  // Called here, once every field they carry is declared; the fields stay the form's.
  const {
    billingMoneySliceJson,
    identitySliceJson,
    materialsSliceJson,
    teamSliceJson,
    autosaveFixturesRef,
    autosavePaymentsRef,
    autosaveRiderFeesRef,
    autosaveMaterialsRef,
    autosaveTeamIdsRef,
    identityFieldsRef,
    hydratedPaymentIdsRef,
    persistedDiscountSnapshotRef,
    persistedPicturesLinkRef,
    persistedCustomerPhoneRef,
    persistedBidIdRef,
    billingAutosave,
    billingAutosaveStatus,
    flushBillingAutosave,
    identityAutosave,
    editAutosaveSlices,
    flushAllAutosaveSlicesRef,
    rehydrateFixturesFromDb,
    readBidOutcomeForToast,
    announceDerivedBidOutcome,
  } = useJobFormAutosaveEngine({
    editing,
    setEditing,
    authUser,
    authRole,
    fixtures,
    setFixtures,
    payments,
    riderFeesDollars,
    materials,
    teamMemberIds,
    identityFields,
    projects,
    customers,
    developments,
    onSavedRef,
  })

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
    setBillToParty(s.identity.billToParty)
    setBillCopyOtherParty(s.identity.billCopyOtherParty)
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
  const editAutosaveAggregate = jobFormAutosaveAggregate(editAutosaveSlices, identityBlocked)

  // Closing the modal must not drop a pending autosave: cancel the debounce,
  // wait out any in-flight write, and save whatever is still dirty before
  // onClose unmounts everything. 'error' keeps the modal open with an explicit
  // Retry / Close-without-saving choice — silent loss is never the default.
  const [closeFlushState, setCloseFlushState] = useState<JobFormCloseFlushState>('idle')
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
    // Whoever opened the window re-reads, as after every other save (the GC run's band regroups on it).
    onSavedRef.current?.()
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
  // The payment lines' actions (the Job form map's order #8): Remove and its confirm, the drop of
  // a hand-typed line once its payment is recorded, Unlink and remove — with their confirm and
  // busy states. The Escape gate below reads two of them, so the hook is called here.
  const {
    paymentRemoveConfirmRowId,
    setPaymentRemoveConfirmRowId,
    paymentRemoveRpcBusy,
    setPaymentRemoveRpcBusy,
    unlinkMercuryConfirmRowId,
    setUnlinkMercuryConfirmRowId,
    unlinkingMercuryPaymentId,
    persistedLedgerPaymentIds,
    paymentRemovePreview,
    paymentRemoveConfirmsPersistedRpc,
    requestRemovePaymentRow,
    confirmRemovePaymentRow,
    finishRecordPaymentOnBill,
    confirmUnlinkMercuryFromBankRow,
  } = useJobFormPaymentActions({
    editing,
    setEditing,
    authRole,
    payments,
    setPayments,
    removePaymentRow,
    jobTotalWithRidersDollars,
    billingAutosave,
    hydratedPaymentIdsRef,
    onSavedRef,
  })
  /** v2.3576: the payment being moved to another job (Move to job…). */
  const [paymentMoveRow, setPaymentMoveRow] = useState<PaymentRow | null>(null)
  /**
   * v2.3692: the Record a cash or check payment window, opened from a bill
   * row's Record payment or from a hand-typed row's Stripe hand-off note
   * (`amount` = what was typed, `draftRowId` = the row to drop afterwards).
   */
  /** v2.3695: the locked Stripe row whose part payment is being undone. */
  const [undoPartPaymentRow, setUndoPartPaymentRow] = useState<PaymentRow | null>(null)
  const [recordPaymentTarget, setRecordPaymentTarget] = useState<{
    inv: JobsLedgerInvoiceRow
    amount: number | null
    draftRowId: string | null
  } | null>(null)
  const [deleteJobConfirmOpen, setDeleteJobConfirmOpen] = useState(false)
  const migrate = useJobMigrate(editing?.id ?? null)
  // Only the fields the shell's own handlers/effects touch — the rest of the
  // hook output is consumed by JobFormDeleteMigrateModals via the `migrate` prop.
  const { migratingJob, setMigratingJob, resetMigrate } = migrate
  /** v2.3839: the invoice list's and people picker's own dialogs, reported up for the Escape gate. */
  const [invoiceListOverlayOpen, setInvoiceListOverlayOpen] = useState(false)
  const [peoplePickerOverlayOpen, setPeoplePickerOverlayOpen] = useState(false)
  // v2.1100: Escape closes the modal through the same guarded closeForm() as a
  // backdrop click — but not while a nested overlay is open (each is gated by
  // its shell flag below; the banner's acceptance-record modal reports through
  // bannerOverlayOpen and owns its own Escape; the invoice list's and the people
  // picker's dialogs report the same way). closeForm is hoisted; the ref keeps
  // the listener on the current render's closure. v2.3839 adds every other
  // layer the form stacks — the payment confirms and windows, delete/migrate,
  // winning-GC pick, terms, the Stages drawer — which Escape used to close the
  // whole form underneath (a half-typed payment was lost).
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
    billToEditorInvoice != null ||
    invoiceListOverlayOpen ||
    peoplePickerOverlayOpen ||
    paymentRemoveConfirmRowId != null ||
    unlinkMercuryConfirmRowId != null ||
    recordPaymentTarget != null ||
    undoPartPaymentRow != null ||
    paymentMoveRow != null ||
    deleteJobConfirmOpen ||
    migrate.migrateJobModalOpen ||
    winningGcPick != null ||
    termsModalOpen ||
    stagesDrawerOpen
  useEffect(() => {
    if (escCloseBlocked) return
    const onKeyDown = (ev: WindowEventMap['keydown']) => {
      if (ev.key !== 'Escape' || ev.defaultPrevented) return
      if (!isTopmostModal()) return
      void closeFormRef.current?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [escCloseBlocked, isTopmostModal])

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
  // The team row and the sub-labor sheets on the job — `useJobFormLabor` (v2.3871), the map's order #1.
  const { editJobTeamLaborLoading, editJobTeamLaborRow, editJobTeamLaborError, editJobSubLaborLoading, editJobSubLaborData, editJobSubLaborError } = useJobFormLabor(editing?.id ?? null)

  const visibleJobFormServiceTypes = useMemo(
    () => visibleServiceTypesForJobForm(serviceTypes, meServiceTypeColumns),
    [serviceTypes, meServiceTypeColumns],
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

  function currentNewJobSnapshot(): NewJobDraftSnapshot {
    return {
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
    }
  }
  // Arm once init finishes in new mode; the capture effect below (same commit,
  // declared after) then snapshots the post-init sheet. applyPrefillFromBid
  // re-arms after an import so imported rows are baseline, not dirt.
  useEffect(() => {
    if (mode === 'new' && initDone) newJobSnapshotArmedRef.current = true
  }, [mode, initDone])
  useEffect(() => {
    if (mode !== 'new' || !newJobSnapshotArmedRef.current) return
    newJobSnapshotArmedRef.current = false
    newJobInitialSnapshotRef.current = currentNewJobSnapshot()
  })

  /**
   * Tier-2 #42 (J1-F2): a dirty New Job asks before Cancel / Escape / backdrop
   * throw it away. Resolves false when the user keeps editing. One prompt at a
   * time — a second Escape while it's up is ignored rather than re-asking.
   */
  async function confirmDiscardNewJobIfDirty(): Promise<boolean> {
    if (mode !== 'new' || newJobSkipDiscardGuardRef.current) return true
    if (newJobDiscardPromptOpenRef.current) return false
    if (!newJobDraftIsDirty(currentNewJobSnapshot(), newJobInitialSnapshotRef.current)) return true
    newJobDiscardPromptOpenRef.current = true
    recordNavClick(authUser?.id, authRole, 'discard_guard_shown', 'new_job')
    try {
      return await confirmDialog({
        title: 'Discard this job?',
        message: 'Nothing has been saved yet — what you typed here will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        danger: true,
      })
    } finally {
      newJobDiscardPromptOpenRef.current = false
    }
  }

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
    if (closeDateMetBackfillNeeded({ customerId, dateMet, customers })) return true
    return closeDemoteToBilledNeeded({ status: editing.status, fixtures: autosaveFixturesRef.current, riderFeesDollars: autosaveRiderFeesRef.current, payments: autosavePaymentsRef.current })
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
    if (closeDemoteToBilledNeeded({ status: editing?.status, fixtures: autosaveFixturesRef.current, riderFeesDollars: autosaveRiderFeesRef.current, payments: autosavePaymentsRef.current })) {
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
    if (!(await confirmDiscardNewJobIfDirty())) return false
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
    gcDefaultAppliedForRef.current = job.gc_customer_id ?? null
    setGcCustomerId(job.gc_customer_id ?? null)
    setBillToParty(parseJobBillToParty((job as { bill_to_party?: string | null }).bill_to_party))
    setBillCopyOtherParty((job as { bill_copy_other_party?: boolean | null }).bill_copy_other_party === true)
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
    persistedCustomerPhoneRef.current = (job.customer_phone ?? '').trim()
    persistedBidIdRef.current = job.bid_id ?? ''
    setJobPlansLink(job.job_plans_link ?? '')
    setProjectFilesPlansExpanded(false)
    setPayments(paymentRowsFromJob(job))
    hydratedPaymentIdsRef.current = (job.payments ?? []).map((p) => p.id)
    setMaterials(
      job.materials.length > 0
        ? job.materials.map((m) => ({ id: m.id, description: m.description, amount: Number(m.amount) }))
        : [{ id: crypto.randomUUID(), description: '', amount: 0 }],
    )
    const hydratedFixtures =
      job.fixtures.length > 0
        ? fixtureRowsFromDb(job.fixtures)
        : [{ id: crypto.randomUUID(), name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }]
    setFixtures(hydratedFixtures)
    // Discount trail (v2.3256): what the DB holds now — the next persist diffs against it.
    persistedDiscountSnapshotRef.current = discountSnapshot(hydratedFixtures)
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
    gcDefaultAppliedForRef.current = null
    setGcCustomerId(null)
    setBillToParty('customer')
    setNewJobShowOtherParty(false)
    setBillCopyOtherParty(false)
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

  // The New Job imports (the Job form map's order #7): a bid or an estimate fills the form. The
  // picker's open pick stays here — the Escape gate reads it.
  const { cancelBidImport, applyPrefillFromBid, handleWinningGcPick, applyPrefillFromEstimate } = useJobFormImport({
    authUserId: authUser?.id,
    authRole,
    customers,
    serviceTypes,
    meServiceTypeColumns,
    winningGcPick,
    setWinningGcPick,
    closeFormRef,
    newJobSnapshotArmedRef,
    setFixtures,
    setFixtureScopeExpandedById,
    setSelectedSegmentIds,
    setBidId,
    setBids,
    setLinkedBidSummary,
    setLinkedBidGc,
    pickGcCustomerId,
    setBillToParty,
    setFormServiceTypeId,
    setJobName,
    setJobAddress,
    setGoogleDriveLink,
    setJobPlansLink,
    setCustomerId,
    setCustomers,
    setCustomerName,
    setCustomerEmail,
    setCustomerPhone,
    setDateMet,
  })

  useLayoutEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      setCustomersLoading(true)
      try {
        async function loadFormUsers(meRole: string | undefined) {
          if (!authUser?.id) return
          // Tier-2 #19: shared active-people query — no archived or twin accounts in the job form's team list.
          const { data: usersRes } = await fetchActiveUsers<UserRow>('id, name, email, role', {
            roles: ['assistant', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', 'controller'],
          })
          let usersList = usersRes
          if (meRole === 'dev') {
            const { data: devUsers } = await fetchActiveUsers<UserRow>('id, name, email, role', { roles: [], includeDev: true })
            if (devUsers.length) {
              const existingIds = new Set(usersList.map((u) => u.id))
              const newDevs = devUsers.filter((u) => !existingIds.has(u.id))
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
          twinIds,
        ] = await Promise.all([
          supabase.from('customers').select('id, name, address, contact_info, billing_email, gc_pays_by_default, sees_customer_bills, date_met, date_met_source, master_user_id, customer_type, archived_at').order('name'),
          supabase.from('projects').select('id, name, customer_id, master_user_id, customers(name)').order('name'),
          supabase
            .from('bids')
            .select('id, project_name, bid_number, service_type_id, customer_id, estimator_id, created_by, customers(name)')
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
          fetchTwinUserIds(),
        ])
        if (cancelled) return
        const allServiceTypes = (stData as JobFormServiceType[] | null) ?? []
        setCustomers((custData as CustomerRow[]) ?? [])
        setProjects((projData as ProjectOption[]) ?? [])
        setDevelopments((devData as JobFormDevelopmentRow[]) ?? [])
        // Tier-2 #19 (J1-N2): the Import picker hides twin mirrors ("ZZ Twin … (backtest)") of
        // the real wins they copy — same People|Robots predicate as the Bid Board.
        setBids(partitionBidsByScope(((bidData ?? []) as Array<JobBidLinkOption & { estimator_id: string | null; created_by: string | null }>), twinIds).people)
        setServiceTypes(allServiceTypes)
        setMeServiceTypeColumns((meRow as MeServiceTypeColumns | null) ?? null)
        await loadFormUsers((meRow as MeServiceTypeColumns | null)?.role)
        if (cancelled) return

        if (mode === 'new') {
          resetNewForm(newJobProjectId)
          // Offer the next global job number (highest numeric HCP-or-C# + 1) as the
          // default C#, editable. Runs async; only fills if still mounted. The box
          // shows "finding…" meanwhile (v2.2909, J1-F3 — it took 3–6 s on a slow
          // link and read as broken), and a number the office typed while waiting
          // is never overwritten by the late suggestion.
          setClickNumberSuggesting(true)
          void (async () => {
            try {
              const suggestion = await withSupabaseRetry(
                async () => await supabase.rpc('next_job_number_suggestion'),
                'next job number suggestion',
              )
              if (!cancelled && typeof suggestion === 'string' && suggestion.length > 0) {
                setClickNumber((prev) => (prev.trim() ? prev : suggestion))
              }
            } catch {
              /* leave C# blank if the suggestion can't be fetched */
            } finally {
              if (!cancelled) setClickNumberSuggesting(false)
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
          setPaymentsReceivedHighlight(paymentsReceivedHighlightInitial)
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
    // This form exists only for the import — cancelling the GC picker closes it (Tier-1 #8, J15-F4).
    void applyPrefillFromBid(pid, undefined, { closeOnCancel: true })
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

  // v2.3795: the bank-returned deposits card lands on ③ Payments received — scroll there, flash, fade.
  // The payments table mounts only after the job and its payments have loaded (seconds after Edit Job
  // opens from a deep link), so the scroll waits for the block to exist and the fade counts from then.
  useEffect(() => {
    if (!paymentsReceivedHighlight) return
    let tries = 0
    let fade: number | null = null
    const tick = window.setInterval(() => {
      const el = paymentsReceivedHighlightRef.current
      tries += 1
      if (el && el.getBoundingClientRect().height > 0) {
        window.clearInterval(tick)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        fade = window.setTimeout(() => setPaymentsReceivedHighlight(false), 4000)
      } else if (tries >= 150) {
        window.clearInterval(tick)
        setPaymentsReceivedHighlight(false)
      }
    }, 100)
    return () => {
      window.clearInterval(tick)
      if (fade !== null) window.clearTimeout(fade)
    }
  }, [paymentsReceivedHighlight])

  // v2.3819: the GC run's chips land on the status stepper (Edit) or the % done field (Bill) — scroll there once it has
  // a size (the Bill region is display-toggled, the job loads after the window opens), ring it, fade.
  useEffect(() => {
    if (!focusFieldFlash) return
    let tries = 0
    let fade: number | null = null
    const tick = window.setInterval(() => {
      const el = focusFieldRef.current
      tries += 1
      if (el && el.getBoundingClientRect().height > 0) {
        window.clearInterval(tick)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        fade = window.setTimeout(() => setFocusFieldFlash(null), 4500)
      } else if (tries >= 150) {
        window.clearInterval(tick)
        setFocusFieldFlash(null)
      }
    }, 100)
    return () => {
      window.clearInterval(tick)
      if (fade !== null) window.clearTimeout(fade)
    }
  }, [focusFieldFlash])

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

  // The invoice doors (the Job form map's order #6): every handler that writes an invoice or moves
  // the job to Ready to Bill, with its busy flag. The selection and the Bill-to editor stay here.
  const {
    creatingInvoice,
    movingJobToReadyToBill,
    creatingSegmentInvoice,
    billingStageFixtureId,
    billingFeeSeparatelyId,
    carvingByPayer,
    createInvoice,
    moveWorkingJobToReadyToBillFromEdit,
    createInvoiceFromSelectedSegments,
    billStageRow,
    carveInvoicesByPayer,
    billHazmatFeeSeparately,
  } = useJobFormInvoiceActions({
    editing,
    setEditing,
    authRole,
    payments,
    jobTotalWithRidersDollars,
    segmentCoverage,
    autosaveFixturesRef,
    setFixtures,
    flushBillingAutosave,
    newInvoiceAmount,
    setNewInvoiceAmount,
    setNewInvoiceAmountInputFocused,
    selectedSegmentIds,
    setSelectedSegmentIds,
    setBillToEditorInvoice,
    setError,
    onSavedRef,
    refreshHazmatIncidents,
    refreshEditingJobAndHydratePayments,
  })

  // Split by line (v2.3349): the plan of one draft per payer; `carveInvoicesByPayer` (the invoice actions hook) writes it.
  const payerCarvePlan = useMemo(
    () => (billToParty === 'split' ? planPayerCarves(fixtures, segmentCoverage) : []),
    [billToParty, fixtures, segmentCoverage],
  )
  const gcNameForPayerTags = useMemo(
    () => (gcCustomerId ? (customers.find((c) => c.id === gcCustomerId)?.name ?? editing?.gcCustomer?.name ?? '').trim() || null : null),
    [gcCustomerId, customers, editing?.gcCustomer?.name],
  )
  function addMaterialRow() {
    setMaterials((prev) => [...prev, { id: crypto.randomUUID(), description: '', amount: 0 }])
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, newEmptyPaymentRow()])
  }

  function updatePaymentRow(id: string, updates: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((r) => (r.id !== id ? r : mergePaymentRowUpdate(r, updates, editing))))
  }

  function removePaymentRow(id: string) {
    setPayments((prev) => paymentRowsAfterRemove(prev, id, editing, newEmptyPaymentRow))
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

  /**
   * "Make the Job Total $X" (v2.3265): the typed total (riders included, as
   * displayed) becomes a discount row of the difference. Reads the live rows
   * synchronously so the footer can say what happened.
   */
  function setJobTotalFromTyped(dollars: number): 'ok' | 'cleared' | 'unreachable' | 'locked' | 'invalid' {
    const rows = autosaveFixturesRef.current
    const locked = new Set(rows.filter((r) => isDiscountRow(r) && discountRowIsLocked(rows, r)).map((r) => r.id))
    const outcome = applyTargetJobTotal(rows, dollars - riderFeesDollars, crypto.randomUUID(), locked)
    if (outcome.kind === 'ok' || outcome.kind === 'cleared') setFixtures(outcome.rows as FixtureRow[])
    return outcome.kind
  }

  // Standing discount (v2.3272): the offer shows until it is applied or waved off on this job.
  const { standingOffer, applyStandingOffer, waiveStandingOffer } = useStandingDiscountOffer({
    customerId,
    editing: editing as { id: string; standing_discount_waived_at?: string | null } | null,
    fixtures,
    setFixtures,
  })

  /** Discount rows (v2.3252+): a typed row that reduces the work above it; the placeholder row is reused when it is the only, empty one. */
  function addDiscountRow() {
    setFixtures((prev) => {
      const row = newDiscountFixtureRow(crypto.randomUUID())
      const only = prev.length === 1 ? prev[0] : undefined
      if (only && !(only.name ?? '').trim() && only.line_unit_price == null && !isDiscountRow(only)) return [row]
      return [...prev, row]
    })
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
      // The new customer carries the job's master_user_id (edit) or the company owner account
      // (new) — one company since v2.2972; the column is provenance, no longer a wall.
      let customerMasterId: string | null = editing
        ? resolveEditJobMasterUserId({
            projectId,
            projectMasterUserId: projectId ? (projects.find((p) => p.id === projectId)?.master_user_id ?? null) : null,
            existingJobMasterUserId: editing.master_user_id,
          })
        : null
      if (!customerMasterId) {
        // One company (v2.2972): a new customer is stamped with the company owner account.
        customerMasterId = await resolveEffectiveJobMasterUserId(supabase, authUser.id, projectId || null)
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
      const bidBefore = bidId ? await readBidOutcomeForToast(bidId) : null

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
          bill_to_party:
            billToParty === 'gc' && !resolveGcCustomerIdForJobPayload(gcCustomerId, effectiveMasterId, customers) ? 'customer' : billToParty,
          bill_copy_other_party: billCopyOtherParty,
          show_bills_to_other_party: newJobShowOtherParty,
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
        await writeNewJobChildRows(supabase, { jobId, payments, materials, fixtures, teamMemberIds })
        onCreatedJobIdRef.current?.(jobId)
        // Tier-1 #8: a job's birth is unloggable in job_activity_events without a migration (no client
        // INSERT policy, no AFTER INSERT trigger on jobs_ledger) — record it as telemetry for now, and
        // tell the bid surfaces so the "J#### opened from this bid" chip appears without a reload.
        recordNavClick(authUser?.id, authRole, 'job_created', jobCreatedTelemetryTarget({ bidId, projectId }))
        if (bidId) window.dispatchEvent(new CustomEvent<JobCreatedFromBidDetail>(JOB_CREATED_FROM_BID_EVENT, { detail: { bidId, jobId } }))
        // v2.3302: the bid's estimate becomes the job's budget (Burn against the bid) — best effort, the job is already saved.
        if (bidId && carryBidBudget) {
          const { error: budgetErr } = await supabase.rpc('snapshot_job_budget_from_bid', { p_job_id: jobId, p_bid_id: bidId })
          if (budgetErr) showToast(`Job saved, but the bid's estimate could not be carried as its budget: ${budgetErr.message}`, 'info')
        }
        // v2.3143: the Dispatch "open the job" to-do for this bid is done — close it and tell the requester
        // (a role RLS keeps from updating leaves it for the inbox's own sweep).
        if (bidId) void closeOpenJobFromBidRequests({ bidId, hcpNumber: hcpNumber.trim(), userId: authUser?.id, role: authRole, elsewhere: false })
        if (bidId) announceDerivedBidOutcome(bidBefore, await readBidOutcomeForToast(bidId))
      }
      if (customerId && dateMet.trim()) {
        const c = customers.find((x) => x.id === customerId)
        if (c && !c.date_met) {
          // A typed date is a human call — stamp it manual so the clock-session
          // fill (v2.1696) never overwrites it.
          await supabase.from('customers').update({ date_met: dateMet.trim(), date_met_source: 'manual' }).eq('id', customerId)
        }
      }
      newJobSkipDiscardGuardRef.current = true
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
          onImportBlockedClick={(hint) => showToast(hint, 'info')}
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
          carryBidBudget={mode === 'new' ? carryBidBudget : undefined}
          onCarryBidBudgetChange={mode === 'new' ? setCarryBidBudget : undefined}
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
            clickNumberSuggesting={clickNumberSuggesting}
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
            <>
              {/* Stage Plan PR 4: the stages read-out sits above the job details. */}
              <JobFormStagesGroup
                plan={stagePlan}
                gcName={stagesGcName}
                sharesWithGc={editing.gc_shares_stage_dates === true}
                onToggleShared={(fixtureId, shared) => updateFixtureRow(fixtureId, { shared_with_gc: shared })}
                onSeeAsCustomer={() => setStagesDrawerOpen(true)}
                onGoToBill={onRequestRegion ? () => onRequestRegion('bill') : undefined}
              />
              {/* Tappable status strip (v2.1773): quick stage moves + the Collections
                  flag. v2.3238: it sits right under the Stages read-out, where the
                  job's state is read, instead of above the footer at the very bottom
                  of the Edit tab (Grace). This fragment renders in the Edit region only. */}
              <div ref={focusFieldFlash === 'status' ? focusFieldRef : undefined} data-job-form-focus={focusFieldFlash === 'status' ? 'status' : undefined} style={{ margin: '0 0 0.25rem', ...(focusFieldFlash === 'status' ? FOCUS_FIELD_RING : {}) }}>
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
              </div>
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
              setCustomerId={pickCustomerId}
              gcCustomerId={gcCustomerId}
              setGcCustomerId={pickGcCustomerId}
              billToParty={billToParty}
              setBillToParty={setBillToParty}
              billCopyOtherParty={billCopyOtherParty}
              setBillCopyOtherParty={setBillCopyOtherParty}
              jobId={editing?.id ?? null}
              showBillsToOtherParty={(editing as { show_bills_to_other_party?: boolean | null } | null)?.show_bills_to_other_party === true}
              onCustomerPatched={patchCustomerRow}
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
              onPropertyAdded={(row) => {
                // v2.3401: the job address saved as a property from the row — it joins the candidates and the job links to it (autosave carries customer_address_id).
                setPropertyCandidates((prev) => [...prev, row])
                setCustomerAddressId(row.id)
              }}
              onOwnerConfirmed={(row) => {
                // Owner of record (PR 2): Use on the row's Found box wrote the record (and jobs_ledger.customer_address_id on every job at the address); the candidate is refreshed and this job links to it.
                setPropertyCandidates((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [...prev, row]))
                setCustomerAddressId(row.id)
              }}
              gcCustomerName={gcNameForPayerTags}
              propertyCandidates={propertyCandidates}
              propertyRecordFocus={propertyRecordFocusInitial}
              focusRow={isJobFormFactRow(focusRowInitial) ? focusRowInitial : null}
              onPropertyKindSaved={(id, patch) => setPropertyCandidates((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
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
            </>
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
              <JobFormPeoplePicker users={users} teamMemberIds={teamMemberIds} setTeamMemberIds={setTeamMemberIds} onOverlayOpenChange={setPeoplePickerOverlayOpen} />
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1rem' }}>
            {/* Their Word PR 4: the payer's terms + record, above the customer rows in both modes. */}
            <CustomerTermsBar
              warning={customerTerms.warning}
              onEditTerms={
                (authRole === 'dev' || authRole === 'master_technician' || authRole === 'assistant' || authRole === 'controller') && termsPayerId
                  ? () => setTermsModalOpen(true)
                  : undefined
              }
            />
            {termsModalOpen && termsPayerId ? (
              <CustomerTermsModal
                customerId={termsPayerId}
                customerName={customers.find((c) => c.id === termsPayerId)?.name ?? customerName ?? 'Customer'}
                record={customerTerms.record}
                onClose={() => setTermsModalOpen(false)}
                onSaved={() => setTermsRefresh((n) => n + 1)}
              />
            ) : null}
            {!editing ? (
              <JobFormCustomerSection
              jobId={initialJob?.id ?? null}
                expanded={customerExpanded}
                setExpanded={setCustomerExpanded}
                customerId={customerId}
                setCustomerId={pickCustomerId}
                billToParty={billToParty}
                setBillToParty={setBillToParty}
                gcCustomerId={gcCustomerId}
                setGcCustomerId={pickGcCustomerId}
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
                setCustomerId={pickCustomerId}
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
            addDiscountRow={addDiscountRow}
            onSetJobTotal={setJobTotalFromTyped}
            standingOffer={standingOffer}
            standingOfferCustomerName={customerName}
            onApplyStandingOffer={applyStandingOffer}
            onWaiveStandingOffer={waiveStandingOffer}
            removeFixtureRow={removeFixtureRow}
            moveFixtureRow={moveFixtureRowInList}
            invoiceStatusById={fixtureInvoiceStatusById}
            onOpenSegmentGenerator={() => setSegmentGeneratorOpen(true)}
            onOpenStripeFixturePreview={() => setStripeFixturePreviewOpen(true)}
            jobTotalDollars={jobTotalBidDollars}
            plan={stagePlan}
            payerTags={billToParty === 'split' ? { customerName: customerName.trim() || null, gcName: gcNameForPayerTags } : null}
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
            <div ref={focusFieldFlash === 'pct' ? focusFieldRef : undefined} data-job-form-focus={focusFieldFlash === 'pct' ? 'pct' : undefined} style={focusFieldFlash === 'pct' ? FOCUS_FIELD_RING : undefined}>
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
          </div>
          {/* Job-account note (v2.3257): job window only — the standalone New
              Job form has no job yet. Renders nothing without a packet on record. */}
          {embedded && editing?.id ? (
            <div style={{ marginBottom: '1rem' }}>
              <JobFormBillJobAccountNote
                jobId={editing.id}
                enabled={authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)}
                supplyInvoiceLines={supplyInvoiceLines}
                onOpenCosts={onRequestRegion ? () => onRequestRegion('costs') : null}
              />
            </div>
          ) : null}
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
                plan={stagePlan}
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
                payerCarves={
                  billToParty === 'split'
                    ? payerCarvePlan.map((c) => ({
                        party: c.party,
                        label: c.party === 'gc' ? gcNameForPayerTags ?? 'GC' : customerName.trim() || 'Customer',
                        count: c.count,
                        netDollars: c.netDollars,
                      }))
                    : null
                }
                onCarveByPayer={() => void carveInvoicesByPayer()}
                carvingByPayer={carvingByPayer}
              />
              <JobFormUpcomingDraws
                plan={stagePlan}
                onBillRow={(id) => void billStageRow(id)}
                billingFixtureId={billingStageFixtureId}
                disabled={creatingSegmentInvoice}
              />
              <JobFormInvoiceList
                editing={editing}
                onOverlayOpenChange={setInvoiceListOverlayOpen}
                payments={payments}
                drawLabelByInvoiceId={drawLabelByInvoiceId}
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
                onAddDiscountLine={() => {
                  addDiscountRow()
                  setFixturesSectionHighlight(true)
                }}
                onFixturesChangedOutside={rehydrateFixturesFromDb}
                onRecordPayment={(inv) => setRecordPaymentTarget({ inv, amount: null, draftRowId: null })}
                nestedOverlayZIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
              />
            </>
          )}
            <div
              ref={paymentsReceivedHighlightRef}
              data-testid="job-form-payments-received"
              style={paymentsReceivedHighlight ? { borderRadius: 8, padding: '0 0.75rem', background: 'var(--bg-blue-tint)', border: '2px solid #93c5fd' } : undefined}
            >
            <JobFormPaymentsTable
              editing={editing}
              payments={payments}
              persistedLedgerPaymentIds={persistedLedgerPaymentIds}
              unlinkingMercuryPaymentId={unlinkingMercuryPaymentId}
              updatePaymentRow={updatePaymentRow}
              addPaymentRow={addPaymentRow}
              requestRemovePaymentRow={requestRemovePaymentRow}
              requestMovePaymentRow={setPaymentMoveRow}
              setUnlinkMercuryConfirmRowId={setUnlinkMercuryConfirmRowId}
              setBillViewInvoice={setBillViewInvoice}
              onRecordPaymentOnBill={(inv, o) => setRecordPaymentTarget({ inv, amount: o.amount, draftRowId: o.draftRowId })}
              requestUndoPartPayment={(row) => setUndoPartPaymentRow(row)}
            />
            </div>
            {undoPartPaymentRow && editing ? (
              <UndoStripePartPaymentModal
                payment={undoPartPaymentRow}
                invoice={(editing.invoices ?? []).find((i) => i.id === undoPartPaymentRow.invoice_id) ?? null}
                stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
                zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
                onClose={() => setUndoPartPaymentRow(null)}
                onSuccess={async () => {
                  setUndoPartPaymentRow(null)
                  const found = await fetchJobWithDetailsById(editing.id)
                  if (found) {
                    setEditing(found)
                    setPayments(paymentRowsFromJob(found))
                    hydratedPaymentIdsRef.current = (found.payments ?? []).map((p) => p.id)
                  }
                  showToast('Part payment undone. The pay link asks for the full remainder again.', 'success')
                  onSavedRef.current?.()
                }}
              />
            ) : null}
            {recordPaymentTarget && editing ? (
              <BilledPaymentConfirmationModal
                mode="invoice"
                invoice={{
                  ...recordPaymentTarget.inv,
                  job: {
                    id: editing.id,
                    hcp_number: editing.hcp_number,
                    click_number: editing.click_number,
                    job_name: editing.job_name,
                    revenue: editing.revenue,
                    payments_made: editing.payments_made,
                  },
                }}
                payments={payments}
                job={null}
                initialAmount={recordPaymentTarget.amount}
                stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
                billedYmd={recordPaymentTarget.inv.billed_at ? String(recordPaymentTarget.inv.billed_at).slice(0, 10) : null}
                zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX}
                onClose={() => setRecordPaymentTarget(null)}
                onSuccess={async () => {
                  const draftRowId = recordPaymentTarget.draftRowId
                  setRecordPaymentTarget(null)
                  await finishRecordPaymentOnBill(draftRowId)
                }}
              />
            ) : null}
            <JobPaymentMoveModal
              open={paymentMoveRow != null}
              payment={paymentMoveRow}
              fromJob={editing}
              onClose={() => setPaymentMoveRow(null)}
              onMoved={() => {
                void (async () => {
                  if (!editing) return
                  const found = await fetchJobWithDetailsById(editing.id)
                  if (found) {
                    setEditing(found)
                    setPayments(paymentRowsFromJob(found))
                  }
                  onSavedRef.current?.()
                })()
              }}
            />
          </div>
          </div>
          {/* COSTS region — money out: the Cost Timeline, the Team / Sub Labor
              lines, and the parts accordions. Its own window tab (owner call);
              the standalone form still shows it after Bill. */}
          <div style={{ display: !embedded || embeddedRegion === 'costs' ? 'flex' : 'none', flexDirection: 'column', gap: '0.75rem' }}>
          <JobFormLaborCostPanel editing={editing} editJobTeamLaborRow={editJobTeamLaborRow} />
          <JobFormPartsCostSection
            editing={editing}
            hideTitle={!!editing?.id}
            teamLabor={{ loading: editJobTeamLaborLoading, error: editJobTeamLaborError, row: editJobTeamLaborRow, showOpenLink: showTeamLaborOpenOnJobsLink }}
            subLabor={{ loading: editJobSubLaborLoading, error: editJobSubLaborError, data: editJobSubLaborData, effectiveHcp: editJobEffectiveHcp, showOpenLink: showSubLaborOpenOnJobsLink }}
            onClose={onClose}
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
        <JobFormFooter
          editing={!!editing}
          narrowViewport={narrowViewport}
          embedded={embedded}
          showDelete={jobFormFooterShowsDelete({ editing: !!editing, role: authRole, embedded, embeddedRegion })}
          deleting={deletingId === editing?.id}
          migratingJob={migratingJob}
          closeFlushState={closeFlushState}
          editAutosaveAggregate={editAutosaveAggregate}
          undoAvailable={undoAvailable}
          undoConfirmOpen={undoConfirmOpen}
          jobFormCanSubmit={jobFormCanSubmit}
          jobFormMissingFields={jobFormMissingFields}
          saving={saving}
          onClose={() => void closeForm()}
          onKeepEditing={() => setCloseFlushState('idle')}
          onCloseWithoutSaving={closeFormWithoutSaving}
          onDelete={() => setDeleteJobConfirmOpen(true)}
          onUndo={performUndo}
          onUndoConfirmOpenChange={setUndoConfirmOpen}
          onCreateJob={() => void createJob()}
        />
      </div>
      <JobFormPaymentRemoveConfirm open={paymentRemoveConfirmRowId != null} preview={paymentRemovePreview} confirmsPersistedRpc={paymentRemoveConfirmsPersistedRpc} busy={paymentRemoveRpcBusy} onCancel={() => setPaymentRemoveConfirmRowId(null)} onConfirm={() => void confirmRemovePaymentRow()} zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX} />
      <JobFormStripeLinePreviewDialog open={stripeFixturePreviewOpen} rows={stripeFixturePreviewRows} onClose={closeStripeFixturePreview} zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX} />
      <JobFormMercuryUnlinkConfirm rowId={unlinkMercuryConfirmRowId} payments={payments} editing={editing} busyRowId={unlinkingMercuryPaymentId} onCancel={() => setUnlinkMercuryConfirmRowId(null)} onConfirm={confirmUnlinkMercuryFromBankRow} zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX} />
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
              pickGcCustomerId((prev) => prev ?? opt.customer_id)
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
          bidOutcome={winningGcPick.bidOutcome}
          onPick={(opt) => void handleWinningGcPick(opt)}
          onCancel={() => {
            const closeTheForm = winningGcPick.closeOnCancel
            setWinningGcPick(null)
            cancelBidImport(closeTheForm, 'Import cancelled — nothing was filled in, and the bid is unchanged.')
          }}
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
      {editing ? (
        <JobFormStagesDrawer
          open={stagesDrawerOpen}
          onClose={() => setStagesDrawerOpen(false)}
          plan={stagePlan}
          gcName={stagesGcName}
          jobLabel={`#${(editing.hcp_number ?? '').trim() || (editing.click_number ?? '').trim() || '—'}${editing.job_address?.trim() ? ` · ${editing.job_address.trim()}` : ''}`}
          jobAddress={null}
          portalUrl={stagesGcLink?.url ?? portalTokenUrl(window.location.origin, 'sample-gc')}
          portalIsSample={!stagesGcLink}
          gcCustomerId={gcCustomerId}
          onLinkMinted={stagesGcLinks.refresh}
          zIndex={JOB_FORM_NESTED_OVERLAY_Z_INDEX + 1}
        />
      ) : null}
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
