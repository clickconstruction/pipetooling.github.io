import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName, formatDateYYMMDD } from '../../lib/bids/bidFormatting'
import { buildRfiHtml, buildRfiText, type RfiFormData } from '../../lib/bidDocuments/rfi'
import { addressLines } from '../../lib/bidDocuments/htmlDoc'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'

type BidRfiTabProps = {
  bids: BidWithBuilder[]
  authUser: User | null
  selectedBid: BidWithBuilder | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
}

export function BidRfiTab({ bids, authUser, selectedBid, onSelectBid, onClose, onEditBid }: BidRfiTabProps) {
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const [rfiSearchQuery, setRfiSearchQuery] = useState('')
  const [rfiFormByBid, setRfiFormByBid] = useState<Record<string, RfiFormData>>({})
  const [rfiCopySuccess, setRfiCopySuccess] = useState(false)

  return (
    <div>
      {!selectedBid && (
        <input
          type="text"
          placeholder="Search bids (project name or GC/Builder)..."
          value={rfiSearchQuery}
          onChange={(e) => setRfiSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
        />
      )}
      {!selectedBid ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Project Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Bid Date</th>
              </tr>
            </thead>
            <tbody>
              {bids
                .filter((b) => {
                  const q = rfiSearchQuery.toLowerCase()
                  if (!q) return true
                  const name = bidDisplayName(b).toLowerCase()
                  const cust = (b.customers?.name ?? '').toLowerCase()
                  const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                  return name.includes(q) || cust.includes(q) || gc.includes(q)
                })
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
                    <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              {bids.filter((b) => {
                const q = rfiSearchQuery.toLowerCase()
                if (!q) return true
                const name = bidDisplayName(b).toLowerCase()
                const cust = (b.customers?.name ?? '').toLowerCase()
                const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                return name.includes(q) || cust.includes(q) || gc.includes(q)
              }).length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    {bids.length === 0 ? 'No bids yet.' : 'No bids match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (() => {
        const bid = selectedBid
        const customerName = bid.customers?.name ?? bid.bids_gc_builders?.name ?? '—'
        const customerAddress = bid.customers?.address ?? bid.bids_gc_builders?.address ?? '—'
        const projectNameVal = bid.project_name ?? '—'
        const projectAddressVal = bid.address ?? '—'
        const defaultResponseDate = (() => {
          const d = new Date()
          d.setDate(d.getDate() + 7)
          return d.toLocaleDateString('en-CA')
        })()
        const getRfiForm = (): RfiFormData => {
          const existing = rfiFormByBid[bid.id]
          if (existing) return existing
          const contactName = (authUser?.user_metadata as { full_name?: string } | undefined)?.full_name ?? authUser?.email ?? ''
          return {
            bidSubmittedDate: '', // Always derived from bid.bid_date_sent when building
            submittedTo: '', // Always derived from bid.submitted_to when building
            companyName: '', // Always "Click Plumbing and Electrical" when building (not editable)
            contactPerson: contactName,
            phoneEmail: '',
            responseRequestDate: defaultResponseDate,
            detailedDescription: '',
            impactStatement: '',
            checklistExactLocation: false,
            checklistWhatIssue: false,
            checklistReferenceDocs: false,
            checklistWhyUnclear: false,
            checklistProposedSolution: false,
            checklistImpactStatement: false,
          }
        }
        const form = getRfiForm()
        const updateRfiForm = (updates: Partial<RfiFormData>) => {
          setRfiFormByBid((prev) => {
            const current = prev[bid.id] ?? form
            return {
              ...prev,
              [bid.id]: { ...current, ...updates },
            }
          })
        }
        const bidSubmittedDateFromBid = bid.bid_date_sent ? (bid.bid_date_sent as string).slice(0, 10) : ''
        const submittedToFromBid = (bid as { submitted_to?: string | null }).submitted_to ?? ''
        const formWithBidDate = { ...form, bidSubmittedDate: bidSubmittedDateFromBid, companyName: 'Click Plumbing and Electrical', submittedTo: submittedToFromBid }
        const combinedHtml = buildRfiHtml(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDate)
        const combinedText = buildRfiText(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDate)
        const copyToClipboard = () => {
          void copyRichHtmlToClipboard(combinedHtml, combinedText).then(() => {
            setRfiCopySuccess(true)
            setTimeout(() => setRfiCopySuccess(false), 2000)
          })
        }
        const serviceTypeName = bid.service_type?.name ?? 'Plumbing'
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const datePart = `${yy}${mm}${dd}`
        const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
        const templateCopyTarget = `ClickRFI_${datePart}_${sanitizedProjectName}`
        let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8' // Default: Plumbing
        if (serviceTypeName === 'Electrical') {
          googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
        } else if (serviceTypeName === 'HVAC') {
          googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
        }
        const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <BidWorkflowTabTitleWithPreview
                bid={bid}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => onEditBid(bid)}
                  title="Edit bid"
                  style={{ padding: '0.5rem 1rem', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 4, color: '#1d4ed8', cursor: 'pointer' }}
                >
                  Edit bid
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
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Project</div>
              <div>{projectNameVal}</div>
              {addressLines(projectAddressVal).map((line, i) => (
                <div key={i} style={{ color: '#6b7280' }}>{line}</div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                  Bid was submitted: {formatDateYYMMDD(bid.bid_date_sent)}
                  {bid.bid_date_sent && (
                    <span style={{ marginLeft: '0.25rem', color: '#6b7280' }}>"{(bid.bid_date_sent as string).slice(0, 10)}"</span>
                  )}
                </span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>The bid was submitted to</label>
                  <span style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>
                    {(bid as { submitted_to?: string | null }).submitted_to || '—'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Edit bid to change</span>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Company Information: Click Plumbing and Electrical</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact</label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) => updateRfiForm({ contactPerson: e.target.value })}
                    placeholder="e.g. yourname@clickplumbing.com"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact Phone/Email</label>
                  <input
                    type="text"
                    value={form.phoneEmail}
                    onChange={(e) => updateRfiForm({ phoneEmail: e.target.value })}
                    placeholder="e.g. 512 360 0599"
                    style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Response request date (1 week by default)</label>
                  <input
                    type="date"
                    value={form.responseRequestDate}
                    onChange={(e) => updateRfiForm({ responseRequestDate: e.target.value })}
                    style={{ flex: 1, maxWidth: 180, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Detailed Description of the Question/Issue</label>
                <textarea
                  value={form.detailedDescription}
                  onChange={(e) => updateRfiForm({ detailedDescription: e.target.value })}
                  placeholder="Be specific and concise. Include: Exact location (e.g. 2nd floor mechanical room, grid line B-4 to C-5); What the issue is; Reference contract documents; Why it's unclear/conflicting/missing; Your proposed solution or options (optional)."
                  rows={6}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.checklistExactLocation ?? false} onChange={(e) => updateRfiForm({ checklistExactLocation: e.target.checked })} style={{ marginTop: 2 }} />
                    <span>Exact location (e.g., &quot;2nd floor mechanical room, grid line B-4 to C-5&quot;)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.checklistWhatIssue ?? false} onChange={(e) => updateRfiForm({ checklistWhatIssue: e.target.checked })} style={{ marginTop: 2 }} />
                    <span>What the issue is (e.g., &quot;The plumbing drawings show a 4&quot; sanitary drain routing through structural beam at elevation 12&apos;-6&quot;, but beam depth conflicts with required slope and clearance.&quot;)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.checklistReferenceDocs ?? false} onChange={(e) => updateRfiForm({ checklistReferenceDocs: e.target.checked })} style={{ marginTop: 2 }} />
                    <span>Reference contract documents (e.g., &quot;See Sheet P-102, detail 5/ plumbing riser diagram; Spec Section 22 05 16 – Expansion Fittings; Structural drawing S-301&quot;)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.checklistWhyUnclear ?? false} onChange={(e) => updateRfiForm({ checklistWhyUnclear: e.target.checked })} style={{ marginTop: 2 }} />
                    <span>Why it&apos;s unclear/conflicting/missing (e.g., &quot;Drawing shows 1/4&quot; per foot slope, but vertical clearance is insufficient per IPC code requirements for cleanouts.&quot;)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.checklistProposedSolution ?? false} onChange={(e) => updateRfiForm({ checklistProposedSolution: e.target.checked })} style={{ marginTop: 2 }} />
                    <span>Your proposed solution or options (optional but helpful—e.g., &quot;Can we reroute via alternative path shown in red markup?&quot;)</span>
                  </label>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Impact Statement</label>
                <textarea
                  value={form.impactStatement}
                  onChange={(e) => updateRfiForm({ impactStatement: e.target.value })}
                  placeholder="Note any potential delay, cost implication, or safety concern if not resolved quickly. Keep factual."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.8125rem', color: '#4b5563' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.checklistImpactStatement ?? false} onChange={(e) => updateRfiForm({ checklistImpactStatement: e.target.checked })} style={{ marginTop: 2 }} />
                    <span>Note any potential delay, cost implication, or safety concern if not resolved quickly (e.g., &quot;This issue is holding rough-in on floors 2–4; potential 5-day delay if not clarified by [date]&quot;). Avoid sounding like you&apos;re demanding a change—keep it factual.</span>
                  </label>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
              <div
                key={`combined-preview-rfi-${bid.id}-${bid.bid_date_sent ?? ''}-${(bid as { submitted_to?: string | null }).submitted_to ?? ''}-${form.contactPerson}-${form.phoneEmail}-${form.responseRequestDate}-${form.detailedDescription}-${form.impactStatement}`}
                style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: combinedHtml }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  {rfiCopySuccess ? 'Copied!' : 'Copy to clipboard'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard()
                    openInExternalBrowser(googleDocsCopyUrl)
                  }}
                  style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}
                >
                  Open in Google Docs
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
