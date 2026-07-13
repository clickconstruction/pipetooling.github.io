import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName, formatDateYYMMDD } from '../../lib/bids/bidFormatting'
import { buildChangeOrderHtml, buildChangeOrderText, type ChangeOrderFormData } from '../../lib/bidDocuments/changeOrder'
import { addressLines } from '../../lib/bidDocuments/htmlDoc'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'

type BidChangeOrderTabProps = {
  bids: BidWithBuilder[]
  authUser: User | null
  selectedBid: BidWithBuilder | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
}

export function BidChangeOrderTab({ bids, authUser, selectedBid, onSelectBid, onClose, onEditBid }: BidChangeOrderTabProps) {
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const [changeOrderSearchQuery, setChangeOrderSearchQuery] = useState('')
  const [changeOrderFormByBid, setChangeOrderFormByBid] = useState<Record<string, ChangeOrderFormData>>({})
  const [changeOrderCopySuccess, setChangeOrderCopySuccess] = useState(false)

  return (
    <div>
      {!selectedBid && (
        <input
          type="text"
          placeholder="Search bids (project name or GC/Builder)..."
          value={changeOrderSearchQuery}
          onChange={(e) => setChangeOrderSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
        />
      )}
      {!selectedBid ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Project Name</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Bid Date</th>
              </tr>
            </thead>
            <tbody>
              {bids
                .filter((b) => {
                  const q = changeOrderSearchQuery.toLowerCase()
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
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    <td style={{ padding: '0.75rem' }}>{bidDisplayName(bid) || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{formatDateYYMMDD(bid.bid_due_date)}</td>
                  </tr>
                ))}
              {bids.filter((b) => {
                const q = changeOrderSearchQuery.toLowerCase()
                if (!q) return true
                const name = bidDisplayName(b).toLowerCase()
                const cust = (b.customers?.name ?? '').toLowerCase()
                const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
                return name.includes(q) || cust.includes(q) || gc.includes(q)
              }).length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
        const getChangeOrderForm = (): ChangeOrderFormData => {
          const existing = changeOrderFormByBid[bid.id]
          if (existing) return existing
          const contactName = (authUser?.user_metadata as { full_name?: string } | undefined)?.full_name ?? authUser?.email ?? ''
          return {
            bidSubmittedDate: '',
            submittedTo: '',
            companyName: '',
            contactPerson: contactName,
            phoneEmail: '',
            responseRequestDate: defaultResponseDate,
            detailedDescriptionOfChange: '',
            reasonForChange: '',
            impactOnCost: '',
            impactOnSchedule: '',
            checklistDetailedDesc: false,
            checklistExactWork: false,
            checklistReferences: false,
            checklistSupportingDetails: false,
            checklistReasonForChange: false,
            checklistCostBreakdown: false,
            checklistNetChange: false,
            checklistUpdatedTotal: false,
            checklistScheduleDuration: false,
            checklistRevisedDate: false,
            checklistScheduleJustification: false,
          }
        }
        const form = getChangeOrderForm()
        const updateChangeOrderForm = (updates: Partial<ChangeOrderFormData>) => {
          setChangeOrderFormByBid((prev) => {
            const current = prev[bid.id] ?? form
            return { ...prev, [bid.id]: { ...current, ...updates } }
          })
        }
        const bidSubmittedDateFromBid = bid.bid_date_sent ? (bid.bid_date_sent as string).slice(0, 10) : ''
        const submittedToFromBid = (bid as { submitted_to?: string | null }).submitted_to ?? ''
        const formWithBidData = { ...form, bidSubmittedDate: bidSubmittedDateFromBid, companyName: 'Click Plumbing and Electrical', submittedTo: submittedToFromBid }
        const combinedHtml = buildChangeOrderHtml(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidData)
        const combinedText = buildChangeOrderText(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidData)
        const copyToClipboard = () => {
          void copyRichHtmlToClipboard(combinedHtml, combinedText).then(() => {
            setChangeOrderCopySuccess(true)
            setTimeout(() => setChangeOrderCopySuccess(false), 2000)
          })
        }
        const serviceTypeName = bid.service_type?.name ?? 'Plumbing'
        const now = new Date()
        const yy = String(now.getFullYear()).slice(-2)
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const dd = String(now.getDate()).padStart(2, '0')
        const datePart = `${yy}${mm}${dd}`
        const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
        const templateCopyTarget = `ClickChangeOrder_${datePart}_${sanitizedProjectName}`
        let googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
        if (serviceTypeName === 'Electrical') googleDocsTemplateId = '1WO7egdTaavsl3YABBc7cR9va-IwmF9PTdIubxDw7ips'
        else if (serviceTypeName === 'HVAC') googleDocsTemplateId = '1Xs76a1fAZfj4GGyIQ-wH_x98rtjnfoB7RVt7cMBmPP8'
        const googleDocsCopyUrl = `https://docs.google.com/document/d/${googleDocsTemplateId}/copy?title=` + encodeURIComponent(templateCopyTarget)
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <BidWorkflowTabTitleWithPreview
                bid={bid}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => onEditBid(bid)} title="Edit bid" style={{ padding: '0.5rem 1rem', background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', borderRadius: 4, color: 'var(--text-blue-700)', cursor: 'pointer' }}>Edit bid</button>
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
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Customer</div>
              <div>{customerName}</div>
              {addressLines(customerAddress).map((line, i) => <div key={i} style={{ color: 'var(--text-muted)' }}>{line}</div>)}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Project</div>
              <div>{projectNameVal}</div>
              {addressLines(projectAddressVal).map((line, i) => <div key={i} style={{ color: 'var(--text-muted)' }}>{line}</div>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>Bid was submitted: {formatDateYYMMDD(bid.bid_date_sent)}{bid.bid_date_sent && <span style={{ marginLeft: '0.25rem', color: 'var(--text-muted)' }}>{'"' + ((bid.bid_date_sent as string).slice(0, 10)) + '"'}</span>}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>The bid was submitted to</label>
                <span style={{ flex: 1, padding: '0.5rem 0', fontSize: '0.875rem', color: 'var(--text-700)' }}>{(bid as { submitted_to?: string | null }).submitted_to || '—'}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Edit bid to change</span>
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Company Information: Click Plumbing and Electrical</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact</label>
                  <input type="text" value={form.contactPerson} onChange={(e) => updateChangeOrderForm({ contactPerson: e.target.value })} placeholder="e.g. yourname@clickplumbing.com" style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Project Lead Contact Phone/Email</label>
                  <input type="text" value={form.phoneEmail} onChange={(e) => updateChangeOrderForm({ phoneEmail: e.target.value })} placeholder="e.g. 512 360 0599" style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}>Response request date (1 week by default)</label>
                <input type="date" value={form.responseRequestDate} onChange={(e) => updateChangeOrderForm({ responseRequestDate: e.target.value })} style={{ flex: 1, maxWidth: 180, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Detailed Description of the Change</label>
                <textarea value={form.detailedDescriptionOfChange} onChange={(e) => updateChangeOrderForm({ detailedDescriptionOfChange: e.target.value })} rows={6} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistDetailedDesc ?? false} onChange={(e) => updateChangeOrderForm({ checklistDetailedDesc: e.target.checked })} style={{ marginTop: 2 }} /><span>A clear, specific explanation of what is being added, deleted, or modified</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistExactWork ?? false} onChange={(e) => updateChangeOrderForm({ checklistExactWork: e.target.checked })} style={{ marginTop: 2 }} /><span>The exact work involved (e.g., &quot;Replace standard drywall with fire-rated drywall in corridor walls&quot;)</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistReferences ?? false} onChange={(e) => updateChangeOrderForm({ checklistReferences: e.target.checked })} style={{ marginTop: 2 }} /><span>References to relevant drawings, specifications, or sections of the original contract</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistSupportingDetails ?? false} onChange={(e) => updateChangeOrderForm({ checklistSupportingDetails: e.target.checked })} style={{ marginTop: 2 }} /><span>Any supporting details like photos, sketches, or revised plans</span></label>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Reason for the Change</label>
                <textarea value={form.reasonForChange} onChange={(e) => updateChangeOrderForm({ reasonForChange: e.target.value })} rows={3} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistReasonForChange ?? false} onChange={(e) => updateChangeOrderForm({ checklistReasonForChange: e.target.checked })} style={{ marginTop: 2 }} /><span>Why the change is needed (e.g., unforeseen site conditions, owner-requested upgrade, design error correction, code compliance update, material substitution, or weather delay impact)</span></label>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Impact on Cost (Contract Sum Adjustment)</label>
                <textarea value={form.impactOnCost} onChange={(e) => updateChangeOrderForm({ impactOnCost: e.target.value })} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistCostBreakdown ?? false} onChange={(e) => updateChangeOrderForm({ checklistCostBreakdown: e.target.checked })} style={{ marginTop: 2 }} /><span>Breakdown of costs (labor, materials, equipment, subcontractors, overhead, profit, taxes, insurance, bonds, etc.)</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistNetChange ?? false} onChange={(e) => updateChangeOrderForm({ checklistNetChange: e.target.checked })} style={{ marginTop: 2 }} /><span>Net change amount (increase, decrease, or no change)</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistUpdatedTotal ?? false} onChange={(e) => updateChangeOrderForm({ checklistUpdatedTotal: e.target.checked })} style={{ marginTop: 2 }} /><span>Updated total contract price after the change</span></label>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Impact on Schedule (Contract Time Adjustment)</label>
                <textarea value={form.impactOnSchedule} onChange={(e) => updateChangeOrderForm({ impactOnSchedule: e.target.value })} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistScheduleDuration ?? false} onChange={(e) => updateChangeOrderForm({ checklistScheduleDuration: e.target.checked })} style={{ marginTop: 2 }} /><span>Number of additional (or reduced) days</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistRevisedDate ?? false} onChange={(e) => updateChangeOrderForm({ checklistRevisedDate: e.target.checked })} style={{ marginTop: 2 }} /><span>Revised substantial completion date or milestones</span></label>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}><input type="checkbox" checked={form.checklistScheduleJustification ?? false} onChange={(e) => updateChangeOrderForm({ checklistScheduleJustification: e.target.checked })} style={{ marginTop: 2 }} /><span>Justification for the time impact (often supported by schedule analysis)</span></label>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
              {/* eslint-disable-next-line react/no-danger -- app-generated document HTML; user-entered fields are escaped by the tested changeOrder builder */}
              <div key={`combined-preview-co-${bid.id}-${bid.bid_date_sent ?? ''}-${(bid as { submitted_to?: string | null }).submitted_to ?? ''}-${form.contactPerson}-${form.phoneEmail}-${form.responseRequestDate}-${form.detailedDescriptionOfChange}-${form.reasonForChange}-${form.impactOnCost}-${form.impactOnSchedule}`} style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: combinedHtml }} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{changeOrderCopySuccess ? 'Copied!' : 'Copy to clipboard'}</button>
                <button type="button" onClick={() => { copyToClipboard(); openInExternalBrowser(googleDocsCopyUrl) }} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}>Open in Google Docs</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
