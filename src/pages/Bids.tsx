import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fromDatetimeLocal } from '../utils/datetimeLocal'
import {
  buildOutcomeChangeBidNoteBody,
  normalizedOutcomePayload,
  resolveActorDisplayName,
} from '../lib/outcomeChangeBidNote'
import { upsertBidNotesReadWatermark } from '../lib/userBidNotesReadState'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useAuth } from '../hooks/useAuth'
import { useWorkingBoardInboxCount } from '../hooks/useWorkingBoardInboxCount'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useBidPricingEngine } from '../hooks/useBidPricingEngine'
import { useBidPricingRows } from '../hooks/useBidPricingRows'
import { useToastContext } from '../contexts/ToastContext'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import {
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../lib/ledgerDisplayPrefixes'
import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { OPEN_BID_EDIT_QUERY, useBidPreview } from '../contexts/BidPreviewModalContext'
import { submissionFollowupBidShareUrl } from '../lib/submissionFollowupBidShareUrl'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { BidsWorkingBoard } from '../components/bids/BidsWorkingBoard'
import { ModalShell } from '../components/bids/ModalShell'
import { BidPartyDetailModal } from '../components/bids/BidPartyDetailModal'
import { BidFormModal, type BidServiceTypeSwitchSibling } from '../components/bids/BidFormModal'
import { BidsEstimatorsTab } from '../components/bids/BidsEstimatorsTab'
import { Database } from '../types/database'
import type { BidWithBuilder, EstimatorUser } from '../types/bidWithBuilder'
import type { BidDateSentAttestationPayload } from '../types/bidDateSentAttestation'
import { bidAttestationDisplayName, normalizeBidDateInput } from '../lib/bidDateSentDisplay'
import { BidsBidBoardTab } from '../components/bids/BidsBidBoardTab'
import { BidRfiTab } from '../components/bids/BidRfiTab'
import { BidSubmissionFollowupTab } from '../components/bids/BidSubmissionFollowupTab'
import { BidsBidCostsTab } from '../components/bids/BidsBidCostsTab'
import { BidsCountsTab } from '../components/bids/BidsCountsTab'
import { BidsLaborTab } from '../components/bids/BidsLaborTab'
import { BidsPricingTab } from '../components/bids/BidsPricingTab'
import { BidsCoverLetterTab } from '../components/bids/BidsCoverLetterTab'
import { BidsTakeoffTab } from '../components/bids/BidsTakeoffTab'
import { BidVersionPicker } from '../components/bids/BidVersionPicker'
import { downloadApprovalPdf as downloadApprovalPdfDoc } from '../lib/bidDocuments/approvalPdf'
import { WorkingBoardArchiveConfirmDialog } from '../components/bids/WorkingBoardArchiveConfirmDialog'
import { BidsBuilderReviewTab } from '../components/bids/BidsBuilderReviewTab'
import { BidChangeOrderTab } from '../components/bids/BidChangeOrderTab'
import { BidLienReleaseTab } from '../components/bids/BidLienReleaseTab'
import {
  DEFAULT_TERMS_AND_WARRANTY,
  DEFAULT_EXCLUSIONS,
} from '../lib/bidDocuments/coverLetter'
import {
  bidEligibleForWorkingBoardArchive,
  canUserArchiveBidOnWorkingBoard,
  isBidEligibleForWorkingBoard,
} from '../lib/workingBoardArchiveEligibility'
import type { Bid } from '../types/bids'
import {
  bidDisplayName,
  getCustomerDisplay,
} from '../lib/bids/bidFormatting'
import { tabStyle, bidsTabStyle } from '../lib/bids/bidStyles'
import { extractContactInfo } from '../lib/bids/bidContactInfo'
import { useBidEditForm } from '../lib/bids/useBidEditForm'

type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type Customer = Database['public']['Tables']['customers']['Row']
type CustomerContact = Database['public']['Tables']['customer_contacts']['Row']
type CustomerContactPerson = Database['public']['Tables']['customer_contact_persons']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

const BID_DATE_SENT_ATTESTATION_NULLS: Record<
  | 'bid_date_sent_attested_at'
  | 'bid_date_sent_attested_by'
  | 'bid_date_sent_ack_email_at'
  | 'bid_date_sent_ack_email_by'
  | 'bid_date_sent_ack_phone_at'
  | 'bid_date_sent_ack_phone_by'
  | 'bid_date_sent_ack_honesty_at'
  | 'bid_date_sent_ack_honesty_by',
  null
> = {
  bid_date_sent_attested_at: null,
  bid_date_sent_attested_by: null,
  bid_date_sent_ack_email_at: null,
  bid_date_sent_ack_email_by: null,
  bid_date_sent_ack_phone_at: null,
  bid_date_sent_ack_phone_by: null,
  bid_date_sent_ack_honesty_at: null,
  bid_date_sent_ack_honesty_by: null,
}

interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}


type EvaluateChecklistItem = {
  id: string
  title: string
  body: string[]
}

const evaluateChecklist: EvaluateChecklistItem[] = [
  {
    id: 'location',
    title: 'LOCATION',
    body: [
      'Is the bid date feasible to produce a thorough and complete proposal?',
      'If not, is the potential reward for taking on the risk objectively worth it when our project expects or start? Will present signed from providing our best work on projects we associate with?',
      '(costs associated with traveling and supervision)',
    ],
  },
  {
    id: 'payment_terms',
    title: 'PAYMENT TERMS',
    body: [
      "Are we comfortable with the payment terms? Is this a client we've worked with before?",
      'If not, are the payment terms outlined clearly in the front end docs?',
      "Do we know we're getting paid?",
    ],
  },
  {
    id: 'bid_documents',
    title: 'BID DOCUMENTS',
    body: [
      'Are the available bid documents adequate to have a clear understanding of scope?',
      'Is there a clear procedure for submitting and answering questions?',
      'Is there a substantial amount of information missing where we would be forced to assume / qualify the bid?',
    ],
  },
  {
    id: 'competition',
    title: 'COMPETITION',
    body: [
      'Do we know the other bidders on this project?',
      'Are they familiar competitors? Are any bidders we know from previous projects where bidding against them could be difficult?',
      'Are they likely to self-perform some or all of the labor that we may be sub-contracting?',
    ],
  },
  {
    id: 'strengths',
    title: 'STRENGTHS',
    body: [
      'Does this project play to our strengths?',
      'Are we able to self-perform the work to give ourselves an advantage?',
      'Do we have specific subcontractors that we know will bid to us, with better pricing on significant scope items?',
    ],
  },
]

export default function Bids() {
  const { user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const newCustomerModal = useNewCustomerModal()
  const bidPreview = useBidPreview()
  const ledgerPrefixMap = useLedgerPrefixMap()
  const checklistAddModal = useChecklistAddModal()
  const editCustomerModal = useEditCustomerModal()
  const location = useLocation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const narrowViewport640 = useNarrowViewport640()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'bid-board' | 'builder-review' | 'working' | 'bid-costs' | 'estimators' | 'counts' | 'takeoffs' | 'labor' | 'pricing' | 'cover-letter' | 'submission-followup' | 'rfi' | 'change-order' | 'lien-release'>('bid-board')
  
  // Service Types state
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  const [estimatorServiceTypeIds, setEstimatorServiceTypeIds] = useState<string[] | null>(null)
  const [primaryServiceTypeIds, setPrimaryServiceTypeIds] = useState<string[] | null>(null)
  const [superintendentServiceTypeIds, setSuperintendentServiceTypeIds] = useState<string[] | null>(null)
  const [fixtureTypes, setFixtureTypes] = useState<Array<{ id: string; name: string }>>([])
  
  // Helper function to find fixture_type_id by name
  const getFixtureTypeIdByName = (name: string): string | null => {
    const normalized = name.trim().toLowerCase()
    const match = fixtureTypes.find(ft => ft.name.toLowerCase() === normalized)
    return match?.id || null
  }

  // Helper function to get or auto-create fixture type. Returns { id, error } so callers can surface the real error.
  // serviceTypeIdOverride: when opening from a bid's Pricing tab, use the bid's service_type_id for robustness.
  async function getOrCreateFixtureTypeId(name: string, serviceTypeIdOverride?: string): Promise<{ id: string } | { id: null; error?: string }> {
    const trimmedName = name.trim()
    if (!trimmedName) return { id: null }
    const serviceTypeId = serviceTypeIdOverride ?? selectedServiceTypeId
    if (!serviceTypeId) {
      return { id: null, error: 'No service type selected. Please select Plumbing, Electrical, or HVAC.' }
    }
    // Check if it already exists (case-insensitive match)
    const existingId = getFixtureTypeIdByName(trimmedName)
    if (existingId) return { id: existingId }
    // Auto-create new fixture type
    const maxSeqResult = await supabase
      .from('fixture_types')
      .select('sequence_order')
      .eq('service_type_id', serviceTypeId)
      .order('sequence_order', { ascending: false })
      .limit(1)
      .single()
    
    const nextSeq = (maxSeqResult.data?.sequence_order ?? 0) + 1
    
    const { data, error } = await supabase
      .from('fixture_types')
      .insert({
        service_type_id: serviceTypeId,
        name: trimmedName,
        category: 'Other',
        sequence_order: nextSeq
      })
      .select('id')
      .single()
    
    if (error || !data) {
      return { id: null, error: error?.message ?? 'Failed to create fixture type' }
    }
    
    // Reload fixture types to update autocomplete suggestions
    await loadFixtureTypes()
    
    return { id: data.id }
  }

  const [bids, setBids] = useState<BidWithBuilder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lastContactFromEntries, setLastContactFromEntries] = useState<Record<string, string>>({})
  const [customerContacts, setCustomerContacts] = useState<CustomerContact[]>([])
  const [customerContactPersons, setCustomerContactPersons] = useState<CustomerContactPerson[]>([])

  // Bid Board
  const [bidFormOpen, setBidFormOpen] = useState(false)
  const [pendingBidFormFocus, setPendingBidFormFocus] = useState<'projectName' | 'gcBuilder' | 'bidValue' | null>(null)
  const [editingBid, setEditingBid] = useState<BidWithBuilder | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [viewingGcBuilder, setViewingGcBuilder] = useState<GcBuilder | null>(null)
  const [savingBid, setSavingBid] = useState(false)
  const [deleteConfirmProjectName, setDeleteConfirmProjectName] = useState('')
  const [deletingBid, setDeletingBid] = useState(false)
  const [deleteBidModalOpen, setDeleteBidModalOpen] = useState(false)
  const [gcCustomerDropdownOpen, setGcCustomerDropdownOpen] = useState(false)
  const [evaluateModalOpen, setEvaluateModalOpen] = useState(false)
  const [evaluateChecked, setEvaluateChecked] = useState<{ [key: string]: boolean }>({})
  const [showSentBidScript, setShowSentBidScript] = useState(false)
  const [showBidQuestionScript, setShowBidQuestionScript] = useState(false)
  const [bidServiceTypeSwitchSiblings, setBidServiceTypeSwitchSiblings] = useState<
    Record<string, BidServiceTypeSwitchSibling[]>
  >({})

  const [estimatorUsers, setEstimatorUsers] = useState<EstimatorUser[]>([])
  // "Only my bids" filter (shared across the workflow tab list views): bids the
  // current user is the account manager or estimator for.
  const [onlyMyBids, setOnlyMyBids] = useState(false)
  const isMyBid = useCallback(
    (bid: BidWithBuilder) =>
      !!authUser?.id && (bid.account_manager_id === authUser.id || bid.estimator_id === authUser.id),
    [authUser?.id],
  )
  const [bidDateSent, setBidDateSent] = useState('')
  const savedBidDateSentRef = useRef('')
  const [bidSentAttestModalOpen, setBidSentAttestModalOpen] = useState(false)
  const [pendingBidDateSentForModal, setPendingBidDateSentForModal] = useState('')
  const [bidSentAckEmail, setBidSentAckEmail] = useState(false)
  const [bidSentAckPhone, setBidSentAckPhone] = useState(false)
  const [bidSentAckHonesty, setBidSentAckHonesty] = useState(false)
  const [bidSentAckEmailAt, setBidSentAckEmailAt] = useState<string | null>(null)
  const [bidSentAckPhoneAt, setBidSentAckPhoneAt] = useState<string | null>(null)
  const [bidSentAckHonestyAt, setBidSentAckHonestyAt] = useState<string | null>(null)
  const [pendingBidDateSentAttestation, setPendingBidDateSentAttestation] =
    useState<BidDateSentAttestationPayload | null>(null)
  const [pendingAttestationForDate, setPendingAttestationForDate] = useState<string | null>(null)
  const [bidSentAttestFollowupNoteDraft, setBidSentAttestFollowupNoteDraft] = useState('')
  const [pendingBidSentFollowupSubmissionNote, setPendingBidSentFollowupSubmissionNote] = useState<string | null>(null)

  const bidForm = useBidEditForm()
  const {
    driveLink,
    plansLink,
    countToolingPlansLink,
    bidSubmissionLink,
    projectName,
    bidNumber,
    address,
    gcContactName,
    gcContactPhone,
    gcContactEmail,
    estimatorId,
    accountManagerId,
    formServiceTypeId,
    bidDueDate,
    estimatedJobStartDate,
    designDrawingPlanDate,
    planPages,
    submittedTo,
    outcome,
    lossReason,
    bidValue,
    agreedValue,
    profit,
    distanceFromOffice,
    lastContact,
    notes,
    gcCustomerId,
  } = bidForm.values
  const [notesModalBid, setNotesModalBid] = useState<BidWithBuilder | null>(null)
  const [notesModalText, setNotesModalText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Counts tab (selection stays in parent for cross-tab sync via setSharedBid; tab-local
  // UI state + handlers live in BidsCountsTab)
  const [selectedBidForCounts, setSelectedBidForCounts] = useState<BidWithBuilder | null>(null)

  // Submission & Followup tab (selection + section/scroll state stay in parent for cross-tab
  // sync and URL deep-linking; tab-local UI state lives in BidSubmissionFollowupTab)
  const [selectedBidForSubmission, setSelectedBidForSubmission] = useState<BidWithBuilder | null>(null)

  // RFI tab (selection stays in parent for cross-tab sync via setSharedBid; form/search state lives in BidRfiTab)
  const [selectedBidForRfi, setSelectedBidForRfi] = useState<BidWithBuilder | null>(null)

  // Change Order tab (selection stays in parent for cross-tab sync via setSharedBid; form/search state lives in BidChangeOrderTab)
  const [selectedBidForChangeOrder, setSelectedBidForChangeOrder] = useState<BidWithBuilder | null>(null)

  // Lien Release tab (selection stays in parent for cross-tab sync via setSharedBid; form/search/collapse state lives in BidLienReleaseTab)
  const [selectedBidForLienRelease, setSelectedBidForLienRelease] = useState<BidWithBuilder | null>(null)

  const submissionSummaryCardRef = useRef<HTMLDivElement>(null)
  const openBidEditHandledRef = useRef<string | null>(null)
  const contactTableRef = useRef<HTMLDivElement | null>(null)
  const [scrollToContactFromBidBoard, setScrollToContactFromBidBoard] = useState(false)
  const [scrollToLaborDirectCosts, setScrollToLaborDirectCosts] = useState(false)
  const [submissionSectionOpen, setSubmissionSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [bidBoardSectionOpen, setBidBoardSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [lostSummaryModalOpen, setLostSummaryModalOpen] = useState(false)
  const [lostSummaryInitialStaffTab, setLostSummaryInitialStaffTab] = useState<string | null>(null)
  const [bidBoardDeepLinkHighlightId, setBidBoardDeepLinkHighlightId] = useState<string | null>(null)
  const [bidBoardDeepLinkHighlightGen, setBidBoardDeepLinkHighlightGen] = useState(0)
  const bidBoardDeepLinkTimeoutRef = useRef<number | null>(null)
  const bidBoardPendingScrollBidIdRef = useRef<string | null>(null)
  const submissionFollowupPendingDeepLinkBidIdRef = useRef<string | null>(null)

  const canAddChecklistFromSubmission = useMemo(
    () =>
      myRole === 'dev' ||
      myRole === 'master_technician' ||
      myRole === 'assistant' ||
      myRole === 'primary' ||
      myRole === 'estimator',
    [myRole],
  )

  const showLostModalLabor = useMemo(
    () => myRole === 'dev' || myRole === 'master_technician',
    [myRole],
  )

  const closeLostSummaryModal = useCallback(() => {
    setLostSummaryModalOpen(false)
    setLostSummaryInitialStaffTab(null)
  }, [])

  const openSubmissionFollowupChecklistTask = useCallback(() => {
    const bid = selectedBidForSubmission
    if (!bid?.id || !checklistAddModal || !authUser?.id) return
    const url = submissionFollowupBidShareUrl(bid.id)
    const num = bid.bid_number?.trim()
    const title = num
      ? `Submission follow-up {{1:${formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, ledgerPrefixMap), num)}}}`
      : `Submission follow-up ${bidDisplayName(bid).trim() || 'Bid'} [1]`
    checklistAddModal.openAddModal({ preset: { title, links: [url] } })
  }, [selectedBidForSubmission, checklistAddModal, authUser?.id, ledgerPrefixMap])

  const applyBidBoardDeepLinkToBid = useCallback((bid: BidWithBuilder) => {
    bidBoardPendingScrollBidIdRef.current = null
    setActiveTab('bid-board')
    const sectionKey =
      bid.outcome === 'won'
        ? ('won' as const)
        : bid.outcome === 'started_or_complete'
          ? ('startedOrComplete' as const)
          : bid.outcome === 'lost'
            ? ('lost' as const)
            : !bid.bid_date_sent
              ? ('unsent' as const)
              : ('pending' as const)
    setBidBoardSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
    setBidBoardDeepLinkHighlightGen((g) => g + 1)
    if (bidBoardDeepLinkTimeoutRef.current) {
      clearTimeout(bidBoardDeepLinkTimeoutRef.current)
      bidBoardDeepLinkTimeoutRef.current = null
    }
    setBidBoardDeepLinkHighlightId(bid.id)
    bidBoardDeepLinkTimeoutRef.current = window.setTimeout(() => {
      setBidBoardDeepLinkHighlightId(null)
      bidBoardDeepLinkTimeoutRef.current = null
    }, 2500)
    window.setTimeout(() => {
      document.getElementById(`bid-board-row-${bid.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }, [])

  const applySubmissionFollowupDeepLinkToBid = useCallback((bid: BidWithBuilder) => {
    submissionFollowupPendingDeepLinkBidIdRef.current = null
    setSelectedBidForSubmission(bid)
    setActiveTab('submission-followup')
    const sectionKey =
      bid.outcome === 'won'
        ? ('won' as const)
        : bid.outcome === 'started_or_complete'
          ? ('startedOrComplete' as const)
          : bid.outcome === 'lost'
            ? ('lost' as const)
            : !bid.bid_date_sent
              ? ('unsent' as const)
              : ('pending' as const)
    setSubmissionSectionOpen((prev) => ({ ...prev, [sectionKey]: true }))
    setTimeout(() => {
      submissionSummaryCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }, [])

  const [builderReviewDeepLinkHighlightCustomerId, setBuilderReviewDeepLinkHighlightCustomerId] = useState<string | null>(null)
  const [builderReviewDeepLinkHighlightGen, setBuilderReviewDeepLinkHighlightGen] = useState(0)
  const builderReviewDeepLinkTimeoutRef = useRef<number | null>(null)
  const builderReviewPendingDeepLinkBidIdRef = useRef<string | null>(null)
  const builderReviewDeepLinkAppliedBidIdRef = useRef<string | null>(null)

  const applyBuilderReviewDeepLinkFromBid = useCallback(
    (bid: BidWithBuilder) => {
      builderReviewPendingDeepLinkBidIdRef.current = null
      setActiveTab('builder-review')
      if (builderReviewDeepLinkAppliedBidIdRef.current === bid.id) {
        return
      }
      if (!bid.customer_id) {
        showToast('This bid is not linked to a customer. Builder Review lists customers.', 'info')
        return
      }
      const customerId = bid.customer_id
      // The search-clear, card-expand, and scroll-into-view are handled by
      // BidsBuilderReviewTab's effect keyed on the highlight gen/customer props.
      setBuilderReviewDeepLinkHighlightGen((g) => g + 1)
      if (builderReviewDeepLinkTimeoutRef.current) {
        clearTimeout(builderReviewDeepLinkTimeoutRef.current)
        builderReviewDeepLinkTimeoutRef.current = null
      }
      setBuilderReviewDeepLinkHighlightCustomerId(customerId)
      builderReviewDeepLinkTimeoutRef.current = window.setTimeout(() => {
        setBuilderReviewDeepLinkHighlightCustomerId(null)
        builderReviewDeepLinkTimeoutRef.current = null
      }, 2500)
      builderReviewDeepLinkAppliedBidIdRef.current = bid.id
    },
    [showToast]
  )

  const [workingBoardDeepLinkBidId, setWorkingBoardDeepLinkBidId] = useState<string | null>(null)
  const [archiveWorkingBoardBusyBidId, setArchiveWorkingBoardBusyBidId] = useState<string | null>(null)
  const [workingBoardArchiveConfirmBidId, setWorkingBoardArchiveConfirmBidId] = useState<string | null>(null)
  const [workingBoardArchiveConfirmLabel, setWorkingBoardArchiveConfirmLabel] = useState<string | null>(null)
  const closeWorkingBoardArchiveConfirm = useCallback(() => {
    setWorkingBoardArchiveConfirmBidId(null)
    setWorkingBoardArchiveConfirmLabel(null)
  }, [])
  const workingBoardPendingDeepLinkBidIdRef = useRef<string | null>(null)
  const workingDeepLinkAppliedBidIdRef = useRef<string | null>(null)
  const onWorkingBoardDeepLinkHandled = useCallback(() => {
    setWorkingBoardDeepLinkBidId(null)
  }, [])

  const [, setTick] = useState(0)

  // Takeoffs tab
  const [selectedBidForTakeoff, setSelectedBidForTakeoff] = useState<BidWithBuilder | null>(null)
  
  
  
  // Part Form Modal state




  // Add Parts to Template Modal state

  // Part Prices modal (check/modify prices from Add Assembly / Edit Assembly item rows)

  // Edit Template Modal state

  // Labor tab (selection + shared PO review modal + shared tax/distance stay parent-owned; rest moved to BidsLaborTab)
  const [selectedBidForCostEstimate, setSelectedBidForCostEstimate] = useState<BidWithBuilder | null>(null)
  const [costEstimatePOModalTaxPercent, setCostEstimatePOModalTaxPercent] = useState('8.25')
  const [costEstimateDistanceInput, setCostEstimateDistanceInput] = useState('')

  // Pricing tab
  const [selectedBidForPricing, setSelectedBidForPricing] = useState<BidWithBuilder | null>(null)

  const {
    countRows, setCountRows, skipNextLoadCountRowsRef,
    takeoffCountRows,
    takeoffMappings, setTakeoffMappings,
    takeoffRoughPartLines, setTakeoffRoughPartLines,
    takeoffRoughCatalogLowestByPartId, setTakeoffRoughCatalogLowestByPartId,
    materialsModelSwitchModal, setMaterialsModelSwitchModal,
    materialsModelBusy,
    materialTemplates,
    draftPOs,
    takeoffBookVersions,
    takeoffBookEntries, setTakeoffBookEntries,
    selectedTakeoffBookVersionId, setSelectedTakeoffBookVersionId,
    takeoffBookEntriesVersionId, setTakeoffBookEntriesVersionId,
    costEstimate, setCostEstimate,
    costEstimateLaborRows, setCostEstimateLaborRows,
    costEstimateCountRows, setCostEstimateCountRows,
    purchaseOrdersForCostEstimate,
    costEstimateMaterialTotalRoughIn,
    costEstimateMaterialTotalTopOut,
    costEstimateMaterialTotalTrimSet,
    laborRateInput, setLaborRateInput,
    drivingCostRate, setDrivingCostRate,
    hoursPerTrip, setHoursPerTrip,
    laborBookVersions,
    laborBookEntries, setLaborBookEntries,
    selectedLaborBookVersionId, setSelectedLaborBookVersionId,
    laborBookEntriesVersionId, setLaborBookEntriesVersionId,
    costEstimateBidIdRef,
    estimatorCostUseFlat, setEstimatorCostUseFlat,
    estimatorCostPerCount, setEstimatorCostPerCount,
    estimatorCostFlatAmount, setEstimatorCostFlatAmount,
    travelPeople, setTravelPeople,
    travelNights, setTravelNights,
    travelMealsRate, setTravelMealsRate,
    travelHotelRate, setTravelHotelRate,
    costEstimateEquipmentRows, setCostEstimateEquipmentRows,
    pricingEquipmentRows,
    costEstimatePermitRows, setCostEstimatePermitRows,
    pricingPermitRows,
    costEstimateSubcontractorRows, setCostEstimateSubcontractorRows,
    pricingSubcontractorRows,
    costEstimateWasteRows, setCostEstimateWasteRows,
    pricingWasteRows,
    costEstimateOtherRows, setCostEstimateOtherRows,
    pricingOtherRows,
    teamLaborDataForBids,
    priceBookVersions,
    templatePriceBookVersions, templatesMode, setTemplatesMode,
    defaultPriceBookTemplateId, rememberLastPriceBookTemplate,
    priceBookEntries, setPriceBookEntries,
    bidPricingAssignments,
    bidCountRowCustomPrices,
    bidCountRowSubmissionHides,
    bidVersions, selectedBidVersionId, switchActiveVersion,
    selectedPricingVersionId, setSelectedPricingVersionId,
    pricingCountRows,
    pricingCostEstimate,
    pricingLaborRows,
    pricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    pricingLaborRate,
    pricingFixtureMaterialsFromTakeoff,
    refreshAfterCountsChange, loadMaterialTemplates,
    loadDraftPOs, loadTakeoffBookVersions, loadTakeoffBookEntries, saveBidSelectedTakeoffBookVersion,
    loadPurchaseOrdersForCostEstimate, loadCostEstimate,
    ensureCostEstimateForBid, loadCostEstimateData,
    loadLaborBookVersions, loadLaborBookEntries, saveBidSelectedLaborBookVersion,
    loadTemplatePriceBookVersions, loadBidPricings, loadBidVersions, loadPriceBookEntries, loadBidPricingAssignments, loadPricingDataForBid,
    saveBidSelectedPriceBookVersion, setCostEstimatePO, openMaterialsModelSwitch, confirmMaterialsModelSwitch,
  } = useBidPricingEngine({
    selectedBidForCounts,
    selectedBidForTakeoff,
    selectedBidForCostEstimate,
    selectedBidForPricing,
    activeTab,
    selectedServiceTypeId,
    authUser,
    setError,
    loadBids,
    setSharedBid,
  })


  // Cover Letter tab
  const [coverLetterInclusionsByBid, setCoverLetterInclusionsByBid] = useState<Record<string, string>>({})
  const [coverLetterExclusionsByBid, setCoverLetterExclusionsByBid] = useState<Record<string, string>>({})
  const [coverLetterTermsByBid, setCoverLetterTermsByBid] = useState<Record<string, string>>({})
  const [coverLetterIncludeDesignDrawingPlanDateByBid, setCoverLetterIncludeDesignDrawingPlanDateByBid] = useState<Record<string, boolean>>({})
  const [coverLetterCustomAmountByBid, setCoverLetterCustomAmountByBid] = useState<Record<string, string>>({})
  const [coverLetterUseCustomAmountByBid, setCoverLetterUseCustomAmountByBid] = useState<Record<string, boolean>>({})
  const [coverLetterIncludeSignatureByBid, setCoverLetterIncludeSignatureByBid] = useState<Record<string, boolean>>({})
  const [coverLetterIncludeFixturesPerPlanByBid, setCoverLetterIncludeFixturesPerPlanByBid] = useState<Record<string, boolean>>({})

  /** Set selected bid for Counts, Takeoffs, Labor, Pricing, Submission, RFI, Change Order, and Lien Release so selection stays in sync across tabs. */
  function setSharedBid(bid: BidWithBuilder | null) {
    setSelectedBidForCounts(bid)
    setSelectedBidForTakeoff(bid)
    setSelectedBidForCostEstimate(bid)
    setSelectedBidForPricing(bid)
    setSelectedBidForSubmission(bid)
    setSelectedBidForRfi(bid)
    setSelectedBidForChangeOrder(bid)
    setSelectedBidForLienRelease(bid)
  }

  /** Clear bid selection and remove bidId from URL so tab switches don't restore the old bid. */
  function closeSharedBidAndClearUrl() {
    setSharedBid(null)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('bidId')
      return next
    }, { replace: true })
  }

  /** Select a bid and sync URL so tab switches show the same bid. */
  function selectBidAndSyncUrl(bid: BidWithBuilder, tab: typeof activeTab) {
    setSharedBid(bid)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', tab)
      next.set('bidId', bid.id)
      return next
    }, { replace: true })
  }





  useEffect(() => {
    if (activeTab !== 'submission-followup') return
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'submission-followup' || !selectedBidForSubmission?.id || !authUser?.id) return
    void (async () => {
      try {
        await upsertBidNotesReadWatermark(authUser.id, selectedBidForSubmission.id)
      } catch {
        /* ignore if migration not applied or RLS */
      }
    })()
  }, [activeTab, selectedBidForSubmission?.id, authUser?.id])

  useEffect(() => {
    if (!bidFormOpen || !pendingBidFormFocus) return
    const which = pendingBidFormFocus
    const timeoutId = window.setTimeout(() => {
      const elId =
        which === 'projectName'
          ? 'bid-form-project-name'
          : which === 'bidValue'
            ? 'bid-form-bid-value'
            : 'bid-form-gc-builder'
      const el = document.getElementById(elId)
      if (el instanceof HTMLElement) {
        el.focus()
        if (el instanceof HTMLInputElement) {
          el.select()
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Brief amber highlight so the user's eye lands on the field after the
        // modal opens. Restore prior inline styles after ~1.6s.
        const prevOutline = el.style.outline
        const prevOutlineOffset = el.style.outlineOffset
        const prevBackground = el.style.background
        const prevTransition = el.style.transition
        el.style.transition = 'background-color 0.3s ease, outline-color 0.3s ease'
        el.style.outline = '2px solid #d97706'
        el.style.outlineOffset = '2px'
        el.style.background = '#fffbeb'
        window.setTimeout(() => {
          el.style.outline = prevOutline
          el.style.outlineOffset = prevOutlineOffset
          el.style.background = prevBackground
          el.style.transition = prevTransition
        }, 1600)
      }
      setPendingBidFormFocus(null)
    }, 50)
    return () => window.clearTimeout(timeoutId)
  }, [bidFormOpen, pendingBidFormFocus])



  async function loadRole() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role, estimator_service_type_ids, primary_service_type_ids, superintendent_service_type_ids')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole; estimator_service_type_ids?: string[] | null; primary_service_type_ids?: string[] | null; superintendent_service_type_ids?: string[] | null } | null)?.role ?? null
    const estIds = (me as { estimator_service_type_ids?: string[] | null } | null)?.estimator_service_type_ids
    const primIds = (me as { primary_service_type_ids?: string[] | null } | null)?.primary_service_type_ids
    const supIds = (me as { superintendent_service_type_ids?: string[] | null } | null)?.superintendent_service_type_ids
    setMyRole(role)
    if (role === 'estimator' && estIds && estIds.length > 0) {
      setEstimatorServiceTypeIds(estIds)
    } else {
      setEstimatorServiceTypeIds(null)
    }
    if (role === 'primary' && primIds && primIds.length > 0) {
      setPrimaryServiceTypeIds(primIds)
    } else {
      setPrimaryServiceTypeIds(null)
    }
    if (role === 'superintendent' && supIds && supIds.length > 0) {
      setSuperintendentServiceTypeIds(supIds)
    } else {
      setSuperintendentServiceTypeIds(null)
    }
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant' && role !== 'estimator' && role !== 'primary' && role !== 'superintendent') {
      setLoading(false)
      return
    }
  }

  async function loadEstimatorUsers() {
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('users')
            .select('id, name, email, role')
            .is('archived_at', null)
            .neq('role', 'helpers')
            .order('name', { ascending: true, nullsFirst: false }),
        'load estimator users for bids',
      )
      const rows = (data as EstimatorUser[]) ?? []
      setEstimatorUsers(
        rows.filter((u) => (u.name?.trim().toLowerCase() ?? '') !== 'delete'),
      )
    } catch {
      // Preserve prior silent failure: do not reject Promise.all callers or clear the list.
    }
  }

  async function loadCustomers() {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, address, master_user_id, contact_info')
      .or('customer_type.is.null,customer_type.eq.commercial')
      .order('name')
    if (error) {
      setError(`Failed to load customers: ${error.message}`)
      return
    }
    setCustomers((data as Customer[]) ?? [])
  }

  async function loadServiceTypes() {
    const { data, error } = await supabase
      .from('service_types' as any)
      .select('*')
      .order('sequence_order', { ascending: true })
    
    if (error) {
      setError(`Failed to load service types: ${error.message}`)
      return
    }
    
    const types = (data as unknown as ServiceType[]) ?? []
    setServiceTypes(types)
    
    // For estimators/primaries/superintendents with restrictions, filter to allowed types
    const visibleTypes = (estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0)
      ? types.filter((st) => estimatorServiceTypeIds.includes(st.id))
      : (primaryServiceTypeIds && primaryServiceTypeIds.length > 0)
        ? types.filter((st) => primaryServiceTypeIds.includes(st.id))
        : (superintendentServiceTypeIds && superintendentServiceTypeIds.length > 0)
          ? types.filter((st) => superintendentServiceTypeIds.includes(st.id))
          : types
    // Fallback: if filter yields no types (e.g. stale primary_service_type_ids), use all
    const typesToUse = visibleTypes.length > 0 ? visibleTypes : types
    const defaultId = (() => {
      if (typesToUse.length === 1) return typesToUse[0]?.id
      const plumbing = typesToUse.find((st) => st.name === 'Plumbing')
      if (plumbing) return plumbing.id
      const electrical = typesToUse.find((st) => st.name === 'Electrical')
      if (electrical) return electrical.id
      return typesToUse[0]?.id
    })()
    if (defaultId) {
      setSelectedServiceTypeId((prev) => {
        if (!prev || !typesToUse.some((st) => st.id === prev)) return defaultId
        return prev
      })
    }
  }

  async function loadFixtureTypes() {
    if (!selectedServiceTypeId) return
    const { data, error } = await supabase
      .from('fixture_types')
      .select('id, name')
      .eq('service_type_id', selectedServiceTypeId)
      .order('name', { ascending: true })
    if (!error && data) {
      setFixtureTypes(data)
    }
  }



  async function loadBids(serviceTypeId?: string | null): Promise<BidWithBuilder[]> {
    const sid = serviceTypeId === undefined ? selectedServiceTypeId : serviceTypeId
    let q = supabase
      .from('bids')
      .select('*, customers(*), bids_gc_builders(*), estimator:users!bids_estimator_id_fkey(id, name, email), account_manager:users!bids_account_manager_id_fkey(id, name, email), service_type:service_types(id, name, color)')
    if (sid) q = q.eq('service_type_id', sid)
    const { data, error } = await q.order('bid_due_date', { ascending: false, nullsFirst: true })
    if (error) {
      setError(`Failed to load bids: ${error.message}`)
      return []
    }
    type Raw = Bid & {
      customers: Customer | Customer[] | null
      bids_gc_builders: GcBuilder | GcBuilder[] | null
      estimator?: EstimatorUser | EstimatorUser[] | null
      account_manager?: EstimatorUser | EstimatorUser[] | null
    }
    const raw = (data as unknown as Raw[]) ?? []
    const rows: BidWithBuilder[] = raw.map((b) => {
      const est = b.estimator
      const estimatorNorm = est == null ? null : Array.isArray(est) ? est[0] ?? null : est
      const am = b.account_manager
      const accountManagerNorm = am == null ? null : Array.isArray(am) ? am[0] ?? null : am
      return {
        ...b,
        customers: Array.isArray(b.customers) ? b.customers[0] ?? null : b.customers,
        bids_gc_builders: Array.isArray(b.bids_gc_builders) ? b.bids_gc_builders[0] ?? null : b.bids_gc_builders,
        estimator: estimatorNorm,
        account_manager: accountManagerNorm,
      }
    })
    setBids(rows)
    const { data: entriesData } = await supabase
      .from('bids_submission_entries')
      .select('bid_id, occurred_at')
    const latestByBid: Record<string, string> = {}
    for (const row of entriesData ?? []) {
      const bidId = (row as { bid_id: string; occurred_at: string | null }).bid_id
      const at = (row as { bid_id: string; occurred_at: string | null }).occurred_at
      if (!at) continue
      const existing = latestByBid[bidId]
      if (!existing || new Date(at) > new Date(existing)) latestByBid[bidId] = at
    }
    setLastContactFromEntries(latestByBid)
    return rows
  }

  const archiveWorkingBoardBid = useCallback(
    async (bidId: string) => {
      if (!authUser?.id) return
      const bid = bids.find((b) => b.id === bidId)
      if (!canUserArchiveBidOnWorkingBoard(bid, authUser.id, myRole)) {
        showToast('You can only archive unsent bids that are not won, lost, or started/complete.', 'error')
        return
      }
      setArchiveWorkingBoardBusyBidId(bidId)
      try {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .update({
                working_board_archived_at: new Date().toISOString(),
                working_board_archived_by: authUser.id,
              })
              .eq('id', bidId),
          'archive working board bid',
        )
        const rows = await loadBids()
        showToast('Archived. Restore from Bid Board → Archived.', 'success')
        setEditingBid((prev) => {
          if (!prev || prev.id !== bidId) return prev
          const fresh = rows.find((b) => b.id === bidId)
          return fresh ?? prev
        })
      } catch (e: unknown) {
        showToast(formatErrorMessage(e, 'Failed to archive bid'), 'error')
      } finally {
        setArchiveWorkingBoardBusyBidId(null)
      }
    },
    [authUser?.id, bids, myRole, showToast, loadBids, setEditingBid],
  )

  const promptArchiveWorkingBoardBid = useCallback(
    (bidId: string) => {
      if (!authUser?.id) return
      const bid = bids.find((b) => b.id === bidId)
      if (!canUserArchiveBidOnWorkingBoard(bid, authUser.id, myRole)) {
        showToast('You can only archive unsent bids that are not won, lost, or started/complete.', 'error')
        return
      }
      const label =
        (bid?.project_name?.trim() || bid?.bid_number?.trim() || '').trim() || 'this bid'
      setWorkingBoardArchiveConfirmBidId(bidId)
      setWorkingBoardArchiveConfirmLabel(label)
    },
    [authUser?.id, bids, myRole, showToast],
  )

  useEffect(() => {
    if (!workingBoardArchiveConfirmBidId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWorkingBoardArchiveConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [workingBoardArchiveConfirmBidId, closeWorkingBoardArchiveConfirm])

  async function loadCustomerContacts() {
    const { data, error } = await supabase
      .from('customer_contacts')
      .select('*')
      .order('contact_date', { ascending: false })
    if (error) {
      setError(`Failed to load customer contacts: ${error.message}`)
      return
    }
    setCustomerContacts((data as CustomerContact[]) ?? [])
  }

  async function loadCustomerContactPersons() {
    const { data, error } = await supabase
      .from('customer_contact_persons')
      .select('*')
      .order('name')
    if (error) {
      setError(`Failed to load contact persons: ${error.message}`)
      return
    }
    setCustomerContactPersons((data as CustomerContactPerson[]) ?? [])
  }






  // Add Parts to Existing Template Modal Functions


  // Edit Template Modal Functions


























  async function downloadApprovalPdf() {
    const b = selectedBidForSubmission
    if (!b) return
    await downloadApprovalPdfDoc({
      bid: b,
      priceBookVersions,
      serviceTypes,
      coverLetter: {
        useCustomAmount: coverLetterUseCustomAmountByBid[b.id] === true,
        customAmount: coverLetterCustomAmountByBid[b.id] ?? '',
        inclusions: coverLetterInclusionsByBid[b.id] ?? '',
        exclusions: coverLetterExclusionsByBid[b.id] ?? DEFAULT_EXCLUSIONS,
        terms: coverLetterTermsByBid[b.id] ?? DEFAULT_TERMS_AND_WARRANTY,
        includeDesignDrawingPlanDate: coverLetterIncludeDesignDrawingPlanDateByBid[b.id] !== false,
        includeFixturesPerPlan: coverLetterIncludeFixturesPerPlanByBid[b.id] !== false,
        includeSignature: coverLetterIncludeSignatureByBid[b.id] === true,
      },
    })
  }
























  useEffect(() => {
    loadRole()
  }, [authUser?.id])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('lostSummary') !== '1') return
    const tabUid = params.get('lostSummaryTab')?.trim() || null
    setLostSummaryInitialStaffTab(tabUid)
    setBidBoardSectionOpen((p) => ({ ...p, lost: true }))
    setLostSummaryModalOpen(true)
    setActiveTab('bid-board')
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.delete('lostSummary')
        next.delete('lostSummaryTab')
        return next
      },
      { replace: true },
    )
  }, [location.search, setSearchParams])

  const BIDS_TABS = ['bid-board', 'builder-review', 'working', 'bid-costs', 'estimators', 'counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'submission-followup', 'rfi', 'change-order', 'lien-release'] as const

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('new') === 'true') {
      openNewBid()
      navigate('/bids', { replace: true })
      return
    }
    const bidId = params.get('bidId')
    let tab = params.get('tab')
    // Back-compat: the Bids "Cost Estimate" tab slug was renamed to "labor".
    if (tab === 'cost-estimate') {
      tab = 'labor'
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'labor')
        return next
      }, { replace: true })
    }
    if (tab !== 'bid-board' || !bidId) {
      bidBoardPendingScrollBidIdRef.current = null
    }
    if (tab !== 'submission-followup' || !bidId) {
      submissionFollowupPendingDeepLinkBidIdRef.current = null
    }
    if (tab !== 'builder-review' || !bidId) {
      builderReviewPendingDeepLinkBidIdRef.current = null
      builderReviewDeepLinkAppliedBidIdRef.current = null
    }
    if (tab !== 'working' || !bidId) {
      workingBoardPendingDeepLinkBidIdRef.current = null
      workingDeepLinkAppliedBidIdRef.current = null
      setWorkingBoardDeepLinkBidId(null)
    }
    if (tab === 'bid-costs' && myRole != null && myRole !== 'dev') {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'bid-board')
        return next
      }, { replace: true })
      setActiveTab('bid-board')
      return
    }
    if (myRole === 'superintendent' && tab && ['pricing', 'cover-letter', 'submission-followup'].includes(tab)) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'bid-board')
        return next
      }, { replace: true })
      setActiveTab('bid-board')
      return
    }
    if (tab === 'builder-review') {
      setActiveTab('builder-review')
      if (!bidId) return
      const brBid = bids.find((b) => b.id === bidId)
      if (brBid) {
        applyBuilderReviewDeepLinkFromBid(brBid)
      } else {
        builderReviewPendingDeepLinkBidIdRef.current = bidId
      }
      return
    }
    if (bidId && tab === 'bid-board') {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        applyBidBoardDeepLinkToBid(bid)
      } else {
        bidBoardPendingScrollBidIdRef.current = bidId
        if (serviceTypes.length > 0) {
          supabase.from('bids').select('service_type_id').eq('id', bidId).single().then(({ data }) => {
            const row = data as { service_type_id: string } | null
            if (row && row.service_type_id !== selectedServiceTypeId) {
              setSelectedServiceTypeId(row.service_type_id)
            }
          })
        }
      }
      return
    }
    if (bidId && tab === 'submission-followup') {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        applySubmissionFollowupDeepLinkToBid(bid)
      } else {
        submissionFollowupPendingDeepLinkBidIdRef.current = bidId
        setActiveTab('submission-followup')
        if (serviceTypes.length > 0) {
          // Bid not in current list - may be different service type; fetch and switch
          supabase.from('bids').select('service_type_id').eq('id', bidId).single().then(({ data }) => {
            const row = data as { service_type_id: string } | null
            if (row && row.service_type_id !== selectedServiceTypeId) {
              setSelectedServiceTypeId(row.service_type_id)
            }
          })
        }
      }
      return
    }
    if (bidId && tab === 'working') {
      setActiveTab('working')
      if (!authUser?.id) {
        workingBoardPendingDeepLinkBidIdRef.current = null
        setWorkingBoardDeepLinkBidId(null)
        return
      }
      const wBid = bids.find((b) => b.id === bidId)
      if (!wBid) {
        workingBoardPendingDeepLinkBidIdRef.current = bidId
        if (serviceTypes.length > 0) {
          supabase.from('bids').select('service_type_id').eq('id', bidId).single().then(({ data }) => {
            const row = data as { service_type_id: string } | null
            if (row && row.service_type_id !== selectedServiceTypeId) {
              setSelectedServiceTypeId(row.service_type_id)
            }
          })
        }
        return
      }
      workingBoardPendingDeepLinkBidIdRef.current = null
      if (wBid.working_board_archived_at) {
        if (workingDeepLinkAppliedBidIdRef.current !== bidId) {
          showToast(
            'This bid is archived on your Working board. Open Bid Board → Archived to restore.',
            'info'
          )
          workingDeepLinkAppliedBidIdRef.current = bidId
        }
        return
      }
      if (!isBidEligibleForWorkingBoard(wBid, authUser.id)) {
        if (workingDeepLinkAppliedBidIdRef.current !== bidId) {
          showToast(
            'This bid is not on your Working board. Working shows unsent bids where you are Estimator or Account Man.',
            'info'
          )
          workingDeepLinkAppliedBidIdRef.current = bidId
        }
        return
      }
      if (workingDeepLinkAppliedBidIdRef.current === wBid.id) {
        return
      }
      workingDeepLinkAppliedBidIdRef.current = wBid.id
      setWorkingBoardDeepLinkBidId(wBid.id)
      return
    }
    const bidTabs = ['counts', 'takeoffs', 'labor', 'pricing', 'cover-letter', 'rfi', 'change-order', 'lien-release']
    if (bidId && tab && bidTabs.includes(tab)) {
      const bid = bids.find((b) => b.id === bidId)
      if (bid) {
        setSharedBid(bid)
        setActiveTab(tab as typeof activeTab)
      } else if (serviceTypes.length > 0) {
        supabase.from('bids').select('service_type_id').eq('id', bidId).single().then(({ data }) => {
          const row = data as { service_type_id: string } | null
          if (row && row.service_type_id !== selectedServiceTypeId) {
            setSelectedServiceTypeId(row.service_type_id)
          }
        })
      }
      return
    }
    if (tab && BIDS_TABS.includes(tab as typeof BIDS_TABS[number])) {
      setActiveTab(tab as typeof activeTab)
    } else if (!params.get('tab')) {
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'bid-board')
        return next
      }, { replace: true })
    }
  }, [
    location.search,
    bids,
    serviceTypes.length,
    selectedServiceTypeId,
    myRole,
    authUser?.id,
    applyBidBoardDeepLinkToBid,
    applySubmissionFollowupDeepLinkToBid,
    applyBuilderReviewDeepLinkFromBid,
    showToast,
  ])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const deepBidId = params.get('bidId')
    const deepTab = params.get('tab')
    if (deepTab !== 'bid-board' || !deepBidId) return
    if (bidBoardPendingScrollBidIdRef.current !== deepBidId) return
    const pendingBid = bids.find((b) => b.id === deepBidId)
    if (!pendingBid) return
    applyBidBoardDeepLinkToBid(pendingBid)
  }, [bids, location.search, applyBidBoardDeepLinkToBid])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const deepBidId = params.get('bidId')
    const deepTab = params.get('tab')
    if (deepTab !== 'submission-followup' || !deepBidId) return
    if (submissionFollowupPendingDeepLinkBidIdRef.current !== deepBidId) return
    const pendingBid = bids.find((b) => b.id === deepBidId)
    if (!pendingBid) return
    applySubmissionFollowupDeepLinkToBid(pendingBid)
  }, [bids, location.search, applySubmissionFollowupDeepLinkToBid])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pendingBrBidId = params.get('bidId')
    const pendingBrTab = params.get('tab')
    if (pendingBrTab !== 'builder-review' || !pendingBrBidId) return
    if (builderReviewPendingDeepLinkBidIdRef.current !== pendingBrBidId) return
    const pendingBrBid = bids.find((b) => b.id === pendingBrBidId)
    if (!pendingBrBid) return
    applyBuilderReviewDeepLinkFromBid(pendingBrBid)
  }, [bids, location.search, applyBuilderReviewDeepLinkFromBid])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pendingW = params.get('bidId')
    const pendingWTab = params.get('tab')
    if (pendingWTab !== 'working' || !pendingW || !authUser?.id) return
    if (workingBoardPendingDeepLinkBidIdRef.current !== pendingW) return
    const pendingWBid = bids.find((b) => b.id === pendingW)
    if (!pendingWBid) return
    workingBoardPendingDeepLinkBidIdRef.current = null
    if (pendingWBid.working_board_archived_at) {
      if (workingDeepLinkAppliedBidIdRef.current !== pendingW) {
        showToast(
          'This bid is archived on your Working board. Open Bid Board → Archived to restore.',
          'info'
        )
        workingDeepLinkAppliedBidIdRef.current = pendingW
      }
      return
    }
    if (!isBidEligibleForWorkingBoard(pendingWBid, authUser.id)) {
      if (workingDeepLinkAppliedBidIdRef.current !== pendingW) {
        showToast(
          'This bid is not on your Working board. Working shows unsent bids where you are Estimator or Account Man.',
          'info'
        )
        workingDeepLinkAppliedBidIdRef.current = pendingW
      }
      return
    }
    if (workingDeepLinkAppliedBidIdRef.current === pendingWBid.id) return
    workingDeepLinkAppliedBidIdRef.current = pendingWBid.id
    setWorkingBoardDeepLinkBidId(pendingWBid.id)
  }, [bids, location.search, authUser?.id, showToast])

  useEffect(() => {
    return () => {
      if (bidBoardDeepLinkTimeoutRef.current) {
        clearTimeout(bidBoardDeepLinkTimeoutRef.current)
        bidBoardDeepLinkTimeoutRef.current = null
      }
      if (builderReviewDeepLinkTimeoutRef.current) {
        clearTimeout(builderReviewDeepLinkTimeoutRef.current)
        builderReviewDeepLinkTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get(OPEN_BID_EDIT_QUERY) !== '1') {
      openBidEditHandledRef.current = null
      return
    }
    const bidId = params.get('bidId')
    if (!bidId) return

    const bidRow = bids.find((b) => b.id === bidId)
    if (!bidRow) {
      if (serviceTypes.length > 0) {
        void supabase
          .from('bids')
          .select('service_type_id')
          .eq('id', bidId)
          .single()
          .then(({ data }) => {
            const row = data as { service_type_id: string } | null
            if (row?.service_type_id && row.service_type_id !== selectedServiceTypeId) {
              setSelectedServiceTypeId(row.service_type_id)
            }
          })
      }
      return
    }

    if (openBidEditHandledRef.current === bidId) return
    openBidEditHandledRef.current = bidId
    openEditBid(bidRow)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete(OPEN_BID_EDIT_QUERY)
      if (!next.get('tab')) next.set('tab', 'bid-board')
      return next
    }, { replace: true })
  }, [location.search, bids, serviceTypes.length, selectedServiceTypeId, setSearchParams])

  useEffect(() => {
    if (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator' || myRole === 'primary' || myRole === 'superintendent') {
      const load = async () => {
        try {
          // Load service types first
          await loadServiceTypes()
          await loadFixtureTypes()
        } finally {
          setLoading(false)
        }
      }
      load()
    }
  }, [myRole, estimatorServiceTypeIds, primaryServiceTypeIds, superintendentServiceTypeIds])
  
  // Reload data when service type changes (skip when Builder Review is active; that tab loads all data)
  useEffect(() => {
    if (selectedServiceTypeId && activeTab !== 'builder-review' && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator' || myRole === 'primary' || myRole === 'superintendent')) {
      const t = setTimeout(async () => {
        await Promise.all([loadCustomers(), loadBids(selectedServiceTypeId), loadCustomerContacts(), loadCustomerContactPersons(), loadEstimatorUsers(), loadFixtureTypes(), loadTakeoffBookVersions(), loadLaborBookVersions(), loadTemplatePriceBookVersions(), loadMaterialTemplates()])
      }, 80)
      return () => clearTimeout(t)
    }
  }, [selectedServiceTypeId, activeTab, myRole])

  // Load all customers and bids when Builder Review tab is active (no service type filter)
  useEffect(() => {
    if (activeTab === 'builder-review' && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant' || myRole === 'estimator' || myRole === 'primary' || myRole === 'superintendent')) {
      const t = setTimeout(async () => {
        await Promise.all([
          loadCustomers(),
          loadBids(null), // load all bids (no service type filter)
          loadCustomerContacts(),
          loadCustomerContactPersons(),
          loadEstimatorUsers(),
          loadFixtureTypes(),
          loadTakeoffBookVersions(),
          loadLaborBookVersions(),
          loadTemplatePriceBookVersions(),
          loadMaterialTemplates()
        ])
      }, 80)
      return () => clearTimeout(t)
    }
  }, [activeTab, myRole])














  useEffect(() => {
    if (
      activeTab === 'submission-followup' &&
      selectedBidForSubmission &&
      scrollToContactFromBidBoard
    ) {
      contactTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToContactFromBidBoard(false)
    }
  }, [activeTab, selectedBidForSubmission?.id, scrollToContactFromBidBoard])

  // From Pricing's "Direct Costs" header: after switching to the Labor tab, scroll
  // its DIRECT COSTS section into view. Retries briefly while the tab renders.
  useEffect(() => {
    if (activeTab !== 'labor' || !scrollToLaborDirectCosts) return
    let tries = 0
    const tick = () => {
      const el = document.getElementById('labor-direct-costs')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setScrollToLaborDirectCosts(false)
        return
      }
      if (tries++ < 20) setTimeout(tick, 50)
      else setScrollToLaborDirectCosts(false)
    }
    tick()
  }, [activeTab, scrollToLaborDirectCosts])



  useEffect(() => {
    if ((activeTab !== 'labor' && activeTab !== 'takeoffs') || !selectedBidForCostEstimate?.id) {
      if (!selectedBidForCostEstimate?.id) {
        costEstimateBidIdRef.current = null
        setCostEstimate(null)
        setCostEstimateLaborRows([])
        setCostEstimateCountRows([])
        setSelectedLaborBookVersionId(null)
        setCostEstimateDistanceInput('')
      }
      return
    }
    setCostEstimateDistanceInput(selectedBidForCostEstimate.distance_from_office ?? '')
    const bidId = selectedBidForCostEstimate.id
    const bidJustChanged = costEstimateBidIdRef.current !== bidId
    if (bidJustChanged) {
      costEstimateBidIdRef.current = bidId
      // Auto-select first labor book if none is saved for this bid
      const savedLaborBookId = selectedBidForCostEstimate.selected_labor_book_version_id
      if (!savedLaborBookId && laborBookVersions.length > 0) {
        const firstLaborBookId = laborBookVersions[0]?.id
        if (firstLaborBookId) {
          setSelectedLaborBookVersionId(firstLaborBookId)
        }
      } else {
        setSelectedLaborBookVersionId(savedLaborBookId ?? null)
      }
    }
    const laborBookVersionId = bidJustChanged
      ? (selectedBidForCostEstimate.selected_labor_book_version_id ?? (laborBookVersions.length > 0 ? laborBookVersions[0]?.id ?? null : null))
      : selectedLaborBookVersionId
    loadCostEstimateData(bidId, laborBookVersionId)
  }, [
    activeTab,
    selectedBidForCostEstimate?.id,
    selectedBidForCostEstimate?.selected_labor_book_version_id,
    selectedBidForCostEstimate?.materials_model,
    selectedLaborBookVersionId,
    laborBookVersions,
  ])


  function openNewBid() {
    clearBidDateSentAttestationFlow()
    savedBidDateSentRef.current = ''
    setEditingBid(null)
    bidForm.reset({ serviceTypeId: selectedServiceTypeId, accountManagerId: authUser?.id ?? '' })
    setBidDateSent('')
    setPendingBidFormFocus(null)
    setBidFormOpen(true)
    setError(null)
  }

  function openNewBidWithCustomer(customer: Customer) {
    clearBidDateSentAttestationFlow()
    savedBidDateSentRef.current = ''
    setEditingBid(null)
    bidForm.reset({
      serviceTypeId: selectedServiceTypeId,
      accountManagerId: authUser?.id ?? '',
      customer: { id: customer.id, address: customer.address ?? null, display: getCustomerDisplay(customer) },
    })
    setBidDateSent('')
    setPendingBidFormFocus(null)
    setBidFormOpen(true)
    setError(null)
  }

  function openEditBid(bid: BidWithBuilder, opts?: { focus?: 'projectName' | 'gcBuilder' | 'bidValue' }) {
    clearBidDateSentAttestationFlow()
    setEditingBid(bid)
    let nextGcCustomerId = ''
    let nextGcCustomerSearch = ''
    if (bid.customer_id && bid.customers) {
      nextGcCustomerId = bid.customer_id
      nextGcCustomerSearch = getCustomerDisplay(bid.customers)
    } else if (bid.gc_builder_id && bid.bids_gc_builders) {
      nextGcCustomerSearch = bid.bids_gc_builders.name
    }
    bidForm.loadFromBid(bid, {
      gcCustomerId: nextGcCustomerId,
      gcCustomerSearch: nextGcCustomerSearch,
      fallbackServiceTypeId: selectedServiceTypeId,
    })
    setBidDateSent(bid.bid_date_sent ?? '')
    savedBidDateSentRef.current = normalizeBidDateInput(bid.bid_date_sent)
    setDeleteConfirmProjectName('')
    setPendingBidFormFocus(opts?.focus ?? null)
    setBidFormOpen(true)
    setError(null)
  }

  function clearBidDateSentAttestationFlow() {
    setBidSentAttestModalOpen(false)
    setPendingBidDateSentForModal('')
    setBidSentAckEmail(false)
    setBidSentAckPhone(false)
    setBidSentAckHonesty(false)
    setBidSentAckEmailAt(null)
    setBidSentAckPhoneAt(null)
    setBidSentAckHonestyAt(null)
    setPendingBidDateSentAttestation(null)
    setPendingAttestationForDate(null)
    setBidSentAttestFollowupNoteDraft('')
    setPendingBidSentFollowupSubmissionNote(null)
  }

  function closeBidForm() {
    setBidFormOpen(false)
    setPendingBidFormFocus(null)
    setEditingBid(null)
    setDeleteConfirmProjectName('')
    setDeletingBid(false)
    setDeleteBidModalOpen(false)
    setBidServiceTypeSwitchSiblings({})
    clearBidDateSentAttestationFlow()
  }

  async function saveLossReasonFromLostSummaryModal(bidId: string, lossReason: string) {
    const loss_reason = lossReason.trim() || null
    await withSupabaseRetry(
      async () => supabase.from('bids').update({ loss_reason }).eq('id', bidId),
      'bid board lost summary loss_reason',
    )
    await loadBids()
  }

  async function refreshBidServiceTypeSwitchSiblings() {
    const source = editingBid
    const customerId = source?.customer_id
    if (!source || !customerId) {
      setBidServiceTypeSwitchSiblings({})
      return
    }
    const pn = (source.project_name ?? '').trim().toLowerCase()
    if (!pn) {
      setBidServiceTypeSwitchSiblings({})
      return
    }
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase
            .from('bids')
            .select('id, bid_number, service_type_id, project_name')
            .eq('customer_id', customerId)
            .neq('id', source.id),
        'list sibling bids for service type switch',
      )
      const map: Record<string, BidServiceTypeSwitchSibling[]> = {}
      for (const row of data ?? []) {
        if ((row.project_name ?? '').trim().toLowerCase() !== pn) continue
        const st = row.service_type_id
        if (!map[st]) map[st] = []
        map[st].push({ id: row.id, bid_number: row.bid_number })
      }
      setBidServiceTypeSwitchSiblings(map)
    } catch {
      setBidServiceTypeSwitchSiblings({})
    }
  }

  async function duplicateBidToServiceTypeHandler(targetServiceTypeId: string) {
    if (!editingBid || !authUser?.id) return
    setSavingBid(true)
    setError(null)
    try {
      const newId = await withSupabaseRetry(
        () =>
          supabase.rpc('duplicate_bid_to_service_type', {
            p_source_bid_id: editingBid.id,
            p_target_service_type_id: targetServiceTypeId,
          }),
        'duplicate bid to service type',
      )
      if (typeof newId !== 'string' || !newId) {
        const msg = 'Duplicate did not return a new bid id.'
        setError(msg)
        showToast(msg, 'error')
        return
      }
      const rows = await loadBids()
      setSelectedServiceTypeId(targetServiceTypeId)
      const fresh = rows.find((b) => b.id === newId)
      if (fresh) {
        closeBidForm()
        openEditBid(fresh)
        showToast('Bid copied to the new trade.', 'success')
      } else {
        closeBidForm()
        showToast('Bid copied. Refresh the page if it does not appear.', 'success')
      }
    } catch (e) {
      const msg = formatErrorMessage(e)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSavingBid(false)
    }
  }

  function openExistingBidFromServiceTypeSwitch(bidId: string) {
    const fresh = bids.find((b) => b.id === bidId)
    if (fresh) {
      setSelectedServiceTypeId(fresh.service_type_id)
      closeBidForm()
      openEditBid(fresh)
      return
    }
    void loadBids().then((rows) => {
      const b = rows.find((x) => x.id === bidId)
      if (b) {
        setSelectedServiceTypeId(b.service_type_id)
        closeBidForm()
        openEditBid(b)
      } else {
        showToast('Bid not found or no access.', 'error')
      }
    })
  }

  function getBidDateSentAttestationPayloadMerge(): Record<string, string | null> {
    const d = normalizeBidDateInput(bidDateSent)
    if (!d) {
      return { ...BID_DATE_SENT_ATTESTATION_NULLS }
    }
    const serverSent = editingBid ? normalizeBidDateInput(editingBid.bid_date_sent) : ''
    if (d !== serverSent) {
      if (pendingBidDateSentAttestation && pendingAttestationForDate === d) {
        return { ...pendingBidDateSentAttestation }
      }
      return {}
    }
    return {}
  }

  function validateBidDateSentAttestationForSave(): string | null {
    const d = normalizeBidDateInput(bidDateSent)
    const serverSent = editingBid ? normalizeBidDateInput(editingBid.bid_date_sent) : ''
    if (!d) return null
    if (d !== serverSent) {
      if (!pendingBidDateSentAttestation || pendingAttestationForDate !== d) {
        return 'Choose a new Bid Date Sent and confirm the attestation checklist, or revert the date.'
      }
    }
    return null
  }

  /** Opens attestation modal once when the committed date differs from last saved; reverts field to baseline until confirmed. */
  function promptBidDateSentAttestationIfNeeded(proposedRaw: string): boolean {
    if (bidSentAttestModalOpen) return false
    const proposedNorm = normalizeBidDateInput(proposedRaw)
    if (!proposedNorm) return false
    const baseline = savedBidDateSentRef.current
    if (proposedNorm === baseline) return false
    if (pendingBidDateSentAttestation && pendingAttestationForDate === proposedNorm) return false

    setPendingBidDateSentForModal(proposedNorm)
    setBidSentAckEmail(false)
    setBidSentAckPhone(false)
    setBidSentAckHonesty(false)
    setBidSentAckEmailAt(null)
    setBidSentAckPhoneAt(null)
    setBidSentAckHonestyAt(null)
    setBidSentAttestFollowupNoteDraft('')
    setBidSentAttestModalOpen(true)
    setBidDateSent(baseline || '')
    return true
  }

  function handleBidDateSentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    const norm = normalizeBidDateInput(v)
    const baseline = savedBidDateSentRef.current

    if (!v) {
      setBidDateSent('')
      setPendingBidDateSentAttestation(null)
      setPendingAttestationForDate(null)
      setPendingBidSentFollowupSubmissionNote(null)
      return
    }

    setBidDateSent(v)

    if (norm === baseline) {
      if (pendingAttestationForDate) {
        setPendingBidDateSentAttestation(null)
        setPendingAttestationForDate(null)
        setPendingBidSentFollowupSubmissionNote(null)
      }
      return
    }

    if (pendingAttestationForDate && pendingAttestationForDate !== norm) {
      setPendingBidDateSentAttestation(null)
      setPendingAttestationForDate(null)
      setPendingBidSentFollowupSubmissionNote(null)
    }
  }

  function handleBidDateSentBlur(e: React.FocusEvent<HTMLInputElement>) {
    promptBidDateSentAttestationIfNeeded(e.target.value)
  }

  function cancelBidSentAttestationModal() {
    setBidSentAttestModalOpen(false)
    setPendingBidDateSentForModal('')
    setBidSentAckEmail(false)
    setBidSentAckPhone(false)
    setBidSentAckHonesty(false)
    setBidSentAckEmailAt(null)
    setBidSentAckPhoneAt(null)
    setBidSentAckHonestyAt(null)
    setBidSentAttestFollowupNoteDraft('')
  }

  function confirmBidSentAttestationModal() {
    if (!authUser?.id) return
    if (!bidSentAckEmail || !bidSentAckPhone || !bidSentAckHonesty) return
    const uid = authUser.id
    const confirmedAt = new Date().toISOString()
    const emailAt = bidSentAckEmailAt ?? confirmedAt
    const phoneAt = bidSentAckPhoneAt ?? confirmedAt
    const honestyAt = bidSentAckHonestyAt ?? confirmedAt
    const payload: BidDateSentAttestationPayload = {
      bid_date_sent_attested_at: confirmedAt,
      bid_date_sent_attested_by: uid,
      bid_date_sent_ack_email_at: emailAt,
      bid_date_sent_ack_email_by: uid,
      bid_date_sent_ack_phone_at: phoneAt,
      bid_date_sent_ack_phone_by: uid,
      bid_date_sent_ack_honesty_at: honestyAt,
      bid_date_sent_ack_honesty_by: uid,
    }
    const pendingDate = pendingBidDateSentForModal
    const trimmedFollowup = bidSentAttestFollowupNoteDraft.trim()
    setPendingBidDateSentAttestation(payload)
    setPendingAttestationForDate(pendingDate)
    setBidDateSent(pendingDate)
    setBidSentAttestModalOpen(false)
    setPendingBidDateSentForModal('')
    setBidSentAckEmail(false)
    setBidSentAckPhone(false)
    setBidSentAckHonesty(false)
    setBidSentAckEmailAt(null)
    setBidSentAckPhoneAt(null)
    setBidSentAckHonestyAt(null)
    setBidSentAttestFollowupNoteDraft('')
    setPendingBidSentFollowupSubmissionNote(trimmedFollowup || null)
  }

  async function insertPendingBidSentFollowupSubmissionNoteAfterSave(bidId: string, noteText: string | null) {
    const trimmed = noteText?.trim() ?? ''
    if (!trimmed || !authUser?.id) return
    const occurredAt = new Date().toISOString()
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: bidId,
            notes: trimmed,
            contact_method: null,
            occurred_at: occurredAt,
            created_by: authUser.id,
          }),
        'insert bid submission entry from bid sent confirmation'
      )
      await withSupabaseRetry(
        async () => supabase.from('bids').update({ last_contact: occurredAt }).eq('id', bidId),
        'update bid last_contact from bid sent confirmation note'
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add bid note from confirmation'), 'error')
    }
  }

  async function insertOutcomeChangeBidNoteAfterSave(opts: {
    bidId: string
    previousOutcome: string | null
    nextOutcome: string | null
    lossReasonForNote: string | null
  }) {
    if (!authUser?.id) return
    if (opts.previousOutcome === opts.nextOutcome) return
    const occurredAt = new Date().toISOString()
    const actorDisplay = resolveActorDisplayName(profileName, authUser.email ?? null)
    const notes = buildOutcomeChangeBidNoteBody({
      previousOutcome: opts.previousOutcome,
      nextOutcome: opts.nextOutcome,
      actorDisplayName: actorDisplay,
      lossReason: opts.lossReasonForNote,
    })
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: opts.bidId,
            notes,
            contact_method: null,
            occurred_at: occurredAt,
            created_by: authUser.id,
          }),
        'insert bid submission entry from win loss change'
      )
      await withSupabaseRetry(
        async () => supabase.from('bids').update({ last_contact: occurredAt }).eq('id', opts.bidId),
        'update bid last_contact from win loss change note'
      )
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add Win/Loss change note'), 'error')
    }
  }

  function handleLastContactClick(bid: BidWithBuilder) {
    setSelectedBidForSubmission(bid)
    setActiveTab('submission-followup')
    setScrollToContactFromBidBoard(true)
  }

  async function saveBid(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    if (promptBidDateSentAttestationIfNeeded(bidDateSent)) {
      setError(null)
      return
    }
    const attestSaveErr = validateBidDateSentAttestationForSave()
    if (attestSaveErr) {
      setError(attestSaveErr)
      return
    }
    setSavingBid(true)
    setError(null)
    const payload = {
      drive_link: driveLink.trim() || null,
      plans_link: plansLink.trim() || null,
      count_tooling_plans_link: countToolingPlansLink.trim() || null,
      bid_submission_link: bidSubmissionLink.trim() || null,
      design_drawing_plan_date: designDrawingPlanDate.trim() ? designDrawingPlanDate : null,
      plan_pages: planPages.trim() || null,
      customer_id: gcCustomerId || null,
      gc_builder_id: null,
      ...(editingBid && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') ? { bid_number: bidNumber.trim() || null } : {}),
      project_name: projectName.trim() || null,
      address: address.trim() || null,
      gc_contact_name: gcContactName.trim() || null,
      gc_contact_phone: gcContactPhone.trim() || null,
      gc_contact_email: gcContactEmail.trim() || null,
      estimator_id: estimatorId || null,
      account_manager_id: accountManagerId || null,
      bid_due_date: bidDueDate || null,
      estimated_job_start_date: estimatedJobStartDate.trim() ? estimatedJobStartDate : null,
      bid_date_sent: bidDateSent || null,
      submitted_to: submittedTo.trim() || null,
      outcome: outcome === 'won' || outcome === 'lost' || outcome === 'started_or_complete' ? outcome : null,
      loss_reason: outcome === 'lost' ? (lossReason.trim() || null) : null,
      bid_value: bidValue !== '' && !isNaN(Number(bidValue)) ? Number(bidValue) : null,
      agreed_value: agreedValue !== '' && !isNaN(Number(agreedValue)) ? Number(agreedValue) : null,
      profit: profit !== '' && !isNaN(Number(profit)) ? Number(profit) : null,
      distance_from_office: distanceFromOffice.trim() || null,
      last_contact: fromDatetimeLocal(lastContact),
      notes: notes.trim() || null,
      service_type_id: formServiceTypeId,
    }
    const payloadWithAttest = { ...payload, ...getBidDateSentAttestationPayloadMerge() }
    const followupNoteToSave = pendingBidSentFollowupSubmissionNote
    let bidIdForFollowup: string | null = null
    if (editingBid) {
      const { error: err } = await supabase.from('bids').update(payloadWithAttest).eq('id', editingBid.id)
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidIdForFollowup = editingBid.id
    } else {
      const { data: inserted, error: err } = await supabase
        .from('bids')
        .insert({ ...payloadWithAttest, created_by: authUser.id, materials_model: 'rough' })
        .select('id')
        .single()
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidIdForFollowup = (inserted as { id: string } | null)?.id ?? null
    }
    savedBidDateSentRef.current = normalizeBidDateInput(bidDateSent)
    setPendingBidDateSentAttestation(null)
    setPendingAttestationForDate(null)
    setPendingBidSentFollowupSubmissionNote(null)
    const previousOutcomeForNote = editingBid ? (editingBid.outcome ?? null) : null
    const nextOutcomeForNote = normalizedOutcomePayload(outcome)
    if (bidIdForFollowup) {
      await insertOutcomeChangeBidNoteAfterSave({
        bidId: bidIdForFollowup,
        previousOutcome: previousOutcomeForNote,
        nextOutcome: nextOutcomeForNote,
        lossReasonForNote: outcome === 'lost' ? (lossReason.trim() || null) : null,
      })
    }
    if (bidIdForFollowup && followupNoteToSave?.trim()) {
      await insertPendingBidSentFollowupSubmissionNoteAfterSave(bidIdForFollowup, followupNoteToSave)
    }
    const rows = await loadBids()
    if (editingBid) {
      const fresh = rows.find((b) => b.id === editingBid.id)
      if (fresh) {
        if (selectedBidForCounts?.id === editingBid.id) setSelectedBidForCounts(fresh)
        if (selectedBidForSubmission?.id === editingBid.id) setSelectedBidForSubmission(fresh)
        if (selectedBidForTakeoff?.id === editingBid.id) setSelectedBidForTakeoff(fresh)
        if (selectedBidForCostEstimate?.id === editingBid.id) setSelectedBidForCostEstimate(fresh)
        if (selectedBidForPricing?.id === editingBid.id) setSelectedBidForPricing(fresh)
      }
    }
    closeBidForm()
    setSavingBid(false)
  }

  async function saveBidAndOpenCounts(e?: React.FormEvent) {
    e?.preventDefault()
    if (!authUser?.id) return
    if (!projectName.trim()) {
      setError('Project Name is required.')
      return
    }
    if (promptBidDateSentAttestationIfNeeded(bidDateSent)) {
      setError(null)
      return
    }
    const attestSaveErrCounts = validateBidDateSentAttestationForSave()
    if (attestSaveErrCounts) {
      setError(attestSaveErrCounts)
      return
    }
    setSavingBid(true)
    setError(null)
    const payload = {
      drive_link: driveLink.trim() || null,
      plans_link: plansLink.trim() || null,
      count_tooling_plans_link: countToolingPlansLink.trim() || null,
      bid_submission_link: bidSubmissionLink.trim() || null,
      design_drawing_plan_date: designDrawingPlanDate.trim() ? designDrawingPlanDate : null,
      plan_pages: planPages.trim() || null,
      customer_id: gcCustomerId || null,
      gc_builder_id: null,
      ...(editingBid && (myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant') ? { bid_number: bidNumber.trim() || null } : {}),
      project_name: projectName.trim() || null,
      address: address.trim() || null,
      gc_contact_name: gcContactName.trim() || null,
      gc_contact_phone: gcContactPhone.trim() || null,
      gc_contact_email: gcContactEmail.trim() || null,
      estimator_id: estimatorId || null,
      bid_due_date: bidDueDate || null,
      estimated_job_start_date: estimatedJobStartDate.trim() ? estimatedJobStartDate : null,
      bid_date_sent: bidDateSent || null,
      submitted_to: submittedTo.trim() || null,
      outcome: outcome === 'won' || outcome === 'lost' || outcome === 'started_or_complete' ? outcome : null,
      loss_reason: outcome === 'lost' ? (lossReason.trim() || null) : null,
      bid_value: bidValue !== '' && !isNaN(Number(bidValue)) ? Number(bidValue) : null,
      agreed_value: agreedValue !== '' && !isNaN(Number(agreedValue)) ? Number(agreedValue) : null,
      profit: profit !== '' && !isNaN(Number(profit)) ? Number(profit) : null,
      distance_from_office: distanceFromOffice.trim() || null,
      last_contact: fromDatetimeLocal(lastContact),
      notes: notes.trim() || null,
      service_type_id: formServiceTypeId,
    }
    const payloadWithAttestCounts = { ...payload, ...getBidDateSentAttestationPayloadMerge() }
    const followupNoteToSaveCounts = pendingBidSentFollowupSubmissionNote
    let bidId: string
    if (editingBid) {
      const { error: err } = await supabase.from('bids').update(payloadWithAttestCounts).eq('id', editingBid.id)
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidId = editingBid.id
    } else {
      const { data: inserted, error: err } = await supabase
        .from('bids')
        .insert({ ...payloadWithAttestCounts, created_by: authUser.id, materials_model: 'rough' })
        .select('id')
        .single()
      if (err) {
        setError(err.message)
        setSavingBid(false)
        return
      }
      bidId = (inserted as { id: string }).id
    }
    savedBidDateSentRef.current = normalizeBidDateInput(bidDateSent)
    setPendingBidDateSentAttestation(null)
    setPendingAttestationForDate(null)
    setPendingBidSentFollowupSubmissionNote(null)
    const previousOutcomeForNoteCounts = editingBid ? (editingBid.outcome ?? null) : null
    const nextOutcomeForNoteCounts = normalizedOutcomePayload(outcome)
    await insertOutcomeChangeBidNoteAfterSave({
      bidId,
      previousOutcome: previousOutcomeForNoteCounts,
      nextOutcome: nextOutcomeForNoteCounts,
      lossReasonForNote: outcome === 'lost' ? (lossReason.trim() || null) : null,
    })
    if (followupNoteToSaveCounts?.trim()) {
      await insertPendingBidSentFollowupSubmissionNoteAfterSave(bidId, followupNoteToSaveCounts)
    }
    if (!editingBid && formServiceTypeId && formServiceTypeId !== selectedServiceTypeId) {
      setSelectedServiceTypeId(formServiceTypeId)
    }
    const rows = await loadBids(editingBid ? undefined : formServiceTypeId)
    if (editingBid) {
      const fresh = rows.find((b) => b.id === editingBid.id)
      if (fresh) {
        if (selectedBidForCounts?.id === editingBid.id) setSelectedBidForCounts(fresh)
        if (selectedBidForSubmission?.id === editingBid.id) setSelectedBidForSubmission(fresh)
        if (selectedBidForTakeoff?.id === editingBid.id) setSelectedBidForTakeoff(fresh)
        if (selectedBidForCostEstimate?.id === editingBid.id) setSelectedBidForCostEstimate(fresh)
        if (selectedBidForPricing?.id === editingBid.id) setSelectedBidForPricing(fresh)
      }
    }
    closeBidForm()
    setSavingBid(false)
    const bid = rows.find((b) => b.id === bidId)
    if (bid) {
      setSharedBid(bid)
      setActiveTab('counts')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'counts')
        next.set('bidId', bidId)
        return next
      }, { replace: true })
    } else {
      setActiveTab('counts')
      setSearchParams((p) => {
        const next = new URLSearchParams(p)
        next.set('tab', 'counts')
        return next
      }, { replace: true })
    }
  }

  async function saveBidSubmissionQuickAdd(bidId: string, value: string) {
    const { error: err } = await supabase
      .from('bids')
      .update({ bid_submission_link: value.trim() || null })
      .eq('id', bidId)
    if (err) {
      setError(err.message)
      return
    }
    const rows = await loadBids()
    const fresh = rows.find((b) => b.id === bidId)
    if (fresh) {
      if (selectedBidForCounts?.id === bidId) setSelectedBidForCounts(fresh)
      if (selectedBidForSubmission?.id === bidId) setSelectedBidForSubmission(fresh)
      if (selectedBidForTakeoff?.id === bidId) setSelectedBidForTakeoff(fresh)
      if (selectedBidForCostEstimate?.id === bidId) setSelectedBidForCostEstimate(fresh)
      if (selectedBidForPricing?.id === bidId) setSelectedBidForPricing(fresh)
    }
  }

  async function deleteBid() {
    if (!editingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim()) return
    setDeletingBid(true)
    setError(null)
    const { error: err } = await supabase.from('bids').delete().eq('id', editingBid.id)
    if (err) {
      setError(err.message)
      setDeletingBid(false)
      return
    }
    await loadBids()
    closeBidForm()
    setDeletingBid(false)
  }

  async function saveNotesModal() {
    if (!notesModalBid) return
    setSavingNotes(true)
    setError(null)
    const { error: err } = await supabase
      .from('bids')
      .update({ notes: notesModalText.trim() || null })
      .eq('id', notesModalBid.id)
    setSavingNotes(false)
    if (err) {
      setError(err.message)
      return
    }
    await loadBids()
    setNotesModalBid(null)
  }


  function openGcBuilderOrCustomerModal(bid: BidWithBuilder) {
    if (bid.customer_id && bid.customers) {
      setViewingCustomer(bid.customers)
      setViewingGcBuilder(null)
    } else if (bid.gc_builder_id && bid.bids_gc_builders) {
      setViewingGcBuilder(bid.bids_gc_builders)
      setViewingCustomer(null)
    }
  }

  const bidsTyped = bids as BidWithBuilder[]





  const workingBoardEligibleBids = useMemo(() => {
    if (!authUser?.id) return []
    return bids.filter(
      (b) =>
        (b.estimator_id === authUser.id || b.account_manager_id === authUser.id) &&
        bidEligibleForWorkingBoardArchive(b),
    )
  }, [bids, authUser?.id])

  const workingBoardVisibleBids = useMemo(() => {
    return workingBoardEligibleBids.filter((b) => !b.working_board_archived_at)
  }, [workingBoardEligibleBids])

  const workingBoardArchivedBids = useMemo(() => {
    if (myRole === 'dev') {
      return bids.filter((b) => bidEligibleForWorkingBoardArchive(b) && !!b.working_board_archived_at)
    }
    return workingBoardEligibleBids.filter((b) => !!b.working_board_archived_at)
  }, [bids, myRole, workingBoardEligibleBids])

  const bidsPrimaryTabsContainerStyle: CSSProperties = narrowViewport640
    ? {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        gap: '0.35rem',
        minWidth: 0,
      }
    : {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.25rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        minWidth: 0,
      }

  const bidsPrimaryTabMobileTopRowStyle: CSSProperties = narrowViewport640
    ? { flex: 1, minWidth: 0, boxSizing: 'border-box' }
    : {}

  const bidsPrimaryTabMobileBidCostsRowStyle: CSSProperties = narrowViewport640
    ? { width: '100%', boxSizing: 'border-box' }
    : {}

  const bidsPrimaryTabsNarrowTopRowStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '0.25rem',
    width: '100%',
    minWidth: 0,
    alignItems: 'stretch',
  }

  const BIDS_WORKING_TAB_LABEL = 'Unsent/Working'

  const { inboxCount: workingInboxCount } = useWorkingBoardInboxCount(authUser?.id, workingBoardVisibleBids)
  const workingInboxBadgeText = workingInboxCount > 9 ? '9+' : String(workingInboxCount)
  const bidsWorkingTabButton = (
    <span
      style={{
        position: 'relative',
        display: narrowViewport640 ? 'flex' : 'inline-flex',
        alignItems: 'center',
        ...(narrowViewport640 ? { flex: 1, minWidth: 0 } : {}),
      }}
    >
      <button
        type="button"
        onClick={() => {
          setActiveTab('working')
          setSearchParams((p) => {
            const next = new URLSearchParams(p)
            next.set('tab', 'working')
            return next
          })
        }}
        aria-label={
          workingInboxCount > 0
            ? `${BIDS_WORKING_TAB_LABEL}, ${workingInboxCount} in inbox`
            : BIDS_WORKING_TAB_LABEL
        }
        style={{
          ...tabStyle(activeTab === 'working'),
          ...bidsPrimaryTabMobileTopRowStyle,
          ...(narrowViewport640 ? { width: '100%' } : {}),
          ...(narrowViewport640 && workingInboxCount > 0 ? { paddingRight: '1.35rem' } : {}),
        }}
      >
        {BIDS_WORKING_TAB_LABEL}
      </button>
      {workingInboxCount > 0 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            minWidth: '0.875rem',
            height: '0.875rem',
            padding: '0 0.2rem',
            borderRadius: 9999,
            background: '#dc2626',
            color: 'white',
            fontSize: '0.625rem',
            fontWeight: 700,
            lineHeight: '0.875rem',
            textAlign: 'center',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'content-box',
          }}
        >
          {workingInboxBadgeText}
        </span>
      ) : null}
    </span>
  )

  const bidsBidCostsTabButton =
    myRole === 'dev' ? (
      <button
        type="button"
        onClick={() => {
          setActiveTab('bid-costs')
          setSearchParams((p) => {
            const next = new URLSearchParams(p)
            next.set('tab', 'bid-costs')
            return next
          })
        }}
        style={{
          ...tabStyle(activeTab === 'bid-costs'),
          ...bidsPrimaryTabMobileBidCostsRowStyle,
        }}
      >
        Bid Costs
      </button>
    ) : null

  const bidsEstimatorsTabButton = (
    <button
      type="button"
      onClick={() => {
        setActiveTab('estimators')
        setSearchParams((p) => {
          const next = new URLSearchParams(p)
          next.set('tab', 'estimators')
          return next
        })
      }}
      style={{
        ...tabStyle(activeTab === 'estimators'),
        ...bidsPrimaryTabMobileBidCostsRowStyle,
      }}
    >
      Estimators
    </button>
  )

  const { pricingRowsForGrid, pricingPackageSource, coverLetterPricingRows } = useBidPricingRows({
    selectedBidForPricing,
    selectedPricingVersionId,
    pricingCountRows,
    pricingCostEstimate,
    pricingMaterialTotalRoughIn,
    pricingMaterialTotalTopOut,
    pricingMaterialTotalTrimSet,
    pricingLaborRate,
    costEstimatePOModalTaxPercent,
    bidPricingAssignments,
    bidCountRowCustomPrices,
    bidCountRowSubmissionHides,
    priceBookEntries,
    pricingLaborRows,
    pricingFixtureMaterialsFromTakeoff,
  })

  const canPackageAndSendBidPricing =
    myRole === 'dev' ||
    myRole === 'master_technician' ||
    myRole === 'assistant' ||
    myRole === 'estimator'

  function getGcBuilderPhone(): string {
    if (gcCustomerId) {
      const customer = customers.find((c) => c.id === gcCustomerId)
      if (customer) {
        return extractContactInfo(customer.contact_info ?? null).phone || '—'
      }
    }
    if (editingBid?.bids_gc_builders) {
      return editingBid.bids_gc_builders.contact_number ?? '—'
    }
    return '—'
  }

  function getGcBuilderEmail(): string {
    if (gcCustomerId) {
      const customer = customers.find((c) => c.id === gcCustomerId)
      if (customer) {
        return extractContactInfo(customer.contact_info ?? null).email || '—'
      }
    }
    if (editingBid?.bids_gc_builders) {
      return editingBid.bids_gc_builders.email ?? '—'
    }
    return '—'
  }

  // Builder Review: customers sorted by last contact (oldest or newest first, nulls last)
  const wonBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id && b.outcome === 'won') : []
  const lostBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id && b.outcome === 'lost') : []
  const wonBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id && b.outcome === 'won') : []
  const lostBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id && b.outcome === 'lost') : []
  const allBidsForCustomer = viewingCustomer ? bids.filter((b) => b.customer_id === viewingCustomer.id) : []
  const allBidsForBuilder = viewingGcBuilder ? bids.filter((b) => b.gc_builder_id === viewingGcBuilder.id) : []

  // For estimators or primaries with restrictions, only show allowed service types
  const visibleServiceTypes = (myRole === 'estimator' && estimatorServiceTypeIds && estimatorServiceTypeIds.length > 0)
    ? serviceTypes.filter((st) => estimatorServiceTypeIds.includes(st.id))
    : (myRole === 'primary' && primaryServiceTypeIds && primaryServiceTypeIds.length > 0)
      ? serviceTypes.filter((st) => primaryServiceTypeIds.includes(st.id))
      : (myRole === 'superintendent' && superintendentServiceTypeIds && superintendentServiceTypeIds.length > 0)
        ? serviceTypes.filter((st) => superintendentServiceTypeIds.includes(st.id))
        : serviceTypes

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant' && myRole !== 'estimator' && myRole !== 'primary' && myRole !== 'superintendent') {
    return (
      <div style={{ padding: '2rem' }}>
        <p>You do not have access to Bids.</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .pageWrap {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 0.5rem !important;
          }
        }
      `}</style>
      <div className="pageWrap" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {error && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {materialsModelSwitchModal.open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="materials-model-switch-title"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => {
              if (!materialsModelBusy) setMaterialsModelSwitchModal({ open: false, next: null, sourceTab: null })
            }}
          >
            <div
              style={{
                background: 'var(--surface)',
                padding: '1.5rem',
                borderRadius: 8,
                maxWidth: 420,
                width: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 id="materials-model-switch-title" style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>
                Switch materials model?
              </h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                By Stage and Combined data are stored separately. Switching does not copy lines from the other mode.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={materialsModelBusy}
                  onClick={() => setMaterialsModelSwitchModal({ open: false, next: null, sourceTab: null })}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    cursor: materialsModelBusy ? 'wait' : 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={materialsModelBusy}
                  onClick={() => void confirmMaterialsModelSwitch()}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#111827',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: materialsModelBusy ? 'wait' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                  }}
                >
                  {materialsModelBusy ? 'Switching…' : 'Switch'}
                </button>
              </div>
            </div>
          </div>
        )}


      {/* Service types (left) + primary tabs (center) + New Bid (right); trade toggles grayed on Builder Review */}
      {visibleServiceTypes.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrowViewport640 ? 'minmax(0, 1fr)' : '1fr auto 1fr',
            alignItems: narrowViewport640 ? 'stretch' : 'center',
            gap: '0.5rem',
            marginBottom: '0.65rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              minWidth: 0,
              opacity: activeTab === 'builder-review' ? 0.5 : 1,
              pointerEvents: activeTab === 'builder-review' ? 'none' : 'auto',
              cursor: activeTab === 'builder-review' ? 'not-allowed' : 'default',
            }}
          >
            {visibleServiceTypes.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  if (st.id !== selectedServiceTypeId) {
                    setSelectedServiceTypeId(st.id)
                    closeSharedBidAndClearUrl()
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  border: selectedServiceTypeId === st.id ? '2px solid #3b82f6' : '1px solid var(--border-strong)',
                  background: selectedServiceTypeId === st.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: selectedServiceTypeId === st.id ? 'var(--text-blue-500)' : 'var(--text-700)',
                  borderRadius: 6,
                  fontWeight: selectedServiceTypeId === st.id ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {st.name}
              </button>
            ))}
          </div>
          <div style={bidsPrimaryTabsContainerStyle}>
            {narrowViewport640 ? (
              <>
                <div style={bidsPrimaryTabsNarrowTopRowStyle}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('bid-board')
                      setSearchParams((p) => {
                        const next = new URLSearchParams(p)
                        next.set('tab', 'bid-board')
                        return next
                      })
                    }}
                    style={{ ...tabStyle(activeTab === 'bid-board'), ...bidsPrimaryTabMobileTopRowStyle }}
                  >
                    Bid Board
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('builder-review')
                      setSearchParams((p) => {
                        const next = new URLSearchParams(p)
                        next.set('tab', 'builder-review')
                        return next
                      })
                    }}
                    style={{ ...tabStyle(activeTab === 'builder-review'), ...bidsPrimaryTabMobileTopRowStyle }}
                  >
                    Builder Review
                  </button>
                  {bidsWorkingTabButton}
                </div>
                {bidsBidCostsTabButton}
                {bidsEstimatorsTabButton}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('bid-board')
                    setSearchParams((p) => {
                      const next = new URLSearchParams(p)
                      next.set('tab', 'bid-board')
                      return next
                    })
                  }}
                  style={{ ...tabStyle(activeTab === 'bid-board'), ...bidsPrimaryTabMobileTopRowStyle }}
                >
                  Bid Board
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('builder-review')
                    setSearchParams((p) => {
                      const next = new URLSearchParams(p)
                      next.set('tab', 'builder-review')
                      return next
                    })
                  }}
                  style={{ ...tabStyle(activeTab === 'builder-review'), ...bidsPrimaryTabMobileTopRowStyle }}
                >
                  Builder Review
                </button>
                {bidsWorkingTabButton}
                {bidsBidCostsTabButton}
                {bidsEstimatorsTabButton}
              </>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: narrowViewport640 ? 'stretch' : 'flex-end',
              minWidth: 0,
            }}
          >
            <button
              type="button"
              onClick={openNewBid}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                ...(narrowViewport640 ? { width: '100%', boxSizing: 'border-box' } : {}),
              }}
            >
              New Bid
            </button>
          </div>
        </div>
      )}

      <div style={{ borderBottom: '2px solid var(--border)', marginBottom: '2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
          }}
        >
          <div style={visibleServiceTypes.length === 0 ? bidsPrimaryTabsContainerStyle : { display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap', minWidth: 0 }}>
            {visibleServiceTypes.length === 0 && (
              <>
                {narrowViewport640 ? (
                  <>
                    <div style={bidsPrimaryTabsNarrowTopRowStyle}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('bid-board')
                          setSearchParams((p) => {
                            const next = new URLSearchParams(p)
                            next.set('tab', 'bid-board')
                            return next
                          })
                        }}
                        style={{ ...tabStyle(activeTab === 'bid-board'), ...bidsPrimaryTabMobileTopRowStyle }}
                      >
                        Bid Board
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('builder-review')
                          setSearchParams((p) => {
                            const next = new URLSearchParams(p)
                            next.set('tab', 'builder-review')
                            return next
                          })
                        }}
                        style={{ ...tabStyle(activeTab === 'builder-review'), ...bidsPrimaryTabMobileTopRowStyle }}
                      >
                        Builder Review
                      </button>
                      {bidsWorkingTabButton}
                    </div>
                    {bidsBidCostsTabButton}
                    {bidsEstimatorsTabButton}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('bid-board')
                        setSearchParams((p) => {
                          const next = new URLSearchParams(p)
                          next.set('tab', 'bid-board')
                          return next
                        })
                      }}
                      style={{ ...tabStyle(activeTab === 'bid-board'), ...bidsPrimaryTabMobileTopRowStyle }}
                    >
                      Bid Board
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('builder-review')
                        setSearchParams((p) => {
                          const next = new URLSearchParams(p)
                          next.set('tab', 'builder-review')
                          return next
                        })
                      }}
                      style={{ ...tabStyle(activeTab === 'builder-review'), ...bidsPrimaryTabMobileTopRowStyle }}
                    >
                      Builder Review
                    </button>
                    {bidsWorkingTabButton}
                    {bidsBidCostsTabButton}
                    {bidsEstimatorsTabButton}
                  </>
                )}
              </>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
        <button
          type="button"
          onClick={() => {
            setActiveTab('counts')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'counts')
              return next
            })
          }}
          style={bidsTabStyle(activeTab === 'counts', 'counts')}
        >
          Counts
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('takeoffs')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'takeoffs')
              return next
            })
          }}
          style={tabStyle(activeTab === 'takeoffs')}
        >
          Takeoffs
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('labor')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'labor')
              return next
            })
          }}
          style={tabStyle(activeTab === 'labor')}
        >
          Labor
        </button>
        {myRole !== 'superintendent' && (
        <>
        <button
          type="button"
          onClick={() => {
            setActiveTab('pricing')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'pricing')
              return next
            })
          }}
          style={bidsTabStyle(activeTab === 'pricing', 'pricing')}
        >
          Pricing
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('cover-letter')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'cover-letter')
              return next
            })
          }}
          style={bidsTabStyle(activeTab === 'cover-letter', 'cover-letter')}
        >
          Cover Letter
        </button>
        </>
        )}
        {myRole !== 'superintendent' ? (
          <>
            <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('submission-followup')
                setSearchParams((p) => {
                  const next = new URLSearchParams(p)
                  next.set('tab', 'submission-followup')
                  return next
                })
              }}
              style={tabStyle(activeTab === 'submission-followup')}
            >
              Submission & Followup
            </button>
          </>
        ) : null}
        <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        <button
          type="button"
          onClick={() => {
            setActiveTab('rfi')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'rfi')
              return next
            })
          }}
          style={tabStyle(activeTab === 'rfi')}
        >
          RFI
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('change-order')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'change-order')
              return next
            })
          }}
          style={tabStyle(activeTab === 'change-order')}
        >
          Change Order
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('lien-release')
            setSearchParams((p) => {
              const next = new URLSearchParams(p)
              next.set('tab', 'lien-release')
              return next
            })
          }}
          style={tabStyle(activeTab === 'lien-release')}
        >
          Lien Release
        </button>
          </div>
          <div aria-hidden style={{ minWidth: 0 }} />
        </div>
      </div>

      <WorkingBoardArchiveConfirmDialog
        bidId={workingBoardArchiveConfirmBidId}
        label={workingBoardArchiveConfirmLabel}
        onCancel={closeWorkingBoardArchiveConfirm}
        onConfirm={(id) => { closeWorkingBoardArchiveConfirm(); void archiveWorkingBoardBid(id) }}
      />

      {/* Bid Board Tab */}
      {activeTab === 'bid-board' && (
        <BidsBidBoardTab
          bids={bids}
          authUser={authUser}
          isDev={myRole === 'dev'}
                ledgerPrefixMap={ledgerPrefixMap}
          bidPreview={bidPreview}
          sectionOpen={bidBoardSectionOpen}
          onSectionOpenChange={setBidBoardSectionOpen}
          deepLinkHighlightId={bidBoardDeepLinkHighlightId}
          deepLinkHighlightGen={bidBoardDeepLinkHighlightGen}
          onEditBid={openEditBid}
          onOpenGcBuilderOrCustomer={openGcBuilderOrCustomerModal}
          onLastContactClick={handleLastContactClick}
          onOpenCounts={(bid) => selectBidAndSyncUrl(bid, 'counts')}
          onError={setError}
          onReloadBids={() => { void loadBids() }}
          onReloadCustomerContacts={() => { void loadCustomerContacts() }}
          onOpenEvaluateChecklist={() => { setEvaluateChecked({}); setEvaluateModalOpen(true) }}
          lostSummaryModalOpen={lostSummaryModalOpen}
          lostSummaryInitialStaffTab={lostSummaryInitialStaffTab}
          onOpenLostSummary={() => setLostSummaryModalOpen(true)}
          onCloseLostSummary={closeLostSummaryModal}
          showLostModalLabor={showLostModalLabor}
                onSaveLossReason={saveLossReasonFromLostSummaryModal}
          workingBoardArchivedBids={workingBoardArchivedBids}
        />
      )}

      {/* Builder Review Tab */}
      {activeTab === 'builder-review' && (
        <BidsBuilderReviewTab
          bids={bids}
          customers={customers}
          customerContacts={customerContacts}
          customerContactPersons={customerContactPersons}
          lastContactFromEntries={lastContactFromEntries}
          authUser={authUser}
          narrowViewport640={narrowViewport640}
          deepLinkHighlightCustomerId={builderReviewDeepLinkHighlightCustomerId}
          deepLinkHighlightGen={builderReviewDeepLinkHighlightGen}
          onLoadCustomers={loadCustomers}
          onReloadCustomerContacts={() => { void loadCustomerContacts() }}
          onReloadContactPersons={() => { void loadCustomerContactPersons() }}
          onReloadBids={() => { void loadBids() }}
          onError={setError}
          onEditBid={openEditBid}
          onNewBidWithCustomer={openNewBidWithCustomer}
          onViewSubmissions={(bid) => { setSelectedBidForSubmission(bid); setActiveTab('submission-followup'); setScrollToContactFromBidBoard(true) }}
          onSetCustomers={setCustomers}
          newCustomerModal={newCustomerModal}
          editCustomerModal={editCustomerModal}
        />
      )}

      {activeTab === 'working' && authUser?.id ? (
        <div>
          <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Drag unsent bids between columns. You see bids where you are Estimator or Account Man. New bids appear in Inbox until moved.
          </p>
          <BidsWorkingBoard
            userId={authUser.id}
            eligibleBids={workingBoardEligibleBids}
            visibleBids={workingBoardVisibleBids}
            deepLinkBidId={workingBoardDeepLinkBidId}
            onDeepLinkHandled={onWorkingBoardDeepLinkHandled}
            onLoadError={(m) => setError(m)}
            onMutatedNotes={() => { void loadBids() }}
            onMutatedNotesCustomer={() => { void loadCustomerContacts(); void loadBids() }}
            onOpenPreviewBid={(bidId) => {
              const b = bids.find((x) => x.id === bidId)
              if (b) bidPreview?.openBidPreviewFromBid(b)
              else void bidPreview?.openBidPreview(bidId)
            }}
          />
        </div>
      ) : null}

      {/* Bid Costs Tab - Dev only */}
      {myRole === 'dev' && activeTab === 'bid-costs' && (
        <BidsBidCostsTab
          bids={bids}
          teamLaborData={teamLaborDataForBids}
          onSelectBid={setSharedBid}
        />
      )}

      {/* Estimators Tab - viewable by everyone */}
      {activeTab === 'estimators' && (
        <BidsEstimatorsTab
          active={activeTab === 'estimators'}
          viewerRole={myRole}
          onOpenBidPreview={(bidId) => {
            const b = bids.find((x) => x.id === bidId)
            if (b) bidPreview?.openBidPreviewFromBid(b)
            else void bidPreview?.openBidPreview(bidId)
          }}
        />
      )}

      {/* Counts Tab */}
      {activeTab === 'counts' && (
        <BidsCountsTab
          bids={bids}
          selectedBidForCounts={selectedBidForCounts}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreview}
          countRows={countRows}
          setCountRows={setCountRows}
          refreshAfterCountsChange={refreshAfterCountsChange}
          skipNextLoadCountRowsRef={skipNextLoadCountRowsRef}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'counts')}
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
          ledgerPrefixMap={ledgerPrefixMap}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={openEditBid}
          onCountSourceLinkSaved={async (bidId) => {
            const rows = await loadBids()
            const fresh = rows.find((b) => b.id === bidId)
            if (fresh && selectedBidForCounts?.id === bidId) setSelectedBidForCounts(fresh)
          }}
        />
      )}

      {/* Takeoffs Tab */}
      {activeTab === 'takeoffs' && (
        <>
        {selectedBidForTakeoff && (
          <BidVersionPicker
            bidId={selectedBidForTakeoff.id}
            bidVersions={bidVersions}
            selectedBidVersionId={selectedBidVersionId}
            currentPricingId={selectedPricingVersionId}
            fallbackPricingSourceId={defaultPriceBookTemplateId}
            isExactMaterials={selectedBidForTakeoff.materials_model === 'exact'}
            onSwitch={(versionId) => switchActiveVersion(selectedBidForTakeoff.id, versionId)}
            reloadVersions={() => Promise.all([loadBidVersions(selectedBidForTakeoff.id), loadBidPricings(selectedBidForTakeoff.id)]).then(() => {})}
          />
        )}
        <BidsTakeoffTab
          bids={bidsTyped}
          selectedBidForTakeoff={selectedBidForTakeoff}
          selectedBidVersionId={selectedBidVersionId}
          selectedBidForCostEstimate={selectedBidForCostEstimate}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreview}
          error={error}
          setError={setError}
          selectedServiceTypeId={selectedServiceTypeId}
          serviceTypes={serviceTypes}
          authUser={authUser}
          loadBids={loadBids}
          activeTab={activeTab}
          costEstimatePOModalTaxPercent={costEstimatePOModalTaxPercent}
          setCostEstimatePOModalTaxPercent={setCostEstimatePOModalTaxPercent}
          takeoffCountRows={takeoffCountRows}
          takeoffMappings={takeoffMappings}
          setTakeoffMappings={setTakeoffMappings}
          takeoffRoughPartLines={takeoffRoughPartLines}
          setTakeoffRoughPartLines={setTakeoffRoughPartLines}
                                      takeoffRoughCatalogLowestByPartId={takeoffRoughCatalogLowestByPartId}
          setTakeoffRoughCatalogLowestByPartId={setTakeoffRoughCatalogLowestByPartId}
                                      materialTemplates={materialTemplates}
          draftPOs={draftPOs}
          takeoffBookVersions={takeoffBookVersions}
          takeoffBookEntries={takeoffBookEntries}
          setTakeoffBookEntries={setTakeoffBookEntries}
          selectedTakeoffBookVersionId={selectedTakeoffBookVersionId}
          setSelectedTakeoffBookVersionId={setSelectedTakeoffBookVersionId}
          takeoffBookEntriesVersionId={takeoffBookEntriesVersionId}
          setTakeoffBookEntriesVersionId={setTakeoffBookEntriesVersionId}
          costEstimate={costEstimate}
          costEstimateCountRows={costEstimateCountRows}
          purchaseOrdersForCostEstimate={purchaseOrdersForCostEstimate}
          costEstimateMaterialTotalRoughIn={costEstimateMaterialTotalRoughIn}
          costEstimateMaterialTotalTopOut={costEstimateMaterialTotalTopOut}
          costEstimateMaterialTotalTrimSet={costEstimateMaterialTotalTrimSet}
          loadDraftPOs={loadDraftPOs}
          loadTakeoffBookVersions={loadTakeoffBookVersions}
          loadTakeoffBookEntries={loadTakeoffBookEntries}
          saveBidSelectedTakeoffBookVersion={saveBidSelectedTakeoffBookVersion}
          loadPurchaseOrdersForCostEstimate={loadPurchaseOrdersForCostEstimate}
          loadCostEstimate={loadCostEstimate}
          ensureCostEstimateForBid={ensureCostEstimateForBid}
          loadMaterialTemplates={loadMaterialTemplates}
          setCostEstimatePO={setCostEstimatePO}
          openMaterialsModelSwitch={openMaterialsModelSwitch}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'takeoffs')}
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
          ledgerPrefixMap={ledgerPrefixMap}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={openEditBid}
        />
        </>
      )}

      {/* Labor Tab */}
      {activeTab === 'labor' && (
        <BidsLaborTab
          bids={bidsTyped}
          selectedBidVersionId={selectedBidVersionId}
          selectedBidForCostEstimate={selectedBidForCostEstimate}
          setSelectedBidForCostEstimate={setSelectedBidForCostEstimate}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreview}
          error={error}
          setError={setError}
          selectedServiceTypeId={selectedServiceTypeId}
          fixtureTypes={fixtureTypes}
          getOrCreateFixtureTypeId={getOrCreateFixtureTypeId}
          loadBids={loadBids}
          costEstimatePOModalTaxPercent={costEstimatePOModalTaxPercent}
          costEstimateDistanceInput={costEstimateDistanceInput}
          setCostEstimateDistanceInput={setCostEstimateDistanceInput}
          costEstimate={costEstimate}
          costEstimateLaborRows={costEstimateLaborRows}
          setCostEstimateLaborRows={setCostEstimateLaborRows}
          costEstimateCountRows={costEstimateCountRows}
          purchaseOrdersForCostEstimate={purchaseOrdersForCostEstimate}
          costEstimateMaterialTotalRoughIn={costEstimateMaterialTotalRoughIn}
          costEstimateMaterialTotalTopOut={costEstimateMaterialTotalTopOut}
          costEstimateMaterialTotalTrimSet={costEstimateMaterialTotalTrimSet}
          laborRateInput={laborRateInput}
          setLaborRateInput={setLaborRateInput}
          drivingCostRate={drivingCostRate}
          setDrivingCostRate={setDrivingCostRate}
          hoursPerTrip={hoursPerTrip}
          setHoursPerTrip={setHoursPerTrip}
          estimatorCostUseFlat={estimatorCostUseFlat}
          setEstimatorCostUseFlat={setEstimatorCostUseFlat}
          estimatorCostPerCount={estimatorCostPerCount}
          setEstimatorCostPerCount={setEstimatorCostPerCount}
          estimatorCostFlatAmount={estimatorCostFlatAmount}
          setEstimatorCostFlatAmount={setEstimatorCostFlatAmount}
          travelPeople={travelPeople}
          setTravelPeople={setTravelPeople}
          travelNights={travelNights}
          setTravelNights={setTravelNights}
          travelMealsRate={travelMealsRate}
          setTravelMealsRate={setTravelMealsRate}
          travelHotelRate={travelHotelRate}
          setTravelHotelRate={setTravelHotelRate}
          equipmentRows={costEstimateEquipmentRows}
          setEquipmentRows={setCostEstimateEquipmentRows}
          permitRows={costEstimatePermitRows}
          setPermitRows={setCostEstimatePermitRows}
          subcontractorRows={costEstimateSubcontractorRows}
          setSubcontractorRows={setCostEstimateSubcontractorRows}
          wasteRows={costEstimateWasteRows}
          setWasteRows={setCostEstimateWasteRows}
          otherRows={costEstimateOtherRows}
          setOtherRows={setCostEstimateOtherRows}
          laborBookVersions={laborBookVersions}
          laborBookEntries={laborBookEntries}
          setLaborBookEntries={setLaborBookEntries}
          selectedLaborBookVersionId={selectedLaborBookVersionId}
          setSelectedLaborBookVersionId={setSelectedLaborBookVersionId}
          laborBookEntriesVersionId={laborBookEntriesVersionId}
          setLaborBookEntriesVersionId={setLaborBookEntriesVersionId}
          loadCostEstimateData={loadCostEstimateData}
          loadLaborBookVersions={loadLaborBookVersions}
          loadLaborBookEntries={loadLaborBookEntries}
          saveBidSelectedLaborBookVersion={saveBidSelectedLaborBookVersion}
          openMaterialsModelSwitch={openMaterialsModelSwitch}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'labor')}
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
          ledgerPrefixMap={ledgerPrefixMap}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={openEditBid}
        />
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <>
        {selectedBidForPricing && (
          <BidVersionPicker
            bidId={selectedBidForPricing.id}
            bidVersions={bidVersions}
            selectedBidVersionId={selectedBidVersionId}
            currentPricingId={selectedPricingVersionId}
            fallbackPricingSourceId={defaultPriceBookTemplateId}
            isExactMaterials={selectedBidForPricing.materials_model === 'exact'}
            onSwitch={(versionId) => switchActiveVersion(selectedBidForPricing.id, versionId)}
            reloadVersions={() => Promise.all([loadBidVersions(selectedBidForPricing.id), loadBidPricings(selectedBidForPricing.id)]).then(() => {})}
          />
        )}
        <BidsPricingTab
          bids={bidsTyped}
          selectedBidForPricing={selectedBidForPricing}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreview}
          error={error}
          setError={setError}
          selectedServiceTypeId={selectedServiceTypeId}
          fixtureTypes={fixtureTypes}
          getOrCreateFixtureTypeId={getOrCreateFixtureTypeId}
          loadBids={loadBids}
          costEstimatePOModalTaxPercent={costEstimatePOModalTaxPercent}
          canPackageAndSendBidPricing={canPackageAndSendBidPricing}
          estimatorUsers={estimatorUsers}
          ledgerPrefixMap={ledgerPrefixMap}
          profileName={profileName}
          priceBookVersions={priceBookVersions}
          priceBookEntries={priceBookEntries}
          setPriceBookEntries={setPriceBookEntries}
          bidPricingAssignments={bidPricingAssignments}
          bidCountRowCustomPrices={bidCountRowCustomPrices}
          bidCountRowSubmissionHides={bidCountRowSubmissionHides}
          selectedBidVersionId={selectedBidVersionId}
          selectedPricingVersionId={selectedPricingVersionId}
          setSelectedPricingVersionId={setSelectedPricingVersionId}
          pricingCountRows={pricingCountRows}
          pricingCostEstimate={pricingCostEstimate}
          pricingLaborRows={pricingLaborRows}
          pricingMaterialTotalRoughIn={pricingMaterialTotalRoughIn}
          pricingMaterialTotalTopOut={pricingMaterialTotalTopOut}
          pricingMaterialTotalTrimSet={pricingMaterialTotalTrimSet}
          pricingLaborRate={pricingLaborRate}
          pricingFixtureMaterialsFromTakeoff={pricingFixtureMaterialsFromTakeoff}
          teamLaborDataForBids={teamLaborDataForBids}
          templatePriceBookVersions={templatePriceBookVersions}
          templatesMode={templatesMode}
          setTemplatesMode={setTemplatesMode}
          loadTemplatePriceBookVersions={loadTemplatePriceBookVersions}
          rememberLastPriceBookTemplate={rememberLastPriceBookTemplate}
          loadBidPricings={loadBidPricings}
          loadPriceBookEntries={loadPriceBookEntries}
          loadBidPricingAssignments={loadBidPricingAssignments}
          reloadPricingForBid={loadPricingDataForBid}
          saveBidSelectedPriceBookVersion={saveBidSelectedPriceBookVersion}
          openMaterialsModelSwitch={openMaterialsModelSwitch}
          pricingRowsForGrid={pricingRowsForGrid}
          pricingPackageSource={pricingPackageSource}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'pricing')}
          onNavigateToLaborDirectCosts={(bid) => { selectBidAndSyncUrl(bid, 'labor'); setScrollToLaborDirectCosts(true) }}
          pricingEquipmentRows={pricingEquipmentRows}
          pricingPermitRows={pricingPermitRows}
          pricingSubcontractorRows={pricingSubcontractorRows}
          pricingWasteRows={pricingWasteRows}
          pricingOtherRows={pricingOtherRows}
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={openEditBid}
          onNavigateToLabor={() => setActiveTab('labor')}
          onNavigateBidToTab={(bid, tab) => selectBidAndSyncUrl(bid, tab)}
        />
        </>
      )}

      {/* Cover Letter Tab */}
      {activeTab === 'cover-letter' && (
        <>
        {selectedBidForPricing && (
          <BidVersionPicker
            bidId={selectedBidForPricing.id}
            bidVersions={bidVersions}
            selectedBidVersionId={selectedBidVersionId}
            currentPricingId={selectedPricingVersionId}
            fallbackPricingSourceId={defaultPriceBookTemplateId}
            isExactMaterials={selectedBidForPricing.materials_model === 'exact'}
            onSwitch={(versionId) => switchActiveVersion(selectedBidForPricing.id, versionId)}
            reloadVersions={() => Promise.all([loadBidVersions(selectedBidForPricing.id), loadBidPricings(selectedBidForPricing.id)]).then(() => {})}
          />
        )}
        <BidsCoverLetterTab
          bids={bidsTyped}
          selectedBidForPricing={selectedBidForPricing}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreview}
          serviceTypes={serviceTypes}
          pricingCountRows={pricingCountRows}
          coverLetterPricingRows={coverLetterPricingRows}
          activePricingName={priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? null}
          bidPricings={priceBookVersions}
          reloadBidPricings={() => (selectedBidForPricing ? loadBidPricings(selectedBidForPricing.id).then(() => {}) : Promise.resolve())}
          loadBids={loadBids}
          coverLetterInclusionsByBid={coverLetterInclusionsByBid}
          setCoverLetterInclusionsByBid={setCoverLetterInclusionsByBid}
          coverLetterExclusionsByBid={coverLetterExclusionsByBid}
          setCoverLetterExclusionsByBid={setCoverLetterExclusionsByBid}
          coverLetterTermsByBid={coverLetterTermsByBid}
          setCoverLetterTermsByBid={setCoverLetterTermsByBid}
          coverLetterIncludeDesignDrawingPlanDateByBid={coverLetterIncludeDesignDrawingPlanDateByBid}
          setCoverLetterIncludeDesignDrawingPlanDateByBid={setCoverLetterIncludeDesignDrawingPlanDateByBid}
          coverLetterCustomAmountByBid={coverLetterCustomAmountByBid}
          setCoverLetterCustomAmountByBid={setCoverLetterCustomAmountByBid}
          coverLetterUseCustomAmountByBid={coverLetterUseCustomAmountByBid}
          setCoverLetterUseCustomAmountByBid={setCoverLetterUseCustomAmountByBid}
          coverLetterIncludeSignatureByBid={coverLetterIncludeSignatureByBid}
          setCoverLetterIncludeSignatureByBid={setCoverLetterIncludeSignatureByBid}
          coverLetterIncludeFixturesPerPlanByBid={coverLetterIncludeFixturesPerPlanByBid}
          setCoverLetterIncludeFixturesPerPlanByBid={setCoverLetterIncludeFixturesPerPlanByBid}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'cover-letter')}
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
          ledgerPrefixMap={ledgerPrefixMap}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={openEditBid}
          onSaveBidSubmissionQuickAdd={saveBidSubmissionQuickAdd}
        />
        </>
      )}

      {/* Submission & Followup Tab */}
      {activeTab === 'submission-followup' && (
        <BidSubmissionFollowupTab
          bids={bids}
          authUser={authUser}
          selectedBid={selectedBidForSubmission}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'submission-followup')}
          onClearBid={() => setSelectedBidForSubmission(null)}
          onEditBid={openEditBid}
          onOpenParty={openGcBuilderOrCustomerModal}
          lastContactFromEntries={lastContactFromEntries}
          customerContacts={customerContacts}
                  estimatorUsers={estimatorUsers}
          onError={(m) => setError(m)}
          onReloadBids={() => { void loadBids() }}
          onReloadCustomerContacts={() => { void loadCustomerContacts() }}
          canAddChecklistTask={canAddChecklistFromSubmission}
          onAddChecklistTask={openSubmissionFollowupChecklistTask}
          onShowSentBidScript={() => setShowSentBidScript(true)}
          onShowBidQuestionScript={() => setShowBidQuestionScript(true)}
          onDownloadApprovalPdf={() => { void downloadApprovalPdf() }}
          summaryCardRef={submissionSummaryCardRef}
          submissionSectionOpen={submissionSectionOpen}
          setSubmissionSectionOpen={setSubmissionSectionOpen}
        />
      )}

      {/* RFI Tab */}
      {activeTab === 'rfi' && (
        <BidRfiTab
          bids={bids}
          authUser={authUser}
          selectedBid={selectedBidForRfi}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'rfi')}
          onClose={() => setSelectedBidForRfi(null)}
          onEditBid={(bid) => openEditBid(bid)}
        />
      )}
      {/* Change Order Tab */}
      {activeTab === 'change-order' && (
        <BidChangeOrderTab
          bids={bids}
          authUser={authUser}
          selectedBid={selectedBidForChangeOrder}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'change-order')}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={(bid) => openEditBid(bid)}
        />
      )}

      {/* Lien Release Tab */}
      {activeTab === 'lien-release' && (
        <BidLienReleaseTab
          bids={bids}
          selectedBid={selectedBidForLienRelease}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'lien-release')}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={(bid) => { setBidFormOpen(true); setEditingBid(bid) }}
        />
      )}

      {/* New/Edit Bid Modal */}
      <BidFormModal
        open={bidFormOpen}
        editingBid={editingBid}
        closeBidForm={closeBidForm}
        saveBid={saveBid}
        form={bidForm}
        estimatorUsers={estimatorUsers}
        myRole={myRole}
        visibleServiceTypes={visibleServiceTypes}
        bidDateSent={bidDateSent}
        handleBidDateSentInputChange={handleBidDateSentInputChange}
        handleBidDateSentBlur={handleBidDateSentBlur}
        pendingAttestationForDate={pendingAttestationForDate}
        pendingBidDateSentAttestation={pendingBidDateSentAttestation}
        gcCustomerDropdownOpen={gcCustomerDropdownOpen}
        setGcCustomerDropdownOpen={setGcCustomerDropdownOpen}
        customers={customers}
        loadCustomers={loadCustomers}
        openNewCustomerModal={newCustomerModal?.openNewCustomerModal}
        getCustomerDisplay={getCustomerDisplay}
        getGcBuilderPhone={getGcBuilderPhone}
        getGcBuilderEmail={getGcBuilderEmail}
        saveBidAndOpenCounts={saveBidAndOpenCounts}
        savingBid={savingBid}
        setDeleteBidModalOpen={setDeleteBidModalOpen}
        setDeleteConfirmProjectName={setDeleteConfirmProjectName}
        setError={setError}
        showArchiveFromUnsentWorking={Boolean(
          editingBid &&
            !editingBid.working_board_archived_at &&
            bidEligibleForWorkingBoardArchive(editingBid) &&
            canUserArchiveBidOnWorkingBoard(editingBid, authUser?.id, myRole),
        )}
        archiveFromUnsentWorkingBusy={archiveWorkingBoardBusyBidId === editingBid?.id}
        onRequestArchiveFromUnsentWorking={
          editingBid ? () => promptArchiveWorkingBoardBid(editingBid.id) : undefined
        }
        serviceTypeSwitchSiblings={bidServiceTypeSwitchSiblings}
        onServiceTypeSwitchModalOpen={refreshBidServiceTypeSwitchSiblings}
        onDuplicateBidToServiceType={duplicateBidToServiceTypeHandler}
        onOpenExistingBidFromServiceTypeSwitch={openExistingBidFromServiceTypeSwitch}
      />

      {bidSentAttestModalOpen && (
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="bid-sent-attest-title"
            style={{
              background: 'var(--surface)',
              padding: '1.5rem 2rem',
              borderRadius: 8,
              maxWidth: '520px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <h2 id="bid-sent-attest-title" style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.125rem' }}>
              Confirm bid sent
            </h2>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Check each statement when it applies. You must confirm all three before the new sent date is applied.
            </p>
            {[
              {
                key: 'email' as const,
                checked: bidSentAckEmail,
                setChecked: setBidSentAckEmail,
                checkedAt: bidSentAckEmailAt,
                setAt: setBidSentAckEmailAt,
                label: 'I sent the bid via email and the client knew it was coming',
              },
              {
                key: 'phone' as const,
                checked: bidSentAckPhone,
                setChecked: setBidSentAckPhone,
                checkedAt: bidSentAckPhoneAt,
                setAt: setBidSentAckPhoneAt,
                label: 'I followed up with a phone call',
              },
              {
                key: 'honesty' as const,
                checked: bidSentAckHonesty,
                setChecked: setBidSentAckHonesty,
                checkedAt: bidSentAckHonestyAt,
                setAt: setBidSentAckHonestyAt,
                label: 'I understand that lying about this will result in my suspension',
              },
            ].map((row) => (
              <div key={row.key} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) => {
                      const on = e.target.checked
                      row.setChecked(on)
                      if (on) row.setAt(new Date().toISOString())
                      else row.setAt(null)
                    }}
                    style={{ marginTop: '0.2rem' }}
                  />
                  <span>{row.label}</span>
                </label>
                {row.checked && row.checkedAt && authUser?.id ? (
                  <div style={{ marginLeft: '1.5rem', marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    {bidAttestationDisplayName(estimatorUsers, authUser.id)} ·{' '}
                    {new Date(row.checkedAt).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                ) : null}
              </div>
            ))}
            <div style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
                Adds to bid note:
              </div>
              <textarea
                value={bidSentAttestFollowupNoteDraft}
                onChange={(e) => setBidSentAttestFollowupNoteDraft(e.target.value)}
                placeholder="What happened when you called them or left a voicemail?"
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={cancelBidSentAttestationModal}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bidSentAckEmail || !bidSentAckPhone || !bidSentAckHonesty || !authUser?.id}
                onClick={confirmBidSentAttestationModal}
                style={{
                  padding: '0.5rem 1rem',
                  background: !bidSentAckEmail || !bidSentAckPhone || !bidSentAckHonesty ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: !bidSentAckEmail || !bidSentAckPhone || !bidSentAckHonesty ? 'not-allowed' : 'pointer',
                }}
              >
                Confirm sent date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Contact Person modal (Builder Review) */}
      {/* Delete bid confirmation modal */}
      {deleteBidModalOpen && editingBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete bid</h2>
            <p style={{ marginBottom: '1rem' }}>
              {editingBid.project_name
                ? <>Type the project name <strong>{editingBid.project_name}</strong> to confirm.</>
                : 'This bid has no project name; leave the field empty to confirm.'}
            </p>
            <input
              type="text"
              value={deleteConfirmProjectName}
              onChange={(e) => { setDeleteConfirmProjectName(e.target.value); setError(null) }}
              placeholder={editingBid.project_name ? 'Project name' : 'No project name'}
              disabled={deletingBid}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              autoComplete="off"
            />
            {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={deleteBid}
                disabled={deletingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim()}
                style={{ padding: '0.5rem 1rem', color: 'var(--text-red-700)', background: 'var(--surface)', border: '1px solid #b91c1c', borderRadius: 4, cursor: deletingBid || deleteConfirmProjectName.trim() !== (editingBid.project_name ?? '').trim() ? 'not-allowed' : 'pointer' }}
              >
                {deletingBid ? 'Deleting…' : 'Delete bid'}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteBidModalOpen(false); setDeleteConfirmProjectName(''); setError(null) }}
                disabled={deletingBid}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: deletingBid ? 'not-allowed' : 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes quick-edit modal */}
      {notesModalBid && (
        <ModalShell cardStyle={{ background: 'var(--surface)', padding: '2rem', borderRadius: 8, maxWidth: '500px', width: '90%' }}>
            <h2 style={{ marginBottom: '1rem' }}>Notes – {bidDisplayName(notesModalBid) || 'Bid'}</h2>
            <textarea
              value={notesModalText}
              onChange={(e) => setNotesModalText(e.target.value)}
              placeholder="Add or edit notes…"
              rows={6}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setNotesModalBid(null)}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveNotesModal}
                disabled={savingNotes}
                style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                {savingNotes ? 'Saving…' : 'Save'}
              </button>
            </div>
        </ModalShell>
      )}

      {/* GC/Builder view modal (customer) */}
      <BidPartyDetailModal
        open={!!viewingCustomer}
        name={viewingCustomer?.name ?? ''}
        address={viewingCustomer?.address ?? null}
        contactRows={(() => {
          if (!viewingCustomer) return []
          const c = extractContactInfo(viewingCustomer.contact_info)
          return [
            ...(c.phone ? [{ label: 'Phone', value: c.phone }] : []),
            ...(c.email ? [{ label: 'Email', value: c.email }] : []),
          ]
        })()}
        wonBids={wonBidsForCustomer}
        lostBids={lostBidsForCustomer}
        allBids={allBidsForCustomer}
        onClose={() => setViewingCustomer(null)}
        onSelectBid={(bid) => openEditBid(bid)}
      />

      {/* GC/Builder view modal (legacy bids_gc_builders) */}
      <BidPartyDetailModal
        open={!!viewingGcBuilder}
        name={viewingGcBuilder?.name ?? ''}
        address={viewingGcBuilder?.address ?? null}
        contactRows={viewingGcBuilder ? [{ label: 'Contact number', value: viewingGcBuilder.contact_number || '—' }] : []}
        wonBids={wonBidsForBuilder}
        lostBids={lostBidsForBuilder}
        allBids={allBidsForBuilder}
        onClose={() => setViewingGcBuilder(null)}
        onSelectBid={(bid) => openEditBid(bid)}
      />

      {/* Checklist modal */}
      {evaluateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              maxWidth: 700,
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Evaluate Bids Checklist</h2>
              <button
                type="button"
                onClick={() => { setEvaluateModalOpen(false); setEvaluateChecked({}) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {evaluateChecklist.map((item) => (
                <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem 1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={!!evaluateChecked[item.id]}
                      onChange={(e) =>
                        setEvaluateChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                    />
                    <span>{item.title}</span>
                  </label>
                  {item.body.map((line, idx) => (
                    <p key={idx} style={{ margin: '0.125rem 0', fontSize: '0.9rem' }}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { setEvaluateModalOpen(false); setEvaluateChecked({}) }}
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sent Bid Script modal */}
      {showSentBidScript && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Sent Bid Script</h3>
              <button
                type="button"
                onClick={() => setShowSentBidScript(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
              {[
                'This is [Master] from Click Plumbing and Electrical',
                'We just sent you our bid for [project name] [time since sent] from my email [your email]',
                'I wanted to make sure you received our email for your proposed work',
                'Is there else you need from me?',
                'If not I wanted to make myself available if you have any questions',
                "and if you know if there is a price point that we're above or below you would like to meet for your project",
              ].map((line, i) => (
                <div key={i} style={{ marginBottom: '0.5rem' }}>{i + 1}) {line}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bid Question Script modal */}
      {showBidQuestionScript && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, maxWidth: 600, width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Bid Question Script</h3>
              <button
                type="button"
                onClick={() => setShowBidQuestionScript(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
We saw some structural issues with your plans and I wanted to get clarity...
            </pre>
          </div>
        </div>
      )}

            </div>
    </>
  )
}

