import { Fragment, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useAuth } from '../../hooks/useAuth'
import { restampConfirmMessage, sentDateAfterLaneStamp, type BidSentLane } from '../../lib/bids/bidSentDate'
import { recordBidSentLane } from '../../lib/bids/bidSentTelemetry'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused } from '../../lib/bids/updateGuard'
import { formatCurrency } from '../../lib/format'
import { compareSentVsToday, sentVsTodayText } from '../../lib/bids/sentVsToday'
import { bidDisplayName, formatDesignDrawingPlanDate, formatDesignDrawingPlanDateLabel } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidPickerStandardList } from './BidPickerStandardList'
import { OpenRfiChip } from './OpenRfiChip'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import {
  APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
  APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
  APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
  APP_SETTINGS_KEY_BID_BOARD_VALUE_RULE,
} from '../../lib/appSettingsKeys'
import { boardValueForRule, bundleSectionsForBoard, formatSendBadge, latestSendByVersion, parseBoardValueRule, type BoardValueRule, type VersionSendRow } from '../../lib/bids/versionSends'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { BidRoomPanel, BidRoomSetupButton } from './BidRoomPanel'
import { BidBasisCard } from './BidBasisCard'
import { useBidBasisExports } from '../../hooks/useBidBasisExports'
import { bidBasisClause, bidBasisRefForBid, shortSheetLabels } from '../../lib/bids/bidBasis'
import {
  breakAmountOntoOwnLineForPreview,
  buildCoverLetterHtml,
  buildCoverLetterText,
  buildCombinedCoverLetterDocument,
  buildCombinedCoverLetterText,
  numberToWords,
  DEFAULT_TERMS_AND_WARRANTY,
  DEFAULT_EXCLUSIONS,
} from '../../lib/bidDocuments/coverLetter'
import { effectiveCoverLetterWording } from '../../lib/bidDocuments/coverLetterWording'
import { computeBidPricingRows, coverLetterTotalsFromPricingRows } from '../../lib/bidPricingRowCalculations'
import { submissionHiddenIdsForVersion } from '../../lib/bids/submissionHides'
import { defaultGcPacketForActiveVersion, groupSectionsByEffectiveGc, resolveSingleLetterGc, letterGcDiffersFromBid, versionGcOverrideMap, type BidVersionGcRow, type GcPacketCustomer } from '../../lib/bids/coverLetterGcPackets'
import {
  DEFAULT_PAYMENT_SCHEDULE_ROWS,
  PAYMENT_SCHEDULE_TIMINGS,
  PAYMENT_SCHEDULE_TIMING_LABELS,
  formatPaymentSchedulePercent,
  paymentSchedulePercentTotal,
  type PaymentScheduleTiming,
} from '../../lib/bidDocuments/paymentSchedule'
import { loadMaterialsByStageForBid, type MaterialsByStageDocument } from '../../lib/bids/materialsByStageIo'
import { buildScheduleOfValuesHtml, materialsByStageLetterRows, scheduleOfValuesLetter, type MaterialsByStageLetterRow } from '../../lib/bidDocuments/scheduleOfValues'
import { paymentRowsFromStageShares, type StageMoney } from '../../lib/bids/materialsByStage'
import type { TakeoffStage } from '../../lib/bids/bidTakeoffHelpers'
import { loadSovLines, loadSovSplitInputsForBid, type SovLaborCosts } from '../../lib/bids/sovLaborMaterialIo'
import { buildSovLinesSheetHtml, seedLinesFromStages, type SovLine, type SovLineSeed } from '../../lib/bidDocuments/sovLines'
import { CoverLetterSovLinesEditor } from './CoverLetterSovLinesEditor'
import { splitStageValues, sovSplitTotals, type SovSplitInput, type SovStageOverride } from '../../lib/bidDocuments/sovLaborMaterial'
import type {
  PriceBookVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  BidPaymentScheduleRow,
  BidVersion,
} from '../../lib/bids/bidPricingEngineTypes'
import { bundleSummary, letterTotal, planLetterSections, planUnsplitLetterSections, sectionLabel, starredPricingIdForVersion } from '../../lib/bids/coverLetterVersionBundle'
import { COVER_LETTER_ALTS_HEADING_DEFAULT, altSectionKey, buildAlternatesBlock, parseCoverLetterAltTexts, planSamePageLetter, type CoverLetterAltTexts } from '../../lib/bids/coverLetterSamePage'
import { buildAddAlternatesBlock, offeredAddAlternates, splitLetterTotalsByAlternate, stampAddAlternateAmounts, type LetterTotalsByAlternate } from '../../lib/bids/coverLetterAddAlternates'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidFlowStrip } from './BidFlowStrip'
import { BidBestEffortCard } from './BidBestEffortCard'
import { deriveBidFlow, type BidFlowDoor, type BidFlowStep } from '../../lib/bids/bidFlow'
import { useBidFlowFacts } from '../../hooks/useBidFlowFacts'
import { useBidFlowReview } from '../../hooks/useBidFlowReview'
import { useBidFlowFold } from '../../hooks/useBidFlowFold'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import { gcDisplayName } from '../../lib/bids/gcDisplayName'

const COVER_LETTER_INCLUSIONS_PLACEHOLDER = 'Permits'

/** bid_versions row (the v2.2117 letter columns are in the generated types since the F5 regen). */
type BidVersionLetter = BidVersion
type BundleSection = { name: string; bidVersionId: string | null; revenueSum: number; fixtureRows: { fixture: string; count: number }[]; isAlternate: boolean; offeredPricingId?: string }
// Same-page alternates (v2.2370): alternates as one line each under the proposed amount, vs. the
// pre-2370 one-full-letter-per-alternate document. Per-device.
const COVER_LETTER_ALTS_LAYOUT_KEY = 'bids_cover_letter_alts_layout_v1'

type BidsCoverLetterTabProps = {
  /** v2.3216: open a step's door from the strip — Edit window or another tab — and land on its field. The page owns it. */
  onOpenBidFlowDoor?: (bid: BidWithBuilder, door: BidFlowDoor, step: BidFlowStep) => void
  /** Role gating for those doors (superintendents never reach Pricing / Cover Letter). */
  bidFlowDoorAllowed?: (door: BidFlowDoor) => boolean
  bids: BidWithBuilder[]
  selectedBidForPricing: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  serviceTypes: Array<{ id: string; name: string }>
  pricingCountRows: BidCountRow[]
  coverLetterPricingRows: { revenueSum: number; fixtureRows: { fixture: string; count: number }[]; byAlternate: LetterTotalsByAlternate | null } | null
  /** Name of the active Pricing driving the amount above, shown so the user knows which pricing this letter reflects. */
  activePricingName: string | null
  /** The engine's active bid Version (null = unsplit bid) — the single letter's GC follows this Version's override. */
  activeBidVersionId: string | null
  /**
   * Fingerprint of the engine's bid_versions (id:customer_id pairs) — refetches
   * versionGcById when a GC is (re)assigned in the Version picker, which
   * reloads the engine's versions but not this tab's local map (v2.1762).
   */
  versionGcFingerprint: string
  /** The selected bid's Pricings — used to build the bundled (one-letter-per-Pricing) submission document. */
  bidPricings: PriceBookVersion[]
  /** Reload the bid's Pricings after an include/reorder change so the bundle recomputes. */
  reloadBidPricings: () => Promise<void>
  /** The selected bid's Versions — the New view bundles these, each at its ★ scenario (v2.2117). */
  bidVersions: BidVersion[]
  reloadBidVersions: () => Promise<void>
  loadBids: (serviceTypeId?: string | null) => Promise<BidWithBuilder[]>
  /** v2.3222: after a Mark sent that reached the bids row — the page opens the robot's envelope when a shadow scored. */
  onBidSentRecorded?: (bidId: string) => void
  /** v2.3234: the best effort just went on record — the page opens the envelope if the robot has scored against it. */
  onBestEffortRecorded?: (bidId: string) => void
  /** v2.3234: the recorded card's door — open the envelope for this bid. */
  onOpenRobotEnvelope?: (bidId: string) => void
  // Parent-owned *ByBid maps (also read by downloadApprovalPdf)
  coverLetterInclusionsByBid: Record<string, string>
  setCoverLetterInclusionsByBid: Dispatch<SetStateAction<Record<string, string>>>
  coverLetterExclusionsByBid: Record<string, string>
  setCoverLetterExclusionsByBid: Dispatch<SetStateAction<Record<string, string>>>
  coverLetterTermsByBid: Record<string, string>
  setCoverLetterTermsByBid: Dispatch<SetStateAction<Record<string, string>>>
  coverLetterIncludeDesignDrawingPlanDateByBid: Record<string, boolean>
  setCoverLetterIncludeDesignDrawingPlanDateByBid: Dispatch<SetStateAction<Record<string, boolean>>>
  coverLetterCustomAmountByBid: Record<string, string>
  setCoverLetterCustomAmountByBid: Dispatch<SetStateAction<Record<string, string>>>
  coverLetterUseCustomAmountByBid: Record<string, boolean>
  setCoverLetterUseCustomAmountByBid: Dispatch<SetStateAction<Record<string, boolean>>>
  coverLetterIncludeSignatureByBid: Record<string, boolean>
  setCoverLetterIncludeSignatureByBid: Dispatch<SetStateAction<Record<string, boolean>>>
  coverLetterIncludeFixturesPerPlanByBid: Record<string, boolean>
  setCoverLetterIncludeFixturesPerPlanByBid: Dispatch<SetStateAction<Record<string, boolean>>>
  // Callbacks
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
  onSaveBidSubmissionQuickAdd: (bidId: string, value: string) => Promise<void>
  ledgerPrefixMap: LedgerPrefixMap
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
}

export function BidsCoverLetterTab({
  onOpenBidFlowDoor,
  bidFlowDoorAllowed,
  bids,
  selectedBidForPricing,
  narrowViewport640,
  bidPreview,
  serviceTypes,
  pricingCountRows,
  coverLetterPricingRows,
  activePricingName,
  activeBidVersionId,
  versionGcFingerprint,
  bidPricings,
  reloadBidPricings,
  bidVersions,
  reloadBidVersions,
  loadBids,
  onBidSentRecorded,
  onBestEffortRecorded,
  onOpenRobotEnvelope,
  coverLetterInclusionsByBid,
  setCoverLetterInclusionsByBid,
  coverLetterExclusionsByBid,
  setCoverLetterExclusionsByBid,
  coverLetterTermsByBid,
  setCoverLetterTermsByBid,
  coverLetterIncludeDesignDrawingPlanDateByBid,
  setCoverLetterIncludeDesignDrawingPlanDateByBid,
  coverLetterCustomAmountByBid,
  setCoverLetterCustomAmountByBid,
  coverLetterUseCustomAmountByBid,
  setCoverLetterUseCustomAmountByBid,
  coverLetterIncludeSignatureByBid,
  setCoverLetterIncludeSignatureByBid,
  coverLetterIncludeFixturesPerPlanByBid,
  setCoverLetterIncludeFixturesPerPlanByBid,
  onSelectBid,
  onClose,
  onEditBid,
  onSaveBidSubmissionQuickAdd,
  ledgerPrefixMap,
  onlyMyBids,
  setOnlyMyBids,
  isMyBid,
}: BidsCoverLetterTabProps) {
  const { showToast } = useToastContext()
  // Bid flow facts for the selected bid (one chunked read per selection).
  const { factsByBid: bidFlowFactsByBid } = useBidFlowFacts(selectedBidForPricing ? [selectedBidForPricing.id] : [])
  const bidFlowReview = useBidFlowReview(selectedBidForPricing ? [selectedBidForPricing] : [])
  // v2.3241: the strip folds to one line beside the title; per device.
  const flowFold = useBidFlowFold()
  const confirmDialog = useConfirmDialog()
  const { user: authUser, role: authRole } = useAuth()
  // Cover-letter-only UI state
  const [coverLetterSearchQuery, setCoverLetterSearchQuery] = useState('')
  const [coverLetterBidSubmissionQuickAddBidId, setCoverLetterBidSubmissionQuickAddBidId] = useState<string | null>(null)
  const [coverLetterBidSubmissionQuickAddValue, setCoverLetterBidSubmissionQuickAddValue] = useState('')
  const [bidSubmissionQuickAddSuccess, setBidSubmissionQuickAddSuccess] = useState<string | null>(null)
  // Per-version sends (v2.2124): latest row per version → "sent 7/7 · $X"; "Mark sent today" appends.
  const [versionSends, setVersionSends] = useState<VersionSendRow[]>([])
  const [boardValueRule, setBoardValueRule] = useState<BoardValueRule>('base_sum')
  const [markingSent, setMarkingSent] = useState(false)
  // Bid basis (v2.3219): the bid's marked-up plans exports + the persisted letter pill.
  const bidBasisExports = useBidBasisExports(selectedBidForPricing?.id ?? null, selectedBidForPricing ? bidBasisRefForBid(selectedBidForPricing) : null)
  const [bidToMarkedPlansOverride, setBidToMarkedPlansOverride] = useState<Record<string, boolean>>({})
  // vv2.2716: the Bid Room panel is controlled per GC so "Setup bid room" can sit beside Mark sent.
  const [roomOpenByKey, setRoomOpenByKey] = useState<Record<string, boolean>>({})
  const [roomPresenceByKey, setRoomPresenceByKey] = useState<Record<string, boolean>>({})
  // Same-page alternates (v2.2370): default same-page; "Separate pages" is the pre-2370 document.
  const [altsLayout, setAltsLayout] = useState<'same-page' | 'separate'>(() => {
    try {
      return window.localStorage.getItem(COVER_LETTER_ALTS_LAYOUT_KEY) === 'separate' ? 'separate' : 'same-page'
    } catch {
      return 'same-page'
    }
  })
  const switchAltsLayout = (next: 'same-page' | 'separate') => {
    setAltsLayout(next)
    try {
      window.localStorage.setItem(COVER_LETTER_ALTS_LAYOUT_KEY, next)
    } catch {
      /* device just won't remember */
    }
  }
  // Customer-facing wording for the Alternates block (bids.cover_letter_alt_texts): heading +
  // per-alternate label/note, edited by clicking the dashed text right on the preview.
  const [altTexts, setAltTexts] = useState<CoverLetterAltTexts>({})
  const [altTextEditor, setAltTextEditor] = useState<{ editKey: string; label: string; note: string } | null>(null)
  // v2.4195: the with-and-without alternates on the active version, kept for the send to stamp
  // their add-on amounts onto cover_letter_alt_texts (the Bid Board's "+$ alt" chip reads them).
  const addAltRef = useRef<{ split: LetterTotalsByAlternate | null; texts: CoverLetterAltTexts }>({ split: null, texts: {} })
  async function stampAlternateAmounts(bidId: string) {
    const { split, texts } = addAltRef.current
    if (!split) return
    const next = stampAddAlternateAmounts(texts, split)
    if (JSON.stringify(next) !== JSON.stringify(texts)) await saveAltTexts(bidId, next)
  }
  // v2.4198: which bid's wording is hydrated — the live stamp below must never run against the
  // empty texts of a bid still loading (it would wipe the saved offered flags).
  const altTextsLoadedFor = useRef<string | null>(null)
  useEffect(() => {
    altTextsLoadedFor.current = null
    setAltTexts({})
    setAltTextEditor(null)
    const bid = selectedBidForPricing
    if (!bid) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('bids').select('cover_letter_alt_texts').eq('id', bid.id).maybeSingle()
      if (cancelled) return
      setAltTexts(parseCoverLetterAltTexts((data as { cover_letter_alt_texts?: unknown } | null)?.cover_letter_alt_texts))
      altTextsLoadedFor.current = bid.id
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on bid id; hydrates from the freshly selected bid
  }, [selectedBidForPricing?.id])
  // v2.4198: the add-on amounts follow the price. Whenever the active version's alternate totals
  // change, the stamped amounts are rewritten (debounced, only when they differ) so the Bid Board's
  // "+$ alt" chip shows the moment an alternate is priced — not only after a send. Offered flags
  // and wording are kept as saved; an open wording editor stays open.
  const liveSplit = coverLetterPricingRows?.byAlternate ?? null
  useEffect(() => {
    const bidId = selectedBidForPricing?.id
    if (!bidId || !liveSplit || altTextsLoadedFor.current !== bidId) return
    const next = stampAddAlternateAmounts(altTexts, liveSplit)
    if (JSON.stringify(next) === JSON.stringify(altTexts)) return
    const handle = window.setTimeout(() => {
      if (altTextsLoadedFor.current !== bidId) return
      setAltTexts(next)
      void supabase.from('bids').update({ cover_letter_alt_texts: next }).eq('id', bidId).select('id').then(({ data: rows, error }) => {
        // A refused write (read-only seat) stays quiet — the letter on screen is already right.
        if (error) showToast('Could not save the alternate amounts: ' + error.message, 'error')
        else if (bidUpdateRefused(rows)) altTextsLoadedFor.current = null
      })
    }, 800)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable; the stamp keys on the bid, its wording and the live split
  }, [selectedBidForPricing?.id, altTexts, liveSplit])
  async function saveAltTexts(bidId: string, next: CoverLetterAltTexts) {
    setAltTexts(next)
    setAltTextEditor(null)
    const { data: rows, error } = await supabase.from('bids').update({ cover_letter_alt_texts: next }).eq('id', bidId).select('id')
    if (error) showToast('Could not save the letter wording: ' + error.message, 'error')
    else if (bidUpdateRefused(rows)) showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
  }

  // Reset quick-add when the selected bid changes
  useEffect(() => {
    if (coverLetterBidSubmissionQuickAddBidId != null && selectedBidForPricing?.id !== coverLetterBidSubmissionQuickAddBidId) {
      setCoverLetterBidSubmissionQuickAddBidId(null)
      setCoverLetterBidSubmissionQuickAddValue('')
    }
  }, [selectedBidForPricing?.id, coverLetterBidSubmissionQuickAddBidId])

  // Payment schedule — persisted per bid (bid_payment_schedule_rows +
  // bids.include_payment_schedule). Rows persist even while the toggle is off.
  const [paymentScheduleRows, setPaymentScheduleRows] = useState<BidPaymentScheduleRow[]>([])
  const [paymentScheduleEnabled, setPaymentScheduleEnabled] = useState(false)
  // Per-row editing buffer so percent typing doesn't write on every keystroke (commit on blur/Enter)
  const [paymentSchedulePercentDrafts, setPaymentSchedulePercentDrafts] = useState<Record<string, string>>({})
  // Materials by stage (v2.3673): the pill (bids.include_materials_by_stage) + the factored stage rows the letter carries.
  const [materialsByStageEnabled, setMaterialsByStageEnabled] = useState(false)
  const [materialsByStageRows, setMaterialsByStageRows] = useState<MaterialsByStageLetterRow[] | null>(null)
  // PR 4: the stages' raw shares, for "Use stage shares" on the payment schedule.
  const [materialsByStageShares, setMaterialsByStageShares] = useState<StageMoney | null>(null)
  // Schedule of values (v2.4066): the pill (bids.include_schedule_of_values) — the letter's amount spread by
  // the takeoff's stage shares. The stage document behind it is the same read the other two pills use.
  const [scheduleOfValuesEnabled, setScheduleOfValuesEnabled] = useState(false)
  const [materialsByStageDoc, setMaterialsByStageDoc] = useState<MaterialsByStageDocument | null>(null)
  // Split labor and material (v2.4075): two switches on the bid, the costs + rule + typed figures behind them, and the typing buffers.
  const [sovSplitEnabled, setSovSplitEnabled] = useState(false)
  const [sovTotalOnly, setSovTotalOnly] = useState(false)
  const [sovCosts, setSovCosts] = useState<SovLaborCosts | null>(null)
  const [sovRuleLaborPct, setSovRuleLaborPct] = useState(45)
  const [sovOverrides, setSovOverrides] = useState<Map<TakeoffStage, SovStageOverride>>(new Map())
  const [sovLaborDrafts, setSovLaborDrafts] = useState<Partial<Record<TakeoffStage, string>>>({})
  const [sovNoteDrafts, setSovNoteDrafts] = useState<Partial<Record<TakeoffStage, string>>>({})
  // My lines (v2.4070): the shape on the bid and its rows (kept while the shape is By stage).
  const [sovShape, setSovShape] = useState<'stage' | 'lines'>('stage')
  const [sovLines, setSovLines] = useState<SovLine[]>([])
  // Org-editable cover letter text (Settings → Templates & testing → Bid Cover Letter
  // Defaults); null = use the built-in constants.
  const [orgCoverLetterDefaults, setOrgCoverLetterDefaults] = useState<{
    terms: string | null
    exclusions: string | null
    closing: string | null
  }>({ terms: null, exclusions: null, closing: null })

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('app_settings')
      .select('key, value_text')
      .in('key', [
        APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT,
        APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT,
        APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING,
        APP_SETTINGS_KEY_BID_BOARD_VALUE_RULE,
      ])
      .then(({ data }) => {
        if (cancelled) return
        const byKey = new Map((data ?? []).map((r) => [r.key, r.value_text]))
        const pick = (key: string) => {
          const v = (byKey.get(key) ?? '')?.trim()
          return v ? v : null
        }
        setOrgCoverLetterDefaults({
          terms: pick(APP_SETTINGS_KEY_BID_COVER_LETTER_TERMS_DEFAULT),
          exclusions: pick(APP_SETTINGS_KEY_BID_COVER_LETTER_EXCLUSIONS_DEFAULT),
          closing: pick(APP_SETTINGS_KEY_BID_COVER_LETTER_CLOSING),
        })
        setBoardValueRule(parseBoardValueRule(byKey.get(APP_SETTINGS_KEY_BID_BOARD_VALUE_RULE) ?? null))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const bid = selectedBidForPricing
    if (!bid) {
      setPaymentScheduleRows([])
      setPaymentScheduleEnabled(false)
      setPaymentSchedulePercentDrafts({})
      return
    }
    setPaymentScheduleEnabled(bid.include_payment_schedule === true)
    setMaterialsByStageEnabled(bid.include_materials_by_stage === true)
    setScheduleOfValuesEnabled(bid.include_schedule_of_values === true)
    setSovSplitEnabled(bid.sov_split_labor_material === true)
    setSovTotalOnly(bid.sov_letter_total_only === true)
    setSovShape(bid.sov_shape === 'lines' ? 'lines' : 'stage')
    setSovLaborDrafts({})
    setSovNoteDrafts({})
    setPaymentSchedulePercentDrafts({})
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('bid_payment_schedule_rows')
        .select('*')
        .eq('bid_id', bid.id)
        .order('sort_order')
        .order('created_at')
      if (cancelled) return
      setPaymentScheduleRows((data as BidPaymentScheduleRow[]) ?? [])
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on bid id; hydrates from the freshly selected bid
  }, [selectedBidForPricing?.id])

  async function reloadPaymentScheduleRows(bidId: string) {
    const { data } = await supabase
      .from('bid_payment_schedule_rows')
      .select('*')
      .eq('bid_id', bidId)
      .order('sort_order')
      .order('created_at')
    setPaymentScheduleRows((data as BidPaymentScheduleRow[]) ?? [])
  }

  async function toggleBidToMarkedPlans(bid: BidWithBuilder) {
    const next = !((bidToMarkedPlansOverride[bid.id] ?? bid.bid_to_marked_plans) === true)
    setBidToMarkedPlansOverride((prev) => ({ ...prev, [bid.id]: next }))
    const { data: rows, error } = await supabase.from('bids').update({ bid_to_marked_plans: next }).eq('id', bid.id).select('id')
    if (error) {
      setBidToMarkedPlansOverride((prev) => ({ ...prev, [bid.id]: !next }))
      showToast('Error updating bid: ' + error.message, 'error')
      return
    }
    if (bidUpdateRefused(rows)) {
      setBidToMarkedPlansOverride((prev) => ({ ...prev, [bid.id]: !next }))
      showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    await loadBids()
  }

  // Materials by stage (v2.3673): the rows come through the one door the Takeoffs rail uses.
  const materialsByStageBidId = selectedBidForPricing?.id ?? null
  const materialsByStageFactorRaw = selectedBidForPricing?.sov_material_factor ?? null
  useEffect(() => {
    if (!materialsByStageBidId || !(materialsByStageEnabled || paymentScheduleEnabled || scheduleOfValuesEnabled)) {
      setMaterialsByStageRows(null)
      setMaterialsByStageShares(null)
      setMaterialsByStageDoc(null)
      return
    }
    let cancelled = false
    void loadMaterialsByStageForBid(supabase, { bidId: materialsByStageBidId, bidVersionId: activeBidVersionId ?? null, bidFactorOverride: materialsByStageFactorRaw })
      .then((d) => {
        if (cancelled) return
        setMaterialsByStageRows(materialsByStageLetterRows(d.summary))
        setMaterialsByStageShares(d.summary.assignedRaw > 0 ? d.summary.sharesPct : null)
        setMaterialsByStageDoc(d)
      })
      .catch(() => {
        if (!cancelled) {
          setMaterialsByStageRows([])
          setMaterialsByStageShares(null)
          setMaterialsByStageDoc(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [materialsByStageBidId, materialsByStageFactorRaw, materialsByStageEnabled, paymentScheduleEnabled, scheduleOfValuesEnabled, activeBidVersionId])

  // PR 4: the three "before" rows take the stages' shares, scaled into what retainage / deposit leave.
  async function applyPaymentScheduleStageShares(bidId: string) {
    if (!materialsByStageShares) return
    const next = paymentRowsFromStageShares(paymentScheduleRows, materialsByStageShares)
    if (!next) {
      showToast('Add a "before Rough In / Top Out / Trim Set" row first.', 'info')
      return
    }
    for (const r of next) {
      const prev = paymentScheduleRows.find((p) => p.id === r.id)
      if (prev && Number(prev.percent) !== r.percent) await supabase.from('bid_payment_schedule_rows').update({ percent: r.percent }).eq('id', r.id)
    }
    setPaymentSchedulePercentDrafts({})
    await reloadPaymentScheduleRows(bidId)
  }

  async function toggleMaterialsByStageEnabled(bid: BidWithBuilder) {
    const next = !materialsByStageEnabled
    setMaterialsByStageEnabled(next)
    const { data: rows, error } = await supabase.from('bids').update({ include_materials_by_stage: next }).eq('id', bid.id).select('id')
    if (error) {
      setMaterialsByStageEnabled(!next)
      showToast('Error updating bid: ' + error.message, 'error')
      return
    }
    if (bidUpdateRefused(rows)) {
      setMaterialsByStageEnabled(!next)
      showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    void loadBids()
  }

  // The split's inputs (v2.4075) — the Labor tab's hours × rate + subs, the company rule, the typed figures — through the one door the Approval PDF uses.
  const sovSplitBidId = scheduleOfValuesEnabled && sovSplitEnabled ? (selectedBidForPricing?.id ?? null) : null
  useEffect(() => {
    if (!sovSplitBidId) {
      setSovCosts(null)
      setSovOverrides(new Map())
      return
    }
    let cancelled = false
    void loadSovSplitInputsForBid(supabase, sovSplitBidId)
      .then((d) => {
        if (cancelled) return
        setSovCosts(d.costs)
        setSovRuleLaborPct(d.ruleLaborPct)
        setSovOverrides(d.overrides)
      })
      .catch(() => {
        if (!cancelled) setSovCosts(null)
      })
    return () => {
      cancelled = true
    }
  }, [sovSplitBidId])

  // The lines are read whenever the schedule is on, so a shape switch is instant and nothing is lost either way.
  const sovLinesBidId = scheduleOfValuesEnabled ? (selectedBidForPricing?.id ?? null) : null
  useEffect(() => {
    if (!sovLinesBidId) {
      setSovLines([])
      return
    }
    let cancelled = false
    void loadSovLines(supabase, sovLinesBidId).then((rows) => {
      if (!cancelled) setSovLines(rows)
    })
    return () => {
      cancelled = true
    }
  }, [sovLinesBidId])

  async function reloadSovLines(bidId: string) {
    setSovLines(await loadSovLines(supabase, bidId))
  }

  /** By stage ↔ My lines. The first switch to My lines seeds the three stages as they stand now. */
  async function setSovShapeOnBid(bid: BidWithBuilder, next: 'stage' | 'lines', seeds: SovLineSeed[] | null) {
    if (next === sovShape) return
    const before = sovShape
    setSovShape(next)
    const { data: rows, error } = await supabase.from('bids').update({ sov_shape: next }).eq('id', bid.id).select('id')
    if (error || bidUpdateRefused(rows)) {
      setSovShape(before)
      showToast(error ? 'Error updating bid: ' + error.message : BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    if (next === 'lines' && sovLines.length === 0 && seeds && seeds.length > 0) {
      const { error: seedErr } = await supabase.from('bid_sov_lines').insert(seeds.map((sd) => ({ bid_id: bid.id, sort_order: sd.sortOrder, label: sd.label, value: sd.value, labor: sd.labor, note: sd.note, stage: sd.stage })))
      if (seedErr) showToast('Could not seed the lines: ' + seedErr.message, 'error')
      await reloadSovLines(bid.id)
    }
    void loadBids()
  }

  async function toggleSovSplit(bid: BidWithBuilder) {
    const next = !sovSplitEnabled
    setSovSplitEnabled(next)
    const { data: rows, error } = await supabase.from('bids').update({ sov_split_labor_material: next }).eq('id', bid.id).select('id')
    if (error || bidUpdateRefused(rows)) {
      setSovSplitEnabled(!next)
      showToast(error ? 'Error updating bid: ' + error.message : BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    void loadBids()
  }

  async function toggleSovTotalOnly(bid: BidWithBuilder) {
    const next = !sovTotalOnly
    setSovTotalOnly(next)
    const { data: rows, error } = await supabase.from('bids').update({ sov_letter_total_only: next }).eq('id', bid.id).select('id')
    if (error || bidUpdateRefused(rows)) {
      setSovTotalOnly(!next)
      showToast(error ? 'Error updating bid: ' + error.message : BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    void loadBids()
  }

  /** One row per stage in bid_sov_stage_overrides; labor null = back to the bid's costs. */
  async function writeSovOverride(bidId: string, stage: TakeoffStage, patch: SovStageOverride) {
    const prev = sovOverrides.get(stage) ?? {}
    const next: SovStageOverride = { labor: 'labor' in patch ? patch.labor : prev.labor ?? null, note: 'note' in patch ? (patch.note ?? '') : prev.note ?? '' }
    setSovOverrides((m) => new Map(m).set(stage, next))
    const { error } = await supabase.from('bid_sov_stage_overrides').upsert({ bid_id: bidId, stage, labor: next.labor ?? null, note: next.note ?? '' }, { onConflict: 'bid_id,stage' })
    if (error) {
      setSovOverrides((m) => new Map(m).set(stage, prev))
      showToast('Could not save the schedule line: ' + error.message, 'error')
    }
  }

  function commitSovLabor(bidId: string, stage: TakeoffStage, derivedLabor: number) {
    const raw = (sovLaborDrafts[stage] ?? '').replace(/[$,]/g, '').trim()
    setSovLaborDrafts((d) => {
      const n = { ...d }
      delete n[stage]
      return n
    })
    if (raw === '') {
      if (sovOverrides.get(stage)?.labor != null) void writeSovOverride(bidId, stage, { labor: null })
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return
    const rounded = Math.round(n * 100) / 100
    if (Math.abs(rounded - derivedLabor) < 0.005) {
      if (sovOverrides.get(stage)?.labor != null) void writeSovOverride(bidId, stage, { labor: null })
      return
    }
    if (sovOverrides.get(stage)?.labor === rounded) return
    void writeSovOverride(bidId, stage, { labor: rounded })
  }

  function commitSovNote(bidId: string, stage: TakeoffStage) {
    const text = (sovNoteDrafts[stage] ?? '').trim().slice(0, 500)
    setSovNoteDrafts((d) => {
      const n = { ...d }
      delete n[stage]
      return n
    })
    if ((sovOverrides.get(stage)?.note ?? '') === text) return
    void writeSovOverride(bidId, stage, { note: text })
  }

  async function toggleScheduleOfValuesEnabled(bid: BidWithBuilder) {
    const next = !scheduleOfValuesEnabled
    setScheduleOfValuesEnabled(next)
    const { data: rows, error } = await supabase.from('bids').update({ include_schedule_of_values: next }).eq('id', bid.id).select('id')
    if (error) {
      setScheduleOfValuesEnabled(!next)
      showToast('Error updating bid: ' + error.message, 'error')
      return
    }
    if (bidUpdateRefused(rows)) {
      setScheduleOfValuesEnabled(!next)
      showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    void loadBids()
  }

  // The full two-page schedule (the Takeoffs print) with its "Of contract" column filled from the
  // letter's amount — the Takeoffs tab has no priced total, so the column is offered from here.
  function printScheduleOfValuesOfContract(bid: BidWithBuilder, amountDollars: number, split: SovSplitInput | null) {
    if (sovShape === 'lines') {
      printHtmlInNewWindow(
        buildSovLinesSheetHtml({
          title: `${bidDisplayName(bid) || 'Bid'} — Schedule of values`,
          subtitle: `${bid.project_name ?? ''}${bid.project_name ? ' · ' : ''}contract $${formatCurrency(amountDollars)} · for progress billing only`,
          lines: sovLines,
          contractAmount: amountDollars,
          split: sovSplitEnabled,
          ruleLaborPct: sovRuleLaborPct,
        }),
      )
      return
    }
    if (!materialsByStageDoc) return
    const summary = materialsByStageDoc.summary
    const letter = scheduleOfValuesLetter(summary, amountDollars)
    const splitRows = letter && split ? splitStageValues(letter, split) : null
    const factorNote = materialsByStageDoc.factorIsBidOverride ? `Factor ${summary.factor} is this bid's own.` : `Factor ${summary.factor} is the company default.`
    printHtmlInNewWindow(
      buildScheduleOfValuesHtml({
        title: `${bidDisplayName(bid) || 'Bid'} — Schedule of values`,
        subtitle: `$${formatCurrency(amountDollars)} by stage, from the takeoff's stage shares · ${summary.stagedFixtureCount} of ${summary.costedFixtureCount} costed fixtures staged`,
        summary,
        contract: letter ? { amount: letter.total, scaled: letter.scaled } : null,
        split: splitRows,
        unstagedNames: summary.fixtures.filter((f) => f.raw <= 0 && f.fixture.trim()).map((f) => f.fixture),
        factorNote,
      }),
    )
  }

  async function togglePaymentScheduleEnabled(bid: BidWithBuilder) {
    const next = !paymentScheduleEnabled
    setPaymentScheduleEnabled(next)
    const { data: rows, error } = await supabase.from('bids').update({ include_payment_schedule: next }).eq('id', bid.id).select('id')
    if (error) {
      setPaymentScheduleEnabled(!next)
      showToast('Error updating bid: ' + error.message, 'error')
      return
    }
    if (bidUpdateRefused(rows)) {
      setPaymentScheduleEnabled(!next)
      showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      return
    }
    // Seed the company-standard 30/30/30/10 on first enable
    if (next && paymentScheduleRows.length === 0) {
      await supabase.from('bid_payment_schedule_rows').insert(
        DEFAULT_PAYMENT_SCHEDULE_ROWS.map((r, i) => ({ bid_id: bid.id, timing: r.timing, percent: r.percent, sort_order: i })),
      )
      await reloadPaymentScheduleRows(bid.id)
    }
    void loadBids()
  }

  async function addPaymentScheduleRow(bidId: string) {
    const maxSort = paymentScheduleRows.reduce((m, r) => Math.max(m, r.sort_order), -1)
    await supabase.from('bid_payment_schedule_rows').insert({ bid_id: bidId, timing: 'before_start', percent: 0, sort_order: maxSort + 1 })
    await reloadPaymentScheduleRows(bidId)
  }

  async function removePaymentScheduleRow(bidId: string, rowId: string) {
    await supabase.from('bid_payment_schedule_rows').delete().eq('id', rowId)
    await reloadPaymentScheduleRows(bidId)
  }

  async function reorderPaymentScheduleRow(bidId: string, row: BidPaymentScheduleRow, dir: -1 | 1) {
    const sorted = [...paymentScheduleRows].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === row.id)
    const other = sorted[idx + dir]
    if (!other) return
    await supabase.from('bid_payment_schedule_rows').update({ sort_order: other.sort_order }).eq('id', row.id)
    await supabase.from('bid_payment_schedule_rows').update({ sort_order: row.sort_order }).eq('id', other.id)
    await reloadPaymentScheduleRows(bidId)
  }

  async function updatePaymentScheduleTiming(bidId: string, rowId: string, timing: string) {
    await supabase.from('bid_payment_schedule_rows').update({ timing }).eq('id', rowId)
    await reloadPaymentScheduleRows(bidId)
  }

  async function commitPaymentSchedulePercent(bidId: string, row: BidPaymentScheduleRow) {
    const draft = paymentSchedulePercentDrafts[row.id]
    if (draft == null) return
    setPaymentSchedulePercentDrafts((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
    const parsed = parseFloat(draft.replace(/,/g, '').trim())
    if (!Number.isFinite(parsed)) return // invalid input reverts to the stored value
    const clamped = Math.min(100, Math.max(0, parsed))
    if (clamped === Number(row.percent)) return
    await supabase.from('bid_payment_schedule_rows').update({ percent: clamped }).eq('id', row.id)
    await reloadPaymentScheduleRows(bidId)
  }

  // Per-Pricing revenue + fixtures for the bundled submission document. Only the active Pricing's
  // data is loaded by the engine, so for the bundle we fetch each INCLUDED Pricing's entries +
  // overlays here and compute revenue (cost inputs are irrelevant to the cover letter, so they're
  // passed as zeros). Precomputed into state so Print / Copy stay synchronous (clipboard gesture).
  const [bundlePricings, setBundlePricings] = useState<BundleSection[]>([])
  // Multi-GC (v2.1159): per-version GC overrides for the selected bid, and
  // which GC packet the preview/Print/Copy act on when there are several.
  const [versionGcById, setVersionGcById] = useState<Record<string, GcPacketCustomer | null>>({})
  const [selectedGcPacketKey, setSelectedGcPacketKey] = useState<string | null>(null)
  useEffect(() => {
    setSelectedGcPacketKey(null)
    const bid = selectedBidForPricing
    if (!bid) {
      setVersionGcById({})
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('bid_versions')
        .select('id, customer_id, customers(id, name, address)')
        .eq('bid_id', bid.id)
      if (cancelled) return
      setVersionGcById(versionGcOverrideMap((data ?? []) as unknown as BidVersionGcRow[]))
    })()
    return () => { cancelled = true }
    // versionGcFingerprint: refetch when a Version's GC assignment changes (v2.1762).
  }, [selectedBidForPricing?.id, versionGcFingerprint])
  useEffect(() => {
    const bid = selectedBidForPricing
    if (!bid) {
      setVersionSends([])
      return
    }
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bid.id)
      if (cancelled) return
      setVersionSends(error ? [] : ((data ?? []) as VersionSendRow[]))
    }
    void load()
    const onChanged = () => { void load() }
    window.addEventListener('bid-version-sends-changed', onChanged)
    return () => { cancelled = true; window.removeEventListener('bid-version-sends-changed', onChanged) }
  }, [selectedBidForPricing?.id])
  useEffect(() => {
    const bid = selectedBidForPricing
    // What goes in the document, by view:
    //  • New (v2.2117): the bid's VERSIONS flagged in-letter, base first then alternates, each at
    //    its ★ scenario. A split bid bundles even a single included version (the letter follows
    //    what's checked, not what's active); an unsplit bid has no versions → single letter.
    const plans: Array<{ name: string; bidVersionId: string | null; pricingId: string | null; isAlternate: boolean; offeredPricingId?: string }> =
      bidVersions.length > 0
        ? planLetterSections(bidVersions as BidVersionLetter[], bidPricings).map((p) => ({ name: p.name, bidVersionId: p.versionId, pricingId: p.pricingId, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }))
            // v2.2392 (Wendi): a version-less bid still honors OFFERED price options (G1) —
            // ★ base + each offered non-★ pricing as an alternate, exactly what the Pricing
            // tab's "On their letter · alternate" promises. Empty when nothing is offered.
        : planUnsplitLetterSections(bidPricings, bid?.selected_price_book_version_id ?? null).map((p) => ({ name: p.name, bidVersionId: null, pricingId: p.pricingId as string | null, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }))
    if (!bid || plans.length === 0 || pricingCountRows.length === 0) {
      setBundlePricings([])
      return
    }
    let cancelled = false
    const versionIds = plans.map((p) => p.pricingId).filter((id): id is string => !!id)
    void (async () => {
      // v2.2132: counts are per version — fetch the bid's rows once and group by version so each
      // section is priced on ITS bid's counts (the engine's pricingCountRows are only the active one's).
      const { data: allCountRows } = await supabase.from('bids_count_rows').select('*').eq('bid_id', bid.id).order('sequence_order', { ascending: true })
      const rowsByVersion = new Map<string | null, BidCountRow[]>()
      for (const r of ((allCountRows ?? []) as BidCountRow[])) {
        const k = (r as BidCountRow & { bid_version_id?: string | null }).bid_version_id ?? null
        rowsByVersion.set(k, [...(rowsByVersion.get(k) ?? []), r])
      }
      const rowsFor = (versionId: string | null) => rowsByVersion.get(versionId) ?? (versionId == null ? pricingCountRows : rowsByVersion.get(null) ?? pricingCountRows)
      const [entriesRes, assignRes, customRes, hidesRes] = versionIds.length > 0
        ? await Promise.all([
            supabase.from('price_book_entries').select('*, fixture_types(name)').in('version_id', versionIds),
            supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
            supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
            supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
      if (cancelled) return
      const allEntries = (entriesRes.data as PriceBookEntryWithFixture[]) ?? []
      const allAssign = (assignRes.data as BidPricingAssignment[]) ?? []
      const allCustom = (customRes.data as BidCountRowCustomPrice[]) ?? []
      const allHides = (hidesRes.data as BidCountRowSubmissionHide[]) ?? []
      const sections: BundleSection[] = plans.map((p) => {
        if (!p.pricingId) return { name: p.name, bidVersionId: p.bidVersionId, revenueSum: 0, fixtureRows: [], isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }
        const pid = p.pricingId
        const entries = allEntries.filter((e) => e.version_id === pid)
        const customMap = new Map<string, number>()
        for (const c of allCustom) if (c.price_book_version_id === pid) customMap.set(c.count_row_id, Number(c.unit_price))
        const result = computeBidPricingRows({
          countRows: rowsFor(p.bidVersionId),
          assignments: allAssign
            .filter((a) => a.price_book_version_id === pid)
            .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override })),
          entries,
          customUnitPriceByCountRowId: customMap,
          laborRows: [],
          totalMaterials: 0,
          laborRate: 0,
          taxPercent: 0,
          materialsFromTakeoffByCountRowId: {},
          hiddenSubmissionCountRowIds: submissionHiddenIdsForVersion(allHides, pid),
        })
        const allTotals = coverLetterTotalsFromPricingRows(result.rows)
        // v2.4195: an offered with-and-without alternate leaves the section (it prints as an add-on);
        // one the estimator unticked stays priced into it.
        const split = splitLetterTotalsByAlternate(result.rows, rowsFor(p.bidVersionId), bid.alternate_group_tags ?? [])
        const offeredHere = offeredAddAlternates(split, altTexts)
        const totals = split && offeredHere.length > 0
          ? (() => {
              const kept = split.alternates.filter((g) => !offeredHere.includes(g))
              return { revenueSum: split.base.revenueSum + kept.reduce((sum, g) => sum + g.revenueSum, 0), fixtureRows: [...split.base.fixtureRows, ...kept.flatMap((g) => g.fixtureRows)] }
            })()
          : allTotals
        return { name: p.name, bidVersionId: p.bidVersionId, revenueSum: totals.revenueSum, fixtureRows: totals.fixtureRows, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }
      })
      setBundlePricings(sections)
    })()
    return () => { cancelled = true }
  }, [selectedBidForPricing?.id, bidPricings, bidVersions, pricingCountRows, altTexts])

  // v2.2117: the letter flag lives on the VERSION. The version's ★ scenario mirrors the version's
  // flag (its other scenarios are never bundled) so the picker badge and the bundle can't disagree.
  async function toggleVersionInclude(v: BidVersionLetter) {
    const next = !v.include_in_submission
    await supabase.from('bid_versions').update({ include_in_submission: next }).eq('id', v.id)
    // Mirror onto the ★ scenario only (Old reads scenario flags). Other scenarios' flags mean
    // "offered to this GC as an alternate" (G1, v2.2154) and are the user's to set.
    const starId = starredPricingIdForVersion(v, bidPricings)
    if (starId) await supabase.from('price_book_versions').update({ include_in_submission: next }).eq('id', starId)
    await Promise.all([reloadBidVersions(), reloadBidPricings()])
  }
  /** G1: offer / stop offering a non-★ scenario to its version's GC as an alternate price on the letter. */
  async function setScenarioOffered(p: PriceBookVersion, offered: boolean) {
    await supabase.from('price_book_versions').update({ include_in_submission: offered }).eq('id', p.id)
    await reloadBidPricings()
  }
  async function setVersionAlternate(v: BidVersionLetter, isAlternate: boolean) {
    if (!!v.is_alternate === isAlternate) return
    await supabase.from('bid_versions').update({ is_alternate: isAlternate }).eq('id', v.id)
    await reloadBidVersions()
  }
  async function reorderVersion(v: BidVersionLetter, dir: -1 | 1) {
    const sorted = [...bidVersions].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === v.id)
    const other = sorted[idx + dir]
    if (!other) return
    await supabase.from('bid_versions').update({ sort_order: other.sort_order }).eq('id', v.id)
    await supabase.from('bid_versions').update({ sort_order: v.sort_order }).eq('id', other.id)
    await reloadBidVersions()
  }

  // Inline renaming in the checklist (v2.2422, owner-approved mockup): the letter prints
  // exactly these names, so fixing one shouldn't mean leaving the panel. `renameKey` is
  // `v:<versionId>` or `p:<pricingId>`.
  const [renameKey, setRenameKey] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  async function commitRenameVersion(v: BidVersionLetter) {
    const name = renameDraft.trim()
    if (!name || name === v.name) { setRenameKey(null); return }
    setRenameBusy(true)
    try {
      await withSupabaseRetry(async () => supabase.from('bid_versions').update({ name }).eq('id', v.id), 'rename bid version')
      setRenameKey(null)
      await Promise.all([reloadBidVersions(), reloadBidPricings()])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not rename the bid'), 'error')
    } finally {
      setRenameBusy(false)
    }
  }
  /** Renames the price option bid-wide AND stores it as the letter's customer-facing label for
      that offered price ("— or <name>: …") — one name everywhere, nothing to keep in sync. */
  async function commitRenameOption(op: PriceBookVersion, bidId: string) {
    const name = renameDraft.trim()
    if (!name || name === op.name) { setRenameKey(null); return }
    setRenameBusy(true)
    try {
      await withSupabaseRetry(async () => supabase.from('price_book_versions').update({ name }).eq('id', op.id), 'rename price option')
      if (op.bid_version_id) {
        const key = `${op.bid_version_id}:${op.id}`
        await saveAltTexts(bidId, { ...altTexts, sections: { ...altTexts.sections, [key]: { ...altTexts.sections?.[key], label: name } } })
      }
      setRenameKey(null)
      await reloadBidPricings()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not rename the price option'), 'error')
    } finally {
      setRenameBusy(false)
    }
  }
  function renameEditBox(onCommit: () => void) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
        <input
          type="text"
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCommit() } else if (e.key === 'Escape') setRenameKey(null) }}
          autoFocus
          aria-label="New name"
          style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.15rem 0.4rem', border: '1px solid #3b82f6', borderRadius: 4, width: '13rem' }}
        />
        <button type="button" onClick={onCommit} disabled={renameBusy} style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>{renameBusy ? '…' : 'Save'}</button>
        <button type="button" onClick={() => setRenameKey(null)} disabled={renameBusy} style={{ font: 'inherit', fontSize: '0.72rem', padding: '0.15rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
      </span>
    )
  }

  /**
   * Mark sent for a version-less bid (v2.2389): no send rows to write — the date + the letter
   * amount go onto the bid. Tier-2 #20 / J13-F2: one rule (`bidSentDate.ts`) for both lanes —
   * the bid room's first link send (`room`) only fills an EMPTY date (it never moves a hand-marked
   * one later), and the button (`hand`) on a bid that already has a date is an explicit re-stamp
   * that asks first. Every lane leaves a `bid_sent #lane=…` telemetry row.
   */
  async function markSentTodaySimple(bidId: string, amount: number, lane: Extract<BidSentLane, 'hand' | 'room'>, currentDateSent: string | null) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const cur = (currentDateSent ?? '').slice(0, 10) || null
    let next: string | null
    if (lane === 'hand' && cur) {
      const ok = await confirmDialog({ message: restampConfirmMessage(cur, today), confirmLabel: 'Move to today' })
      if (!ok) return
      next = sentDateAfterLaneStamp(cur, today, { explicit: true }).next
    } else {
      const r = sentDateAfterLaneStamp(cur, today)
      if (!r.write) {
        // The room link went out on a bid that already has its sent day — the send still counts for
        // telemetry, the date stays where the hand put it.
        recordBidSentLane(authUser?.id, authRole, lane)
        return
      }
      next = r.next
    }
    setMarkingSent(true)
    try {
      const patch: { bid_date_sent: string | null; bid_value?: number } = { bid_date_sent: next }
      if (amount > 0) patch.bid_value = amount
      const { data: rows, error } = await supabase.from('bids').update(patch).eq('id', bidId).select('id')
      if (error) {
        showToast('Could not mark the bid sent: ' + error.message, 'error')
        return
      }
      if (bidUpdateRefused(rows)) {
        showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
        return
      }
      recordBidSentLane(authUser?.id, authRole, lane)
      await stampAlternateAmounts(bidId)
      await loadBids()
      showToast(cur ? 'Sent date moved to today.' : 'Marked sent today.', 'success')
      onBidSentRecorded?.(bidId)
    } finally {
      setMarkingSent(false)
    }
  }

  /** "Mark sent today" (v2.2124): one send row per bid in the letter (today, its ★ value), and the bid-level roll-up.
      v2.2407 (Option A): the roll-up date is the FIRST send (never moved later by a later GC),
      and the board VALUE stamps only when this is the bid's OWN GC's letter — marking another
      GC's packet no longer overwrites it (the old last-GC-wins bug). */
  async function markSentToday(bidId: string, sections: BundleSection[], boardValue: number | null, opts: { isOwnGc: boolean; currentDateSent: string | null; lane?: BidSentLane }) {
    // $0 rule (v2.2213): unpriced sections aren't on the letter, so they don't get send rows either.
    const inLetter = sections.filter((s) => s.bidVersionId && s.revenueSum > 0)
    if (inLetter.length === 0) return
    setMarkingSent(true)
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null
      const { error } = await supabase.from('bid_version_sends').insert(
        inLetter.map((s) => ({ bid_id: bidId, bid_version_id: s.bidVersionId as string, sent_on: today, value: s.revenueSum > 0 ? s.revenueSum : null, is_alternate: s.isAlternate, created_by: userId })),
      )
      if (error) {
        showToast('Could not record the send: ' + error.message, 'error')
        return
      }
      // Derived-first roll-up: the one sent-date rule (`bidSentDate.ts` — earliest send stands; the
      // `sync_bid_date_sent_from_sends` trigger enforces the same rule server-side).
      const firstSent = sentDateAfterLaneStamp(opts.currentDateSent, today).next ?? today
      const patch: { bid_date_sent: string; bid_value?: number } = { bid_date_sent: firstSent }
      if (opts.isOwnGc && boardValue != null && boardValue > 0) patch.bid_value = boardValue
      const { data: bidRows, error: bidErr } = await supabase.from('bids').update(patch).eq('id', bidId).select('id')
      if (bidErr) showToast('Sends recorded, but the bid did not update: ' + bidErr.message, 'error')
      else if (bidUpdateRefused(bidRows)) showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
      recordBidSentLane(authUser?.id, authRole, opts.lane ?? 'ledger')
      window.dispatchEvent(new Event('bid-version-sends-changed'))
      await stampAlternateAmounts(bidId)
      await loadBids()
      showToast(`Marked sent today — ${inLetter.length} bid${inLetter.length === 1 ? '' : 's'} in the letter.`, 'success')
      if (!bidErr) onBidSentRecorded?.(bidId)
    } finally {
      setMarkingSent(false)
    }
  }

  function printCoverLetterDocument(combinedHtml: string) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cover Letter</title><style>
  body { font-family: sans-serif; margin: 1in; font-size: 12pt; }
  @media print { body { margin: 0.5in; } }
</style></head><body>${combinedHtml}</body></html>`
    printHtmlInNewWindow(html)
  }

  async function handleSaveBidSubmissionQuickAdd(bidId: string, value: string) {
    await onSaveBidSubmissionQuickAdd(bidId, value)
    setBidSubmissionQuickAddSuccess(bidId)
    setTimeout(() => setBidSubmissionQuickAddSuccess(null), 3000)
    setCoverLetterBidSubmissionQuickAddBidId(null)
    setCoverLetterBidSubmissionQuickAddValue('')
  }

  // New-view (studio) building blocks
  const studioStepCardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '0.9rem 1rem 1rem',
  }
  const studioStepHeadStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.55rem',
    marginBottom: '0.7rem',
    fontWeight: 600,
    fontSize: '0.95rem',
  }
  const studioStepNumStyle: React.CSSProperties = {
    width: '1.35rem',
    height: '1.35rem',
    borderRadius: 999,
    flexShrink: 0,
    background: '#3b82f6',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  const studioTogStyle = (on: boolean): React.CSSProperties => ({
    fontSize: '0.78rem',
    padding: '0.3rem 0.6rem',
    borderRadius: 999,
    cursor: 'pointer',
    border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
    background: on ? '#3b82f6' : 'var(--surface)',
    color: on ? '#fff' : 'var(--text-muted)',
  })
  const studioSegBtnStyle = (on: boolean, enabled: boolean): React.CSSProperties => ({
    fontSize: '0.68rem',
    padding: '0.15rem 0.45rem',
    border: 'none',
    background: on ? 'var(--bg-muted)' : 'var(--surface)',
    color: on ? 'var(--text-strong)' : 'var(--text-muted)',
    fontWeight: on ? 600 : 400,
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.45,
  })
  const studioFieldLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-700)',
    marginBottom: '0.25rem',
  }

  const coverLetterVisibleBids = (onlyMyBids ? bids.filter(isMyBid) : bids).filter((b) => {
    const q = coverLetterSearchQuery.toLowerCase()
    if (!q) return true
    const name = bidDisplayName(b).toLowerCase()
    const cust = (b.customers?.name ?? '').toLowerCase()
    const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
    return name.includes(q) || cust.includes(q) || gc.includes(q) || bidNumberMatchesQuery(b, coverLetterSearchQuery, ledgerPrefixMap)
  })

  return (
    <div>
      {!selectedBidForPricing && (
        <BidPickerSearchRow query={coverLetterSearchQuery} onQueryChange={setCoverLetterSearchQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} />
      )}
      {!selectedBidForPricing ? (
        <BidPickerStandardList
          bids={coverLetterVisibleBids}
          prefixMap={ledgerPrefixMap}
          onSelectBid={onSelectBid}
          emptyMessage={
            bids.length === 0
              ? 'No bids yet.'
              : onlyMyBids
                ? 'No bids you are the account manager or estimator for.'
                : 'No bids match your search.'
          }
        />
      ) : (() => {
        const bid = selectedBidForPricing
        const customer = bid.customers
        // One name for an unnamed GC everywhere the letter is shown (J13-F4): letterhead, Bid Room panel, room payload.
        const customerName = gcDisplayName(customer)
        const customerAddress = customer?.address ?? '—'
        const projectNameVal = bid.project_name ?? '—'
        const projectAddressVal = bid.address ?? '—'
        let coverLetterRevenue = 0
        let fixtureRows: { fixture: string; count: number }[] = []
        if (coverLetterPricingRows) {
          coverLetterRevenue = coverLetterPricingRows.revenueSum
          fixtureRows = coverLetterPricingRows.fixtureRows
        }
        // v2.4195: with-and-without alternates — the proposed amount is the BASE, each offered
        // alternate prints as an addition under it; an unticked one stays priced into the amount.
        const addAltSplit = coverLetterPricingRows?.byAlternate ?? null
        const offeredAdd = offeredAddAlternates(addAltSplit, altTexts)
        if (addAltSplit && offeredAdd.length > 0) {
          const kept = addAltSplit.alternates.filter((g) => !offeredAdd.includes(g))
          coverLetterRevenue = addAltSplit.base.revenueSum + kept.reduce((sum, g) => sum + g.revenueSum, 0)
          fixtureRows = [...addAltSplit.base.fixtureRows, ...kept.flatMap((g) => g.fixtureRows)]
        }
        addAltRef.current = { split: addAltSplit, texts: altTexts }
        const useCustomAmount = coverLetterUseCustomAmountByBid[bid.id] === true
        const customAmountStr = (coverLetterCustomAmountByBid[bid.id] ?? '').replace(/,/g, '').trim()
        const customAmountNum = customAmountStr ? parseFloat(customAmountStr) : NaN
        const effectiveRevenue = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : coverLetterRevenue
        const addAltsBlock = (editable: boolean, base: number = effectiveRevenue) => buildAddAlternatesBlock(offeredAdd, base, altTexts, formatCurrency, editable)
        const altChipStyle: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0 0.3rem', borderRadius: 3, border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-700)', marginLeft: '0.3rem', verticalAlign: '1px' }
        const addAltRows = addAltSplit && addAltSplit.alternates.length > 0 ? (
          <div data-testid="cover-letter-add-alternates" style={{ display: 'grid', gap: '0.25rem', margin: '0.35rem 0 0.5rem' }}>
            {addAltSplit.alternates.map((g) => {
              const on = offeredAdd.includes(g)
              const saved = altTexts.sections?.[g.key]
              const autoLabel = `Alternate ${offeredAdd.indexOf(g) + 1} — ${g.label}`
              return (
                <div key={g.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  <input
                    type="checkbox"
                    checked={on}
                    aria-label={`Offer ${g.label} as an alternate`}
                    onChange={() => {
                      const next: CoverLetterAltTexts = { ...altTexts, groups: { ...(altTexts.groups ?? {}), [g.key]: { ...(altTexts.groups?.[g.key] ?? {}), offered: !on } } }
                      void saveAltTexts(bid.id, next)
                    }}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                  <span>Offer <strong>{g.label}</strong><span style={altChipStyle}>ALT</span></span>
                  <span style={{ color: 'var(--text-muted)' }}>adds ${formatCurrency(g.revenueSum)}</span>
                  {on ? (
                    <button
                      type="button"
                      onClick={() => setAltTextEditor({ editKey: g.key, label: saved?.label ?? autoLabel, note: saved?.note ?? '' })}
                      title="How this alternate reads on the letter"
                      aria-label={`Wording for ${g.label}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-link)', fontSize: '0.75rem', padding: '0 0.25rem' }}
                    >
                      ✎ {saved?.label ?? autoLabel}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>priced into the proposal</span>
                  )}
                </div>
              )
            })}
          </div>
        ) : null
        // New view on a split bid: the headline is the LETTER TOTAL (sum of base bids at their ★),
        // not the active scenario's revenue — the number Mark sent stamps as the bid's value.
        const newBundleActive = bidVersions.length > 0 && bundlePricings.length > 0
        // v2.2213 (owner): a $0 section never reaches the letter — unpriced bids are listed in the
        // studio (grayed) and rejoin the letter the moment they're priced.
        const pricedBundle = bundlePricings.filter((sec) => sec.revenueSum > 0)
        const unpricedLeftOff = bundlePricings.length - pricedBundle.length
        const newLetterTotal = letterTotal(pricedBundle)
        const headlineAmount = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : newBundleActive ? (boardValueForRule(boardValueRule, bundleSectionsForBoard(bundlePricings), coverLetterRevenue) ?? newLetterTotal) : coverLetterRevenue
        // v2.4199: the best effort is the WHOLE — the headline (base) plus every offered alternate's
        // add-on — because the robot priced the alternate's rows too and is scored against it.
        const bestEffortAmount = headlineAmount + (addAltSplit ? offeredAdd.reduce((sum, g) => sum + g.revenueSum, 0) : 0)
        // J13-F3: while Pricing lazy-loads the preview reads "ZERO 00/100 DOLLARS" — Mark sent was
        // guarded, but Print and Copy were not, so a $0 letter of a $15.8M bid could leave the building.
        // A custom amount needs no pricing rows, so it is never gated.
        const totalsResolved = coverLetterPricingRows != null || useCustomAmount
        const totalsPendingTitle = 'Pricing is still loading — the letter amount is not final yet'
        const latestSends = latestSendByVersion(versionSends)
        const revenueWords = numberToWords(effectiveRevenue).toUpperCase()
        const revenueNumber = `$${formatCurrency(effectiveRevenue)}`
        const inclusions = coverLetterInclusionsByBid[bid.id] ?? ''
        const inclusionsDisplay = coverLetterInclusionsByBid[bid.id] ?? ''
        const exclusions = coverLetterExclusionsByBid[bid.id] ?? orgCoverLetterDefaults.exclusions ?? ''
        const exclusionsDisplay = coverLetterExclusionsByBid[bid.id] ?? orgCoverLetterDefaults.exclusions ?? DEFAULT_EXCLUSIONS
        const terms = coverLetterTermsByBid[bid.id] ?? orgCoverLetterDefaults.terms ?? ''
        const termsDisplay = coverLetterTermsByBid[bid.id] ?? orgCoverLetterDefaults.terms ?? DEFAULT_TERMS_AND_WARRANTY
        // The bid room hides an empty block where the letter prints the built-in wording, so the
        // room is handed the wording the letter resolves to, never the raw text.
        const roomExclusions = effectiveCoverLetterWording({ perBid: coverLetterExclusionsByBid[bid.id], orgDefault: orgCoverLetterDefaults.exclusions, builtIn: DEFAULT_EXCLUSIONS })
        const roomTerms = effectiveCoverLetterWording({ perBid: coverLetterTermsByBid[bid.id], orgDefault: orgCoverLetterDefaults.terms, builtIn: DEFAULT_TERMS_AND_WARRANTY })
        const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && bid.design_drawing_plan_date) ? formatDesignDrawingPlanDate(bid.design_drawing_plan_date) : null
        // The Design Drawings Plan Date and Fixtures-per-plan toggles are independent:
        // each is included strictly per its own checkbox (one, the other, both, or none).
        const effectiveIncludeFixtures = coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false
        // Bid basis (v2.3219): the clause rides only when the pill is on AND an export exists.
        const bidBasisCurrent = bidBasisExports.current
        const bidToMarkedPlansOn = (bidToMarkedPlansOverride[bid.id] ?? bid.bid_to_marked_plans === true) && !!bidBasisCurrent
        const bidBasisForLetter = bidToMarkedPlansOn && bidBasisCurrent
          ? { clause: bidBasisClause({ planDateFormatted: designDrawingPlanDateFormatted, sheets: shortSheetLabels(bidBasisCurrent.sheet_labels ?? [], bidBasisCurrent.ct_project_name) }) }
          : null
        const bidServiceType = serviceTypes.find((st) => st.id === bid.service_type_id)
        const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
        const includeSignature = coverLetterIncludeSignatureByBid[bid.id] === true
        const paymentScheduleSorted = [...paymentScheduleRows].sort((a, b) => a.sort_order - b.sort_order)
        const paymentScheduleInputs = paymentScheduleSorted.map((r) => ({ timing: r.timing, percent: Number(r.percent) }))
        const paymentSchedulePercentSum = paymentSchedulePercentTotal(paymentScheduleInputs)
        const paymentScheduleActive = paymentScheduleEnabled && paymentScheduleInputs.length > 0
        const materialsByStageForLetter = materialsByStageEnabled && materialsByStageRows && materialsByStageRows.length > 0 ? { rows: materialsByStageRows } : null
        // Schedule of values (v2.4066): each letter spreads ITS amount — the bundle section's, the same-page headline's — by the one set of shares.
        // The split (v2.4075): the bid's costs + the company rule + the typed figures; the same input for every letter and the print.
        const sovSplitInput: SovSplitInput | null = scheduleOfValuesEnabled && sovSplitEnabled && sovCosts && materialsByStageDoc
          ? { costs: { labor: sovCosts.labor, material: materialsByStageDoc.summary.scaled }, ruleLaborPct: sovRuleLaborPct, overrides: sovOverrides }
          : null
        const sovLinesForLetter = sovShape === 'lines' ? { lines: sovLines, ruleLaborPct: sovRuleLaborPct, split: sovSplitEnabled } : null
        const scheduleOfValuesForLetter = (amountDollars: number) =>
          scheduleOfValuesEnabled && (materialsByStageDoc || sovLinesForLetter)
            ? { summary: materialsByStageDoc?.summary ?? { byStage: { rough_in: 0, top_out: 0, trim_set: 0 }, assignedRaw: 0 }, amountDollars, split: sovSplitInput, totalOnly: sovTotalOnly, lines: sovLinesForLetter }
            : null
        const scheduleOfValuesPreview = scheduleOfValuesEnabled && materialsByStageDoc ? scheduleOfValuesLetter(materialsByStageDoc.summary, effectiveRevenue) : null
        const sovSplitPreview = scheduleOfValuesPreview && sovSplitInput ? splitStageValues(scheduleOfValuesPreview, sovSplitInput) : null
        const sovSplitPreviewTotals = sovSplitPreview ? sovSplitTotals(sovSplitPreview) : null
        const sovSeeds: SovLineSeed[] | null = scheduleOfValuesPreview ? seedLinesFromStages(scheduleOfValuesPreview, sovSplitPreview) : null
        // Multi-GC (v2.1159): group bundled sections by effective GC (version
        // override ?? bid GC). The preview / Print / Copy operate on ONE
        // packet at a time, so a document mixing GCs can never exist.
        const bidGcPacketCustomer: GcPacketCustomer = {
          id: (bid as { customer_id?: string | null }).customer_id ?? null,
          name: customerName,
          address: customerAddress,
        }
        // Any included version makes a bundle (a split bid's letter follows what's checked,
        // even when that's one version that isn't the active one).
        const gcPackets = pricedBundle.length > 0
          ? groupSectionsByEffectiveGc(pricedBundle, versionGcById, bidGcPacketCustomer)
          : []
        const baseSectionNames = pricedBundle.filter((sec) => !sec.isAlternate).map((sec) => sec.name)
        // Edited wording (v2.2370) follows the section into BOTH layouts: the same-page line and
        // the separate-pages section heading.
        const sectionDisplayName = (sec: BundleSection) => altTexts.sections?.[altSectionKey(sec)]?.label?.trim() || sec.name
        const bundleLabel = (sec: BundleSection) =>
          sectionLabel({ name: sectionDisplayName(sec), isAlternate: sec.isAlternate }, baseSectionNames)
        // Default packet follows the ACTIVE Version (v2.1762) — falling back to
        // gcPackets[0] addressed every letter to the first section's GC (the bid
        // default) no matter which Version chip was selected.
        const selectedGcPacket = gcPackets.length > 0
          ? gcPackets.find((pk) => pk.key === selectedGcPacketKey) ??
            defaultGcPacketForActiveVersion(gcPackets, activeBidVersionId)
          : null
        // Single-letter path: the letter follows the ACTIVE Version — its GC
        // override when set, else the bid GC — so the letterhead always matches
        // the amount and fixtures below it (which come from the active Pricing).
        // include_in_submission only matters for the multi-pricing bundle above.
        const letterCustomer = selectedGcPacket
          ? selectedGcPacket.customer
          : resolveSingleLetterGc(activeBidVersionId, versionGcById, bidGcPacketCustomer)
        const letterGcIsNotBidGc = letterGcDiffersFromBid(letterCustomer, bidGcPacketCustomer)
        const letterCustomerName = letterCustomer.name
        const letterCustomerAddress = letterCustomer.address
        const combinedText = buildCoverLetterText(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: effectiveRevenue } : null, orgCoverLetterDefaults.closing, null, bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(effectiveRevenue), addAltsBlock(false))
        const combinedHtml = buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: effectiveRevenue } : null, orgCoverLetterDefaults.closing, null, bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(effectiveRevenue), addAltsBlock(false))
        const combinedHtmlEditable = offeredAdd.length > 0 ? buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: effectiveRevenue } : null, orgCoverLetterDefaults.closing, null, bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(effectiveRevenue), addAltsBlock(true)) : null
        // When 2+ Pricings are included in submission, the deliverable is one cover letter per
        // Pricing (each with its own amount + fixtures, shared prose), concatenated. With 0–1
        // included Pricings this stays the single letter above (no behavior change).
        const packetSectionHtml = (s: { name: string; revenueSum: number; fixtureRows: { fixture: string; count: number }[] }) =>
          buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(s.revenueSum).toUpperCase(), `$${formatCurrency(s.revenueSum)}`, s.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: s.revenueSum } : null, orgCoverLetterDefaults.closing, null, bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(s.revenueSum))
        const packetSectionText = (s: { name: string; revenueSum: number; fixtureRows: { fixture: string; count: number }[] }) =>
          buildCoverLetterText(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(s.revenueSum).toUpperCase(), `$${formatCurrency(s.revenueSum)}`, s.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: s.revenueSum } : null, orgCoverLetterDefaults.closing, null, bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(s.revenueSum))
        // Same-page alternates (v2.2370): in the New view, a packet with alternates is ONE letter —
        // the bases sum to the proposed amount (fixture lists merged), each alternate is one line
        // under it, and with no base at all the first alternate leads. "Separate pages" keeps the
        // pre-2370 one-full-letter-per-section document.
        const samePagePlan = altsLayout === 'same-page' && selectedGcPacket
          ? planSamePageLetter(selectedGcPacket.sections)
          : null
        // The layout toggle follows the packet the LETTER shows (selectedGcPacket), not the studio's
        // GC tab — they can differ when the active version's GC has nothing priced yet.
        const showAltsLayoutToggle = selectedGcPacket != null && selectedGcPacket.sections.length > 1 && selectedGcPacket.sections.some((s) => s.isAlternate)
        const samePageHtml = (editable: boolean) =>
          samePagePlan
            ? buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(samePagePlan.headlineRevenue).toUpperCase(), `$${formatCurrency(samePagePlan.headlineRevenue)}`, samePagePlan.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: samePagePlan.headlineRevenue } : null, orgCoverLetterDefaults.closing, buildAlternatesBlock(samePagePlan, altTexts, formatCurrency, editable, { gcName: letterCustomerName, projectName: projectNameVal }), bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(samePagePlan.headlineRevenue), addAltsBlock(editable, samePagePlan.headlineRevenue))
            : null
        const finalCoverLetterHtml = selectedGcPacket
          ? samePagePlan
            ? samePageHtml(false)!
            : selectedGcPacket.sections.length > 1
              ? buildCombinedCoverLetterDocument(selectedGcPacket.sections.map((s) => ({ label: bundleLabel(s), html: packetSectionHtml(s) })))
              : packetSectionHtml(selectedGcPacket.sections[0]!)
          : combinedHtml
        // Preview-only twin with data-cl-edit spans (click-to-edit); never copied or printed.
        const previewCoverLetterHtml = samePagePlan ? samePageHtml(true)! : combinedHtmlEditable && !selectedGcPacket ? combinedHtmlEditable : finalCoverLetterHtml
        const finalCoverLetterText = selectedGcPacket
          ? samePagePlan
            ? buildCoverLetterText(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(samePagePlan.headlineRevenue).toUpperCase(), `$${formatCurrency(samePagePlan.headlineRevenue)}`, samePagePlan.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: samePagePlan.headlineRevenue } : null, orgCoverLetterDefaults.closing, buildAlternatesBlock(samePagePlan, altTexts, formatCurrency, false, { gcName: letterCustomerName, projectName: projectNameVal }), bidBasisForLetter, materialsByStageForLetter, scheduleOfValuesForLetter(samePagePlan.headlineRevenue), addAltsBlock(false, samePagePlan.headlineRevenue))
            : selectedGcPacket.sections.length > 1
              ? buildCombinedCoverLetterText(selectedGcPacket.sections.map((s) => ({ label: bundleLabel(s), text: packetSectionText(s) })))
              : packetSectionText(selectedGcPacket.sections[0]!)
          : combinedText
        // All-alternates packet on one page (v2.2370): the ★ alternate leads the letter, so the
        // studio total shows the letter's amount instead of $0.00. Board value / Mark sent rules
        // are untouched — this is what the letter says, and what Mark sent stamps as the bid's value.
        const alternateLeadsLetter = samePagePlan != null && samePagePlan.alternateLeads && !(newLetterTotal > 0)
        const displayHeadlineAmount = alternateLeadsLetter ? samePagePlan!.headlineRevenue : headlineAmount
        const displayHeadlineNumber = `$${formatCurrency(displayHeadlineAmount)}`
        const now = new Date()
        const yy = now.getFullYear() % 100
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const datePart = `${yy}${mm}${dd}`
        const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, ' ').trim() || 'Project'
        const templateCopyTarget = `ClickProposal ${datePart} ${sanitizedProjectName}`
        
        let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
        if (serviceTypeName === 'Electrical') {
          googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
        } else if (serviceTypeName === 'HVAC') {
          googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
        }
        
        const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
        const copyToClipboard = () => {
          void copyRichHtmlToClipboard(finalCoverLetterHtml, finalCoverLetterText)
        }
        return (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '1.5rem 2rem',
              background: 'var(--surface)',
              marginBottom: '1.5rem',
              ...(narrowViewport640 ? { position: 'relative' } : {}),
            }}
          >
            {narrowViewport640 ? (
              <button
                type="button"
                onClick={onClose}
                title="Close"
                aria-label="Close"
                style={bidDetailCloseFloatMobileStyle}
              >
                ×
              </button>
            ) : null}
            {/* v2.3200: the bid flow strip above the bid title (Review is its one door here). */}
            {flowFold.expanded ? (
            <BidFlowStrip
              variant="full"
              hideHeader
              flow={deriveBidFlow(bid, bidFlowFactsByBid[bid.id])}
              bidLabel={bid.project_name ?? undefined}
              canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
              onOpenDoor={(d, step) => {
                if (d === 'review') void bidFlowReview.markReviewed(bid)
                else onOpenBidFlowDoor?.(bid, d, step)
              }}
              reviewStamp={bidFlowReview.stampFor(bid)}
            />
            ) : null}
            <div
              style={{
                display: 'flex',
                flexDirection: narrowViewport640 ? 'column' : 'row',
                justifyContent: narrowViewport640 ? 'flex-start' : 'space-between',
                alignItems: narrowViewport640 ? 'stretch' : 'center',
                gap: narrowViewport640 ? '0.75rem' : 0,
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', minWidth: 0 }}>
                <BidWorkflowTabTitleWithPreview
                  bid={bid}
                  previewEnabled={bidPreview != null}
                  onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)}
                  {...(narrowViewport640 ? { h2Style: { margin: 0 } } : {})}
                />
                <BidFlowStrip
                  variant="inline"
                  expanded={flowFold.expanded}
                  onToggleExpanded={flowFold.toggle}
                  flow={deriveBidFlow(bid, bidFlowFactsByBid[bid.id])}
                  bidLabel={bid.project_name ?? undefined}
                  canOpenDoor={(d) => d === 'review' || (onOpenBidFlowDoor != null && (bidFlowDoorAllowed ? bidFlowDoorAllowed(d) : d != null))}
                  onOpenDoor={(d, step) => {
                  if (d === 'review') void bidFlowReview.markReviewed(bid)
                  else onOpenBidFlowDoor?.(bid, d, step)
                  }}
                  reviewStamp={bidFlowReview.stampFor(bid)}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  ...(narrowViewport640 ? { flexWrap: 'wrap' } : {}),
                }}
              >
                <button
                  type="button"
                  onClick={() => onEditBid(bid)}
                  title="Edit bid"
                  style={{ padding: '0.5rem 1rem', background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', borderRadius: 4, color: 'var(--text-blue-700)', cursor: 'pointer' }}
                >
                  Edit bid
                </button>
                <button
                  type="button"
                  onClick={() => printCoverLetterDocument(finalCoverLetterHtml)}
                  disabled={!totalsResolved}
                  aria-busy={!totalsResolved || undefined}
                  title={totalsResolved ? 'Print combined document' : totalsPendingTitle}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: totalsResolved ? 'pointer' : 'wait', opacity: totalsResolved ? 1 : 0.5 }}
                >
                  Print
                </button>
                {!narrowViewport640 ? (
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    style={bidDetailCloseXStyle}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
              <>
                <style>{`
                  .cover-letter-studio { display: grid; grid-template-columns: minmax(300px, 380px) minmax(0, 1fr); gap: 1.25rem; align-items: start; }
                  .cover-letter-studio-preview { position: sticky; top: 0.5rem; }
                  @media (max-width: 900px) {
                    .cover-letter-studio { grid-template-columns: 1fr; }
                    .cover-letter-studio-preview { position: static; }
                  }
                `}</style>
                <div className="cover-letter-studio">
                  <div style={{ display: 'grid', gap: '0.9rem' }}>
                    <div style={studioStepCardStyle}>
                      <div style={studioStepHeadStyle}>
                        <span style={studioStepNumStyle}>1</span> Scope &amp; pricing
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                        To <strong style={{ color: 'var(--text-strong)' }}>{letterCustomerName}</strong>
                        {letterGcIsNotBidGc ? <> (this version's GC — bid default is {customerName})</> : null}
                        {' · '}
                        {projectNameVal}
                      </div>
                      {(() => {
                        // G1 (v2.2154): one letter per GC. Tabs = the GCs this bid's versions point at
                        // (a version with no override = the bid's GC); the list is that GC's versions
                        // and, under each, the non-★ prices it offers as alternates.
                        const gcKeyOf = (vid: string) => versionGcById[vid]?.id ?? 'bid-default'
                        const gcTabs: Array<{ key: string; name: string }> = []
                        for (const v of [...bidVersions].sort((a, b) => a.sort_order - b.sort_order)) {
                          const key = gcKeyOf(v.id)
                          if (!gcTabs.some((t) => t.key === key)) gcTabs.push({ key, name: versionGcById[v.id]?.name ?? customerName })
                        }
                        const activeKey = activeBidVersionId ? gcKeyOf(activeBidVersionId) : (gcTabs[0]?.key ?? 'bid-default')
                        const selectedKey = selectedGcPacketKey && gcTabs.some((t) => t.key === selectedGcPacketKey) ? selectedGcPacketKey : activeKey
                        const multi = gcTabs.length > 1
                        const rowsVersions = [...bidVersions].sort((a, b) => a.sort_order - b.sort_order).filter((v) => !multi || gcKeyOf(v.id) === selectedKey)
                        const gcName = gcTabs.find((t) => t.key === selectedKey)?.name ?? customerName
                        const gcShort = gcName
                        const packet = gcPackets.find((pk) => pk.key === selectedKey) ?? null
                        const gcSections = multi ? (packet?.sections ?? []) : pricedBundle
                        const gcBase = letterTotal(gcSections)
                        const gcAlts = gcSections.filter((x) => x.isAlternate).length
                        const latestForGc = (key: string) => { const vids = bidVersions.filter((v) => gcKeyOf(v.id) === key).map((v) => v.id); let best: string | null = null; for (const vid of vids) { const sOn = latestSends[vid]?.sentOn; if (sOn && (!best || sOn > best)) best = sOn } return best }
                        return (
                        <div style={{ marginBottom: '0.7rem' }}>
                          {multi ? (
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                              {gcTabs.map((t) => { const sOn = latestForGc(t.key); const on = t.key === selectedKey; return (
                                <button key={t.key} type="button" onClick={() => setSelectedGcPacketKey(t.key)} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.3rem 0.6rem', borderRadius: 6, border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', textAlign: 'left' }}>
                                  {t.name}<span style={{ display: 'block', fontSize: '0.66rem', fontWeight: 400, color: sOn ? 'var(--text-green-600)' : 'var(--text-muted)' }}>{sOn ? `sent ${sOn.slice(5).replace('-', '/').replace(/^0/, '')}` : 'not sent'}</span>
                                </button>
                              ) })}
                            </div>
                          ) : null}
                          {/* v2.3234: the step between the letter's amount and Mark sent — record the number
                              you would send right now; the robot's envelope opens against it. */}
                          {!multi && onBestEffortRecorded ? (
                            <BidBestEffortCard
                              bid={bid}
                              amount={bestEffortAmount}
                              onRecorded={onBestEffortRecorded}
                              onOpenEnvelope={(id) => onOpenRobotEnvelope?.(id)}
                            />
                          ) : null}
                          <span style={studioFieldLabelStyle}>{multi ? `In ${gcShort}'s letter` : 'In this cover letter'}</span>
                          {addAltRows}
                          {bidVersions.length === 0 ? (
                            <>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                One bid{activePricingName ? <> — the letter shows ★ <strong style={{ color: 'var(--text-strong)' }}>{activePricingName}</strong></> : null}
                                {(() => {
                                  // v2.2392: offered non-★ pricings ride this letter as alternates — say so.
                                  const offered = bundlePricings.filter((x) => x.offeredPricingId)
                                  if (offered.length === 0) return <>. To offer an alternate, make it a bid to send (＋ Another bid to send… at the top).</>
                                  return (
                                    <>
                                      , plus <strong style={{ color: 'var(--text-strong)' }}>{offered.map((x) => x.name).join(', ')}</strong> offered as {offered.length === 1 ? 'an alternate' : 'alternates'} — manage offers on the Pricing tab.
                                    </>
                                  )
                                })()}
                              </div>
                              {showAltsLayoutToggle ? (
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>Alternates in the letter</span>
                                  <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                                    <button type="button" onClick={() => switchAltsLayout('same-page')} style={studioSegBtnStyle(altsLayout === 'same-page', true)} title="One letter — alternates listed under the proposed amount">Same page</button>
                                    <button type="button" onClick={() => switchAltsLayout('separate')} style={studioSegBtnStyle(altsLayout === 'separate', true)} title="One full letter per alternate (the pre-v2.2370 document)">Separate pages</button>
                                  </span>
                                </div>
                              ) : null}
                              {/* v2.2389 (Wendi): the caption promises Mark sent, but the button only lived in the
                                  packets branch — a plain bid had no send button at all. Same stamp, no send rows. */}
                              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button id="cover-letter-mark-sent"
                                  type="button"
                                  disabled={markingSent || headlineAmount <= 0}
                                  title={headlineAmount <= 0 ? 'Nothing to send until this bid has a priced letter amount' : undefined}
                                  onClick={() => void markSentTodaySimple(bid.id, headlineAmount, 'hand', bid.bid_date_sent ?? null)}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: markingSent ? 'wait' : headlineAmount <= 0 ? 'not-allowed' : 'pointer', opacity: headlineAmount <= 0 ? 0.5 : 1 }}
                                >
                                  {/* Tier-2 #20: on a bid that already has a sent day this is the explicit re-stamp — it asks first. */}
                                  {markingSent ? 'Marking…' : bid.bid_date_sent ? 'Move sent date to today' : 'Mark sent today'}
                                </button>
                                {roomPresenceByKey[`${bid.id}:own`] === false && !roomOpenByKey[`${bid.id}:own`] ? (
                                  <BidRoomSetupButton gcShort={letterCustomerName} onClick={() => setRoomOpenByKey((m) => ({ ...m, [`${bid.id}:own`]: true }))} />
                                ) : null}
                                <OpenRfiChip bidId={bid.id} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {bid.bid_date_sent
                                    ? <>sent {bid.bid_date_sent.slice(5).replace('-', '/')} · sending the room link keeps this date; only this button moves it</>
                                    : <>stamps the bid with today as its sent date and this letter's amount as its value — or the bid room's first link send does it for you</>}
                                </span>
                              </div>
                              <BidRoomPanel
                                bidId={bid.id}
                                gcCustomerId={null}
                                gcName={letterCustomerName}
                                projectName={projectNameVal}
                                projectAddress={projectAddressVal}
                                serviceTypeName={serviceTypeName}
                                sections={
                                  bundlePricings.length > 0
                                    ? bundlePricings.map((s) => ({ name: s.name, isAlternate: s.isAlternate, revenueSum: s.revenueSum, fixtureRows: s.fixtureRows }))
                                    : [{ name: 'Base bid', isAlternate: false, revenueSum: headlineAmount, fixtureRows }]
                                }
                                inclusions={inclusions}
                                exclusions={roomExclusions}
                                terms={roomTerms}
                                crmCustomerId={bid.customers?.id ?? null}
                                onFirstLinkSent={() => void markSentTodaySimple(bid.id, headlineAmount, 'room', bid.bid_date_sent ?? null)}
                                open={roomOpenByKey[`${bid.id}:own`] ?? false}
                                onOpenChange={(v) => setRoomOpenByKey((m) => ({ ...m, [`${bid.id}:own`]: v }))}
                                onRoomPresence={(has) => setRoomPresenceByKey((m) => (m[`${bid.id}:own`] === has ? m : { ...m, [`${bid.id}:own`]: has }))}
                              />
                            </>
                          ) : (
                            <>
                              {rowsVersions.map((v, i, arr) => {
                                const vx = v as BidVersionLetter
                                const starId = starredPricingIdForVersion(vx, bidPricings)
                                const starName = bidPricings.find((p) => p.id === starId)?.name ?? null
                                const sec = bundlePricings.find((x) => x.bidVersionId === v.id && !x.offeredPricingId)
                                const isAlt = !!vx.is_alternate
                                // v2.2391 (Wendi): an alternate is offered IN LIEU of a base — with only one
                                // version in the letter the toggle changed nothing (the lone alternate led the
                                // letter anyway), so Alternate waits until a second bid joins.
                                const loneInLetter = v.include_in_submission && rowsVersions.filter((x) => x.include_in_submission).length === 1
                                const otherPrices = bidPricings.filter((p) => p.bid_version_id === v.id && p.id !== starId).sort((a, b) => a.sort_order - b.sort_order)
                                return (
                                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.2rem 0', flexWrap: 'wrap' }}>
                                    <input type="checkbox" checked={v.include_in_submission} onChange={() => void toggleVersionInclude(vx)} style={{ cursor: 'pointer', margin: 0 }} aria-label={`${v.name} in the letter`} />
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                      {renameKey === `v:${v.id}` ? (
                                        renameEditBox(() => void commitRenameVersion(vx))
                                      ) : (
                                        <>
                                          <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{v.name}</span>
                                          <button
                                            type="button"
                                            onClick={() => { setRenameKey(`v:${v.id}`); setRenameDraft(v.name) }}
                                            title="Rename this bid — the letter prints this name"
                                            aria-label={`Rename ${v.name}`}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-link)', fontSize: '0.72rem', padding: '0 0.25rem' }}
                                          >
                                            ✎
                                          </button>
                                        </>
                                      )}
                                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {/* Each segment is a nowrap unit so a narrow panel breaks BETWEEN the
                                            " · " separators, never inside "sent 8/27" (owner, 2026-08-28). */}
                                        {starName ? <><span style={{ whiteSpace: 'nowrap' }}>★ {starName}</span>{sec && sec.revenueSum > 0 ? <>{' · '}<span style={{ whiteSpace: 'nowrap' }}>${formatCurrency(sec.revenueSum)}</span></> : null}</> : 'no prices yet'}
                                        {v.include_in_submission && (!sec || sec.revenueSum <= 0) ? (
                                          <span style={{ marginLeft: '0.35rem', fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.03rem 0.4rem', whiteSpace: 'nowrap' }}>unpriced — left off the letter</span>
                                        ) : null}
                                        {(() => { const b = formatSendBadge(latestSends[v.id], { money: (n) => `$${formatCurrency(n)}` }); return b ? <>{' · '}<span style={{ whiteSpace: 'nowrap' }}>{b}</span></> : null })()}
                                      </span>
                                    </span>
                                    <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
                                      <button type="button" disabled={!v.include_in_submission} onClick={() => void setVersionAlternate(vx, false)} style={studioSegBtnStyle(!isAlt, v.include_in_submission)} title="Adds to the letter total">Base</button>
                                      <button type="button" disabled={!v.include_in_submission || (loneInLetter && !isAlt)} onClick={() => void setVersionAlternate(vx, true)} style={studioSegBtnStyle(isAlt, v.include_in_submission && !(loneInLetter && !isAlt))} title={loneInLetter && !isAlt ? 'An alternate is offered in lieu of a base — add another bid to send first' : 'Offered in lieu of the base bids'}>Alternate</button>
                                    </span>
                                    <button type="button" onClick={() => void reorderVersion(vx, -1)} disabled={i === 0} title="Move earlier" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: '0 0.15rem' }}>▲</button>
                                    <button type="button" onClick={() => void reorderVersion(vx, 1)} disabled={i === arr.length - 1} title="Move later" style={{ background: 'none', border: 'none', cursor: i === arr.length - 1 ? 'default' : 'pointer', color: i === arr.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: '0 0.15rem' }}>▼</button>
                                    {v.include_in_submission && otherPrices.length > 0 ? (
                                      <div style={{ flexBasis: '100%', paddingLeft: '1.65rem', display: 'grid', gap: '0.15rem' }}>
                                        {otherPrices.map((op) => {
                                          const osec = bundlePricings.find((x) => x.offeredPricingId === op.id)
                                          return (
                                            <div key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                                              <input type="checkbox" checked={op.include_in_submission} onChange={() => void setScenarioOffered(op, !op.include_in_submission)} style={{ margin: 0, cursor: 'pointer' }} aria-label={`Offer ${op.name} as an alternate`} />
                                              {renameKey === `p:${op.id}` ? (
                                                renameEditBox(() => void commitRenameOption(op, bid.id))
                                              ) : (
                                                <>
                                                  <span style={{ color: 'var(--text-600)' }}>{op.name}</span>
                                                  <button
                                                    type="button"
                                                    onClick={() => { setRenameKey(`p:${op.id}`); setRenameDraft(op.name) }}
                                                    title="Rename this price — an offered price prints this name on the letter"
                                                    aria-label={`Rename ${op.name}`}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-link)', fontSize: '0.7rem', padding: '0 0.25rem' }}
                                                  >
                                                    ✎
                                                  </button>
                                                </>
                                              )}
                                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{op.include_in_submission ? (osec && osec.revenueSum > 0 ? `alternate · $${formatCurrency(osec.revenueSum)}` : 'alternate · unpriced — left off the letter') : 'not offered'}</span>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    ) : null}
                                  </div>
                                )
                              })}
                              {(multi || bundlePricings.length === 0) ? (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                  {multi ? <>Checked packets go in {gcShort}'s letter at their ★ base price; ticked prices under one are offered to {gcShort} as alternates. Change prices on the Pricing tab.</> : null}
                                  {multi ? <> <strong style={{ color: 'var(--text-strong)' }}>{gcShort}: base ${formatCurrency(gcBase)}{gcAlts ? ` + ${gcAlts} alternate${gcAlts === 1 ? '' : 's'}` : ''}</strong></> : null}
                                  {bundlePricings.length === 0 ? <> Nothing checked — showing the active bid's letter.</> : null}
                                </div>
                              ) : null}
                              {showAltsLayoutToggle ? (
                                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>Alternates in the letter</span>
                                  <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                                    <button type="button" onClick={() => switchAltsLayout('same-page')} style={studioSegBtnStyle(altsLayout === 'same-page', true)} title="One letter — alternates listed under the proposed amount">Same page</button>
                                    <button type="button" onClick={() => switchAltsLayout('separate')} style={studioSegBtnStyle(altsLayout === 'separate', true)} title="One full letter per alternate (the pre-v2.2370 document)">Separate pages</button>
                                  </span>
                                </div>
                              ) : null}
                              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button id="cover-letter-mark-sent"
                                  type="button"
                                  disabled={markingSent || gcSections.filter((s) => s.bidVersionId && !s.offeredPricingId && s.revenueSum > 0).length === 0}
                                  title={gcSections.filter((s) => s.bidVersionId && !s.offeredPricingId && s.revenueSum > 0).length === 0 ? 'Nothing to send until this GC has a ★ base price' : undefined}
                                  onClick={() => void markSentToday(bid.id, gcSections.filter((s) => !s.offeredPricingId), headlineAmount > 0 ? headlineAmount : null, { isOwnGc: !multi || selectedKey === 'bid-default', currentDateSent: bid.bid_date_sent ?? null })}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: markingSent ? 'wait' : 'pointer', opacity: bundlePricings.filter((s) => s.bidVersionId).length === 0 ? 0.5 : 1 }}
                                >
                                  {markingSent ? 'Marking…' : multi ? `Mark sent to ${gcShort}` : 'Mark sent today'}
                                </button>
                                {roomPresenceByKey[`${bid.id}:${selectedKey}`] === false && !roomOpenByKey[`${bid.id}:${selectedKey}`] ? (
                                  <BidRoomSetupButton gcShort={gcShort} onClick={() => setRoomOpenByKey((m) => ({ ...m, [`${bid.id}:${selectedKey}`]: true }))} />
                                ) : null}
                                  <OpenRfiChip bidId={bid.id} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {multi
                                    ? `stamps ${gcShort}'s bids with today + base price` +
                                      (selectedKey === 'bid-default' ? ", and sets the bid's sent date and value" : " — the bid's first-sent date rolls up; the board value stays with the bid's own GC")
                                    : "stamps every bid in the letter with today + its ★ value, and sets the bid's sent date and value"}
                                </span>
                              </div>
                              <BidRoomPanel
                                bidId={bid.id}
                                gcCustomerId={selectedKey === 'bid-default' ? null : selectedKey}
                                gcName={gcName}
                                projectName={projectNameVal}
                                projectAddress={projectAddressVal}
                                serviceTypeName={serviceTypeName}
                                sections={gcSections.map((s) => ({ name: s.name, isAlternate: s.isAlternate, revenueSum: s.revenueSum, fixtureRows: s.fixtureRows }))}
                                inclusions={inclusions}
                                exclusions={roomExclusions}
                                terms={roomTerms}
                                crmCustomerId={selectedKey === 'bid-default' ? bid.customers?.id ?? null : selectedKey}
                                onFirstLinkSent={() => void markSentToday(bid.id, gcSections.filter((s) => !s.offeredPricingId), headlineAmount > 0 ? headlineAmount : null, { isOwnGc: !multi || selectedKey === 'bid-default', currentDateSent: bid.bid_date_sent ?? null, lane: 'room' })}
                                open={roomOpenByKey[`${bid.id}:${selectedKey}`] ?? false}
                                onOpenChange={(v) => setRoomOpenByKey((m) => ({ ...m, [`${bid.id}:${selectedKey}`]: v }))}
                                onRoomPresence={(has) => setRoomPresenceByKey((m) => (m[`${bid.id}:${selectedKey}`] === has ? m : { ...m, [`${bid.id}:${selectedKey}`]: has }))}
                              />
                            </>
                          )}
                        </div>
                        )
                      })()}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', background: 'var(--bg-green-tint)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-green-600)', fontVariantNumeric: 'tabular-nums' }}>{displayHeadlineNumber}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {useCustomAmount ? 'custom amount' : alternateLeadsLetter ? `letter amount · ★ alternate leads · ${bundleSummary(bundlePricings)}` : newBundleActive ? `${boardValueRule === 'active_star' ? "active bid's ★" : 'letter total'} · ${bundleSummary(bundlePricings)}` : activePricingName ? `from Pricing · ${activePricingName}` : 'from Pricing'}
                        </span>
                      </div>
                      {/* Frozen bid prices, PR 2: the letter recomputes from the price copy; the quote is what went out. */}
                      {(() => {
                        const cmp = compareSentVsToday({ bidDateSent: bid.bid_date_sent, bidValue: bid.bid_value, today: displayHeadlineAmount })
                        if (!cmp) return null
                        const differs = cmp.kind === 'differs'
                        return (
                          <div
                            data-testid="cover-letter-sent-vs-today"
                            style={{ marginTop: '0.35rem', fontSize: '0.74rem', fontVariantNumeric: 'tabular-nums', color: differs ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: differs ? 600 : 400 }}
                          >
                            {sentVsTodayText(cmp, { where: 'letter', currentYear: new Date().getFullYear() })}
                          </div>
                        )
                      })()}
                      <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
                          <input
                            type="checkbox"
                            checked={coverLetterUseCustomAmountByBid[bid.id] === true}
                            onChange={() => setCoverLetterUseCustomAmountByBid((prev) => ({ ...prev, [bid.id]: !prev[bid.id] }))}
                          />
                          Custom amount
                        </label>
                        {coverLetterUseCustomAmountByBid[bid.id] === true && (
                          <input
                            type="text"
                            value={coverLetterCustomAmountByBid[bid.id] ?? ''}
                            onChange={(e) => setCoverLetterCustomAmountByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                            placeholder="e.g. 1359800"
                            style={{ width: '8rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box' }}
                          />
                        )}
                      </div>
                    </div>

                    <div style={studioStepCardStyle}>
                      <div style={studioStepHeadStyle}>
                        <span style={studioStepNumStyle}>2</span> Letter content
                      </div>
                      <div style={{ marginBottom: '0.7rem' }}>
                        <span style={studioFieldLabelStyle}>Include in the letter</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setCoverLetterIncludeDesignDrawingPlanDateByBid((prev) => ({ ...prev, [bid.id]: prev[bid.id] === false }))}
                            title={bid.design_drawing_plan_date ? `Design Drawings Plan Date [${formatDesignDrawingPlanDateLabel(bid.design_drawing_plan_date)}]` : 'Design Drawings Plan Date: [not set]'}
                            style={studioTogStyle(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false)}
                          >
                            Plan date
                          </button>
                          {pricingCountRows.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCoverLetterIncludeFixturesPerPlanByBid((prev) => ({ ...prev, [bid.id]: prev[bid.id] === false }))}
                              title="Include Fixtures provided and installed by us per plan"
                              style={studioTogStyle(coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false)}
                            >
                              Fixtures per plan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setCoverLetterIncludeSignatureByBid((prev) => ({ ...prev, [bid.id]: !prev[bid.id] }))}
                            title="Include Signature block in Cover Letter and Approval PDF"
                            style={studioTogStyle(coverLetterIncludeSignatureByBid[bid.id] === true)}
                          >
                            Signature block
                          </button>
                          <button
                            type="button"
                            id="cover-letter-schedule-of-values-pill"
                            onClick={() => void toggleScheduleOfValuesEnabled(bid)}
                            title="Include a Schedule of values — the amount spread across Rough In / Top Out / Trim Set by the takeoff's stage shares — in the letter and the Approval PDF"
                            style={studioTogStyle(scheduleOfValuesEnabled)}
                          >
                            Schedule of values
                          </button>
                          <button
                            type="button"
                            onClick={() => void togglePaymentScheduleEnabled(bid)}
                            title="Include the Payment schedule — when each percent of the amount is due — in the letter and the Approval PDF"
                            style={studioTogStyle(paymentScheduleEnabled)}
                          >
                            Payment schedule
                          </button>
                          <button
                            type="button"
                            id="cover-letter-materials-by-stage-pill"
                            onClick={() => void toggleMaterialsByStageEnabled(bid)}
                            title="Include Materials by stage — each stage's takeoff material × the factor — in the letter and the Approval PDF"
                            style={studioTogStyle(materialsByStageEnabled)}
                          >
                            Materials by stage
                          </button>
                          <button
                            type="button"
                            id="cover-letter-bid-basis-pill"
                            onClick={() => void toggleBidToMarkedPlans(bid)}
                            disabled={!bidBasisCurrent}
                            title={bidBasisCurrent ? 'Say in the letter that we bid to our marked-up plans, not the plans as issued' : 'Available once marked-up plans are exported from CountTooling'}
                            style={bidBasisCurrent ? studioTogStyle(bidToMarkedPlansOn) : { ...studioTogStyle(false), border: '1px dashed var(--border-strong)', color: 'var(--text-faint)', cursor: 'not-allowed' }}
                          >
                            Bid to our marked-up plans
                          </button>
                        </div>
                      </div>
                      <BidBasisCard bid={bid} exports={bidBasisExports} />
                      {scheduleOfValuesEnabled && (
                        <div data-testid="cover-letter-schedule-of-values" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.7rem', marginBottom: '0.7rem' }}>
                          <span style={studioFieldLabelStyle}>Schedule of values · ${formatCurrency(effectiveRevenue)} · {sovShape === 'lines' ? 'my lines' : 'by stage'}</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', marginBottom: '0.45rem', fontSize: '0.78rem', alignItems: 'center' }}>
                            <span role="radiogroup" aria-label="Schedule shape" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                              {(['stage', 'lines'] as const).map((shape) => (
                                <button
                                  key={shape}
                                  type="button"
                                  role="radio"
                                  aria-checked={sovShape === shape}
                                  onClick={() => void setSovShapeOnBid(bid, shape, sovSeeds)}
                                  title={shape === 'stage' ? 'The takeoff writes the three lines and keeps them current' : 'Your own lines, seeded from the stages the first time; kept while you are back on By stage'}
                                  style={{ padding: '0.2rem 0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.78rem', background: sovShape === shape ? '#3b82f6' : 'var(--surface)', color: sovShape === shape ? '#fff' : 'var(--text-muted)' }}
                                >
                                  {shape === 'stage' ? 'By stage' : 'My lines'}
                                </button>
                              ))}
                            </span>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }} title="Each stage's value divided into labor and material by the ratio of the bid's costs; either figure can be typed over">
                              <input type="checkbox" checked={sovSplitEnabled} onChange={() => void toggleSovSplit(bid)} /> Split labor and material
                            </label>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }} title="The letter keeps one line pointing at the attached schedule; the lines print on the sheet only">
                              <input type="checkbox" checked={sovTotalOnly} onChange={() => void toggleSovTotalOnly(bid)} /> Letter shows the total only
                            </label>
                          </div>
                          {sovShape === 'lines' ? (
                            <>
                              <CoverLetterSovLinesEditor bidId={bid.id} lines={sovLines} contractAmount={effectiveRevenue} splitOn={sovSplitEnabled} ruleLaborPct={sovRuleLaborPct} seeds={sovSeeds} onChanged={() => reloadSovLines(bid.id)} />
                              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {sovSplitEnabled ? `A line with no labor typed takes the company labor share (${sovRuleLaborPct}%). ` : ''}
                                <button
                                  type="button"
                                  onClick={() => printScheduleOfValuesOfContract(bid, effectiveRevenue, sovSplitInput)}
                                  title="Print the schedule in the pay-application form: #, description, (labor, material,) scheduled value, notes"
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                                >
                                  Print the schedule
                                </button>
                              </div>
                            </>
                          ) : materialsByStageDoc == null ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading the takeoff's stages…</div>
                          ) : scheduleOfValuesPreview == null ? (
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                              {effectiveRevenue > 0 ? 'No fixture on the Takeoffs sheet has a stage yet, so there is nothing to spread. Stage the takeoff (Takeoffs → Stages → Fill from rules & book) and this fills in.' : 'The letter has no amount yet, so there is nothing to spread.'}
                            </div>
                          ) : (
                            <>
                              {sovSplitEnabled && sovSplitPreview ? (
                                <table data-testid="cover-letter-sov-split" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                                  <thead>
                                    <tr style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                                      <th style={{ textAlign: 'left', fontWeight: 600, padding: '0.1rem 0.2rem' }}>Stage</th>
                                      <th style={{ textAlign: 'right', fontWeight: 600, padding: '0.1rem 0.2rem' }}>Labor</th>
                                      <th style={{ textAlign: 'right', fontWeight: 600, padding: '0.1rem 0.2rem' }}>Material</th>
                                      <th style={{ textAlign: 'right', fontWeight: 600, padding: '0.1rem 0.2rem' }}>Value</th>
                                      <th style={{ padding: '0.1rem 0.2rem' }} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sovSplitPreview.map((sp) => (
                                      <Fragment key={sp.stage}>
                                        <tr>
                                          <td style={{ padding: '0.15rem 0.2rem' }}>{sp.label}</td>
                                          <td style={{ padding: '0.15rem 0.2rem', textAlign: 'right' }}>
                                            <input
                                              type="text"
                                              inputMode="decimal"
                                              aria-label={`${sp.label} labor`}
                                              value={sovLaborDrafts[sp.stage] ?? formatCurrency(sp.labor)}
                                              onChange={(e) => setSovLaborDrafts((d) => ({ ...d, [sp.stage]: e.target.value }))}
                                              onBlur={() => commitSovLabor(bid.id, sp.stage, sp.derivedLabor)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault()
                                                  e.currentTarget.blur()
                                                }
                                              }}
                                              style={{ width: '6.2rem', padding: '0.2rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', textAlign: 'right', boxSizing: 'border-box', background: sp.source === 'typed' ? 'var(--bg-amber-100)' : undefined }}
                                            />
                                          </td>
                                          <td style={{ padding: '0.15rem 0.2rem', textAlign: 'right' }}>${formatCurrency(sp.material)}</td>
                                          <td style={{ padding: '0.15rem 0.2rem', textAlign: 'right' }}>${formatCurrency(sp.value)}</td>
                                          <td style={{ padding: '0.15rem 0.2rem', fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {sp.source === 'typed' ? (
                                              <>
                                                typed ·{' '}
                                                <button type="button" onClick={() => void writeSovOverride(bid.id, sp.stage, { labor: null })} title={`Back to the bid's costs: $${formatCurrency(sp.derivedLabor)}`} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.68rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 }}>
                                                  reset
                                                </button>
                                              </>
                                            ) : sp.source === 'rule' ? (
                                              <span title={`No labor hours or material for this stage: the company rule (${sovRuleLaborPct}% labor) from Settings → Bid Cover Letter Defaults`}>company rule</span>
                                            ) : (
                                              <span title="From the Labor tab's hours × the rate (plus subcontractors) against the takeoff's material × the factor">from the bid</span>
                                            )}
                                          </td>
                                        </tr>
                                        <tr>
                                          <td colSpan={5} style={{ padding: '0 0.2rem 0.3rem' }}>
                                            <input
                                              type="text"
                                              aria-label={`${sp.label} note`}
                                              placeholder="Note for the GC (optional)"
                                              value={sovNoteDrafts[sp.stage] ?? sp.note}
                                              onChange={(e) => setSovNoteDrafts((d) => ({ ...d, [sp.stage]: e.target.value }))}
                                              onBlur={() => commitSovNote(bid.id, sp.stage)}
                                              maxLength={500}
                                              style={{ width: '100%', padding: '0.2rem 0.35rem', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.75rem', boxSizing: 'border-box', fontStyle: sovNoteDrafts[sp.stage] ?? sp.note ? undefined : 'italic' }}
                                            />
                                          </td>
                                        </tr>
                                      </Fragment>
                                    ))}
                                    <tr style={{ fontWeight: 600 }}>
                                      <td style={{ padding: '0.3rem 0.2rem 0', borderTop: '1px solid var(--border-strong)' }}>Total</td>
                                      <td style={{ padding: '0.3rem 0.2rem 0', borderTop: '1px solid var(--border-strong)', textAlign: 'right' }}>${formatCurrency(sovSplitPreviewTotals?.labor ?? 0)}</td>
                                      <td style={{ padding: '0.3rem 0.2rem 0', borderTop: '1px solid var(--border-strong)', textAlign: 'right' }}>${formatCurrency(sovSplitPreviewTotals?.material ?? 0)}</td>
                                      <td style={{ padding: '0.3rem 0.2rem 0', borderTop: '1px solid var(--border-strong)', textAlign: 'right' }}>{scheduleOfValuesPreview.totalFormatted}</td>
                                      <td style={{ borderTop: '1px solid var(--border-strong)' }} />
                                    </tr>
                                  </tbody>
                                </table>
                              ) : (
                                <>
                                  {scheduleOfValuesPreview.rows.map((r) => (
                                    <div key={r.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.15rem 0', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>
                                      <span style={{ flex: 1 }}>{r.label}</span>
                                      <span>${formatCurrency(r.amount)}</span>
                                      <span style={{ color: 'var(--text-muted)', minWidth: '3.4rem', textAlign: 'right' }}>{r.shareFormatted}</span>
                                    </div>
                                  ))}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0 0', marginTop: '0.2rem', borderTop: '1px solid var(--border-strong)', fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    <span style={{ flex: 1 }}>Total</span>
                                    <span>{scheduleOfValuesPreview.totalFormatted}</span>
                                    <span style={{ color: 'var(--text-muted)', minWidth: '3.4rem', textAlign: 'right', fontWeight: 400 }}>100%</span>
                                  </div>
                                </>
                              )}
                              {sovSplitEnabled && !sovSplitPreview ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Reading the Labor tab…</div>
                              ) : null}
                              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Shares from the Takeoffs sheet's stages, {materialsByStageDoc.summary.stagedFixtureCount} of {materialsByStageDoc.summary.costedFixtureCount} costed fixtures staged.
                                {sovSplitEnabled && sovCosts ? ` Labor from ${formatCurrency(sovCosts.hoursByStage.rough_in + sovCosts.hoursByStage.top_out + sovCosts.hoursByStage.trim_set)} h × $${formatCurrency(sovCosts.laborRate)}${sovCosts.subByStage.rough_in + sovCosts.subByStage.top_out + sovCosts.subByStage.trim_set > 0 ? ' plus subcontractors' : ''}; material from the takeoff × ${materialsByStageDoc.summary.factor}.` : ''}
                                {sovSplitPreview?.some((sp) => sp.source === 'rule') ? ` A stage with no cost on either side takes the company rule (${sovRuleLaborPct}% labor).` : ''}{' '}
                                <button
                                  type="button"
                                  onClick={() => printScheduleOfValuesOfContract(bid, effectiveRevenue, sovSplitInput)}
                                  title="Print the two-page schedule — the stages with their fixtures, then every fixture and its stage — with an Of contract column at this amount"
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                                >
                                  Print the full schedule
                                </button>
                              </div>
                              {materialsByStageDoc.summary.unassignedRaw > 0.005 && (
                                <div style={{ marginTop: '0.4rem', padding: '0.3rem 0.45rem', background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', borderRadius: 4, color: 'var(--text-amber-700)', fontSize: '0.75rem' }}>
                                  ⚠ {materialsByStageDoc.summary.incompleteFixtureIds.length} {materialsByStageDoc.summary.incompleteFixtureIds.length === 1 ? 'fixture still needs' : 'fixtures still need'} a stage (${formatCurrency(materialsByStageDoc.summary.unassignedRaw)} of material) — the shares above leave that money out. Stage them on Takeoffs.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {paymentScheduleEnabled && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.7rem', marginBottom: '0.7rem' }}>
                          <span style={studioFieldLabelStyle}>Payment schedule</span>
                          {paymentScheduleSorted.map((row, i, arr) => {
                            const knownTiming = (PAYMENT_SCHEDULE_TIMINGS as string[]).includes(row.timing)
                            const rowPercent = paymentSchedulePercentDrafts[row.id] != null
                              ? parseFloat(paymentSchedulePercentDrafts[row.id]?.replace(/,/g, '').trim() ?? '')
                              : Number(row.percent)
                            const rowDollars = Number.isFinite(rowPercent) ? (effectiveRevenue * rowPercent) / 100 : null
                            return (
                              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.15rem 0', flexWrap: 'wrap' }}>
                                <select
                                  value={row.timing}
                                  onChange={(e) => void updatePaymentScheduleTiming(bid.id, row.id, e.target.value)}
                                  aria-label="Payment timing"
                                  style={{ padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', flex: 1, minWidth: '9rem' }}
                                >
                                  {!knownTiming && <option value={row.timing}>{row.timing}</option>}
                                  {PAYMENT_SCHEDULE_TIMINGS.map((t: PaymentScheduleTiming) => (
                                    <option key={t} value={t}>
                                      {PAYMENT_SCHEDULE_TIMING_LABELS[t].charAt(0).toUpperCase() + PAYMENT_SCHEDULE_TIMING_LABELS[t].slice(1)}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={paymentSchedulePercentDrafts[row.id] ?? String(Number(row.percent))}
                                  onChange={(e) => setPaymentSchedulePercentDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                  onBlur={() => void commitPaymentSchedulePercent(bid.id, row)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      e.currentTarget.blur()
                                    }
                                  }}
                                  aria-label="Percent of contract amount"
                                  style={{ width: '3.6rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', textAlign: 'right', boxSizing: 'border-box' }}
                                />
                                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>%</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '5.5rem' }}>
                                  {rowDollars != null ? `= $${formatCurrency(rowDollars)}` : ''}
                                </span>
                                <button type="button" onClick={() => void reorderPaymentScheduleRow(bid.id, row, -1)} disabled={i === 0} title="Move earlier" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: 0 }}>▲</button>
                                <button type="button" onClick={() => void reorderPaymentScheduleRow(bid.id, row, 1)} disabled={i === arr.length - 1} title="Move later" style={{ background: 'none', border: 'none', cursor: i === arr.length - 1 ? 'default' : 'pointer', color: i === arr.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: 0 }}>▼</button>
                                <button type="button" onClick={() => void removePaymentScheduleRow(bid.id, row.id)} title="Remove row" aria-label="Remove row" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-red-600)', fontSize: '0.95rem', padding: 0 }}>×</button>
                              </div>
                            )
                          })}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {materialsByStageShares ? (
                            <button
                              type="button"
                              onClick={() => void applyPaymentScheduleStageShares(bid.id)}
                              title={`Set the before Rough In / Top Out / Trim Set percents from the takeoff's stage shares (${Math.round(materialsByStageShares.rough_in)} · ${Math.round(materialsByStageShares.top_out)} · ${Math.round(materialsByStageShares.trim_set)} %), scaled into what the other rows leave`}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', marginRight: '0.5rem' }}
                            >
                              Use stage shares
                            </button>
                          ) : null}
                          <button
                              type="button"
                              onClick={() => void addPaymentScheduleRow(bid.id)}
                              style={{ padding: '0.2rem 0.6rem', background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', borderRadius: 4, color: 'var(--text-blue-700)', cursor: 'pointer', fontSize: '0.8125rem' }}
                            >
                              + Add row
                            </button>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Total: {formatPaymentSchedulePercent(paymentSchedulePercentSum)}</span>
                          </div>
                          {paymentScheduleSorted.length > 0 && Math.abs(paymentSchedulePercentSum - 100) > 0.001 && (
                            <div style={{ marginTop: '0.4rem', padding: '0.3rem 0.45rem', background: 'var(--bg-amber-100)', border: '1px solid var(--border-amber)', borderRadius: 4, color: 'var(--text-amber-700)', fontSize: '0.75rem' }}>
                              ⚠ Percents sum to {formatPaymentSchedulePercent(paymentSchedulePercentSum)}, not 100%.
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ marginBottom: '0.7rem' }}>
                        <label style={studioFieldLabelStyle}>Additional inclusions (one per line → bullets)</label>
                        <textarea
                          value={inclusionsDisplay}
                          onChange={(e) => setCoverLetterInclusionsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                          rows={3}
                          placeholder={COVER_LETTER_INCLUSIONS_PLACEHOLDER}
                          style={{ width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, boxSizing: 'border-box', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div style={{ marginBottom: '0.7rem' }}>
                        <label style={studioFieldLabelStyle}>Exclusions and scope</label>
                        <textarea
                          value={exclusionsDisplay}
                          onChange={(e) => setCoverLetterExclusionsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                          rows={3}
                          placeholder="e.g. Owner-supplied fixtures"
                          style={{ width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, boxSizing: 'border-box', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={studioFieldLabelStyle}>Terms and warranty</label>
                        <textarea
                          value={termsDisplay}
                          onChange={(e) => setCoverLetterTermsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                          rows={3}
                          placeholder="e.g. 1-year warranty on labor"
                          style={{ width: '100%', padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, boxSizing: 'border-box', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="cover-letter-studio-preview" style={{ display: 'grid', gap: '0.7rem' }}>
                    {bundlePricings.length > 1 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)' }}>
                        {(pricedBundle.length > 0
                            ? <>In the letter: {bundleSummary(pricedBundle)} — {(() => {
                                // v2.2422: offered prices fold into their scope's entry ("(alternate, 2 prices)")
                                // instead of repeating the version name once per price.
                                const optCount = new Map<string, number>()
                                for (const p of pricedBundle) if (p.offeredPricingId && p.bidVersionId) optCount.set(p.bidVersionId, (optCount.get(p.bidVersionId) ?? 0) + 1)
                                const scopeVersionIds = new Set(pricedBundle.filter((p) => !p.offeredPricingId && p.bidVersionId).map((p) => p.bidVersionId))
                                const names = pricedBundle.filter((p) => !p.offeredPricingId).map((p) => {
                                  const n = p.bidVersionId ? (optCount.get(p.bidVersionId) ?? 0) : 0
                                  if (p.isAlternate) return n > 0 ? `${p.name} (alternate, ${n + 1} prices)` : `${p.name} (alternate)`
                                  return n > 0 ? `${p.name} (+${n} alternate price${n === 1 ? '' : 's'})` : p.name
                                })
                                for (const p of pricedBundle) if (p.offeredPricingId && (!p.bidVersionId || !scopeVersionIds.has(p.bidVersionId))) names.push(`${p.name} (alternate)`)
                                return names.join(', ')
                              })()} — {samePagePlan ? 'one page.' : 'one section each.'}{unpricedLeftOff > 0 ? <span style={{ color: 'var(--text-amber-700)' }}> {unpricedLeftOff} unpriced left off.</span> : null}</>
                            : <span style={{ color: 'var(--text-amber-700)' }}>Nothing priced yet — {unpricedLeftOff} bid{unpricedLeftOff === 1 ? '' : 's'} left off the letter until priced; showing the active bid's letter.</span>)}
                      </div>
                    ) : null}
                    {/* v2.2213: bundled sections read as separate sheets in the PREVIEW only —
                        the copied Google-Docs document and the printout are untouched (print
                        already breaks each section onto its own page). */}
                    <style>{`
                      .cl-preview section { border: 1px solid #c9ced6; border-radius: 8px; margin: 0 0 1.2rem; padding: 0 0.9rem 0.7rem; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.07); overflow: hidden; background: #fff; }
                      .cl-preview section:last-child { margin-bottom: 0; }
                      .cl-preview section > h2:first-child { background: #eef2f7; border-bottom: 1px solid #c9ced6; margin: 0 -0.9rem 0.8rem; padding: 0.45rem 0.9rem; font-size: 0.95rem; }
                      .cl-preview [data-cl-edit] { border-bottom: 1.5px dashed #93b4e8; cursor: text; }
                      .cl-preview [data-cl-edit]:hover { background: #eaf1fd; }
                    `}</style>
                    {altTextEditor && (samePagePlan || offeredAdd.length > 0) ? (() => {
                      const isHeading = altTextEditor.editKey === 'heading'
                      const autoSec = isHeading ? null : samePagePlan?.alternates.find((s) => altSectionKey(s) === altTextEditor.editKey)
                      // v2.4195: a with-and-without alternate edits under its group key; its automatic name is numbered among the offered ones.
                      const autoGroup = isHeading ? null : offeredAdd.find((g) => g.key === altTextEditor.editKey)
                      const autoName = autoSec?.name ?? (autoGroup ? `Alternate ${offeredAdd.indexOf(autoGroup) + 1} — ${autoGroup.label}` : undefined)
                      const commit = () => {
                        const next: CoverLetterAltTexts = { ...altTexts, sections: { ...(altTexts.sections ?? {}) } }
                        if (isHeading) {
                          const h = altTextEditor.label.trim()
                          if (!h || h === COVER_LETTER_ALTS_HEADING_DEFAULT) delete next.heading
                          else next.heading = h
                        } else {
                          const label = altTextEditor.label.trim()
                          const note = altTextEditor.note.trim()
                          const entry: { label?: string; note?: string } = {}
                          if (label && label !== autoName) entry.label = label
                          if (note) entry.note = note
                          if (entry.label || entry.note) next.sections![altTextEditor.editKey] = entry
                          else delete next.sections![altTextEditor.editKey]
                        }
                        if (next.sections && Object.keys(next.sections).length === 0) delete next.sections
                        void saveAltTexts(bid.id, next)
                      }
                      const resetToAuto = () => {
                        const next: CoverLetterAltTexts = { ...altTexts, sections: { ...(altTexts.sections ?? {}) } }
                        if (isHeading) delete next.heading
                        else delete next.sections![altTextEditor.editKey]
                        if (next.sections && Object.keys(next.sections).length === 0) delete next.sections
                        void saveAltTexts(bid.id, next)
                      }
                      const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, boxSizing: 'border-box', fontSize: '0.85rem' }
                      return (
                        <div style={{ background: 'var(--surface)', border: '1px solid #3b82f6', borderRadius: 10, padding: '0.8rem 0.9rem', display: 'grid', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{isHeading ? 'Alternates heading' : `Letter wording — ${autoSec?.name ?? autoGroup?.label ?? 'alternate'}`}</span>
                          <input
                            type="text"
                            value={altTextEditor.label}
                            autoFocus
                            onChange={(e) => setAltTextEditor((prev) => (prev ? { ...prev, label: e.target.value } : prev))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') setAltTextEditor(null) }}
                            aria-label={isHeading ? 'Alternates heading' : 'Alternate name on the letter'}
                            placeholder={isHeading ? COVER_LETTER_ALTS_HEADING_DEFAULT : autoName}
                            style={inputStyle}
                          />
                          {!isHeading ? (
                            <input
                              type="text"
                              value={altTextEditor.note}
                              onChange={(e) => setAltTextEditor((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') setAltTextEditor(null) }}
                              aria-label="Optional note under the alternate"
                              placeholder="Optional note under this alternate (e.g. what the alternate covers)"
                              style={inputStyle}
                            />
                          ) : null}
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button type="button" onClick={commit} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>Save</button>
                            <button type="button" onClick={() => setAltTextEditor(null)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 5, cursor: 'pointer' }}>Cancel</button>
                            <button type="button" onClick={resetToAuto} title="Back to the automatic wording" style={{ marginLeft: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.8rem', background: 'none', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reset to auto</button>
                          </div>
                        </div>
                      )
                    })() : null}
                    <div
                      className="cl-preview"
                      data-theme="light"
                      key={`studio-preview-${bid.id}-${coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}-${coverLetterIncludeSignatureByBid[bid.id] === true}-${coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false}-${coverLetterUseCustomAmountByBid[bid.id] === true ? coverLetterCustomAmountByBid[bid.id] ?? '' : ''}-${paymentScheduleEnabled}-${scheduleOfValuesEnabled}-${sovSplitEnabled}-${sovTotalOnly}-${sovShape}-${sovLines.map((l) => `${l.id}:${l.label}:${l.value}:${l.labor ?? ''}:${l.note}`).join('|')}-${[...sovOverrides.entries()].map(([k, v]) => `${k}:${v.labor ?? ''}:${v.note ?? ''}`).join('|')}-${paymentScheduleSorted.map((r) => `${r.timing}:${r.percent}`).join(',')}`}
                      style={{
                        background: 'var(--surface)',
                        color: 'var(--text-strong)',
                        borderRadius: 6,
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.18)',
                        border: '1px solid var(--border)',
                        padding: '2rem 2.2rem',
                        minHeight: 360,
                        fontSize: '0.875rem',
                        whiteSpace: 'pre-wrap',
                        overflowX: 'auto',
                      }}
                      onClick={(e) => {
                        // Same-page alternates (v2.2370): dashed spans are click-to-edit wording.
                        const target = (e.target as HTMLElement).closest?.('[data-cl-edit]')
                        if (!target || !samePagePlan) return
                        const editKey = target.getAttribute('data-cl-edit')
                        if (!editKey) return
                        if (editKey === 'heading') {
                          setAltTextEditor({ editKey, label: altTexts.heading ?? COVER_LETTER_ALTS_HEADING_DEFAULT, note: '' })
                        } else {
                          const sec = samePagePlan.alternates.find((s) => altSectionKey(s) === editKey)
                          const saved = altTexts.sections?.[editKey]
                          setAltTextEditor({ editKey, label: saved?.label ?? sec?.name ?? '', note: saved?.note ?? '' })
                        }
                      }}
                      // eslint-disable-next-line react/no-danger -- app-generated document HTML; user-entered fields are escaped by the tested coverLetter builder
                      dangerouslySetInnerHTML={{ __html: breakAmountOntoOwnLineForPreview(previewCoverLetterHtml) }}
                    />
                    {samePagePlan ? (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Dashed text is the customer wording — click it to edit right here.
                      </div>
                    ) : null}
                    <div id="cover-letter-submission-link" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.9rem' }}>
                      <button id="cover-letter-generate"
                        type="button"
                        disabled={!totalsResolved}
                        aria-busy={!totalsResolved || undefined}
                        title={totalsResolved ? undefined : totalsPendingTitle}
                        onClick={() => {
                          copyToClipboard()
                          openInExternalBrowser(googleDocsCopyUrl)
                          setCoverLetterBidSubmissionQuickAddBidId(bid.id)
                          setCoverLetterBidSubmissionQuickAddValue(bid.bid_submission_link ?? '')
                        }}
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: totalsResolved ? 'pointer' : 'wait', opacity: totalsResolved ? 1 : 0.5 }}
                      >
                        Copy &amp; open in Google Docs
                      </button>
                      <button
                        type="button"
                        onClick={() => printCoverLetterDocument(finalCoverLetterHtml)}
                        disabled={!totalsResolved}
                        aria-busy={!totalsResolved || undefined}
                        title={totalsResolved ? 'Print combined document' : totalsPendingTitle}
                        style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: totalsResolved ? 'pointer' : 'wait', opacity: totalsResolved ? 1 : 0.5 }}
                      >
                        Print
                      </button>
                      {coverLetterBidSubmissionQuickAddBidId === bid.id && (
                        <>
                          <input
                            type="url"
                            value={coverLetterBidSubmissionQuickAddValue}
                            onChange={(e) => setCoverLetterBidSubmissionQuickAddValue(e.target.value)}
                            placeholder="Paste the shared Proposal link to attach it to the bid…"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                void handleSaveBidSubmissionQuickAdd(bid.id, coverLetterBidSubmissionQuickAddValue)
                              }
                            }}
                            style={{ flex: 1, minWidth: 200, padding: '0.45rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, boxSizing: 'border-box', fontSize: '0.8rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => void handleSaveBidSubmissionQuickAdd(bid.id, coverLetterBidSubmissionQuickAddValue)}
                            style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}
                          >
                            Add
                          </button>
                        </>
                      )}
                      {bidSubmissionQuickAddSuccess === bid.id && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-green-600)', fontWeight: 500 }}>✓ Link added</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
          </div>
        )
      })()}
    </div>
  )
}
