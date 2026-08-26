import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import { bidDisplayName, formatDesignDrawingPlanDate, formatDesignDrawingPlanDateLabel } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidPickerStandardList } from './BidPickerStandardList'
import { MyBidsToggle } from './MyBidsToggle'
import { BidPickerSortToggle } from './BidPickerSortToggle'
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
import type {
  PriceBookVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
  BidPaymentScheduleRow,
  BidVersion,
} from '../../lib/bids/bidPricingEngineTypes'
import { bundleSummary, letterTotal, planLetterSections, sectionLabel, starredPricingIdForVersion } from '../../lib/bids/coverLetterVersionBundle'
import { COVER_LETTER_ALTS_HEADING_DEFAULT, altSectionKey, buildAlternatesBlock, parseCoverLetterAltTexts, planSamePageLetter, type CoverLetterAltTexts } from '../../lib/bids/coverLetterSamePage'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'

const COVER_LETTER_INCLUSIONS_PLACEHOLDER = 'Permits'

/** bid_versions row (the v2.2117 letter columns are in the generated types since the F5 regen). */
type BidVersionLetter = BidVersion
type BundleSection = { name: string; bidVersionId: string | null; revenueSum: number; fixtureRows: { fixture: string; count: number }[]; isAlternate: boolean; offeredPricingId?: string }
const COVER_LETTER_VIEW_KEY = 'bids_cover_letter_view_v1'
// Same-page alternates (v2.2370): alternates as one line each under the proposed amount, vs. the
// pre-2370 one-full-letter-per-alternate document. Per-device, like the Old/New pills.
const COVER_LETTER_ALTS_LAYOUT_KEY = 'bids_cover_letter_alts_layout_v1'

type BidsCoverLetterTabProps = {
  bids: BidWithBuilder[]
  selectedBidForPricing: BidWithBuilder | null
  narrowViewport640: boolean
  bidPreview: ReturnType<typeof useBidPreview>
  serviceTypes: Array<{ id: string; name: string }>
  pricingCountRows: BidCountRow[]
  coverLetterPricingRows: { revenueSum: number; fixtureRows: { fixture: string; count: number }[] } | null
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
  // Cover-letter-only UI state
  const [coverLetterSearchQuery, setCoverLetterSearchQuery] = useState('')
  const [coverLetterBidSubmissionQuickAddBidId, setCoverLetterBidSubmissionQuickAddBidId] = useState<string | null>(null)
  const [coverLetterBidSubmissionQuickAddValue, setCoverLetterBidSubmissionQuickAddValue] = useState('')
  const [applyingBidValue, setApplyingBidValue] = useState(false)
  const [bidValueAppliedSuccess, setBidValueAppliedSuccess] = useState(false)
  const [bidSubmissionQuickAddSuccess, setBidSubmissionQuickAddSuccess] = useState<string | null>(null)
  // Old / New pills (v2.2117), like Pricing's: Old = today's letter (bundles checked price
  // scenarios); New = bundles the bid's VERSIONS, each at its ★ scenario, base + alternates.
  // Per-device; default New. "Send… →" on the version picker always lands on New.
  const [coverLetterView, setCoverLetterView] = useState<'old' | 'new'>(() => {
    try {
      return window.localStorage.getItem(COVER_LETTER_VIEW_KEY) === 'old' ? 'old' : 'new'
    } catch {
      return 'new'
    }
  })
  // Per-version sends (v2.2124): latest row per version → "sent 7/7 · $X"; "Mark sent today" appends.
  const [versionSends, setVersionSends] = useState<VersionSendRow[]>([])
  const [boardValueRule, setBoardValueRule] = useState<BoardValueRule>('base_sum')
  const [markingSent, setMarkingSent] = useState(false)
  const switchCoverLetterView = (next: 'old' | 'new') => {
    setCoverLetterView(next)
    try {
      window.localStorage.setItem(COVER_LETTER_VIEW_KEY, next)
    } catch {
      /* device just won't remember */
    }
  }
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
  useEffect(() => {
    setAltTexts({})
    setAltTextEditor(null)
    const bid = selectedBidForPricing
    if (!bid) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('bids').select('cover_letter_alt_texts').eq('id', bid.id).maybeSingle()
      if (cancelled) return
      setAltTexts(parseCoverLetterAltTexts((data as { cover_letter_alt_texts?: unknown } | null)?.cover_letter_alt_texts))
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on bid id; hydrates from the freshly selected bid
  }, [selectedBidForPricing?.id])
  async function saveAltTexts(bidId: string, next: CoverLetterAltTexts) {
    setAltTexts(next)
    setAltTextEditor(null)
    const { error } = await supabase.from('bids').update({ cover_letter_alt_texts: next }).eq('id', bidId)
    if (error) showToast('Could not save the letter wording: ' + error.message, 'error')
  }

  // Reset quick-add when the selected bid changes
  useEffect(() => {
    if (coverLetterBidSubmissionQuickAddBidId != null && selectedBidForPricing?.id !== coverLetterBidSubmissionQuickAddBidId) {
      setCoverLetterBidSubmissionQuickAddBidId(null)
      setCoverLetterBidSubmissionQuickAddValue('')
    }
  }, [selectedBidForPricing?.id, coverLetterBidSubmissionQuickAddBidId])

  // Schedule of Values (payment schedule) — persisted per bid (bid_payment_schedule_rows +
  // bids.include_payment_schedule). Rows persist even while the toggle is off.
  const [paymentScheduleRows, setPaymentScheduleRows] = useState<BidPaymentScheduleRow[]>([])
  const [paymentScheduleEnabled, setPaymentScheduleEnabled] = useState(false)
  // Per-row editing buffer so percent typing doesn't write on every keystroke (commit on blur/Enter)
  const [paymentSchedulePercentDrafts, setPaymentSchedulePercentDrafts] = useState<Record<string, string>>({})
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

  async function togglePaymentScheduleEnabled(bid: BidWithBuilder) {
    const next = !paymentScheduleEnabled
    setPaymentScheduleEnabled(next)
    const { error } = await supabase.from('bids').update({ include_payment_schedule: next }).eq('id', bid.id)
    if (error) {
      setPaymentScheduleEnabled(!next)
      showToast('Error updating bid: ' + error.message, 'error')
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
    //  • Old: the checked price scenarios, 2+ of them, one letter each (unchanged).
    const plans: Array<{ name: string; bidVersionId: string | null; pricingId: string | null; isAlternate: boolean; offeredPricingId?: string }> =
      coverLetterView === 'new'
        ? (bidVersions.length > 0
            ? planLetterSections(bidVersions as BidVersionLetter[], bidPricings).map((p) => ({ name: p.name, bidVersionId: p.versionId, pricingId: p.pricingId, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }))
            : [])
        : (() => {
            const included = bidPricings.filter((p) => p.include_in_submission).sort((a, b) => a.sort_order - b.sort_order)
            return included.length > 1 ? included.map((p) => ({ name: p.name, bidVersionId: p.bid_version_id ?? null, pricingId: p.id as string | null, isAlternate: false })) : []
          })()
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
        const totals = coverLetterTotalsFromPricingRows(result.rows)
        return { name: p.name, bidVersionId: p.bidVersionId, revenueSum: totals.revenueSum, fixtureRows: totals.fixtureRows, isAlternate: p.isAlternate, offeredPricingId: p.offeredPricingId }
      })
      setBundlePricings(sections)
    })()
    return () => { cancelled = true }
  }, [selectedBidForPricing?.id, bidPricings, bidVersions, pricingCountRows, coverLetterView])

  // Which versions are in the bundled submission, and in what order. Writes the pricing facet's
  // flags (what the bundle reads) and mirrors onto the parent bid_versions row for consistency.
  async function toggleSubmissionInclude(p: PriceBookVersion) {
    const next = !p.include_in_submission
    await supabase.from('price_book_versions').update({ include_in_submission: next }).eq('id', p.id)
    if (p.bid_version_id) await supabase.from('bid_versions').update({ include_in_submission: next }).eq('id', p.bid_version_id)
    await reloadBidPricings()
  }
  async function reorderSubmission(p: PriceBookVersion, dir: -1 | 1) {
    const sorted = [...bidPricings].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex((x) => x.id === p.id)
    const other = sorted[idx + dir]
    if (!other) return
    await supabase.from('price_book_versions').update({ sort_order: other.sort_order }).eq('id', p.id)
    await supabase.from('price_book_versions').update({ sort_order: p.sort_order }).eq('id', other.id)
    if (p.bid_version_id) await supabase.from('bid_versions').update({ sort_order: other.sort_order }).eq('id', p.bid_version_id)
    if (other.bid_version_id) await supabase.from('bid_versions').update({ sort_order: p.sort_order }).eq('id', other.bid_version_id)
    await reloadBidPricings()
  }

  // New view (v2.2117): the letter flag lives on the VERSION. Old reads the scenario flags, so
  // while both views exist the version's ★ scenario mirrors the version's flag (its other
  // scenarios are never bundled) — the picker badge and the New bundle can't disagree.
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

  /** "Mark sent today" (v2.2124): one send row per bid in the letter (today, its ★ value), and the bid-level roll-up. */
  async function markSentToday(bidId: string, sections: BundleSection[], boardValue: number | null) {
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
      const patch: { bid_date_sent: string; bid_value?: number } = { bid_date_sent: today }
      if (boardValue != null && boardValue > 0) patch.bid_value = boardValue
      const { error: bidErr } = await supabase.from('bids').update(patch).eq('id', bidId)
      if (bidErr) showToast('Sends recorded, but the bid did not update: ' + bidErr.message, 'error')
      window.dispatchEvent(new Event('bid-version-sends-changed'))
      await loadBids()
      showToast(`Marked sent today — ${inLetter.length} bid${inLetter.length === 1 ? '' : 's'} in the letter.`, 'success')
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

  async function applyProposedAmountToBidValue(bidId: string, amount: number) {
    setApplyingBidValue(true)
    const { error } = await supabase
      .from('bids')
      .update({ bid_value: amount })
      .eq('id', bidId)
    
    if (error) {
      showToast('Error updating bid value: ' + error.message, 'error')
    } else {
      await loadBids()
      setBidValueAppliedSuccess(true)
      setTimeout(() => setBidValueAppliedSuccess(false), 3000)
    }
    setApplyingBidValue(false)
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
  const studioPillStyle = (on: boolean): React.CSSProperties => ({
    padding: '0.2rem 0.6rem',
    borderRadius: 999,
    border: on ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
    background: on ? '#3b82f6' : 'var(--surface)',
    color: on ? '#fff' : 'var(--text-muted)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (bid #, project name, or GC/Builder)..."
            value={coverLetterSearchQuery}
            onChange={(e) => setCoverLetterSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <BidPickerSortToggle />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
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
        const customerName = customer?.name ?? '—'
        const customerAddress = customer?.address ?? '—'
        const projectNameVal = bid.project_name ?? '—'
        const projectAddressVal = bid.address ?? '—'
        let coverLetterRevenue = 0
        let fixtureRows: { fixture: string; count: number }[] = []
        if (coverLetterPricingRows) {
          coverLetterRevenue = coverLetterPricingRows.revenueSum
          fixtureRows = coverLetterPricingRows.fixtureRows
        }
        const useCustomAmount = coverLetterUseCustomAmountByBid[bid.id] === true
        const customAmountStr = (coverLetterCustomAmountByBid[bid.id] ?? '').replace(/,/g, '').trim()
        const customAmountNum = customAmountStr ? parseFloat(customAmountStr) : NaN
        const effectiveRevenue = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : coverLetterRevenue
        // New view on a split bid: the headline is the LETTER TOTAL (sum of base bids at their ★),
        // not the active scenario's revenue — that's what "Apply to Bid Value" writes.
        const newBundleActive = coverLetterView === 'new' && bidVersions.length > 0 && bundlePricings.length > 0
        // v2.2213 (owner): a $0 section never reaches the letter — unpriced bids are listed in the
        // studio (grayed) and rejoin the letter the moment they're priced.
        const pricedBundle = bundlePricings.filter((sec) => sec.revenueSum > 0)
        const unpricedLeftOff = bundlePricings.length - pricedBundle.length
        const newLetterTotal = letterTotal(pricedBundle)
        const headlineAmount = useCustomAmount && !isNaN(customAmountNum) && customAmountNum >= 0 ? customAmountNum : newBundleActive ? (boardValueForRule(boardValueRule, bundleSectionsForBoard(bundlePricings), coverLetterRevenue) ?? newLetterTotal) : coverLetterRevenue
        const latestSends = latestSendByVersion(versionSends)
        const revenueWords = numberToWords(effectiveRevenue).toUpperCase()
        const revenueNumber = `$${formatCurrency(effectiveRevenue)}`
        const inclusions = coverLetterInclusionsByBid[bid.id] ?? ''
        const inclusionsDisplay = coverLetterInclusionsByBid[bid.id] ?? ''
        const exclusions = coverLetterExclusionsByBid[bid.id] ?? orgCoverLetterDefaults.exclusions ?? ''
        const exclusionsDisplay = coverLetterExclusionsByBid[bid.id] ?? orgCoverLetterDefaults.exclusions ?? DEFAULT_EXCLUSIONS
        const terms = coverLetterTermsByBid[bid.id] ?? orgCoverLetterDefaults.terms ?? ''
        const termsDisplay = coverLetterTermsByBid[bid.id] ?? orgCoverLetterDefaults.terms ?? DEFAULT_TERMS_AND_WARRANTY
        const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && bid.design_drawing_plan_date) ? formatDesignDrawingPlanDate(bid.design_drawing_plan_date) : null
        // The Design Drawings Plan Date and Fixtures-per-plan toggles are independent:
        // each is included strictly per its own checkbox (one, the other, both, or none).
        const effectiveIncludeFixtures = coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false
        const bidServiceType = serviceTypes.find((st) => st.id === bid.service_type_id)
        const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
        const includeSignature = coverLetterIncludeSignatureByBid[bid.id] === true
        const paymentScheduleSorted = [...paymentScheduleRows].sort((a, b) => a.sort_order - b.sort_order)
        const paymentScheduleInputs = paymentScheduleSorted.map((r) => ({ timing: r.timing, percent: Number(r.percent) }))
        const paymentSchedulePercentSum = paymentSchedulePercentTotal(paymentScheduleInputs)
        const paymentScheduleActive = paymentScheduleEnabled && paymentScheduleInputs.length > 0
        // Multi-GC (v2.1159): group bundled sections by effective GC (version
        // override ?? bid GC). The preview / Print / Copy operate on ONE
        // packet at a time, so a document mixing GCs can never exist.
        const bidGcPacketCustomer: GcPacketCustomer = {
          id: (bid as { customer_id?: string | null }).customer_id ?? null,
          name: customerName,
          address: customerAddress,
        }
        // Old: 2+ scenarios make a bundle. New: any included version does (a split bid's letter
        // follows what's checked, even when that's one version that isn't the active one).
        const gcPackets = pricedBundle.length > (coverLetterView === 'new' ? 0 : 1)
          ? groupSectionsByEffectiveGc(pricedBundle, versionGcById, bidGcPacketCustomer)
          : []
        const baseSectionNames = pricedBundle.filter((sec) => !sec.isAlternate).map((sec) => sec.name)
        // Edited wording (v2.2370) follows the section into BOTH layouts: the same-page line and
        // the separate-pages section heading.
        const sectionDisplayName = (sec: BundleSection) => altTexts.sections?.[altSectionKey(sec)]?.label?.trim() || sec.name
        const bundleLabel = (sec: BundleSection) =>
          coverLetterView === 'new' ? sectionLabel({ name: sectionDisplayName(sec), isAlternate: sec.isAlternate }, baseSectionNames) : `Pricing: ${sec.name}`
        // Default packet follows the ACTIVE Version (v2.1762) — falling back to
        // gcPackets[0] addressed every letter to the first section's GC (the bid
        // default) no matter which Version chip was selected.
        const selectedGcPacket = gcPackets.length > 0
          ? gcPackets.find((pk) => pk.key === selectedGcPacketKey) ??
            defaultGcPacketForActiveVersion(gcPackets, activeBidVersionId)
          : null
        const multiGc = gcPackets.length > 1
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
        const combinedText = buildCoverLetterText(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: effectiveRevenue } : null, orgCoverLetterDefaults.closing)
        const combinedHtml = buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: effectiveRevenue } : null, orgCoverLetterDefaults.closing)
        // When 2+ Pricings are included in submission, the deliverable is one cover letter per
        // Pricing (each with its own amount + fixtures, shared prose), concatenated. With 0–1
        // included Pricings this stays the single letter above (no behavior change).
        const packetSectionHtml = (s: { name: string; revenueSum: number; fixtureRows: { fixture: string; count: number }[] }) =>
          buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(s.revenueSum).toUpperCase(), `$${formatCurrency(s.revenueSum)}`, s.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: s.revenueSum } : null, orgCoverLetterDefaults.closing)
        const packetSectionText = (s: { name: string; revenueSum: number; fixtureRows: { fixture: string; count: number }[] }) =>
          buildCoverLetterText(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(s.revenueSum).toUpperCase(), `$${formatCurrency(s.revenueSum)}`, s.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: s.revenueSum } : null, orgCoverLetterDefaults.closing)
        // Same-page alternates (v2.2370): in the New view, a packet with alternates is ONE letter —
        // the bases sum to the proposed amount (fixture lists merged), each alternate is one line
        // under it, and with no base at all the first alternate leads. "Separate pages" keeps the
        // pre-2370 one-full-letter-per-section document.
        const samePagePlan = coverLetterView === 'new' && altsLayout === 'same-page' && selectedGcPacket
          ? planSamePageLetter(selectedGcPacket.sections)
          : null
        // The layout toggle follows the packet the LETTER shows (selectedGcPacket), not the studio's
        // GC tab — they can differ when the active version's GC has nothing priced yet.
        const showAltsLayoutToggle = coverLetterView === 'new' && selectedGcPacket != null && selectedGcPacket.sections.length > 1 && selectedGcPacket.sections.some((s) => s.isAlternate)
        const samePageHtml = (editable: boolean) =>
          samePagePlan
            ? buildCoverLetterHtml(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(samePagePlan.headlineRevenue).toUpperCase(), `$${formatCurrency(samePagePlan.headlineRevenue)}`, samePagePlan.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: samePagePlan.headlineRevenue } : null, orgCoverLetterDefaults.closing, buildAlternatesBlock(samePagePlan, altTexts, formatCurrency, editable))
            : null
        const finalCoverLetterHtml = selectedGcPacket
          ? samePagePlan
            ? samePageHtml(false)!
            : selectedGcPacket.sections.length > 1
              ? buildCombinedCoverLetterDocument(selectedGcPacket.sections.map((s) => ({ label: bundleLabel(s), html: packetSectionHtml(s) })))
              : packetSectionHtml(selectedGcPacket.sections[0]!)
          : combinedHtml
        // Preview-only twin with data-cl-edit spans (click-to-edit); never copied or printed.
        const previewCoverLetterHtml = samePagePlan ? samePageHtml(true)! : finalCoverLetterHtml
        const finalCoverLetterText = selectedGcPacket
          ? samePagePlan
            ? buildCoverLetterText(letterCustomerName, letterCustomerAddress, projectNameVal, projectAddressVal, numberToWords(samePagePlan.headlineRevenue).toUpperCase(), `$${formatCurrency(samePagePlan.headlineRevenue)}`, samePagePlan.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures, paymentScheduleActive ? { rows: paymentScheduleInputs, amountDollars: samePagePlan.headlineRevenue } : null, orgCoverLetterDefaults.closing, buildAlternatesBlock(samePagePlan, altTexts, formatCurrency))
            : selectedGcPacket.sections.length > 1
              ? buildCombinedCoverLetterText(selectedGcPacket.sections.map((s) => ({ label: bundleLabel(s), text: packetSectionText(s) })))
              : packetSectionText(selectedGcPacket.sections[0]!)
          : combinedText
        // All-alternates packet on one page (v2.2370): the ★ alternate leads the letter, so the
        // studio total shows the letter's amount instead of $0.00. Board value / Mark sent rules
        // are untouched — this is what the letter says, and what "Apply to Bid Value" writes.
        const alternateLeadsLetter = samePagePlan != null && samePagePlan.alternateLeads && !(newLetterTotal > 0)
        const displayHeadlineAmount = alternateLeadsLetter ? samePagePlan!.headlineRevenue : headlineAmount
        const displayHeadlineNumber = `$${formatCurrency(displayHeadlineAmount)}`
        const displayBidValueSynced = bid.bid_value != null && bid.bid_value === displayHeadlineAmount
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
                {/* Old / New pills (v2.2117) — same device-remembered pattern as Pricing. */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} title="Old = today's letter (checked price scenarios). New = one letter per GC — each packet at its ★ base, plus any prices you offered as alternates.">
                  <button type="button" onClick={() => switchCoverLetterView('old')} style={studioPillStyle(coverLetterView === 'old')}>Old</button>
                  <button type="button" onClick={() => switchCoverLetterView('new')} style={studioPillStyle(coverLetterView === 'new')}>New</button>
                </span>
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
                  title="Print combined document"
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
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
                      {coverLetterView === 'new' ? (() => {
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
                          <span style={studioFieldLabelStyle}>{multi ? `In ${gcShort}'s letter` : 'In this cover letter'}</span>
                          {bidVersions.length === 0 ? (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              One bid{activePricingName ? <> — the letter shows ★ <strong style={{ color: 'var(--text-strong)' }}>{activePricingName}</strong></> : null}. To offer an alternate, make it a bid to send (＋ Another bid to send… at the top).
                            </div>
                          ) : (
                            <>
                              {rowsVersions.map((v, i, arr) => {
                                const vx = v as BidVersionLetter
                                const starId = starredPricingIdForVersion(vx, bidPricings)
                                const starName = bidPricings.find((p) => p.id === starId)?.name ?? null
                                const sec = bundlePricings.find((x) => x.bidVersionId === v.id && !x.offeredPricingId)
                                const isAlt = !!vx.is_alternate
                                const otherPrices = bidPricings.filter((p) => p.bid_version_id === v.id && p.id !== starId).sort((a, b) => a.sort_order - b.sort_order)
                                return (
                                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.2rem 0', flexWrap: 'wrap' }}>
                                    <input type="checkbox" checked={v.include_in_submission} onChange={() => void toggleVersionInclude(vx)} style={{ cursor: 'pointer', margin: 0 }} aria-label={`${v.name} in the letter`} />
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                      <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{v.name}</span>
                                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {starName ? <>★ {starName}{sec && sec.revenueSum > 0 ? ` · $${formatCurrency(sec.revenueSum)}` : ''}</> : 'no prices yet'}
                                        {v.include_in_submission && (!sec || sec.revenueSum <= 0) ? (
                                          <span style={{ marginLeft: '0.35rem', fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-amber-700)', border: '1px solid var(--border)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.03rem 0.4rem', whiteSpace: 'nowrap' }}>unpriced — left off the letter</span>
                                        ) : null}
                                        {(() => { const b = formatSendBadge(latestSends[v.id], { money: (n) => `$${formatCurrency(n)}` }); return b ? <> · {b}</> : null })()}
                                      </span>
                                    </span>
                                    <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
                                      <button type="button" disabled={!v.include_in_submission} onClick={() => void setVersionAlternate(vx, false)} style={studioSegBtnStyle(!isAlt, v.include_in_submission)} title="Adds to the letter total">Base</button>
                                      <button type="button" disabled={!v.include_in_submission} onClick={() => void setVersionAlternate(vx, true)} style={studioSegBtnStyle(isAlt, v.include_in_submission)} title="Offered in lieu of the base bids">Alternate</button>
                                    </span>
                                    <button type="button" onClick={() => void reorderVersion(vx, -1)} disabled={i === 0} title="Move earlier" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: '0 0.15rem' }}>▲</button>
                                    <button type="button" onClick={() => void reorderVersion(vx, 1)} disabled={i === arr.length - 1} title="Move later" style={{ background: 'none', border: 'none', cursor: i === arr.length - 1 ? 'default' : 'pointer', color: i === arr.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: '0 0.15rem' }}>▼</button>
                                    {v.include_in_submission && otherPrices.length > 0 ? (
                                      <div style={{ flexBasis: '100%', paddingLeft: '1.65rem', display: 'grid', gap: '0.15rem' }}>
                                        {otherPrices.map((op) => {
                                          const osec = bundlePricings.find((x) => x.offeredPricingId === op.id)
                                          return (
                                            <label key={op.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', cursor: 'pointer' }}>
                                              <input type="checkbox" checked={op.include_in_submission} onChange={() => void setScenarioOffered(op, !op.include_in_submission)} style={{ margin: 0 }} aria-label={`Offer ${op.name} as an alternate`} />
                                              <span style={{ color: 'var(--text-600)' }}>{op.name}</span>
                                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{op.include_in_submission ? (osec && osec.revenueSum > 0 ? `alternate · $${formatCurrency(osec.revenueSum)}` : 'alternate · unpriced — left off the letter') : 'not offered'}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    ) : null}
                                  </div>
                                )
                              })}
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                {multi ? <>Checked packets go in {gcShort}'s letter at their ★ base price; ticked prices under one are offered to {gcShort} as alternates. </> : <>Checked packets go in the letter, each at its ★ base price; ticked prices under one are offered as alternates. Base packets add up; alternates are offered instead. </>}Change prices on the Pricing tab.
                                {multi ? <> <strong style={{ color: 'var(--text-strong)' }}>{gcShort}: base ${formatCurrency(gcBase)}{gcAlts ? ` + ${gcAlts} alternate${gcAlts === 1 ? '' : 's'}` : ''}</strong></> : null}
                                {bundlePricings.length === 0 ? <> Nothing checked — showing the active bid's letter.</> : null}
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
                              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  disabled={markingSent || gcSections.filter((s) => s.bidVersionId && !s.offeredPricingId && s.revenueSum > 0).length === 0}
                                  title={gcSections.filter((s) => s.bidVersionId && !s.offeredPricingId && s.revenueSum > 0).length === 0 ? 'Nothing to send until this GC has a ★ base price' : undefined}
                                  onClick={() => void markSentToday(bid.id, gcSections.filter((s) => !s.offeredPricingId), headlineAmount > 0 ? headlineAmount : null)}
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: markingSent ? 'wait' : 'pointer', opacity: bundlePricings.filter((s) => s.bidVersionId).length === 0 ? 0.5 : 1 }}
                                >
                                  {markingSent ? 'Marking…' : multi ? `Mark sent to ${gcShort}` : 'Mark sent today'}
                                </button>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{multi ? `stamps ${gcShort}'s bids with today + base price` : 'stamps every bid in the letter with today + its ★ value'}, and sets the bid's sent date and value</span>
                              </div>
                            </>
                          )}
                        </div>
                        )
                      })() : bidPricings.length > 1 ? (
                        <div style={{ marginBottom: '0.7rem' }}>
                          <span style={studioFieldLabelStyle}>Versions in this submission</span>
                          {[...bidPricings].sort((a, b) => a.sort_order - b.sort_order).map((p, i, arr) => (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.15rem 0', cursor: 'pointer' }}>
                              <input type="checkbox" checked={p.include_in_submission} onChange={() => void toggleSubmissionInclude(p)} style={{ cursor: 'pointer', margin: 0 }} />
                              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{p.name}</span>
                              <button type="button" onClick={() => void reorderSubmission(p, -1)} disabled={i === 0} title="Move earlier" style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: '0 0.15rem' }}>▲</button>
                              <button type="button" onClick={() => void reorderSubmission(p, 1)} disabled={i === arr.length - 1} title="Move later" style={{ background: 'none', border: 'none', cursor: i === arr.length - 1 ? 'default' : 'pointer', color: i === arr.length - 1 ? 'var(--text-faint-300)' : 'var(--text-muted)', padding: '0 0.15rem' }}>▼</button>
                            </label>
                          ))}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Checked versions bundle into the submission — one letter each, in this order.</div>
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', background: 'var(--bg-green-tint)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-green-600)', fontVariantNumeric: 'tabular-nums' }}>{displayHeadlineNumber}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {useCustomAmount ? 'custom amount' : alternateLeadsLetter ? `letter amount · ★ alternate leads · ${bundleSummary(bundlePricings)}` : newBundleActive ? `${boardValueRule === 'active_star' ? "active bid's ★" : 'letter total'} · ${bundleSummary(bundlePricings)}` : activePricingName ? `from Pricing · ${activePricingName}` : 'from Pricing'}
                        </span>
                        {displayBidValueSynced ? (
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-green-600)', fontWeight: 600 }}>✓ matches Bid Value</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => applyProposedAmountToBidValue(bid.id, displayHeadlineAmount)}
                            disabled={applyingBidValue || displayHeadlineAmount === 0}
                            title="Apply this amount to Bid Value"
                            style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.25rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: applyingBidValue || displayHeadlineAmount === 0 ? 'not-allowed' : 'pointer' }}
                          >
                            {applyingBidValue ? 'Applying…' : 'Apply to Bid Value'}
                          </button>
                        )}
                      </div>
                      {bidValueAppliedSuccess ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-green-600)', fontWeight: 500, marginTop: '0.3rem' }}>✓ Applied successfully</div>
                      ) : null}
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
                        {bid.bid_value != null && bid.bid_value !== displayHeadlineAmount && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Bid Value: ${formatCurrency(bid.bid_value)}</span>
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
                            onClick={() => void togglePaymentScheduleEnabled(bid)}
                            title="Include Schedule of Values (payment schedule) in document"
                            style={studioTogStyle(paymentScheduleEnabled)}
                          >
                            Payment schedule
                          </button>
                        </div>
                      </div>
                      {paymentScheduleEnabled && (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.7rem', marginBottom: '0.7rem' }}>
                          <span style={studioFieldLabelStyle}>Schedule of Values</span>
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
                    {multiGc && coverLetterView === 'old' ? (
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {gcPackets.map((pk) => {
                          const active = pk.key === selectedGcPacket?.key
                          return (
                            <button
                              key={pk.key}
                              type="button"
                              onClick={() => setSelectedGcPacketKey(pk.key)}
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                padding: '0.35rem 0.75rem',
                                borderRadius: 999,
                                border: active ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
                                background: active ? '#3b82f6' : 'var(--surface)',
                                color: active ? '#fff' : 'var(--text-700)',
                                cursor: 'pointer',
                              }}
                              title={`${pk.sections.map((s) => s.name).join(' · ')} — ${pk.sections.length} letter${pk.sections.length !== 1 ? 's' : ''}`}
                            >
                              {pk.customer.name}
                            </button>
                          )
                        })}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>Each GC gets their own letter with only their pricing.</span>
                      </div>
                    ) : bundlePricings.length > 1 ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)' }}>
                        {coverLetterView === 'new'
                          ? (pricedBundle.length > 0
                            ? <>In the letter: {bundleSummary(pricedBundle)} — {pricedBundle.map((p) => (p.isAlternate ? `${p.name} (alternate)` : p.name)).join(', ')} — {samePagePlan ? 'one page.' : 'one section each.'}{unpricedLeftOff > 0 ? <span style={{ color: 'var(--text-amber-700)' }}> {unpricedLeftOff} unpriced left off.</span> : null}</>
                            : <span style={{ color: 'var(--text-amber-700)' }}>Nothing priced yet — {unpricedLeftOff} bid{unpricedLeftOff === 1 ? '' : 's'} left off the letter until priced; showing the active bid's letter.</span>)
                          : <>Bundling {bundlePricings.length} pricings: {bundlePricings.map((p) => p.name).join(', ')} — one letter each.</>}
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
                    {altTextEditor && samePagePlan ? (() => {
                      const isHeading = altTextEditor.editKey === 'heading'
                      const autoSec = isHeading ? null : samePagePlan.alternates.find((s) => altSectionKey(s) === altTextEditor.editKey)
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
                          if (label && label !== autoSec?.name) entry.label = label
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
                          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{isHeading ? 'Alternates heading' : `Letter wording — ${autoSec?.name ?? 'alternate'}`}</span>
                          <input
                            type="text"
                            value={altTextEditor.label}
                            autoFocus
                            onChange={(e) => setAltTextEditor((prev) => (prev ? { ...prev, label: e.target.value } : prev))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } else if (e.key === 'Escape') setAltTextEditor(null) }}
                            aria-label={isHeading ? 'Alternates heading' : 'Alternate name on the letter'}
                            placeholder={isHeading ? COVER_LETTER_ALTS_HEADING_DEFAULT : autoSec?.name}
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
                      key={`studio-preview-${bid.id}-${coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}-${coverLetterIncludeSignatureByBid[bid.id] === true}-${coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false}-${coverLetterUseCustomAmountByBid[bid.id] === true ? coverLetterCustomAmountByBid[bid.id] ?? '' : ''}-${paymentScheduleEnabled}-${paymentScheduleSorted.map((r) => `${r.timing}:${r.percent}`).join(',')}`}
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
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.9rem' }}>
                      <button
                        type="button"
                        onClick={() => {
                          copyToClipboard()
                          openInExternalBrowser(googleDocsCopyUrl)
                          setCoverLetterBidSubmissionQuickAddBidId(bid.id)
                          setCoverLetterBidSubmissionQuickAddValue(bid.bid_submission_link ?? '')
                        }}
                        style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                      >
                        Copy &amp; open in Google Docs
                      </button>
                      <button
                        type="button"
                        onClick={() => printCoverLetterDocument(finalCoverLetterHtml)}
                        title="Print combined document"
                        style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}
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
