import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { bidDisplayName, formatDateYYMMDD, formatDesignDrawingPlanDate, formatDesignDrawingPlanDateLabel } from '../../lib/bids/bidFormatting'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidBoardBidNumberMark } from './BidBoardBidNumberMark'
import { MyBidsToggle } from './MyBidsToggle'
import { resolveBidLedgerPrefix, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { addressLines, printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import {
  buildCoverLetterHtml,
  buildCoverLetterText,
  numberToWords,
  DEFAULT_TERMS_AND_WARRANTY,
  DEFAULT_EXCLUSIONS,
} from '../../lib/bidDocuments/coverLetter'
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
    return name.includes(q) || cust.includes(q) || gc.includes(q)
  })

  return (
    <div>
      {!selectedBidForPricing && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
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
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid #</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
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
                    <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                      {bid.bid_number?.trim() ? (
                        <BidBoardBidNumberMark bidPrefix={resolveBidLedgerPrefix(bid.service_type_id, ledgerPrefixMap)} bidNumber={bid.bid_number.trim()} />
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              {coverLetterVisibleBids.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
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
        const effectiveIncludeFixtures = !designDrawingPlanDateFormatted || (coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false)
        const bidServiceType = serviceTypes.find((st) => st.id === bid.service_type_id)
        const serviceTypeName = bidServiceType?.name ?? 'Plumbing'
        const combinedText = buildCoverLetterText(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, coverLetterIncludeSignatureByBid[bid.id] === true, effectiveIncludeFixtures)
        const combinedHtml = buildCoverLetterHtml(customerName, customerAddress, projectNameVal, projectAddressVal, revenueWords, revenueNumber, fixtureRows, inclusions, exclusions, terms, designDrawingPlanDateFormatted, serviceTypeName, coverLetterIncludeSignatureByBid[bid.id] === true, effectiveIncludeFixtures)
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
          void copyRichHtmlToClipboard(combinedHtml, combinedText)
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
                  onClick={() => printCoverLetterDocument(combinedHtml)}
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
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Proposed amount (from Pricing)</div>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) ? 'pointer' : 'default', opacity: (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) ? 1 : 0.7 }}>
                  <input
                    type="checkbox"
                    checked={(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) ? (coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false) : true}
                    disabled={!(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date)}
                    onChange={() => (coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) && setCoverLetterIncludeFixturesPerPlanByBid((prev) => ({
                      ...prev,
                      [bid.id]: prev[bid.id] === false
                    }))}
                  />
                  Include Fixtures provided and installed by us per plan
                  {!(coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false && !!bid.design_drawing_plan_date) && (
                    <span style={{ fontSize: '0.8em', color: '#6b7280' }}>
                      {!bid.design_drawing_plan_date
                        ? '(Set Design Drawing Plan Date in Edit bid to toggle)'
                        : '(Check Design Drawings Plan Date above to toggle)'}
                    </span>
                  )}
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
              <div
                key={`combined-preview-${bid.id}-${coverLetterIncludeDesignDrawingPlanDateByBid[bid.id] !== false}-${coverLetterIncludeSignatureByBid[bid.id] === true}-${coverLetterIncludeFixturesPerPlanByBid[bid.id] !== false}-${coverLetterUseCustomAmountByBid[bid.id] === true ? coverLetterCustomAmountByBid[bid.id] ?? '' : ''}`}
                style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
                // eslint-disable-next-line react/no-danger -- app-generated document HTML; user-entered fields are escaped by the tested coverLetter builder
                dangerouslySetInnerHTML={{ __html: combinedHtml }}
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
