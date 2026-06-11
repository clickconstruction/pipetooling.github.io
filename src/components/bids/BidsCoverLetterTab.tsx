import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { bidDisplayName, formatDateYYMMDD, formatDesignDrawingPlanDate, formatDesignDrawingPlanDateLabel } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidProjectCell } from './BidProjectCell'
import { MyBidsToggle } from './MyBidsToggle'
import { bidNumberMatchesQuery, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { addressLines, printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import {
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
import type {
  PriceBookVersion,
  PriceBookEntryWithFixture,
  BidPricingAssignment,
  BidCountRowCustomPrice,
  BidCountRowSubmissionHide,
} from '../../lib/bids/bidPricingEngineTypes'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import type { useBidPreview } from '../../contexts/BidPreviewModalContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'

const COVER_LETTER_INCLUSIONS_PLACEHOLDER = 'Permits'

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
  /** The selected bid's Pricings — used to build the bundled (one-letter-per-Pricing) submission document. */
  bidPricings: PriceBookVersion[]
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
  bidPricings,
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
  // Cover-letter-only UI state
  const [coverLetterSearchQuery, setCoverLetterSearchQuery] = useState('')
  const [coverLetterTermsCollapsed, setCoverLetterTermsCollapsed] = useState(true)
  const [coverLetterBidSubmissionQuickAddBidId, setCoverLetterBidSubmissionQuickAddBidId] = useState<string | null>(null)
  const [coverLetterBidSubmissionQuickAddValue, setCoverLetterBidSubmissionQuickAddValue] = useState('')
  const [applyingBidValue, setApplyingBidValue] = useState(false)
  const [bidValueAppliedSuccess, setBidValueAppliedSuccess] = useState(false)
  const [bidSubmissionQuickAddSuccess, setBidSubmissionQuickAddSuccess] = useState<string | null>(null)

  // Reset quick-add when the selected bid changes
  useEffect(() => {
    if (coverLetterBidSubmissionQuickAddBidId != null && selectedBidForPricing?.id !== coverLetterBidSubmissionQuickAddBidId) {
      setCoverLetterBidSubmissionQuickAddBidId(null)
      setCoverLetterBidSubmissionQuickAddValue('')
    }
  }, [selectedBidForPricing?.id, coverLetterBidSubmissionQuickAddBidId])

  // Per-Pricing revenue + fixtures for the bundled submission document. Only the active Pricing's
  // data is loaded by the engine, so for the bundle we fetch each INCLUDED Pricing's entries +
  // overlays here and compute revenue (cost inputs are irrelevant to the cover letter, so they're
  // passed as zeros). Precomputed into state so Print / Copy stay synchronous (clipboard gesture).
  const [bundlePricings, setBundlePricings] = useState<{ name: string; revenueSum: number; fixtureRows: { fixture: string; count: number }[] }[]>([])
  useEffect(() => {
    const bid = selectedBidForPricing
    const included = bidPricings
      .filter((p) => p.include_in_submission)
      .sort((a, b) => a.sort_order - b.sort_order)
    if (!bid || included.length <= 1 || pricingCountRows.length === 0) {
      setBundlePricings([])
      return
    }
    let cancelled = false
    const versionIds = included.map((p) => p.id)
    void (async () => {
      const [entriesRes, assignRes, customRes, hidesRes] = await Promise.all([
        supabase.from('price_book_entries').select('*, fixture_types(name)').in('version_id', versionIds),
        supabase.from('bid_pricing_assignments').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
        supabase.from('bid_count_row_custom_prices').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
        supabase.from('bid_count_row_submission_hides').select('*').eq('bid_id', bid.id).in('price_book_version_id', versionIds),
      ])
      if (cancelled) return
      const allEntries = (entriesRes.data as PriceBookEntryWithFixture[]) ?? []
      const allAssign = (assignRes.data as BidPricingAssignment[]) ?? []
      const allCustom = (customRes.data as BidCountRowCustomPrice[]) ?? []
      const allHides = (hidesRes.data as BidCountRowSubmissionHide[]) ?? []
      const sections = included.map((p) => {
        const entries = allEntries.filter((e) => e.version_id === p.id)
        const customMap = new Map<string, number>()
        for (const c of allCustom) if (c.price_book_version_id === p.id) customMap.set(c.count_row_id, Number(c.unit_price))
        const result = computeBidPricingRows({
          countRows: pricingCountRows,
          assignments: allAssign
            .filter((a) => a.price_book_version_id === p.id)
            .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override })),
          entries,
          customUnitPriceByCountRowId: customMap,
          laborRows: [],
          totalMaterials: 0,
          laborRate: 0,
          taxPercent: 0,
          materialsFromTakeoffByCountRowId: {},
          hiddenSubmissionCountRowIds: submissionHiddenIdsForVersion(allHides, p.id),
        })
        const totals = coverLetterTotalsFromPricingRows(result.rows)
        return { name: p.name, revenueSum: totals.revenueSum, fixtureRows: totals.fixtureRows }
      })
      setBundlePricings(sections)
    })()
    return () => { cancelled = true }
  }, [selectedBidForPricing?.id, bidPricings, pricingCountRows])

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
      alert('Error updating bid value: ' + error.message)
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (bid #, project name, or GC/Builder)..."
            value={coverLetterSearchQuery}
            onChange={(e) => setCoverLetterSearchQuery(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
      )}
      {!selectedBidForPricing ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
              </tr>
            </thead>
            <tbody>
              {coverLetterVisibleBids
                .map((bid) => (
                  <tr
                    key={bid.id}
                    onClick={() => onSelectBid(bid)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                  >
                    <td style={{ padding: '0.75rem' }}><BidProjectCell bid={bid} ledgerPrefixMap={ledgerPrefixMap} /></td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              {coverLetterVisibleBids.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    {bids.length === 0
                      ? 'No bids yet.'
                      : onlyMyBids
                        ? 'No bids you are the account manager or estimator for.'
                        : 'No bids match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        const isBidValueSynced = bid.bid_value != null && bid.bid_value === effectiveRevenue
        const revenueWords = numberToWords(effectiveRevenue).toUpperCase()
        const revenueNumber = `$${formatCurrency(effectiveRevenue)}`
        const inclusions = coverLetterInclusionsByBid[bid.id] ?? ''
        const inclusionsDisplay = coverLetterInclusionsByBid[bid.id] ?? ''
        const exclusions = coverLetterExclusionsByBid[bid.id] ?? ''
        const exclusionsDisplay = coverLetterExclusionsByBid[bid.id] ?? DEFAULT_EXCLUSIONS
        const terms = coverLetterTermsByBid[bid.id] ?? ''
        const termsDisplay = coverLetterTermsByBid[bid.id] ?? DEFAULT_TERMS_AND_WARRANTY
        const designDrawingPlanDateFormatted = (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && bid.design_drawing_plan_date) ? formatDesignDrawingPlanDate(bid.design_drawing_plan_date) : null
        // The Design Drawings Plan Date and Fixtures-per-plan toggles are independent:
        // each is included strictly per its own checkbox (one, the other, both, or none).
        const effectiveIncludeFixtures = coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false
        const bidServiceType = serviceTypes.find((st) => st.id === bid.service_type_id)
        const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
        const includeSignature = coverLetterIncludeSignatureByBid[bid.id] === true
        const combinedText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures)
        const combinedHtml = buildCoverLetterHtml(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures)
        // When 2+ Pricings are included in submission, the deliverable is one cover letter per
        // Pricing (each with its own amount + fixtures, shared prose), concatenated. With 0–1
        // included Pricings this stays the single letter above (no behavior change).
        const finalCoverLetterHtml = bundlePricings.length > 1
          ? buildCombinedCoverLetterDocument(bundlePricings.map((s) => ({
              label: `Pricing: ${s.name}`,
              html: buildCoverLetterHtml(customerName, customerAddress, projectNameVal, projectAddressVal, numberToWords(s.revenueSum).toUpperCase(), `$${formatCurrency(s.revenueSum)}`, s.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures),
            })))
          : combinedHtml
        const finalCoverLetterText = bundlePricings.length > 1
          ? buildCombinedCoverLetterText(bundlePricings.map((s) => ({
              label: `Pricing: ${s.name}`,
              text: buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, numberToWords(s.revenueSum).toUpperCase(), `$${formatCurrency(s.revenueSum)}`, s.fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, includeSignature, effectiveIncludeFixtures),
            })))
          : combinedText
        const now = new Date()
        const yy = now.getFullYear() % 100
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const datePart = `${yy}${mm}${dd}`
        const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
        const templateCopyTarget = `ClickProposal_${datePart}_${sanitizedProjectName}`
        
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
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '1.5rem 2rem',
              background: 'white',
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
              <BidWorkflowTabTitleWithPreview
                bid={bid}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)}
                {...(narrowViewport640 ? { h2Style: { margin: 0 } } : {})}
              />
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
                  style={{ padding: '0.5rem 1rem', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 4, color: '#1d4ed8', cursor: 'pointer' }}
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
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Customer</div>
              <div>{customerName}</div>
              {addressLines(customerAddress).map((line, i) => (
                <div key={i} style={{ color: '#6b7280' }}>{line}</div>
              ))}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Project</div>
              <div>{projectNameVal}</div>
              {addressLines(projectAddressVal).map((line, i) => (
                <div key={i} style={{ color: '#6b7280' }}>{line}</div>
              ))}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Proposed amount (from Pricing)</span>
                  {activePricingName && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#1e40af',
                        background: '#dbeafe',
                        border: '1px solid #bfdbfe',
                        borderRadius: 9999,
                        padding: '0.1rem 0.5rem',
                        whiteSpace: 'nowrap',
                      }}
                      title="The Pricing this cover letter reflects"
                    >
                      Pricing: {activePricingName}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  {!isBidValueSynced && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => applyProposedAmountToBidValue(bid.id, coverLetterRevenue)}
                        disabled={applyingBidValue || coverLetterRevenue === 0}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: applyingBidValue || coverLetterRevenue === 0 ? '#d1d5db' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: applyingBidValue || coverLetterRevenue === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                        title="Apply proposed amount to Bid Value"
                      >
                        {applyingBidValue ? 'Applying...' : 'Apply Proposed amount to Bid Value'}
                      </button>
                      {bidValueAppliedSuccess && (
                        <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                          ✓ Applied successfully
                        </span>
                      )}
                    </div>
                  )}
                  {coverLetterUseCustomAmountByBid[bid.id] === true && !isBidValueSynced && (() => {
                    const customStr = (coverLetterCustomAmountByBid[bid.id] ?? '').replace(/,/g, '').trim()
                    const customNum = customStr ? parseFloat(customStr) : NaN
                    const isValid = !isNaN(customNum) && customNum >= 0
                    return (
                      <button
                        type="button"
                        onClick={() => isValid && applyProposedAmountToBidValue(bid.id, customNum)}
                        disabled={applyingBidValue || !isValid}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: applyingBidValue || !isValid ? '#d1d5db' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: applyingBidValue || !isValid ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem'
                        }}
                        title="Apply custom amount to Bid Value"
                      >
                        {applyingBidValue ? 'Applying...' : 'Apply custom amount to Bid Value'}
                      </button>
                    )
                  })()}
                </div>
              </div>
              <div>{revenueWords} ({revenueNumber})</div>
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={coverLetterUseCustomAmountByBid[bid.id] === true}
                    onChange={() => setCoverLetterUseCustomAmountByBid((prev) => ({ ...prev, [bid.id]: !prev[bid.id] }))}
                  />
                  Use custom amount in document
                </label>
                {coverLetterUseCustomAmountByBid[bid.id] === true && (
                  <input
                    type="text"
                    value={coverLetterCustomAmountByBid[bid.id] ?? ''}
                    onChange={(e) => setCoverLetterCustomAmountByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                    placeholder="e.g. 1359800"
                    style={{ width: '8rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                )}
              </div>
              {bid.bid_value != null && bid.bid_value !== coverLetterRevenue && (
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  Current Bid Value: ${formatCurrency(bid.bid_value)}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 500 }}>Include in combined document</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}
                  onChange={() => setCoverLetterIncludeDesignDrawingPlanDateByBid((prev) => ({ ...prev, [bid.id]: prev[bid.id] === false }))}
                />
                {bid.design_drawing_plan_date
                  ? `Design Drawings Plan Date [${formatDesignDrawingPlanDateLabel(bid.design_drawing_plan_date)}]`
                  : 'Design Drawings Plan Date: [not set]'}
              </label>
            </div>
            {pricingCountRows.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false}
                    onChange={() => setCoverLetterIncludeFixturesPerPlanByBid((prev) => ({
                      ...prev,
                      [bid.id]: prev[bid.id] === false
                    }))}
                  />
                  Include Fixtures provided and installed by us per plan
                </label>
              </div>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Additional Inclusions (one per line, shown as bullets)</label>
              <textarea
                value={inclusionsDisplay}
                onChange={(e) => setCoverLetterInclusionsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                rows={4}
                placeholder={COVER_LETTER_INCLUSIONS_PLACEHOLDER}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Exclusions and Scope (one per line, shown as bullets)</label>
              <textarea
                value={exclusionsDisplay}
                onChange={(e) => setCoverLetterExclusionsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                rows={4}
                placeholder="e.g. Owner-supplied fixtures"
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setCoverLetterTermsCollapsed((c) => !c)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '1rem' }}
              >
                {coverLetterTermsCollapsed ? '\u25B6' : '\u25BC'} Terms and Warranty
              </button>
              {!coverLetterTermsCollapsed && (
                <textarea
                  value={termsDisplay}
                  onChange={(e) => setCoverLetterTermsByBid((prev) => ({ ...prev, [bid.id]: e.target.value }))}
                  rows={4}
                  placeholder="e.g. 1-year warranty on labor"
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', marginTop: '0.5rem' }}
                />
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={coverLetterIncludeSignatureByBid[bid.id] === true}
                  onChange={() =>
                    setCoverLetterIncludeSignatureByBid((prev) => ({
                      ...prev,
                      [bid.id]: !prev[bid.id],
                    }))
                  }
                />
                Include Signature block in Cover Letter and Approval PDF
              </label>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Combined document (copy to send)
                {bundlePricings.length > 1 && (
                  <span style={{ marginLeft: '0.5rem', fontWeight: 400, fontSize: '0.8125rem', color: '#1e40af' }}>
                    · bundling {bundlePricings.length} pricings: {bundlePricings.map((p) => p.name).join(', ')}
                  </span>
                )}
              </label>
              <div
                key={`combined-preview-${bid.id}-${coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}-${coverLetterIncludeSignatureByBid[bid.id] === true}-${coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false}-${coverLetterUseCustomAmountByBid[bid.id] === true ? coverLetterCustomAmountByBid[bid.id] ?? '' : ''}`}
                style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
                // eslint-disable-next-line react/no-danger -- app-generated document HTML; user-entered fields are escaped by the tested coverLetter builder
                dangerouslySetInnerHTML={{ __html: finalCoverLetterHtml }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard()
                    openInExternalBrowser(googleDocsCopyUrl)
                    setCoverLetterBidSubmissionQuickAddBidId(bid.id)
                    setCoverLetterBidSubmissionQuickAddValue(bid.bid_submission_link ?? '')
                  }}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Copy to clipboard and open in Google Docs
                </button>
                {coverLetterBidSubmissionQuickAddBidId === bid.id && (
                  <>
                    <input
                      type="url"
                      value={coverLetterBidSubmissionQuickAddValue}
                      onChange={(e) => setCoverLetterBidSubmissionQuickAddValue(e.target.value)}
                      placeholder="Set the sharing permissions and paste the Proposal link here to quick add: https://docs.google.com/…"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleSaveBidSubmissionQuickAdd(bid.id, coverLetterBidSubmissionQuickAddValue)
                        }
                      }}
                      style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveBidSubmissionQuickAdd(bid.id, coverLetterBidSubmissionQuickAddValue)}
                      style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                    >
                      Add
                    </button>
                  </>
                )}
                {bidSubmissionQuickAddSuccess === bid.id && (
                  <span style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>
                    ✓ Link added successfully
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
