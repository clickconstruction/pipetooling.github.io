import { useState } from 'react'
import { bidNumberMatchesQuery, resolveBidLedgerPrefix, formatBidLedgerNumberLabel } from '../../lib/ledgerDisplayPrefixes'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import {
  LIEN_WAIVER_FORM_CITES,
  UNCONDITIONAL_WAIVER_WARNING,
  buildLienWaiverEmailHtml,
  buildLienWaiverEmailText,
  buildLienWaiverPdfBlob,
  buildLienWaiverPrintHtml,
  lienWaiverFormFrom,
  lienWaiverPdfFilename,
  lienWaiverTitle,
  lienWaiverToggles,
  lienWaiverUsesField,
  lienWaiverWhy,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import {
  BID_LIEN_WAIVER_HOLD_LINE,
  bidLienWaiverOutputsHeld,
  bidLienWaiverPaper,
  bidLienWaiverPayor,
  bidLienWaiverPrefill,
} from '../../lib/bids/bidLienWaiver'
import { TradeWaiverPaperView } from '../gc/GcTradeWaiverPaper'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidPickerStandardList } from './BidPickerStandardList'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Bids → Lien Release (v2.5893): the tab makes the Release of Lien window's own four forms —
 * conditional/unconditional × progress/final on Texas Property Code § 53.284
 * (`lienWaiverRelease.ts`) — scoped to a bid, where no bills exist yet, so the amount and dates
 * are typed. Conditional forms are self-serve; choosing Unconditional asks the window's warning,
 * and its outputs hold for everyone but the leaders and the controller
 * (`bidLienWaiver.ts`). The old invoice-wrapper document this tab carried is retired.
 */

type BidWaiverState = { formType: LienWaiverFormType; fields: LienWaiverFields }

type BidLienReleaseTabProps = {
  bids: BidWithBuilder[]
  onlyMyBids: boolean
  setOnlyMyBids: (next: boolean) => void
  isMyBid: (bid: BidWithBuilder) => boolean
  selectedBid: BidWithBuilder | null
  onSelectBid: (bid: BidWithBuilder) => void
  onClose: () => void
  onEditBid: (bid: BidWithBuilder) => void
}

const FIELD_LABELS: Partial<Record<keyof LienWaiverFields, string>> = {
  checkFrom: 'Check from (owner / GC)',
  amount: 'Amount ($)',
  companyName: 'Contractor / releasing party',
  projectDescription: 'Project (name — address)',
  throughDate: 'Progress payments through',
  signedDate: 'Signature date',
  signerName: 'Signed by (the leader)',
  signerTitle: 'Their title',
}

const FIELD_ORDER: (keyof LienWaiverFields)[] = ['checkFrom', 'amount', 'companyName', 'projectDescription', 'throughDate', 'signedDate', 'signerName', 'signerTitle']

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text-base)' }
const segWrap: React.CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }
const seg = (on: boolean): React.CSSProperties => ({
  padding: '0.35rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  border: 'none',
  background: on ? 'var(--text-strong)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-700)',
  cursor: 'pointer',
})
const outputBtn: React.CSSProperties = { padding: '0.5rem 1rem', background: 'var(--bg-muted)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }

export function BidLienReleaseTab({ bids, onlyMyBids, setOnlyMyBids, isMyBid, selectedBid, onSelectBid, onClose, onEditBid }: BidLienReleaseTabProps) {
  const tabLedgerPrefixMap = useLedgerPrefixMap()
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [searchQuery, setSearchQuery] = useState('')
  const [waiverByBid, setWaiverByBid] = useState<Record<string, BidWaiverState>>({})
  const [copied, setCopied] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  return (
    <div>
      {!selectedBid && (
        <BidPickerSearchRow query={searchQuery} onQueryChange={setSearchQuery} onlyMyBids={onlyMyBids} onOnlyMyBidsChange={setOnlyMyBids} searchesBidNumber={false} />
      )}
      {!selectedBid ? (
        (() => {
          const q = searchQuery.toLowerCase()
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
              searching={searchQuery.trim() !== ''}
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
        const payor = bidLienWaiverPayor(bid)
        const bidLabel = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, tabLedgerPrefixMap), bid.bid_number)
        const cur: BidWaiverState = waiverByBid[bid.id] ?? { formType: 'conditional_progress', fields: bidLienWaiverPrefill(bid, todayYmdInAppTz()) }
        const setCur = (next: BidWaiverState) => setWaiverByBid((prev) => ({ ...prev, [bid.id]: next }))
        const setField = (key: keyof LienWaiverFields, value: string) => setCur({ ...cur, fields: { ...cur.fields, [key]: value } })
        const toggles = lienWaiverToggles(cur.formType)
        const setToggles = async (next: { conditional: boolean; final: boolean }) => {
          // Every route into Unconditional asks, as the Release of Lien window does (v2.4582).
          if (toggles.conditional && !next.conditional && !(await confirmDialog(UNCONDITIONAL_WAIVER_WARNING))) return
          setCur({ ...cur, formType: lienWaiverFormFrom(next) })
        }
        const paper = bidLienWaiverPaper(cur.formType, cur.fields)
        const held = bidLienWaiverOutputsHeld(cur.formType, role)
        const copyForEmail = () => {
          void copyRichHtmlToClipboard(buildLienWaiverEmailHtml(cur.formType, cur.fields, null), buildLienWaiverEmailText(cur.formType, cur.fields)).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }
        const printWaiver = () => {
          printHtmlInNewWindow(buildLienWaiverPrintHtml(cur.formType, cur.fields, bidLabel, null, `Bid ${bidLabel}`))
        }
        const downloadPdf = async () => {
          setPdfBusy(true)
          try {
            const blob = await buildLienWaiverPdfBlob(cur.formType, cur.fields, null)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = lienWaiverPdfFilename(cur.formType, bidLabel)
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
          } catch {
            showToast('Could not build the PDF.', 'error')
          } finally {
            setPdfBusy(false)
          }
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
              <button type="button" onClick={onClose} title="Close" aria-label="Close" style={bidDetailCloseFloatMobileStyle}>
                ×
              </button>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <BidWorkflowTabTitleWithPreview
                bid={bid}
                previewEnabled={bidPreview != null}
                onOpenPreview={() => bidPreview?.openBidPreviewFromBid(bid)}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => onEditBid(bid)} style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}>Edit bid</button>
                {!narrowViewport640 ? (
                  <button type="button" onClick={onClose} title="Close" aria-label="Close" style={bidDetailCloseXStyle}>
                    ×
                  </button>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={segWrap}>
                      <button type="button" style={seg(toggles.conditional)} onClick={() => void setToggles({ ...toggles, conditional: true })}>
                        Conditional
                      </button>
                      <button type="button" style={seg(!toggles.conditional)} onClick={() => void setToggles({ ...toggles, conditional: false })}>
                        Unconditional
                      </button>
                    </span>
                    <span style={segWrap}>
                      <button type="button" style={seg(!toggles.final)} onClick={() => void setToggles({ ...toggles, final: false })}>
                        Progress
                      </button>
                      <button type="button" style={seg(toggles.final)} onClick={() => void setToggles({ ...toggles, final: true })}>
                        Final
                      </button>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Texas Property Code {LIEN_WAIVER_FORM_CITES[cur.formType]} — {lienWaiverTitle(cur.formType)}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>{lienWaiverWhy(cur.formType, payor)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: narrowViewport640 ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '0.6rem 0.9rem' }}>
                  {FIELD_ORDER.filter((key) => lienWaiverUsesField(cur.formType, key)).map((key) => (
                    <div key={key} style={key === 'projectDescription' && !narrowViewport640 ? { gridColumn: 'span 2' } : undefined}>
                      <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.8125rem' }} htmlFor={`bid-lien-waiver-${key}`}>
                        {FIELD_LABELS[key]}
                      </label>
                      <input
                        id={`bid-lien-waiver-${key}`}
                        type={key === 'throughDate' || key === 'signedDate' ? 'date' : 'text'}
                        value={cur.fields[key]}
                        onChange={(e) => setField(key, e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                {held ? (
                  <div data-testid="bid-lien-waiver-hold" style={{ background: 'var(--bg-amber-100)', color: 'var(--text-amber-900)', fontSize: '0.8125rem', lineHeight: 1.5, borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                    {BID_LIEN_WAIVER_HOLD_LINE}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" onClick={copyForEmail} style={{ ...outputBtn, background: 'var(--text-strong)', color: 'var(--surface)', border: 'none', fontWeight: 600 }}>
                      {copied ? 'Copied!' : 'Copy for email'}
                    </button>
                    <button type="button" onClick={printWaiver} style={outputBtn}>
                      Print
                    </button>
                    <button type="button" onClick={() => void downloadPdf()} disabled={pdfBusy} style={{ ...outputBtn, opacity: pdfBusy ? 0.6 : 1 }}>
                      {pdfBusy ? 'Building…' : 'Download PDF'}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <TradeWaiverPaperView paper={paper} />
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
