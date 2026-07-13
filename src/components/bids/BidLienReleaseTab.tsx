import { useState } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName, formatDateYYMMDD, formatAmountFromString } from '../../lib/bids/bidFormatting'
import {
  buildLienReleaseHtml,
  buildLienReleaseText,
  type LienReleaseFormData,
  LIEN_RELEASE_DEFAULT_COMPANY_ADDRESS,
  LIEN_RELEASE_DEFAULT_LIEN_PHONE,
  LIEN_RELEASE_DEFAULT_COMPANY_PHONE,
  LIEN_RELEASE_DEFAULT_COMPANY_EMAIL,
  LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER,
  LIEN_RELEASE_DEFAULT_PAYMENT_TERMS,
} from '../../lib/bidDocuments/lienRelease'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'

type BidLienReleaseTabProps = {
  bids: BidWithBuilder[]
  selectedBid: BidWithBuilder | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
}

export function BidLienReleaseTab({ bids, selectedBid, onSelectBid, onClose, onEditBid }: BidLienReleaseTabProps) {
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const [lienReleaseSearchQuery, setLienReleaseSearchQuery] = useState('')
  const [lienReleaseFormByBid, setLienReleaseFormByBid] = useState<Record<string, LienReleaseFormData>>({})
  const [lienReleaseCopySuccess, setLienReleaseCopySuccess] = useState(false)
  const [lienReleaseCompanyInfoCollapsed, setLienReleaseCompanyInfoCollapsed] = useState(true)
  const [lienReleaseConditionalWaiverCollapsed, setLienReleaseConditionalWaiverCollapsed] = useState(true)
  const [lienReleasePaymentTermsCollapsed, setLienReleasePaymentTermsCollapsed] = useState(true)
  const [lienReleaseLienStatusCollapsed, setLienReleaseLienStatusCollapsed] = useState(true)

  return (
    <div>
      {!selectedBid && (
        <input
          type="text"
          placeholder="Search bids (project name or GC/Builder)..."
          value={lienReleaseSearchQuery}
          onChange={(e) => setLienReleaseSearchQuery(e.target.value)}
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
                  const q = lienReleaseSearchQuery.toLowerCase()
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
                const q = lienReleaseSearchQuery.toLowerCase()
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
        const defaultBidAmount = bid.agreed_value != null ? String(bid.agreed_value) : bid.bid_value != null ? String(bid.bid_value) : ''
        const todayStr = new Date().toLocaleDateString('en-CA')
        const getLienReleaseForm = (): LienReleaseFormData => {
          const existing = lienReleaseFormByBid[bid.id]
          if (existing) {
            const legacy = existing as { finalInvoice?: string; amountOfApplication?: string }
            const invoiceAmount = existing.invoiceAmount ?? legacy.amountOfApplication ?? legacy.finalInvoice ?? ''
            return { ...existing, invoiceAmount }
          }
          return {
            invoiceAmount: '',
            bidAmount: defaultBidAmount,
            invoicesToDate: '',
            cc: '',
            companyName: 'Click Plumbing and Electrical',
            companyAddress: LIEN_RELEASE_DEFAULT_COMPANY_ADDRESS,
            companyPhone: LIEN_RELEASE_DEFAULT_COMPANY_PHONE,
            companyEmail: LIEN_RELEASE_DEFAULT_COMPANY_EMAIL,
            invoiceDate: todayStr,
            invoiceNumber: '',
            descriptionOfWork: '',
            conditionalWaiver: LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER,
            paymentTerms: LIEN_RELEASE_DEFAULT_PAYMENT_TERMS,
            lienStatusPhone: LIEN_RELEASE_DEFAULT_LIEN_PHONE,
          }
        }
        const form = getLienReleaseForm()
        const updateLienReleaseForm = (updates: Partial<LienReleaseFormData>) => {
          setLienReleaseFormByBid((prev) => {
            const current = prev[bid.id] ?? form
            return { ...prev, [bid.id]: { ...current, ...updates } }
          })
        }
        const formWithBidDefaults = { ...form, bidAmount: form.bidAmount || defaultBidAmount }
        const combinedHtml = buildLienReleaseHtml(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDefaults, customerName)
        const combinedText = buildLienReleaseText(customerName, customerAddress, projectNameVal, projectAddressVal, formWithBidDefaults, customerName)
        const copyToClipboard = () => {
          void copyRichHtmlToClipboard(combinedHtml, combinedText).then(() => {
            setLienReleaseCopySuccess(true)
            setTimeout(() => setLienReleaseCopySuccess(false), 2000)
          })
        }
        const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Project'
        const templateCopyTarget = `ClickLienRelease_${datePart}_${sanitizedProjectName}`
        const serviceTypeName = bid.service_type?.name ?? 'Plumbing'
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
                <button type="button" onClick={() => onEditBid(bid)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Edit bid</button>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoice Amount</label>
                <input type="text" value={form.invoiceAmount} onChange={(e) => updateLienReleaseForm({ invoiceAmount: e.target.value })} placeholder="e.g. 10,000.00" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Bid amount</label>
                <input type="text" value={form.bidAmount} onChange={(e) => updateLienReleaseForm({ bidAmount: e.target.value })} placeholder="e.g. 100,000.00" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoices to date</label>
                <input type="text" value={form.invoicesToDate} onChange={(e) => updateLienReleaseForm({ invoicesToDate: e.target.value })} placeholder="e.g. 90,000.00" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoice Date</label>
                <input type="date" value={form.invoiceDate} onChange={(e) => updateLienReleaseForm({ invoiceDate: e.target.value })} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Invoice Number</label>
                <input type="text" value={form.invoiceNumber} onChange={(e) => updateLienReleaseForm({ invoiceNumber: e.target.value })} placeholder="e.g. 250 (Billed Dec 22nd 2025)" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4 }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Project:</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{projectNameVal}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{projectAddressVal || '—'}</div>
            </div>
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 4 }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.25rem' }}>Owner / Contracting Party:</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>{customerName}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{customerAddress || '—'}</div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>CC</label>
              <input type="text" value={form.cc} onChange={(e) => updateLienReleaseForm({ cc: e.target.value })} placeholder="Person, phone, email (optional)" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => setLienReleaseCompanyInfoCollapsed((c) => !c)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}
              >
                {lienReleaseCompanyInfoCollapsed ? '\u25B6' : '\u25BC'} Company Information: Click Plumbing and Electrical
              </button>
              {!lienReleaseCompanyInfoCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem' }}>Company Address</label>
                    <textarea value={form.companyAddress} onChange={(e) => updateLienReleaseForm({ companyAddress: e.target.value })} rows={2} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem' }}>Phone</label>
                      <input type="text" value={form.companyPhone} onChange={(e) => updateLienReleaseForm({ companyPhone: e.target.value })} placeholder={LIEN_RELEASE_DEFAULT_COMPANY_PHONE} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '0.8125rem' }}>Email</label>
                      <input type="text" value={form.companyEmail} onChange={(e) => updateLienReleaseForm({ companyEmail: e.target.value })} placeholder={LIEN_RELEASE_DEFAULT_COMPANY_EMAIL} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                <label style={{ fontWeight: 500, fontSize: '0.875rem' }}>Description of Work / Period Covered (Optional)</label>
                <button
                  type="button"
                  onClick={() => {
                    const bidAmtFmt = formatAmountFromString(form.bidAmount || defaultBidAmount) || '—'
                    updateLienReleaseForm({
                      descriptionOfWork: `Plumbing services performed through approximately __% completion of the original base contract amount of $${bidAmtFmt}.`
                    })
                  }}
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Pre-fill
                </button>
              </div>
              <textarea value={form.descriptionOfWork} onChange={(e) => updateLienReleaseForm({ descriptionOfWork: e.target.value })} rows={4} placeholder="e.g. Plumbing services performed through approximately 95% completion of the original base contract amount of $121,000.00." style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={() => setLienReleaseConditionalWaiverCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                {lienReleaseConditionalWaiverCollapsed ? '\u25B6' : '\u25BC'} Conditional Waiver and Release
              </button>
              {!lienReleaseConditionalWaiverCollapsed && (
                <div style={{ marginTop: '0.5rem' }}>
                  <textarea value={form.conditionalWaiver} onChange={(e) => updateLienReleaseForm({ conditionalWaiver: e.target.value })} rows={5} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Use {`{{finalInvoice}}`} and {`{{invoicesToDate}}`} as placeholders for amounts.</div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={() => setLienReleasePaymentTermsCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                {lienReleasePaymentTermsCollapsed ? '\u25B6' : '\u25BC'} Payment Terms & Late Payment Consequences
              </button>
              {!lienReleasePaymentTermsCollapsed && (
                <div style={{ marginTop: '0.5rem' }}>
                  <textarea value={form.paymentTerms} onChange={(e) => updateLienReleaseForm({ paymentTerms: e.target.value })} rows={4} style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', resize: 'vertical' }} />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Use {`{{finalInvoice}}`} and {`{{ownerName}}`} as placeholders.</div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <button type="button" onClick={() => setLienReleaseLienStatusCollapsed((c) => !c)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.875rem' }}>
                {lienReleaseLienStatusCollapsed ? '\u25B6' : '\u25BC'} Lien Status Verification phone
              </button>
              {!lienReleaseLienStatusCollapsed && (
                <div style={{ marginTop: '0.5rem' }}>
                  <input type="text" value={form.lienStatusPhone} onChange={(e) => updateLienReleaseForm({ lienStatusPhone: e.target.value })} placeholder={LIEN_RELEASE_DEFAULT_LIEN_PHONE} style={{ width: '100%', maxWidth: 220, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
            <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Combined document (copy to send)</label>
              {/* eslint-disable-next-line react/no-danger -- app-generated document HTML; user-entered fields are escaped by the tested lienRelease builder */}
              <div key={`combined-preview-lr-${bid.id}-${form.invoiceAmount}-${form.bidAmount}-${form.invoicesToDate}-${form.cc}-${form.companyAddress}-${form.companyPhone}-${form.companyEmail}-${form.invoiceDate}-${form.invoiceNumber}-${form.descriptionOfWork}-${form.conditionalWaiver}-${form.paymentTerms}-${form.lienStatusPhone}`} style={{ width: '100%', minHeight: 360, padding: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontFamily: 'inherit', fontSize: '0.875rem', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: combinedHtml }} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={copyToClipboard} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{lienReleaseCopySuccess ? 'Copied!' : 'Copy to clipboard'}</button>
                <button type="button" onClick={() => { copyToClipboard(); openInExternalBrowser(googleDocsCopyUrl) }} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: 'inherit' }}>Open in Google Docs</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
