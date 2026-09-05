import { bidNumberMatchesQuery } from '../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { resolveEstimateMasterUserId } from '../../lib/estimateMasterUser'
import type { User } from '@supabase/supabase-js'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName, formatDateYYMMDD } from '../../lib/bids/bidFormatting'
import { buildChangeOrderHtml, buildChangeOrderText, type ChangeOrderFormData } from '../../lib/bidDocuments/changeOrder'
import { buildBridgedChangeOrderDraft, formatSignedDollars, parseCostImpact, sanitizeSignedMoneyTyping, signedMoneyToCents } from '../../lib/bidDocuments/changeOrderBridge'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { addressLines } from '../../lib/bidDocuments/htmlDoc'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { MyBidsToggle } from './MyBidsToggle'

type BidChangeOrderTabProps = {
  bids: BidWithBuilder[]
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
  authUser: User | null
  selectedBid: BidWithBuilder | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
}

export function BidChangeOrderTab({ bids, onlyMyBids, setOnlyMyBids, isMyBid, authUser, selectedBid, onSelectBid, onClose, onEditBid }: BidChangeOrderTabProps) {
  const tabLedgerPrefixMap = useLedgerPrefixMap()
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const [changeOrderSearchQuery, setChangeOrderSearchQuery] = useState('')
  /** Bids → Estimates bridge (CO train v2.1835): create a signable CO draft from this form. */
  const [sendingForSignature, setSendingForSignature] = useState(false)
  const navigate = useNavigate()
  const { role } = useAuth()
  const { showToast } = useToastContext()

  /**
   * Confirm sheet for the bridge (decision 17, 2026-09-05; J16-2): "Send for
   * signature →" opens this instead of inserting. It shows the parsed fields
   * and asks for the net change to the contract as a number — prefilled when
   * the free text parses — so the draft is created with a real total and line.
   * Cancel writes nothing.
   */
  const [bridgeSheet, setBridgeSheet] = useState<{ bid: BidWithBuilder; form: ChangeOrderFormData; netChange: string } | null>(null)

  const openBridgeSheet = (bid: BidWithBuilder, form: ChangeOrderFormData) => {
    if (!authUser?.id || sendingForSignature) return
    const parsed = parseCostImpact(form.impactOnCost)
    setBridgeSheet({ bid, form, netChange: parsed === null ? '' : (parsed / 100).toFixed(2) })
  }

  const sendForSignature = async (bid: BidWithBuilder, form: ChangeOrderFormData, netChangeCents: number) => {
    if (!authUser?.id || sendingForSignature) return
    setSendingForSignature(true)
    try {
      const masterUserId =
        bid.customers?.master_user_id ?? (await resolveEstimateMasterUserId(authUser.id, role))
      if (!masterUserId) {
        showToast('Could not determine the account owner for this change order.', 'error')
        return
      }
      const draft = buildBridgedChangeOrderDraft({ form, netChangeCents })
      const { data, error } = await supabase
        .from('estimates')
        .insert({
          master_user_id: masterUserId,
          created_by: authUser.id,
          doc_kind: 'change_order',
          bid_id: bid.id,
          customer_id: bid.customers?.id ?? null,
          title: (bid.project_name ?? '').trim() ? `Change order — ${(bid.project_name ?? '').trim()}` : 'Change order',
          for_address: (bid.address ?? '').trim() || null,
          line_items_snapshot: draft.line_items_snapshot,
          terms_snapshot: '',
          total_cents: draft.total_cents,
          internal_notes: draft.internal_notes,
          change_order_fields: draft.change_order_fields,
        })
        .select('estimate_number')
        .single()
      if (error) throw error
      const num = (data as { estimate_number: number } | null)?.estimate_number
      setBridgeSheet(null)
      recordNavClick(authUser.id, role, 'change_order_bridged', num != null ? `/estimates/${num}` : '/estimates')
      showToast(
        netChangeCents === 0
          ? 'Change order draft created at $0 — add cost lines if the price changes, then send for signature.'
          : `Change order draft created — net change ${formatSignedDollars(netChangeCents)}. Review the line, then send for signature.`,
        'success',
      )
      if (num != null) navigate(`/estimates/${num}`)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not create the change order draft'), 'error')
    } finally {
      setSendingForSignature(false)
    }
  }
  const [changeOrderFormByBid, setChangeOrderFormByBid] = useState<Record<string, ChangeOrderFormData>>({})
  const [changeOrderCopySuccess, setChangeOrderCopySuccess] = useState(false)

  return (
    <div>
      {!selectedBid && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Search bids (project name or GC/Builder)..."
            value={changeOrderSearchQuery}
            onChange={(e) => setChangeOrderSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 200, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
          />
          <BidPickerSortToggle />
          <MyBidsToggle active={onlyMyBids} onChange={setOnlyMyBids} />
        </div>
      )}
      {!selectedBid ? (
        (() => {
          const q = changeOrderSearchQuery.toLowerCase()
          const scoped = onlyMyBids ? bids.filter(isMyBid) : bids
          const filtered = scoped.filter((b) => {
            if (!q) return true
            const name = bidDisplayName(b).toLowerCase()
            const cust = (b.customers?.name ?? '').toLowerCase()
            const gc = (b.bids_gc_builders?.name ?? '').toLowerCase()
            return bidNumberMatchesQuery(b, q, tabLedgerPrefixMap) || name.includes(q) || cust.includes(q) || gc.includes(q)
          })
          return (
            <BidPickerStandardList
              bids={filtered}
              prefixMap={tabLedgerPrefixMap}
              onSelectBid={onSelectBid}
              emptyMessage={
                bids.length === 0
                  ? 'No bids yet.'
                  : onlyMyBids && scoped.length === 0
                    ? 'No bids you are the account manager or estimator for.'
                    : 'No bids match your search.'
              }
            />
          )
        })()
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
        const sanitizedProjectName = (projectNameVal ?? '').replace(/[^a-zA-Z0-9]+/g, ' ').trim() || 'Project'
        const templateCopyTarget = `ClickChangeOrder ${datePart} ${sanitizedProjectName}`
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
                <button
                  type="button"
                  disabled={sendingForSignature}
                  title="Review what will be created, enter the net change, then a signable change order draft opens in Estimates"
                  onClick={() => openBridgeSheet(bid, form)}
                  style={{ padding: '0.5rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: sendingForSignature ? 'wait' : 'pointer' }}
                >
                  {sendingForSignature ? 'Creating…' : 'Send for signature →'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {bridgeSheet ? (() => {
        const cents = signedMoneyToCents(bridgeSheet.netChange)
        const rowsShown: Array<[string, string]> = [
          ['Description of change', bridgeSheet.form.detailedDescriptionOfChange.trim() || '—'],
          ['Reason for change', bridgeSheet.form.reasonForChange.trim() || '—'],
          ['Impact on schedule', bridgeSheet.form.impactOnSchedule.trim() || '—'],
          ['Response requested by', bridgeSheet.form.responseRequestDate.trim() || '—'],
          ['Impact on cost (as typed)', bridgeSheet.form.impactOnCost.trim() || '—'],
        ]
        const close = () => {
          if (!sendingForSignature) setBridgeSheet(null)
        }
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="co-bridge-sheet-title"
            onClick={close}
            style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto', padding: '1.25rem 1.5rem', boxSizing: 'border-box', boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
            >
              <h3 id="co-bridge-sheet-title" style={{ margin: '0 0 0.35rem', fontSize: '1.0625rem' }}>Create a change order draft in Estimates?</h3>
              <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Nothing is saved until you confirm. The draft opens in Estimates prefilled from this form and linked to {bidDisplayName(bridgeSheet.bid)}; you can still edit every line there before sending it for signature.
              </p>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: '0.75rem', rowGap: '0.4rem', fontSize: '0.8125rem' }}>
                {rowsShown.map(([k, v]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{k}</dt>
                    <dd style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-700)' }}>{v}</dd>
                  </div>
                ))}
              </dl>
              <label style={{ display: 'block', marginTop: '1rem', fontSize: '0.8125rem' }}>
                <span style={{ fontWeight: 600 }}>Net change to contract ($)</span>
                <span style={{ marginLeft: '0.35rem', color: 'var(--text-muted)' }}>increase positive, credit negative; blank = $0 (schedule-only)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={bridgeSheet.netChange}
                  onChange={(e) => setBridgeSheet((prev) => (prev ? { ...prev, netChange: sanitizeSignedMoneyTyping(e.target.value) } : prev))}
                  placeholder="e.g. 2450.00 or -390"
                  style={{ display: 'block', width: '100%', marginTop: '0.35rem', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.9375rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-strong)' }}
                />
              </label>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {cents === null
                  ? 'Enter a number, or leave it blank for a $0 draft.'
                  : cents === 0
                    ? 'The draft is created at $0 with no cost lines — add them in Estimates if the price changes.'
                    : `The draft is created with one line for ${formatSignedDollars(cents)}; the typed breakdown rides along as its description.`}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.1rem' }}>
                <button
                  type="button"
                  onClick={close}
                  disabled={sendingForSignature}
                  style={{ padding: '0.5rem 1rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingForSignature || cents === null}
                  onClick={() => {
                    if (cents === null) return
                    void sendForSignature(bridgeSheet.bid, bridgeSheet.form, cents)
                  }}
                  style={{ padding: '0.5rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: sendingForSignature || cents === null ? 'not-allowed' : 'pointer' }}
                >
                  {sendingForSignature ? 'Creating…' : 'Create draft →'}
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
    </div>
  )
}
