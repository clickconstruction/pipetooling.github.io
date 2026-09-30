import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { canSeeBidBoardJobLinks } from '../lib/bids/bidBoardJobLinks'
import { laborBookForTrade } from '../lib/bids/laborEntryProvenance'
import { useBidBoardScope } from '../hooks/useBidBoardScope'
import { useBidsLoadGates, useBidsPageData } from '../hooks/useBidsPageData'
import { useBidsDeepLinks } from '../hooks/useBidsDeepLinks'
import { BID_REVIEWED_EVENT } from '../lib/bids/bidReview'
import { supabase } from '../lib/supabase'
import { upsertBidNotesReadWatermark } from '../lib/userBidNotesReadState'
import { withScopeLabel } from '../lib/bids/bidSentCounts'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { useAuth } from '../hooks/useAuth'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { useWorkingBoardInboxCount } from '../hooks/useWorkingBoardInboxCount'
import { useNarrowViewport640 } from '../hooks/useNarrowViewport640'
import { useBidPricingEngine } from '../hooks/useBidPricingEngine'
import { useBidPricingRows } from '../hooks/useBidPricingRows'
import { useBidCustomCosts } from '../hooks/useBidCustomCosts'
import { useToastContext } from '../contexts/ToastContext'
import { useRoleGate } from '../hooks/useRoleGate'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import {
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../lib/ledgerDisplayPrefixes'
import { useNewCustomerModal } from '../contexts/NewCustomerModalContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { useBidPreview } from '../contexts/BidPreviewModalContext'
import { submissionFollowupBidShareUrl } from '../lib/submissionFollowupBidShareUrl'
import type { BreakdownJumpTarget } from '../lib/bids/bidTabRowJump'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import { BidsWorkingBoard } from '../components/bids/BidsWorkingBoard'
import { BidPartyDetailModal } from '../components/bids/BidPartyDetailModal'
import { BidFormModal } from '../components/bids/BidFormModal'
import { useBidWindowState } from '../hooks/useBidWindowState'
import { useBidEditController } from '../hooks/useBidEditController'
import { BidWindowModal } from '../components/bids/BidWindowModal'
import { BidsEstimatorsTab } from '../components/bids/BidsEstimatorsTab'
import { Database } from '../types/database'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { bidAttestationDisplayName } from '../lib/bidDateSentDisplay'
import { useBidDateSentAttestation } from '../hooks/useBidDateSentAttestation'
import { BidDeleteConfirmModal } from '../components/bids/BidDeleteConfirmModal'
import { BidEvaluateChecklistModal } from '../components/bids/BidEvaluateChecklistModal'
import { BidSentAttestationModal } from '../components/bids/BidSentAttestationModal'
import { BidsBidBoardTab } from '../components/bids/BidsBidBoardTab'
import { BidRfiTab } from '../components/bids/BidRfiTab'
import { BidsAuditsTab } from '../components/bids/BidsAuditsTab'
import { BID_FORM_FOCUS_ELEMENT_ID } from '../lib/bids/bidFormFocus'
import { envelopeParamBidNumber } from '../lib/bids/robotLayer'
import { useBidRobotLayer } from '../hooks/useBidRobotLayer'
import { BidsRobotOverlays } from '../components/bids/BidsRobotOverlays'
import type { BidFlowDoor, BidFlowStep } from '../lib/bids/bidFlow'
import { landOnBidFlowTarget, landOnElement, parseLandingParam } from '../lib/bids/bidFlowLanding'
import { BidsRobotQueueTab } from '../components/bids/BidsRobotQueueTab'
import { plansWaitingBids, plansWaitingWords } from '../lib/bids/bidPlansFolder'
import { BidsRobotMirrorTab } from '../components/bids/BidsRobotMirrorTab'
import { RobotGroupStrip } from '../components/bids/RobotGroupStrip'
import { BidsRobotScoreboardTab } from '../components/bids/BidsRobotScoreboardTab'
import { normalizeBidNumber } from '../lib/bids/confidenceBoard'
import { BidsRobotConsoleTab } from '../components/bids/BidsRobotConsoleTab'

/** The lenses under the one 🤖 Robots tab (v2.2527); `robot-shadows` is a redirect alias, `robot-queue` / `robot-console` are dev-only. */
import { bidsTabOpenFor, canOpenBids, isFollowupLens, isRobotLens, type BidsTabKey } from '../lib/bids/bidsTabAccess'
import { followupLensCaption, followupLenses, followupNeedsReasonChipShows, robotLensBarShows, robotLensCaption, robotLenses } from '../lib/bids/bidsLenses'
import { BidsLensBar } from '../components/bids/BidsLensBar'
import { useBidAuditsPendingCount } from '../hooks/useBidAuditsPendingCount'
import { canWorkRobotAudits } from '../lib/bids/bidAudits'
import { BidSubmissionFollowupTab } from '../components/bids/BidSubmissionFollowupTab'
import { BidsBidCostsTab } from '../components/bids/BidsBidCostsTab'
import { canSeeBidCostDollars, canSeeBidCosts } from '../lib/bids/bidPursuit'
import { BidsCountsTab } from '../components/bids/BidsCountsTab'
import { BidsLaborTab } from '../components/bids/BidsLaborTab'
import { BidsPricingTab } from '../components/bids/BidsPricingTab'
import { BidsCoverLetterTab } from '../components/bids/BidsCoverLetterTab'
import { BidsSubmittalsTab } from '../components/bids/BidsSubmittalsTab'
import { BidsTakeoffTab } from '../components/bids/BidsTakeoffTab'
import { BidVersionPicker } from '../components/bids/BidVersionPicker'
import { BidsPricingCalculator } from '../components/bids/BidsPricingCalculator'
import { BidPackageMapModal } from '../components/bids/BidPackageMapModal'
import { computeSharedBidCost } from '../lib/bids/bidPackageMap'
import { downloadApprovalPdf as downloadApprovalPdfDoc } from '../lib/bidDocuments/approvalPdf'
import { WorkingBoardArchiveConfirmDialog } from '../components/bids/WorkingBoardArchiveConfirmDialog'
import { BidsBuilderReviewTab } from '../components/bids/BidsBuilderReviewTab'
import { BidsWhyWeLostLens } from '../components/bids/BidsWhyWeLostLens'
import { BidsCallQueueTab } from '../components/bids/BidsCallQueueTab'
import { BidsWaitingToHearLens } from '../components/bids/BidsWaitingToHearLens'
import { BidsJobAccountsLens } from '../components/bids/BidsJobAccountsLens'
import { useBidGcPackets } from '../hooks/useBidGcPackets'
import { BidChangeOrderTab } from '../components/bids/BidChangeOrderTab'
import { BidLienReleaseTab } from '../components/bids/BidLienReleaseTab'
import {
  DEFAULT_TERMS_AND_WARRANTY,
  DEFAULT_EXCLUSIONS,
} from '../lib/bidDocuments/coverLetter'
import {
  bidEligibleForWorkingBoardArchive,
  canUserArchiveBidOnWorkingBoard,
} from '../lib/workingBoardArchiveEligibility'
import {
  bidDisplayName,
  getCustomerDisplay,
} from '../lib/bids/bidFormatting'
import { tabStyle, bidsTabStyle } from '../lib/bids/bidStyles'
import PeopleDayBookTab from '../components/people/PeopleDayBookTab'
import { canOpenDayBook } from '../lib/people/dayBookAccess'
import { dropDayBookDoorParams, type DayBookDoor } from '../lib/people/dayBookDoor'
import { pricingResolvePanel } from '../lib/bids/pricingResolve'
import { laborEmptyState, loadAfterResolve, shouldLoadCostEstimate } from '../lib/bids/laborTabLoadGate'
import { pickActiveVersion } from '../lib/bids/pickActiveVersion'
import { recordNavClick } from '../lib/navClickTelemetry'
import { ScrollableTabStrip } from '../components/ScrollableTabStrip'
import { useMatchMedia } from '../hooks/useMatchMedia'
import { extractContactInfo } from '../lib/bids/bidContactInfo'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../lib/bids/updateGuard'
import { useBidEditForm } from '../lib/bids/useBidEditForm'
import { rememberSharedBidId } from '../lib/bids/sharedBidPointer'
import { MATERIALS_MODEL_CAPTION } from '../lib/bids/bidTakeoffHelpers'

type GcBuilder = Database['public']['Tables']['bids_gc_builders']['Row']
type Customer = Database['public']['Tables']['customers']['Row']

export default function Bids() {
  const { user: authUser, profileName, role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const newCustomerModal = useNewCustomerModal()
  const bidPreview = useBidPreview()
  // v2.2390 (Wendi): on the Bids page, a bid-name click opens the tabbed Bid
  // window on its Bid face — not the old standalone preview (which stays for
  // Dashboard / global search / customer profiles, per the flip guide).
  const bidPreviewOnBidsPage = bidPreview
    ? { ...bidPreview, openBidPreviewFromBid: (bid: BidWithBuilder) => openEditBid(bid, { tab: 'bid' }) }
    : null
  const ledgerPrefixMap = useLedgerPrefixMap()
  const checklistAddModal = useChecklistAddModal()
  const editCustomerModal = useEditCustomerModal()
  const location = useLocation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const narrowViewport640 = useNarrowViewport640()
  // Header layout: one row (trades | board tabs | New Bid) needs ~1150px; below
  // that the board tabs drop to their own single-row scrollable strip (v2.1331).
  const wideBidsHeader = useMatchMedia('(min-width: 1151px)')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('')
  // What the page loads and who is looking (hooks/useBidsPageData): the role, the trades, the bids, the customers.
  const pageData = useBidsPageData({ authUserId: authUser?.id, selectedServiceTypeId, setSelectedServiceTypeId, setLoading, setError })
  const {
    myRole,
    serviceTypes,
    estimatorServiceTypeIds,
    primaryServiceTypeIds,
    superintendentServiceTypeIds,
    fixtureTypes,
    bids,
    setBids,
    bidsLoaded,
    customers,
    setCustomers,
    lastContactFromEntries,
    lastMethodContactFromEntries,
    bidGcRecipientsByBidId,
    customerContacts,
    customerContactPersons,
    estimatorUsers,
    twinUserIds,
    loadRole,
    loadFixtureTypes,
    loadBids,
    loadCustomers,
    loadCustomerContacts,
    loadCustomerContactPersons,
  } = pageData
  // Role gates that say something (v2.2882): a superintendent's link to an
  // office-only tab toasts once and lands on the Bid board — not a silent rewrite.
  const { bounce: roleGateBounce } = useRoleGate(myRole, authUser?.id)
  const [activeTab, setActiveTab] = useState<BidsTabKey>('bid-board')
  
  // Service Types state
  
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

  // Bids by GC (v2.2162/v2.2164): one packet load for the board, the Followup lenses and By builder.
  const { packetsByBid: gcPacketsByBid, noteCounts: gcNoteCounts, roomStatesByBid } = useBidGcPackets(bids, bidGcRecipientsByBidId)

  // Bid Board
  // The Bid window's own state (hooks/useBidWindowState): open, face, bid, focus, saving, close guard, refresh key, delete window.
  const bidWindow = useBidWindowState()
  const {
    bidFormOpen,
    bidWindowInitialTab,
    pendingBidFormFocus,
    setPendingBidFormFocus,
    editingBid,
    setEditingBid,
    savingBid,
    bidCloseFlushState,
    setBidCloseFlushState,
    bidWindowRefreshKey,
    deleteConfirmProjectName,
    setDeleteConfirmProjectName,
    deletingBid,
    deleteBidModalOpen,
    setDeleteBidModalOpen,
  } = bidWindow
  /** Projects for the bid form's linked-project picker; null = not fetched yet (lazy, on first form open). */
  const [projectsForPicker, setProjectsForPicker] = useState<Array<{ id: string; name: string | null; project_number: string | null }> | null>(null)
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [viewingGcBuilder, setViewingGcBuilder] = useState<GcBuilder | null>(null)
  const [bidFormServiceTypeSwitchOpen, setBidFormServiceTypeSwitchOpen] = useState(false)
  const [gcCustomerDropdownOpen, setGcCustomerDropdownOpen] = useState(false)
  const [evaluateModalOpen, setEvaluateModalOpen] = useState(false)
  const [showSentBidScript, setShowSentBidScript] = useState(false)
  const [showBidQuestionScript, setShowBidQuestionScript] = useState(false)

  // "Only my bids" filter (shared across all eight workflow tab list views): bids the
  // current user is the account manager or estimator for. On by default (v2.2704).
  const [onlyMyBids, setOnlyMyBids] = useState(true)
  const isMyBid = useCallback(
    (bid: BidWithBuilder) =>
      !!authUser?.id && (bid.account_manager_id === authUser.id || bid.estimator_id === authUser.id),
    [authUser?.id],
  )
  // Bid Date Sent: the field, the checklist a new date needs, the note typed with it (hooks/useBidDateSentAttestation).
  const attestation = useBidDateSentAttestation({ serverBidDateSent: editingBid?.bid_date_sent ?? null, userId: authUser?.id ?? null })
  const bidDateSent = attestation.bidDateSent

  const bidForm = useBidEditForm()
  const { gcCustomerId } = bidForm.values

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
  const [submissionSectionOpen, setSubmissionSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  const [bidBoardSectionOpen, setBidBoardSectionOpen] = useState({ unsent: true, pending: true, won: true, startedOrComplete: true, lost: false })
  // The board's scope (hooks/useBidBoardScope): the People | Robots split, the sent counts, the job chips.
  const {
    peopleBids,
    robotBids,
    sentScope,
    lostBidsNeedingReasonCount,
    jobsByBidId,
    bidBoardBudgetChips,
    jobAccountStrips,
    jobAccountsMissingCount,
    linkJobToBidFromBoard,
  } = useBidBoardScope({ bids, twinUserIds, selectedServiceTypeId, serviceTypes, gcPacketsByBid, myRole, showToast })
  // v2.3201: a bid was just marked reviewed → reload the rows so every flow strip reads the stamp.
  useEffect(() => {
    const reload = () => {
      void loadBids()
    }
    window.addEventListener(BID_REVIEWED_EVENT, reload)
    return () => window.removeEventListener(BID_REVIEWED_EVENT, reload)
    // loadBids reads the latest trade filter through refs/state when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // The robot layer (hooks/useBidRobotLayer): the twin pairing, shadow runs, the robots' open
  // questions and the writes behind the robot icon; BidsRobotOverlays draws its five windows.
  const robot = useBidRobotLayer({ authUserId: authUser?.id, myRole, bids, setBids, robotBids, serviceTypes, showToast })
  const {
    twinBidBySourceId,
    robotMirrorCount,
    setRobotMirrorCount,
    referencePresence,
    setRobotGradeBid,
    setRobotStatusBid,
    setRobotNeedsBid,
    setRobotNeedsBidId,
    robotRowInputFor,
    robotRowStateForScoreboard,
    robotQuestionsWaiting,
    robotRowStateFor,
    setRobotComparePair,
    focusAuditId,
    setFocusAuditId,
    offerRobotEnvelope,
    openEnvelopeFromMirror,
    noteBestEffortGap,
    noteRobotReviewRevision,
  } = robot
  // Deep link from Standing rulings (v2.3212): /bids?tab=bid-board&bidId=…&robot=needs
  // opens that bid's robot needs sheet once the bid is in hand, then drops the flag.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('robot') !== 'needs') return
    const id = params.get('bidId')
    if (id && !bids.some((b) => b.id === id)) return // bids not in hand yet — try again on the next render
    if (id) setRobotNeedsBidId(id)
    // Drop the flag whether or not it found its bid: the board's own deep-link
    // handler consumes bidId separately, and a stale `robot=needs` must not
    // reopen the sheet on the next visit.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('robot')
      return next
    }, { replace: true })
  }, [location.search, bids, setSearchParams, setRobotNeedsBidId])
  // Landing from a URL (v2.3216): /bids?tab=…&bidId=…&focus=<element-id[,fallback]> —
  // the same landing the strip's doors do, so a link can point at a field.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (!params.has('focus')) return
    const id = params.get('bidId')
    if (id && !bids.some((b) => b.id === id)) return
    const targets = parseLandingParam(params.get('focus'))
    if (targets.length) landOnBidFlowTarget(targets)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('focus')
      return next
    }, { replace: true })
  }, [location.search, bids, setSearchParams])
  // Dev door (v2.3222): /bids?envelope=<bid number> force-opens the envelope on that bid's scored shadow — support and testing, never for estimators.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const wanted = params.get('envelope')
    if (!wanted || myRole !== 'dev') return
    const target = bids.find((b) => (b.bid_number ?? '').trim() === envelopeParamBidNumber(wanted))
    if (!target) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('envelope')
      return next
    }, { replace: true })
    void offerRobotEnvelope(target.id, { force: true })
  }, [location.search, bids, myRole, setSearchParams, offerRobotEnvelope])
  // Audits tab gating (v2.2517): tab shows whenever audits exist; label carries the
  // pending count so a waiting robot bid is visible from anywhere on the Bids page.
  // Presence follows the robot-audit audience (v2.2920): the bid_audits write set,
  // the same list the Needs-You card reads — not "whoever RLS lets SELECT".
  const auditGate = useBidAuditsPendingCount(!!authUser?.id && canWorkRobotAudits(myRole))
  const [lostSummaryModalOpen, setLostSummaryModalOpen] = useState(false)
  const [lostSummaryInitialStaffTab, setLostSummaryInitialStaffTab] = useState<string | null>(null)

  const canAddChecklistFromSubmission = useMemo(
    () =>
      myRole === 'dev' ||
      myRole === 'master_technician' ||
      isAssistantLike(myRole) ||
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

  /**
   * One-shot deep links (v2.2043): once a `?bidId=` jump has been applied
   * (scroll + highlight), drop the param — so revisiting the tab, reloading,
   * or clicking around never replays an old jump. The scroll happens exactly
   * once, on the click that asked for it.
   */
  const [archiveWorkingBoardBusyBidId, setArchiveWorkingBoardBusyBidId] = useState<string | null>(null)
  const [workingBoardArchiveConfirmBidId, setWorkingBoardArchiveConfirmBidId] = useState<string | null>(null)
  const [workingBoardArchiveConfirmLabel, setWorkingBoardArchiveConfirmLabel] = useState<string | null>(null)
  const closeWorkingBoardArchiveConfirm = useCallback(() => {
    setWorkingBoardArchiveConfirmBidId(null)
    setWorkingBoardArchiveConfirmLabel(null)
  }, [])

  const [, setTick] = useState(0)

  // Takeoffs tab
  const [selectedBidForTakeoff, setSelectedBidForTakeoff] = useState<BidWithBuilder | null>(null)
  
  
  

  // Labor tab (selection + shared PO review modal + shared tax/distance stay parent-owned; rest moved to BidsLaborTab)
  const [selectedBidForCostEstimate, setSelectedBidForCostEstimate] = useState<BidWithBuilder | null>(null)
  const [costEstimatePOModalTaxPercent, setCostEstimatePOModalTaxPercent] = useState('8.25')
  const [costEstimateDistanceInput, setCostEstimateDistanceInput] = useState('')

  // Pricing tab
  const [selectedBidForPricing, setSelectedBidForPricing] = useState<BidWithBuilder | null>(null)

  // v2.2400 (Wendi): the Margin breakdown's jump chips hand the destination tab a row to
  // land on — the tab scrolls to it and flashes it (Jobs → Pipeline idiom), then clears this.
  const [bidTabRowJump, setBidTabRowJump] = useState<BreakdownJumpTarget | null>(null)

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
    costEstimateFixtureMaterials,
    purchaseOrdersForCostEstimate,
    costEstimateMaterialTotalRoughIn,
    costEstimateMaterialTotalTopOut,
    costEstimateMaterialTotalTrimSet,
    laborRateInput, setLaborRateInput,
    drivingCostRate, setDrivingCostRate,
    hoursPerTrip, setHoursPerTrip,
    laborBookVersions,
    laborBookEntries,
    selectedLaborBookVersionId, setSelectedLaborBookVersionId,
    laborBookEntriesVersionId, setLaborBookEntriesVersionId,
    costEstimateBidIdRef,
    estimatorCostUseFlat,
    estimatorCostPerCount,
    estimatorCostFlatAmount,
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
    bidAssignedCosts,
    priceBookVersions,
    templatePriceBookVersions,
    defaultPriceBookTemplateId, versionClonePricingSourceId, rememberLastPriceBookTemplate,
    priceBookEntries, setPriceBookEntries,
    bidPricingAssignments,
    bidCountRowCustomPrices,
    bidCountRowSubmissionHides,
    bidVersions, selectedBidVersionId, setSelectedBidVersionId, selectedBidVersionIdRef, switchActiveVersion,
    pricingResolve, retryPricingResolve, costEstimateResolve,
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
    loadLaborBookVersions, loadLaborBookEntries,
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

  // Package map (v2.2374): the 🗺 Map button on the Send to strip opens a read-only
  // tree of the bid — GC packets → versions → prices. Cost (for margins) rides the
  // Pricing tab's loaded data; opening the map loads it when it isn't this bid's yet.
  const [packageMapBid, setPackageMapBid] = useState<{
    id: string
    bid_number: string | null
    project_name: string | null
    bid_date_sent: string | null
    selected_price_book_version_id: string | null
    distance_from_office: string | null
    gcName: string | null
  } | null>(null)
  function openPackageMap(bid: BidWithBuilder, gcName: string | null) {
    setPackageMapBid({
      id: bid.id,
      bid_number: bid.bid_number ?? null,
      project_name: bid.project_name ?? null,
      bid_date_sent: bid.bid_date_sent ?? null,
      selected_price_book_version_id: bid.selected_price_book_version_id ?? null,
      distance_from_office: bid.distance_from_office ?? null,
      gcName,
    })
    if ((pricingCostEstimate as { bid_id?: string } | null)?.bid_id !== bid.id) void loadPricingDataForBid(bid.id)
  }
  const packageMapSharedCost =
    packageMapBid && (pricingCostEstimate as { bid_id?: string } | null)?.bid_id === packageMapBid.id
      ? computeSharedBidCost({
          costEstimate: pricingCostEstimate,
          laborRows: pricingLaborRows,
          materialTotalRoughIn: pricingMaterialTotalRoughIn,
          materialTotalTopOut: pricingMaterialTotalTopOut,
          materialTotalTrimSet: pricingMaterialTotalTrimSet,
          laborRate: pricingLaborRate,
          distanceFromOffice: packageMapBid.distance_from_office,
          countRowsLen: pricingCountRows.length,
          equipmentRows: pricingEquipmentRows,
          permitRows: pricingPermitRows,
          subcontractorRows: pricingSubcontractorRows,
          wasteRows: pricingWasteRows,
          otherRows: pricingOtherRows,
          teamLaborCost: teamLaborDataForBids.find((r) => r.bidId === packageMapBid.id)?.bidCost ?? 0,
        })
      : null
  /** Map click-through: VIEW the price on the Pricing tab (session-only — never re-stars). */
  async function openPriceFromPackageMap(versionId: string | null, pricingId: string) {
    const bidId = packageMapBid?.id
    setPackageMapBid(null)
    if (!bidId) return
    if (versionId && versionId !== selectedBidVersionId) await switchActiveVersion(bidId, versionId)
    setSelectedPricingVersionId(pricingId)
    void loadPriceBookEntries(pricingId)
    if (activeTab !== 'pricing') selectBidsTab('pricing')
  }

  /** Set selected bid for Counts, Takeoffs, Labor, Pricing, Submission, RFI, Change Order, and Lien Release so selection stays in sync across tabs. */
  function setSharedBid(bid: BidWithBuilder | null) {
    rememberSharedBidId(bid?.id ?? null) // survives a refresh after a tab click strips bidId (J11-F2/N2)
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

  const [countsImportRequest, setCountsImportRequest] = useState(0)
  // Bid flow doors (v2.3216): a step on any strip opens its destination — the Edit
  // window or one of the workflow tabs — and then LANDS on the field the step is
  // about (scroll, focus, a fading ring). One handler for the five workflow-tab
  // strips; the board's opened row does the same through its own props.
  function bidFlowDoorAllowed(door: BidFlowDoor): boolean {
    return door != null && (myRole !== 'superintendent' || (door !== 'pricing' && door !== 'cover-letter'))
  }
  function openBidFlowDoor(bid: BidWithBuilder, door: BidFlowDoor, step: BidFlowStep) {
    if (!bidFlowDoorAllowed(door)) return
    if (door === 'edit') openEditBid(bid)
    // 'accounts' (v2.3574) is the Bid Board's own door — the board opens the Job accounts question before it reaches here.
    else if (door && door !== 'review' && door !== 'accounts') selectBidAndSyncUrl(bid, door)
    // v2.3227: Count & import opens the Import Counts dialog itself; the landing
    // then rings the paste box (the button is the fallback if the dialog is slow).
    if (door === 'counts' && step.key === 'count') setCountsImportRequest((n) => n + 1)
    landOnBidFlowTarget(step.target)
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
      const el = document.getElementById(BID_FORM_FOCUS_ELEMENT_ID[which])
      if (el instanceof HTMLElement) {
        // One landing style (v2.3228): the same blue ring + fade the bid flow doors
        // use, instead of the amber outline this effect used to paint inline.
        landOnElement(el)
        if (el instanceof HTMLInputElement) el.select()
        // v2.3334: one settle pass once the bid window has finished laying out its
        // sections — an instant scroll to the same spot, a no-op when the smooth
        // landing above already got there and the only scroll that runs at all in
        // a hidden document (smooth scrolling is skipped there). Scheduled here,
        // not in the effect, because resetting the pending focus below re-runs the
        // effect and its cleanup.
        window.setTimeout(() => {
          if (!el.isConnected) return
          try {
            el.scrollIntoView({ behavior: 'auto', block: 'center' })
          } catch {
            /* jsdom */
          }
        }, 600)
      }
      setPendingBidFormFocus(null)
    }, 50)
    return () => window.clearTimeout(timeoutId)
  }, [bidFormOpen, pendingBidFormFocus, setPendingBidFormFocus])

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
        const archivedRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .update({
                working_board_archived_at: new Date().toISOString(),
                working_board_archived_by: authUser.id,
              })
              .eq('id', bidId)
              .select('id'),
          'archive working board bid',
        )
        if (bidUpdateRefused(archivedRows)) throw new Error(BID_UPDATE_NOT_APPLIED_MESSAGE)
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

  /** Journey map P-B1: the only Bids tabs a primary (customer-side principal) may hold. */

  // Lazy projects fetch for the bid form's linked-project picker (first open only).
  useEffect(() => {
    if (!bidFormOpen || projectsForPicker !== null) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('projects').select('id, name, project_number').order('name')
      if (cancelled) return
      setProjectsForPicker((data ?? []) as Array<{ id: string; name: string | null; project_number: string | null }>)
    })()
    return () => {
      cancelled = true
    }
  }, [bidFormOpen, projectsForPicker])

  // Projects card "+ Bid" deep link (?newBid=true&project=<id>): open New Bid
  // pre-linked to the project. Gated on auth so a cold load doesn't fire before
  // the session resolves (handle-gating rule); params strip once it fires.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('newBid') !== 'true') return
    if (!authUser?.id) return
    const projectIdParam = params.get('project')?.trim() || null
    void (async () => {
      let project: { id: string; name: string | null } | null = null
      if (projectIdParam) {
        const { data } = await supabase.from('projects').select('id, name').eq('id', projectIdParam).maybeSingle()
        project = (data as { id: string; name: string | null } | null) ?? null
      }
      openNewBidFromProject(project)
    })()
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.delete('newBid')
      next.delete('project')
      return next
    }, { replace: true })
    // openNewBidFromProject reads latest form/service-type state when the IIFE runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, authUser?.id, setSearchParams])

  // The URL router and everything a link to a bid does (hooks/useBidsDeepLinks).
  const {
    bidBoardDeepLinkHighlightId,
    bidBoardDeepLinkHighlightGen,
    builderReviewDeepLinkHighlightCustomerId,
    builderReviewDeepLinkHighlightGen,
    workingBoardDeepLinkBidId,
    onWorkingBoardDeepLinkHandled,
    applyBidBoardDeepLinkToBid,
    applyBuilderReviewDeepLinkFromBid,
    openBuilderLensForCustomer,
  } = useBidsDeepLinks({
    bids,
    serviceTypeCount: serviceTypes.length,
    selectedServiceTypeId,
    setSelectedServiceTypeId,
    myRole,
    authUserId: authUser?.id,
    twinUserIds,
    hasSelectedBid: !!selectedBidForCounts,
    showToast,
    roleGateBounce,
    setActiveTab,
    setSharedBid,
    setSelectedBidForSubmission,
    setSubmissionSectionOpen,
    setBidBoardSectionOpen,
    submissionSummaryCardRef,
    openNewBid: () => openNewBid(),
    openEditBid: (bid) => openEditBid(bid),
  })

  // The load gates (hooks/useBidsPageData): the trades once the role is known, then the page's data per trade or, on By builder, for every trade.
  useBidsLoadGates(pageData, {
    activeTab,
    selectedServiceTypeId,
    setLoading,
    loadBooks: () => [loadTakeoffBookVersions(), loadLaborBookVersions(), loadTemplatePriceBookVersions(), loadMaterialTemplates()],
  })

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
      // The trade's one book when none is saved for this bid (v2.3597: the robot book, never an archived one)
      const savedLaborBookId = selectedBidForCostEstimate.selected_labor_book_version_id
      if (!savedLaborBookId && laborBookVersions.length > 0) {
        const tradeBookId = laborBookForTrade(laborBookVersions)?.id
        if (tradeBookId) {
          setSelectedLaborBookVersionId(tradeBookId)
        }
      } else {
        setSelectedLaborBookVersionId(savedLaborBookId ?? null)
      }
    }
    const laborBookVersionId = bidJustChanged
      ? (selectedBidForCostEstimate.selected_labor_book_version_id ?? laborBookForTrade(laborBookVersions)?.id ?? null)
      : selectedLaborBookVersionId
    // J11-F1: count rows are per Version, and the engine reads the active version from a
    // bid-tagged ref. Loading before that ref points at THIS bid filtered on the wrong version
    // and rendered "Add fixtures in the Counts tab first." on every versioned bid until a tab
    // round-trip. Mirror the Counts effect: resolve the version first, then load.
    let cancelled = false
    void (async () => {
      if (!shouldLoadCostEstimate({ bidId, resolvedFor: selectedBidVersionIdRef.current, versionId: selectedBidVersionId })) {
        if (selectedBidVersionIdRef.current?.bidId === bidId) return // ref ahead of state; the pending state change re-runs this effect
        const versions = (await loadBidVersions(bidId)) ?? []
        if (cancelled) return
        const picked = pickActiveVersion({ savedVersionId: selectedBidForCostEstimate.selected_bid_version_id, bidVersions: versions })
        setSelectedBidVersionId(bidId, picked)
        if (!loadAfterResolve({ picked, versionId: selectedBidVersionId })) return // the state change re-runs this effect
      }
      if (cancelled) return
      await loadCostEstimateData(bidId, laborBookVersionId)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    selectedBidForCostEstimate?.id,
    selectedBidForCostEstimate?.selected_labor_book_version_id,
    selectedBidForCostEstimate?.materials_model,
    selectedLaborBookVersionId,
    laborBookVersions,
    selectedBidVersionId,
  ])

  // J11 telemetry: the genuine empty state, once per bid it is shown for. `version_resolved`
  // is true by construction (the panel kernel never yields 'empty' while unresolved) — a row
  // with anything else means the false-empty bug is back.
  const laborPanel = laborEmptyState({
    resolved: pricingResolvePanel(costEstimateResolve, selectedBidForCostEstimate?.id ?? null) !== 'skeleton',
    rowCount: costEstimateCountRows.length,
  })
  useEffect(() => {
    if (activeTab !== 'labor' || laborPanel !== 'empty' || !selectedBidForCostEstimate?.id) return
    recordNavClick(
      authUser?.id,
      myRole,
      'labor_tab_empty_state_shown',
      `/bids?tab=labor&rows=${costEstimateCountRows.length}&version_resolved=${costEstimateResolve.bidId === selectedBidForCostEstimate.id}`,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, laborPanel, selectedBidForCostEstimate?.id])


  // The Edit Bid controller (hooks/useBidEditController): the Bid window's doors, its autosave and close
  // guard, Create bid / Create and open counts, delete — called where this code stood.
  const {
    openNewBid,
    openNewBidFromProject,
    openNewBidWithCustomer,
    openEditBid,
    closeBidForm,
    saveLossReasonFromLostSummaryModal,
    tradeSwitch,
    bidAutosave,
    markBidOutcomePersistedByPanel,
    requestCloseBidForm,
    closeBidFormWithoutSaving,
    saveBid,
    saveBidAndOpenCounts,
    deleteBid,
  } = useBidEditController({
    bidWindow,
    bidForm,
    attestation,
    authUser,
    profileName,
    myRole,
    bids,
    loadBids,
    selectedServiceTypeId,
    setSelectedServiceTypeId,
    setError,
    showToast,
    noteRobotReviewRevision,
    offerRobotEnvelope,
    syncFreshBidIntoSelections,
    openCountsForBid,
  })

  function handleLastContactClick(bid: BidWithBuilder) {
    setSelectedBidForSubmission(bid)
    setActiveTab('submission-followup')
  }

  /** After a bid row changes, every tab holding that bid gets the fresh copy. */
  function syncFreshBidIntoSelections(bidId: string, rows: BidWithBuilder[]) {
    const fresh = rows.find((b) => b.id === bidId)
    if (!fresh) return
    if (selectedBidForCounts?.id === bidId) setSelectedBidForCounts(fresh)
    if (selectedBidForSubmission?.id === bidId) setSelectedBidForSubmission(fresh)
    if (selectedBidForTakeoff?.id === bidId) setSelectedBidForTakeoff(fresh)
    if (selectedBidForCostEstimate?.id === bidId) setSelectedBidForCostEstimate(fresh)
    if (selectedBidForPricing?.id === bidId) setSelectedBidForPricing(fresh)
  }

  function openCountsForBid(bidId: string, rows: BidWithBuilder[]) {
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
    const { data: updatedRows, error: err } = await supabase
      .from('bids')
      .update({ bid_submission_link: value.trim() || null })
      .eq('id', bidId)
      .select('id')
    if (err) {
      setError(err.message)
      return
    }
    if (bidUpdateRefused(updatedRows)) {
      setError(BID_UPDATE_NOT_APPLIED_MESSAGE)
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

  /** Where the Day book was left, for the next time its tab opens (its params leave the URL with it). */
  const dayBookMemoryRef = useRef<DayBookDoor | null>(null)
  /** One place for tab switches: state + the ?tab= URL param (v2.1331 dedupe). */
  const selectBidsTab = (tab: typeof activeTab) => {
    setActiveTab(tab)
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', tab)
      // Clicking a tab yourself means "take me to the page", never "replay my
      // old deep-link jump" (v2.2043) — drop any lingering bidId.
      next.delete('bidId')
      // The Day book's week and person leave the URL with it; the page remembers them.
      if (tab !== 'day-book') dropDayBookDoorParams(next)
      return next
    })
  }

  /** The version bar above Counts, Takeoffs, Pricing and the Cover Letter; the last two also carry the pricing resolve panel. */
  const renderBidVersionPicker = (bid: BidWithBuilder, options?: { withResolvePanel?: boolean }) => {
    const gcName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? null
    return (
      <BidVersionPicker
        onGoToCoverLetter={() => selectBidsTab('cover-letter')}
        bidId={bid.id}
        bidVersions={bidVersions}
        selectedBidVersionId={selectedBidVersionId}
        currentPricingId={selectedPricingVersionId}
        fallbackPricingSourceId={versionClonePricingSourceId}
        isExactMaterials={bid.materials_model === 'exact'}
        onSwitch={(versionId) => switchActiveVersion(bid.id, versionId)}
        reloadVersions={() => Promise.all([loadBidVersions(bid.id), loadBidPricings(bid.id)]).then(() => {})}
        pricingSourceNames={Object.fromEntries([...priceBookVersions, ...templatePriceBookVersions].map((v) => [v.id, v.name]))}
        bidGcName={gcName}
        bidDateSent={bid.bid_date_sent ?? null}
        resolvePanel={options?.withResolvePanel ? pricingResolvePanel(pricingResolve, bid.id) : undefined}
        onOpenMap={() => openPackageMap(bid, gcName)}
      />
    )
  }
  const BIDS_WORKING_TAB_LABEL = 'Unsent/Working'

  const { inboxCount: workingInboxCount } = useWorkingBoardInboxCount(authUser?.id, workingBoardVisibleBids)
  const workingInboxBadgeText = workingInboxCount > 9 ? '9+' : String(workingInboxCount)
  const bidsWorkingTabButton = (
    <span
      data-tabkey="working"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => selectBidsTab('working')}
        aria-label={
          workingInboxCount > 0
            ? `${BIDS_WORKING_TAB_LABEL}, ${workingInboxCount} in inbox`
            : BIDS_WORKING_TAB_LABEL
        }
        style={tabStyle(activeTab === 'working')}
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

  const bidsDayBookTabButton = canOpenDayBook(myRole) ? (
    <button type="button" data-tabkey="day-book" onClick={() => selectBidsTab('day-book')} style={tabStyle(activeTab === 'day-book')} title="What each estimator and office person got done, any day — the same view as People → Day book">
      Day book
    </button>
  ) : null
  const bidsBidCostsTabButton =
    canSeeBidCosts(myRole) ? (
      <button
        type="button"
        data-tabkey="bid-costs"
        onClick={() => selectBidsTab('bid-costs')}
        style={tabStyle(activeTab === 'bid-costs')}
      >
        Bid Costs
      </button>
    ) : null

  const bidsEstimatorsTabButton = (
    <button
      type="button"
      data-tabkey="estimators"
      onClick={() => selectBidsTab('estimators')}
      style={tabStyle(activeTab === 'estimators')}
    >
      Estimators
    </button>
  )

  /** The five board tabs as one single-row strip (centers when it fits, scrolls when it doesn't). */
  const bidsBoardTabsStrip = (
    <ScrollableTabStrip activeKey={activeTab} ariaLabel="Bid boards">
      <button
        type="button"
        data-tabkey="bid-board"
        onClick={() => selectBidsTab('bid-board')}
        style={tabStyle(activeTab === 'bid-board')}
      >
        Bid Board
      </button>
      {bidsTabOpenFor('robot-board', myRole) && (robotBids.length > 0 || auditGate.anyAudits) ? (
        /* Pending-audit count renders as the same red inbox pill as Unsent/Working
           (v2.2531) — same "needs you" semantic, same visual language. */
        <span
          data-tabkey={activeTab === 'audits' ? 'audits' : 'robot-board'}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              // Robots group (Followup precedent): entering lands on Audits when work is
              // pending (or it's the only lens), else the Robot Board. Re-clicking while
              // inside keeps the lens you picked.
              const inGroup = isRobotLens(activeTab)
              const landing =
                auditGate.anyAudits && (auditGate.pending > 0 || robotBids.length === 0)
                  ? 'audits'
                  : 'robot-board'
              selectBidsTab(inGroup ? activeTab : landing)
            }}
            style={tabStyle(isRobotLens(activeTab))}
            title="Robot Board and Audits, merged — twin-owned bids and the human audit queue, lenses inside"
            aria-label={
              auditGate.pending > 0
                ? `Robots, ${auditGate.pending} audit${auditGate.pending === 1 ? '' : 's'} pending`
                : 'Robots'
            }
          >
            {/* J10-F10: the tab read "🤖 9+" with no word for sighted users — name it. */}
            {'\u{1F916}'} Robots
          </button>
          {auditGate.pending > 0 ? (
            <span
              aria-hidden
              title={`${auditGate.pending} robot audit${auditGate.pending === 1 ? '' : 's'} pending`}
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
              {auditGate.pending > 9 ? '9+' : String(auditGate.pending)}
            </span>
          ) : null}
        </span>
      ) : null}
      {bidsTabOpenFor('builder-review', myRole) && (
      <button
        type="button"
        data-tabkey="builder-review"
        onClick={() => {
          // v2.2473: entering the group lands on the NEW Call queue lens by
          // default (superintendents can't see it — they keep By builder).
          // Re-clicking while already inside keeps the lens you picked (it
          // still clears any lingering bidId, per v2.2043).
          const inGroup = isFollowupLens(activeTab)
          selectBidsTab(inGroup ? activeTab : myRole === 'superintendent' ? 'builder-review' : 'call-queue')
        }}
        style={tabStyle(isFollowupLens(activeTab))}
        title="Builder Review and Submission & Followup, merged — flip between lenses inside"
      >
        Followup
      </button>
      )}
      {bidsTabOpenFor('working', myRole) && bidsWorkingTabButton}
      {bidsTabOpenFor('bid-costs', myRole) && bidsBidCostsTabButton}
      {bidsTabOpenFor('estimators', myRole) && bidsEstimatorsTabButton}
      {bidsTabOpenFor('day-book', myRole) && bidsDayBookTabButton}
    </ScrollableTabStrip>
  )

  const { customCosts: bidCountRowCustomCosts, reloadCustomCosts: reloadBidCustomCosts } = useBidCustomCosts(selectedBidForPricing?.id ?? null)

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
    bidCountRowCustomCosts,
    bidCountRowSubmissionHides,
    priceBookEntries,
    pricingLaborRows,
    pricingFixtureMaterialsFromTakeoff,
  })

  const canPackageAndSendBidPricing =
    myRole === 'dev' ||
    myRole === 'master_technician' ||
    isAssistantLike(myRole) ||
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

  /** Trades as a compact segmented control; grayed on Builder Review (all-trade roster). */
  const bidsTradeSegments =
    visibleServiceTypes.length > 0 ? (
      <div
        role="group"
        aria-label="Trade"
        style={{
          display: 'inline-flex',
          flexShrink: 0,
          border: '1px solid var(--border-strong)',
          borderRadius: 6,
          overflow: 'hidden',
          opacity: activeTab === 'builder-review' ? 0.5 : 1,
          pointerEvents: activeTab === 'builder-review' ? 'none' : 'auto',
        }}
      >
        {visibleServiceTypes.map((st, i) => {
          const active = selectedServiceTypeId === st.id
          return (
            <button
              key={st.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (st.id !== selectedServiceTypeId) {
                  setSelectedServiceTypeId(st.id)
                  closeSharedBidAndClearUrl()
                }
              }}
              style={{
                padding: '0.45rem 0.85rem',
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: active ? 'var(--text-blue-500)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {st.name}
            </button>
          )
        })}
      </div>
    ) : null

  const bidsNewBidButton =
    visibleServiceTypes.length > 0 && myRole !== 'primary' ? (
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
          flexShrink: 0,
        }}
      >
        New Bid
      </button>
    ) : null


  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading…
      </div>
    )
  }

  if (!canOpenBids(myRole)) {
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
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                {MATERIALS_MODEL_CAPTION}
              </p>
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


      {/* Header (v2.1331): trades (segmented) + board tabs + New Bid. One row on wide
          screens; below ~1150px trades + New Bid share a row and the board tabs drop
          to their own single-row scrollable strip. */}
      <div style={{ marginBottom: '0.65rem' }}>
        {wideBidsHeader ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {bidsTradeSegments ?? <span />}
            {bidsBoardTabsStrip}
            {bidsNewBidButton ?? <span />}
          </div>
        ) : (
          <>
            {(bidsTradeSegments || bidsNewBidButton) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.5rem',
                }}
              >
                {bidsTradeSegments ?? <span />}
                {bidsNewBidButton}
              </div>
            )}
            {bidsBoardTabsStrip}
          </>
        )}
      </div>

      {/* Bid-detail tabs (v2.1331): one row always — centered while they fit,
          horizontally scrollable with edge fades when they don't. */}
      <div style={{ borderBottom: '2px solid var(--border)', marginBottom: '2rem' }}>
        <ScrollableTabStrip activeKey={activeTab} ariaLabel="Bid detail tabs">
        {bidsTabOpenFor('counts', myRole) && (
        <>
        <button
          type="button"
          data-tabkey="counts"
          onClick={() => selectBidsTab('counts')}
          style={bidsTabStyle(activeTab === 'counts', 'counts')}
        >
          Counts
        </button>
        <button
          type="button"
          data-tabkey="takeoffs"
          onClick={() => selectBidsTab('takeoffs')}
          style={tabStyle(activeTab === 'takeoffs')}
        >
          Takeoffs
        </button>
        <button
          type="button"
          data-tabkey="labor"
          onClick={() => selectBidsTab('labor')}
          style={tabStyle(activeTab === 'labor')}
        >
          Labor
        </button>
        </>
        )}
        {bidsTabOpenFor('pricing', myRole) && (
        <>
        <button
          type="button"
          data-tabkey="pricing"
          onClick={() => selectBidsTab('pricing')}
          style={bidsTabStyle(activeTab === 'pricing', 'pricing')}
        >
          Pricing
        </button>
        <button
          type="button"
          data-tabkey="cover-letter"
          onClick={() => selectBidsTab('cover-letter')}
          style={bidsTabStyle(activeTab === 'cover-letter', 'cover-letter')}
        >
          Cover Letter
        </button>
        <button
          type="button"
          data-tabkey="submittals"
          onClick={() => selectBidsTab('submittals')}
          style={tabStyle(activeTab === 'submittals')}
        >
          Submittals
        </button>
        </>
        )}
        {/* v2.1387: Submission & Followup lives inside the merged Followup tab
            (top strip) as the "By status" lens — its standalone button is gone. */}
        {bidsTabOpenFor('counts', myRole) && (
        <span style={{ color: 'var(--text-faint)', padding: '0 0.1rem', position: 'relative', top: '-1px', fontSize: '0.875rem' }}>|</span>
        )}
        <button
          type="button"
          data-tabkey="rfi"
          onClick={() => selectBidsTab('rfi')}
          style={tabStyle(activeTab === 'rfi')}
        >
          RFI
        </button>
        <button
          type="button"
          data-tabkey="change-order"
          onClick={() => selectBidsTab('change-order')}
          style={tabStyle(activeTab === 'change-order')}
        >
          Change Order
        </button>
        <button
          type="button"
          data-tabkey="lien-release"
          onClick={() => selectBidsTab('lien-release')}
          style={tabStyle(activeTab === 'lien-release')}
        >
          Lien Release
        </button>
        </ScrollableTabStrip>
      </div>

      <WorkingBoardArchiveConfirmDialog
        bidId={workingBoardArchiveConfirmBidId}
        label={workingBoardArchiveConfirmLabel}
        onCancel={closeWorkingBoardArchiveConfirm}
        onConfirm={(id) => { closeWorkingBoardArchiveConfirm(); void archiveWorkingBoardBid(id) }}
      />

      {/* Robots group lens bar — Robot Board, Audits, Scoreboard (and the dev Queue and
          Console) as lenses under the 🤖 tab (same segmented-control chrome as the Followup
          lenses). Each lens keeps its own visibility gate; the bar only shows when
          there's more than one lens. The Shadows lens folded into the Scoreboard
          (v2.3221); its URL key still lands there. */}
      {isRobotLens(activeTab) && robotLensBarShows({ robotBidCount: robotBids.length, anyAudits: auditGate.anyAudits, role: myRole }) && (
        <BidsLensBar
          lenses={robotLenses({ role: myRole, activeTab, mirrorCount: robotMirrorCount, auditsPending: auditGate.pending })}
          activeKey={activeTab}
          onSelect={selectBidsTab}
        >
          {/* v2.4256 (punch list #63): the one line that says what the open lens is for, like the Followup bar's. */}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{robotLensCaption(activeTab)}</span>
        </BidsLensBar>
      )}
      {/* v2.4256: the group's header — the program in six numbers on every lens, each tile a door (was the Robot Board's alone). */}
      {isRobotLens(activeTab) && (
        <RobotGroupStrip
          bids={peopleBids}
          robotBids={robotBids}
          auditPending={auditGate.pending}
          rowStateFor={robotRowStateFor}
          activeKey={activeTab}
          canOpen={(key) => bidsTabOpenFor(key, myRole)}
          onOpen={selectBidsTab}
        />
      )}

      {/* Audits Tab — the robot feedback loop's human side (v2.2517). */}
      {activeTab === 'audits' && <BidsAuditsTab authUser={authUser} myRole={myRole} focusAuditId={focusAuditId} />}

      {/* Robot Queue lens (v2.2542, dev only) — requested above ready; prompts live here. */}
      {activeTab === 'robot-queue' && myRole === 'dev' && (
        <BidsRobotQueueTab bids={peopleBids} twinBidBySourceId={twinBidBySourceId} referencePresence={referencePresence} onOpenBid={openEditBid} />
      )}

      {/* Scoreboard (v2.2560; every audit role since v2.3221) — the rule, your part,
          job types closest to ready, and every run: live bids then practice on past bids. */}
      {activeTab === 'robot-scoreboard' && canWorkRobotAudits(myRole) && (
        <BidsRobotScoreboardTab
          auditPending={auditGate.pending}
          questionsWaiting={robotQuestionsWaiting}
          bids={peopleBids}
          robotBids={robotBids}
          viewerId={authUser?.id ?? null}
          isDev={myRole === 'dev'}
          stateFor={robotRowStateForScoreboard}
          onOpenBid={(bidId) => {
            const target = bids.find((b) => b.id === bidId)
            if (target) applyBidBoardDeepLinkToBid(target)
          }}
          onOpenBidNumber={(bidNumber) => {
            const target = bids.find((b) => normalizeBidNumber(b.bid_number) === normalizeBidNumber(bidNumber))
            if (target) applyBidBoardDeepLinkToBid(target)
          }}
          onOpenAudits={() => selectBidsTab('audits')}
          onOpenBidBoard={() => selectBidsTab('bid-board')}
        />
      )}

      {/* Console lens (v2.3224, dev only) — the operator's desk; the Queue is one door away. */}
      {activeTab === 'robot-console' && myRole === 'dev' && (
        <BidsRobotConsoleTab bids={peopleBids} twinBidBySourceId={twinBidBySourceId} onOpenQueue={() => selectBidsTab('robot-queue')} />
      )}

      {/* Robot Board (v2.3222) — a mirror of the Bid Board: our bids, the same sections, a
          robot column. The ZZ shells never list; they open from a row's doors. */}
      {activeTab === 'robot-board' && (
        <BidsRobotMirrorTab
          bids={peopleBids}
          robotBids={robotBids}
          loading={!bidsLoaded}
          isDev={myRole === 'dev'}
          highlightBidId={bidBoardDeepLinkHighlightId}
          onEditBid={openEditBid}
          onCompare={(source, twin) => setRobotComparePair({ source, twin })}
          onOpenShell={(twin) => selectBidAndSyncUrl(twin, 'counts')}
          onOpenAudit={(auditId) => { setFocusAuditId(auditId); selectBidsTab('audits') }}
          onReviewNow={openEnvelopeFromMirror}
          // v2.3225: the live bids with no run list too, from the icon's own kernel, with their doors.
          rowStateFor={robotRowStateFor}
          onOpenNeeds={setRobotNeedsBid}
          onPasteThePlans={(bid) => openEditBid(bid, { focus: 'plansLink' })}
          onOpenStatus={setRobotStatusBid}
          onAddBidValue={(bid) => openEditBid(bid, { focus: 'bidValue' })}
          onRowCount={setRobotMirrorCount}
        />
      )}

      {/* Bid Board Tab */}
      {activeTab === 'bid-board' && plansWaitingBids(peopleBids, serviceTypes).length > 0 ? (
        // v2.4165 · the line the Robot Board already carries, on the board estimators live on.
        <div data-testid="plans-waiting-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', margin: '0 0 0.75rem', padding: '0.55rem 0.85rem', border: '1px solid var(--bg-amber-tint)', background: 'var(--bg-amber-tint)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>
          <span>{plansWaitingWords(plansWaitingBids(peopleBids, serviceTypes).length)}</span>
          <button type="button" onClick={() => selectBidsTab('robot-board')} style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 600, padding: '0.35rem 0.75rem', borderRadius: 5, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add the plans →</button>
        </div>
      ) : null}
      {activeTab === 'bid-board' && (
        <BidsBidBoardTab
          jobAccountStrips={jobAccountStrips}
          onOpenJobAccountsLens={() => selectBidsTab('job-accounts')}
          bids={peopleBids}
          sentScope={sentScope}
          loading={!bidsLoaded}
          authUser={authUser}
          isDev={myRole === 'dev'}
          showMap
          showEstimatingHealth={myRole !== 'primary' && myRole !== 'superintendent'}
          jobsByBidId={jobsByBidId}
          budgetChips={bidBoardBudgetChips}
          onLinkJobToBid={canSeeBidBoardJobLinks(myRole) ? linkJobToBidFromBoard : undefined}
                ledgerPrefixMap={ledgerPrefixMap}
          bidPreview={bidPreviewOnBidsPage}
          sectionOpen={bidBoardSectionOpen}
          onSectionOpenChange={setBidBoardSectionOpen}
          deepLinkHighlightId={bidBoardDeepLinkHighlightId}
          deepLinkHighlightGen={bidBoardDeepLinkHighlightGen}
          onEditBid={openEditBid}
          onOpenGcBuilderOrCustomer={openGcBuilderOrCustomerModal}
          // Set by state, so the router's gate never runs: the door goes only to roles By status stands for.
          onLastContactClick={bidsTabOpenFor('submission-followup', myRole) ? handleLastContactClick : undefined}
          onOpenBidTab={(bid, tab) => selectBidAndSyncUrl(bid, tab)}
          onOpenBidFlowDoor={openBidFlowDoor}
          canSeePricingTabs={myRole !== 'superintendent'}
          onError={setError}
          onReloadBids={() => { void loadBids() }}
          onReloadCustomerContacts={() => { void loadCustomerContacts() }}
          lostSummaryModalOpen={lostSummaryModalOpen}
          lostSummaryInitialStaffTab={lostSummaryInitialStaffTab}
          onOpenLostSummary={() => setLostSummaryModalOpen(true)}
          onCloseLostSummary={closeLostSummaryModal}
          showLostModalLabor={showLostModalLabor}
                onSaveLossReason={saveLossReasonFromLostSummaryModal}
          workingBoardArchivedBids={workingBoardArchivedBids}
          gcNoteCounts={gcNoteCounts}
          gcPacketsByBid={gcPacketsByBid}
          roomStatesByBid={roomStatesByBid}
          recipientsByBidId={bidGcRecipientsByBidId}
          robotReadiness={{
            twinBidBySourceId,
            inputFor: robotRowInputFor,
            onOpenStatus: setRobotStatusBid,
            onOpenNeeds: setRobotNeedsBid,
            onOpenTwinBid: (twin, source) => setRobotComparePair({ source, twin }),
            onOpenGrade: setRobotGradeBid,
          }}
        />
      )}

      <BidsRobotOverlays serviceTypes={serviceTypes} robot={robot} authUser={authUser} selectBidsTab={selectBidsTab} selectBidAndSyncUrl={selectBidAndSyncUrl} openEditBid={openEditBid} />

      {/* Builder Review Tab */}
      {isFollowupLens(activeTab) && (
        <BidsLensBar lenses={followupLenses({ role: myRole, jobAccountsMissing: jobAccountsMissingCount })} activeKey={activeTab} onSelect={selectBidsTab}>
          {followupNeedsReasonChipShows({ role: myRole, activeTab, lostNeedingReason: lostBidsNeedingReasonCount }) ? (
            <button
              type="button"
              onClick={() => selectBidsTab('why-we-lost')}
              title="Lost bids with no reason recorded — open the Why we lost queue"
              style={{
                padding: '0.2rem 0.65rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 999,
                border: 'none',
                background: 'var(--bg-red-tint)',
                color: 'var(--text-red-800)',
                cursor: 'pointer',
              }}
            >
              {withScopeLabel(`${lostBidsNeedingReasonCount} need a reason`, sentScope)}
            </button>
          ) : null}
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{followupLensCaption(activeTab)}</span>
        </BidsLensBar>
      )}
      {activeTab === 'call-queue' && (
        <BidsCallQueueTab
          bids={peopleBids}
          sentScope={sentScope}
          gcPacketsByBid={gcPacketsByBid}
          ledgerPrefixMap={ledgerPrefixMap}
          lastContactFromEntries={lastMethodContactFromEntries}
          narrowViewport640={narrowViewport640}
          authUserId={authUser?.id ?? null}
          onError={setError}
          onReloadBids={() => { void loadBids() }}
          onOpenBuilderCard={applyBuilderReviewDeepLinkFromBid}
        />
      )}
      {activeTab === 'why-we-lost' && (
        <BidsWhyWeLostLens
          bids={peopleBids}
          sentScope={sentScope}
          gcPacketsByBid={gcPacketsByBid}
          ledgerPrefixMap={ledgerPrefixMap}
          recipientsByBidId={bidGcRecipientsByBidId}
          narrowViewport640={narrowViewport640}
          onError={setError}
          onReloadBids={() => { void loadBids() }}
          onOpenBuilderCard={applyBuilderReviewDeepLinkFromBid}
        />
      )}
      {activeTab === 'waiting-to-hear' && (
        <BidsWaitingToHearLens
          bids={peopleBids}
          sentScope={sentScope}
          gcPacketsByBid={gcPacketsByBid}
          roomStatesByBid={roomStatesByBid}
          ledgerPrefixMap={ledgerPrefixMap}
          lastContactFromEntries={lastMethodContactFromEntries}
          recipientsByBidId={bidGcRecipientsByBidId}
          narrowViewport640={narrowViewport640}
          authUserId={authUser?.id ?? null}
          onError={setError}
          onReloadBids={() => { void loadBids() }}
          onOpenBuilderCard={applyBuilderReviewDeepLinkFromBid}
        />
      )}
      {activeTab === 'job-accounts' && (
        <BidsJobAccountsLens
          bids={peopleBids}
          strips={jobAccountStrips}
          ledgerPrefixMap={ledgerPrefixMap}
          authUserId={authUser?.id ?? null}
          narrowViewport640={narrowViewport640}
        />
      )}
      {activeTab === 'builder-review' && (
        <BidsBuilderReviewTab
          bids={peopleBids}
          gcPacketsByBid={gcPacketsByBid}
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
          onViewSubmissions={bidsTabOpenFor('submission-followup', myRole) ? handleLastContactClick : undefined}
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
              if (b) openEditBid(b, { tab: 'bid' })
              else void bidPreview?.openBidPreview(bidId)
            }}
          />
        </div>
      ) : null}

      {/* Day book (v2.3735) — the People tab, mounted here as the estimating side's door; the same gate and RPC */}
      {canOpenDayBook(myRole) && activeTab === 'day-book' && (
        <div style={{ marginTop: '0.75rem' }}>
          <PeopleDayBookTab authUserId={authUser?.id ?? null} authRole={myRole} canPickPerson={canOpenDayBook(myRole)} tabKey="day-book" memory={dayBookMemoryRef} />
        </div>
      )}

      {/* Bid Costs Tab — office roles; dollars for dev / master / controller (v2.3336) */}
      {canSeeBidCosts(myRole) && activeTab === 'bid-costs' && (
        <BidsBidCostsTab
          bids={bids}
          teamLaborData={teamLaborDataForBids}
          bidAssignedCosts={bidAssignedCosts}
          onSelectBid={setSharedBid}
          onCostIt={(bid) => {
            setSharedBid(bid)
            selectBidsTab('labor')
          }}
          onOpenBid={(bid) => openEditBid(bid, { tab: 'bid' })}
          showDollars={canSeeBidCostDollars(myRole)}
        />
      )}

      {/* Estimators Tab - viewable by everyone */}
      {activeTab === 'estimators' && (
        <BidsEstimatorsTab
          active={activeTab === 'estimators'}
          viewerRole={myRole === 'controller' ? 'assistant' : myRole}
          onOpenBidPreview={(bidId) => {
            const b = bids.find((x) => x.id === bidId)
            if (b) openEditBid(b, { tab: 'bid' })
            else void bidPreview?.openBidPreview(bidId)
          }}
        />
      )}

      {/* Counts Tab */}
      {activeTab === 'counts' && (
        <>
        {selectedBidForCounts && renderBidVersionPicker(selectedBidForCounts)}
        <BidsCountsTab
          onOpenBidFlowDoor={openBidFlowDoor}
          openImportRequest={countsImportRequest}
          bidFlowDoorAllowed={bidFlowDoorAllowed}
          bids={bids}
          selectedBidForCounts={selectedBidForCounts}
          rowJump={bidTabRowJump?.tab === 'counts' ? bidTabRowJump : null}
          onRowJumpHandled={() => setBidTabRowJump(null)}
          activeBidVersionId={selectedBidVersionId}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreviewOnBidsPage}
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
          onCountSourceLinkSaved={async (bidId) => {
            const rows = await loadBids()
            const fresh = rows.find((b) => b.id === bidId)
            if (fresh && selectedBidForCounts?.id === bidId) setSelectedBidForCounts(fresh)
          }}
        />
        </>
      )}

      {/* Takeoffs Tab */}
      {activeTab === 'takeoffs' && (
        <>
        {selectedBidForTakeoff && renderBidVersionPicker(selectedBidForTakeoff)}
        <BidsTakeoffTab
          onOpenBidFlowDoor={openBidFlowDoor}
          bidFlowDoorAllowed={bidFlowDoorAllowed}
          bids={bidsTyped}
          rowJump={bidTabRowJump?.tab === 'takeoffs' ? bidTabRowJump : null}
          onRowJumpHandled={() => setBidTabRowJump(null)}
          selectedBidForTakeoff={selectedBidForTakeoff}
          selectedBidVersionId={selectedBidVersionId}
          selectedBidForCostEstimate={selectedBidForCostEstimate}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreviewOnBidsPage}
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
          onOpenBidFlowDoor={openBidFlowDoor}
          bidFlowDoorAllowed={bidFlowDoorAllowed}
          bids={bidsTyped}
          rowJump={bidTabRowJump?.tab === 'labor' ? bidTabRowJump : null}
          onRowJumpHandled={() => setBidTabRowJump(null)}
          selectedBidVersionId={selectedBidVersionId}
          selectedBidForCostEstimate={selectedBidForCostEstimate}
          setSelectedBidForCostEstimate={setSelectedBidForCostEstimate}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreviewOnBidsPage}
          error={error}
          setError={setError}
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
          costEstimateFixtureMaterials={costEstimateFixtureMaterials}
          panel={laborPanel}
          purchaseOrdersForCostEstimate={purchaseOrdersForCostEstimate}
          costEstimateMaterialTotalRoughIn={costEstimateMaterialTotalRoughIn}
          costEstimateMaterialTotalTopOut={costEstimateMaterialTotalTopOut}
          costEstimateMaterialTotalTrimSet={costEstimateMaterialTotalTrimSet}
          teamLaborDataForBids={teamLaborDataForBids}
          laborRateInput={laborRateInput}
          setLaborRateInput={setLaborRateInput}
          drivingCostRate={drivingCostRate}
          setDrivingCostRate={setDrivingCostRate}
          hoursPerTrip={hoursPerTrip}
          setHoursPerTrip={setHoursPerTrip}
          estimatorCostUseFlat={estimatorCostUseFlat}
          estimatorCostPerCount={estimatorCostPerCount}
          estimatorCostFlatAmount={estimatorCostFlatAmount}
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
          selectedLaborBookVersionId={selectedLaborBookVersionId}
          laborBookEntriesVersionId={laborBookEntriesVersionId}
          setLaborBookEntriesVersionId={setLaborBookEntriesVersionId}
          loadLaborBookVersions={loadLaborBookVersions}
          loadLaborBookEntries={loadLaborBookEntries}
          viewerUserId={authUser?.id ?? null}
          viewerRole={authRole}
          selectedServiceTypeName={serviceTypes.find((st) => st.id === selectedServiceTypeId)?.name ?? null}
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {renderBidVersionPicker(selectedBidForPricing, { withResolvePanel: true })}
          </div>
          {/* v2.2376: the Old/New pills moved beside the bid title inside BidsPricingTab (Wendi) — the old portal slot is gone. */}
          </div>
        )}
        <BidsPricingTab
          onOpenBidFlowDoor={openBidFlowDoor}
          bidFlowDoorAllowed={bidFlowDoorAllowed}
          bids={bidsTyped}
          bidVersions={bidVersions}
          onSwitchBidVersion={(versionId) => { if (selectedBidForPricing) void switchActiveVersion(selectedBidForPricing.id, versionId) }}
          reloadBidVersions={() => (selectedBidForPricing ? Promise.all([loadBidVersions(selectedBidForPricing.id), loadBidPricings(selectedBidForPricing.id)]).then(() => {}) : Promise.resolve())}
          selectedBidForPricing={selectedBidForPricing}
          resolvePanel={pricingResolvePanel(pricingResolve, selectedBidForPricing?.id ?? null)}
          onRetryResolve={retryPricingResolve}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreviewOnBidsPage}
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
          bidCountRowCustomCosts={bidCountRowCustomCosts}
          reloadBidCustomCosts={reloadBidCustomCosts}
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
          defaultPriceBookTemplateId={defaultPriceBookTemplateId}
          loadTemplatePriceBookVersions={loadTemplatePriceBookVersions}
          rememberLastPriceBookTemplate={rememberLastPriceBookTemplate}
          loadBidPricings={loadBidPricings}
          loadPriceBookEntries={loadPriceBookEntries}
          loadBidPricingAssignments={loadBidPricingAssignments}
          reloadPricingForBid={loadPricingDataForBid}
          saveBidSelectedPriceBookVersion={saveBidSelectedPriceBookVersion}
          pricingRowsForGrid={pricingRowsForGrid}
          pricingPackageSource={pricingPackageSource}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'pricing')}
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
          onNavigateBidToTab={(bid, tab) => selectBidAndSyncUrl(bid, tab)}
          onNavigateBidToTabRow={(bid, tab, target) => {
            setBidTabRowJump({ tab, ...target })
            selectBidAndSyncUrl(bid, tab)
          }}
        />
        {/* v2.2359: the Pricing Tape — floating tape calculator, desktop only */}
        <BidsPricingCalculator />
        </>
      )}

      {/* Cover Letter Tab */}
      {activeTab === 'cover-letter' && (
        <>
        {selectedBidForPricing && renderBidVersionPicker(selectedBidForPricing, { withResolvePanel: true })}
        <BidsCoverLetterTab
          onOpenBidFlowDoor={openBidFlowDoor}
          bidFlowDoorAllowed={bidFlowDoorAllowed}
          bids={bidsTyped}
          selectedBidForPricing={selectedBidForPricing}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreviewOnBidsPage}
          serviceTypes={serviceTypes}
          pricingCountRows={pricingCountRows}
          coverLetterPricingRows={coverLetterPricingRows}
          activePricingName={priceBookVersions.find((v) => v.id === selectedPricingVersionId)?.name ?? null}
          activeBidVersionId={selectedBidVersionId}
          versionGcFingerprint={bidVersions.map((v) => `${v.id}:${v.customer_id ?? ''}`).join('|')}
          bidPricings={priceBookVersions}
          reloadBidPricings={() => (selectedBidForPricing ? loadBidPricings(selectedBidForPricing.id).then(() => {}) : Promise.resolve())}
          bidVersions={bidVersions}
          reloadBidVersions={() => (selectedBidForPricing ? loadBidVersions(selectedBidForPricing.id).then(() => {}) : Promise.resolve())}
          loadBids={loadBids}
          onBidSentRecorded={(id) => { void noteBestEffortGap(id).then(() => offerRobotEnvelope(id)) }}
          onBestEffortRecorded={(id) => { void offerRobotEnvelope(id) }}
          onOpenRobotEnvelope={(id) => { void offerRobotEnvelope(id, { force: true }) }}
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

      {/* Submittals Tab (Submittals stage 2b): a lens on the product decisions made on the Pricing compare */}
      {activeTab === 'submittals' && (
        <BidsSubmittalsTab
          bids={bidsTyped}
          selectedBid={selectedBidForPricing}
          narrowViewport640={narrowViewport640}
          bidPreview={bidPreviewOnBidsPage}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'submittals')}
          onClose={closeSharedBidAndClearUrl}
          onOpenPricing={(bid) => selectBidAndSyncUrl(bid, 'pricing')}
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
        />
      )}

      {/* Submission & Followup Tab */}
      {activeTab === 'submission-followup' && (
        <BidSubmissionFollowupTab
          bids={bids}
          sentScope={sentScope}
          gcPacketsByBid={gcPacketsByBid}
          authUser={authUser}
          selectedBid={selectedBidForSubmission}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'submission-followup')}
          onClearBid={() => setSelectedBidForSubmission(null)}
          onEditBid={openEditBid}
          onOpenParty={openGcBuilderOrCustomerModal}
          onOpenBuilderLens={openBuilderLensForCustomer}
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
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
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
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
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
          onlyMyBids={onlyMyBids}
          setOnlyMyBids={setOnlyMyBids}
          isMyBid={isMyBid}
          selectedBid={selectedBidForLienRelease}
          onSelectBid={(bid) => selectBidAndSyncUrl(bid, 'lien-release')}
          onClose={closeSharedBidAndClearUrl}
          onEditBid={openEditBid}
        />
      )}

      {/* New/Edit Bid Modal — editing an existing bid opens the tabbed Bid window
          (Bid · Edit, mirrors the Job window); New Bid keeps the plain form. */}
      {(() => {
        const bidFormModalElement = (
          <BidFormModal
            open={bidFormOpen}
            editingBid={editingBid}
            onOpenEvaluateChecklist={() => setEvaluateModalOpen(true)}
            closeBidForm={closeBidForm}
            saveBid={saveBid}
            form={bidForm}
            projects={projectsForPicker ?? []}
            estimatorUsers={estimatorUsers}
            myRole={myRole === 'controller' ? 'assistant' : myRole}
            visibleServiceTypes={visibleServiceTypes}
            bidDateSent={bidDateSent}
            handleBidDateSentInputChange={attestation.handleInputChange}
            handleBidDateSentBlur={attestation.handleBlur}
            onGcRollupDateChanged={(d) => {
              // v2.2407: the per-GC panel rewrote the derived roll-up in the DB — mirror it into
              // the form state so Save writes the same value and attestation never trips.
              const norm = d ?? ''
              attestation.resetTo(norm)
              const sentBidId = editingBid?.id ?? null
              void loadBids().then(() => { if (sentBidId && norm) void offerRobotEnvelope(sentBidId) })
            }}
            pendingAttestationForDate={attestation.pendingForDate}
            pendingBidDateSentAttestation={attestation.pending}
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
            autosave={
              editingBid
                ? {
                    status: bidAutosave.status,
                    dirty: bidAutosave.isDirty(),
                    retry: () => void bidAutosave.flush(),
                    closeFlushState: bidCloseFlushState,
                    retryClose: () => void requestCloseBidForm(),
                    keepEditing: () => setBidCloseFlushState('idle'),
                    closeWithoutSaving: closeBidFormWithoutSaving,
                  }
                : undefined
            }
            onOutcomeRollupPersisted={markBidOutcomePersistedByPanel}
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
            serviceTypeSwitchSiblings={tradeSwitch.siblings}
            onServiceTypeSwitchModalOpen={tradeSwitch.refreshSiblings}
            onDuplicateBidToServiceType={tradeSwitch.duplicateToTrade}
            onOpenExistingBidFromServiceTypeSwitch={tradeSwitch.openExistingSibling}
            embedded={Boolean(bidFormOpen && editingBid)}
            onServiceTypeSwitchOpenChange={setBidFormServiceTypeSwitchOpen}
          />
        )
        if (bidFormOpen && editingBid) {
          return (
            <BidWindowModal
              key={`${editingBid.id}:${bidWindowInitialTab}`}
              bidId={editingBid.id}
              initialTab={bidWindowInitialTab}
              onRequestClose={() => void requestCloseBidForm()}
              onNavigateToBidsTab={(tab, bidId) => {
                void requestCloseBidForm().then((closed) => {
                  if (closed) navigate(`/bids?tab=${tab}&bidId=${bidId}`)
                })
              }}
              refreshKey={bidWindowRefreshKey}
              escBlocked={
                deleteBidModalOpen ||
                evaluateModalOpen ||
                attestation.modalOpen ||
                bidFormServiceTypeSwitchOpen ||
                gcCustomerDropdownOpen
              }
            >
              {bidFormModalElement}
            </BidWindowModal>
          )
        }
        return bidFormModalElement
      })()}

      {attestation.modalOpen && (
        <BidSentAttestationModal modal={attestation.modal} signerName={authUser?.id ? bidAttestationDisplayName(estimatorUsers, authUser.id) : null} />
      )}

      {/* Add/Edit Contact Person modal (Builder Review) */}
      {/* Delete bid confirmation modal */}
      {deleteBidModalOpen && editingBid && (
        <BidDeleteConfirmModal
          projectName={editingBid.project_name}
          confirmValue={deleteConfirmProjectName}
          onConfirmValueChange={(value) => { setDeleteConfirmProjectName(value); setError(null) }}
          error={error}
          deleting={deletingBid}
          onDelete={deleteBid}
          onCancel={() => { setDeleteBidModalOpen(false); setDeleteConfirmProjectName(''); setError(null) }}
        />
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
      {evaluateModalOpen && <BidEvaluateChecklistModal onClose={() => setEvaluateModalOpen(false)} />}

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

      {packageMapBid && (
        <BidPackageMapModal
          bid={packageMapBid}
          bidGcName={packageMapBid.gcName}
          bidVersions={bidVersions}
          selectedBidVersionId={selectedBidVersionId}
          selectedPricingVersionId={selectedPricingVersionId}
          sharedCost={packageMapSharedCost}
          onClose={() => setPackageMapBid(null)}
          onOpenPrice={(versionId, pricingId) => void openPriceFromPackageMap(versionId, pricingId)}
        />
      )}

            </div>
    </>
  )
}

