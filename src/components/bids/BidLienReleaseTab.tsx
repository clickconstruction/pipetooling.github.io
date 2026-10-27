import { useCallback, useEffect, useMemo, useState } from 'react'
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
  lienWaiverUnfinishedDateBlocksIssue,
  lienWaiverUsesField,
  lienWaiverWhy,
  type LienWaiverFields,
  type LienWaiverFormType,
} from '../../lib/jobsDocuments/lienWaiverRelease'
import {
  BID_LIEN_WAIVER_HOLD_HEAD,
  BID_LIEN_WAIVER_HOLD_LINE,
  bidLienReleaseChip,
  bidLienReleaseFields,
  bidLienReleaseForPaper,
  bidLienReleaseHistory,
  bidLienWaiverCodeDoorShown,
  bidLienWaiverCodeDoorWords,
  bidLienWaiverLeader,
  bidLienWaiverOutputsHeld,
  bidLienWaiverPaper,
  bidLienWaiverPayor,
  bidLienWaiverPrefill,
  leaderInitials,
  type BidLienReleaseChip,
  type BidLienReleaseRow,
} from '../../lib/bids/bidLienWaiver'
import { loadBidLienReleases, loadBidLienWaiverLeaders, mintBidLienRelease, stampBidLienReleaseSent, type BidLienReleaseHistory } from '../../lib/bids/bidLienReleaseIo'
import { isLienWaiverFormType, type JobLienReleaseRow } from '../../lib/jobs/lienReleaseTracking'
import { lienReleaseRowSignature, lienReleaseStatus } from '../../lib/jobs/lienReleaseLifecycle'
import type { LienWaiverSigner } from '../../lib/jobs/lienWaiverSigners'
import { getPhysicalInvoiceIssuerDraft } from '../../lib/physicalInvoiceIssuer'
import LienReleaseSignModal from '../jobs/LienReleaseSignModal'
import { TradeWaiverPaperView } from '../gc/GcTradeWaiverPaper'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { copyRichHtmlToClipboard } from '../../lib/copyRichHtmlToClipboard'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { bidDetailCloseXStyle, bidDetailCloseFloatMobileStyle } from '../../lib/bids/bidStyles'
import { BidWorkflowTabTitleWithPreview } from './BidWorkflowTabTitleWithPreview'
import { BidPickerStandardList } from './BidPickerStandardList'
import { bidPickerEmptyWords } from '../../lib/bids/bidPickerEmptyWords'
import { BidPickerSearchRow } from './BidPickerSearchRow'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Bids → Lien Release (v2.5893): the tab makes the Release of Lien window's own four forms —
 * conditional/unconditional × progress/final on Texas Property Code § 53.284
 * (`lienWaiverRelease.ts`) — scoped to a bid, where no bills exist yet, so the amount and dates
 * are typed. Conditional forms are self-serve; choosing Unconditional asks the window's warning,
 * and its outputs hold for everyone but the leaders and the controller
 * (`bidLienWaiver.ts`). The old invoice-wrapper document this tab carried is retired.
 *
 * v2.5958 (board 3 of the Sign by his code canvas): every waiver that goes out is recorded on the
 * bid and listed under Already on this bid, and the unconditional hold gains the code door — the
 * leader standing at an estimator's screen signs it with his code, and the outputs open signed.
 */

type BidWaiverState = { formType: LienWaiverFormType; fields: LienWaiverFields }
type SignTarget = { row: BidLienReleaseRow; leader: LienWaiverSigner; docLabel: string; bidId: string }

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
const historyChip = (tone: BidLienReleaseChip['tone']): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: '0.6875rem',
  fontWeight: 700,
  padding: '0.1rem 0.5rem',
  borderRadius: 9999,
  border: tone === 'made' ? '1px solid var(--border-strong)' : 'none',
  background: tone === 'waiting' ? 'var(--bg-amber-100)' : tone === 'made' ? 'var(--bg-subtle)' : 'var(--bg-green-100)',
  color: tone === 'waiting' ? 'var(--text-amber-900)' : tone === 'made' ? 'var(--text-muted)' : 'var(--text-green-800)',
  cursor: 'pointer',
  textAlign: 'left',
})

export function BidLienReleaseTab({ bids, onlyMyBids, setOnlyMyBids, isMyBid, selectedBid, onSelectBid, onClose, onEditBid }: BidLienReleaseTabProps) {
  const tabLedgerPrefixMap = useLedgerPrefixMap()
  const narrowViewport640 = useNarrowViewport640()
  const bidPreview = useBidPreview()
  const { role, user: authUser, profileName } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [searchQuery, setSearchQuery] = useState('')
  const [waiverByBid, setWaiverByBid] = useState<Record<string, BidWaiverState>>({})
  const [copied, setCopied] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  // v2.5958: the waivers recorded on each bid, the leaders who sign, and the code door's state.
  const [historyByBid, setHistoryByBid] = useState<Record<string, BidLienReleaseHistory>>({})
  const [leaders, setLeaders] = useState<LienWaiverSigner[]>([])
  const [signTarget, setSignTarget] = useState<SignTarget | null>(null)
  const [codeBusy, setCodeBusy] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const companySignerName = useMemo(() => getPhysicalInvoiceIssuerDraft().signerName ?? null, [])
  const selectedBidId = selectedBid?.id ?? null

  const reloadHistory = useCallback(async (bidId: string) => {
    try {
      const history = await loadBidLienReleases(bidId)
      setHistoryByBid((prev) => ({ ...prev, [bidId]: history }))
    } catch {
      // Already on this bid keeps what it had; the outputs work either way.
    }
  }, [])
  useEffect(() => {
    if (selectedBidId) void reloadHistory(selectedBidId)
  }, [selectedBidId, reloadHistory])
  useEffect(() => {
    if (!selectedBidId) return
    let cancelled = false
    void loadBidLienWaiverLeaders().then((rows) => {
      if (!cancelled) setLeaders(rows)
    })
    return () => {
      cancelled = true
    }
  }, [selectedBidId])

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
              empty={bidPickerEmptyWords({ total: bids.length, onlyMyBids, mine: scoped.length, query: searchQuery, clearQuery: () => setSearchQuery(''), showEveryBid: () => setOnlyMyBids(false) })}
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
        // v2.5958: the waiver recorded for this very paper, and its signature when the leader's code signed it.
        const history = historyByBid[bid.id] ?? null
        const rows = history?.rows ?? []
        const recorded = bidLienReleaseForPaper(rows, cur.formType, cur.fields)
        const signedRow = recorded && lienReleaseStatus(recorded) === 'signed' ? recorded : null
        const signedOn = signedRow?.signed_on_device_of ? (history?.deviceNames[signedRow.signed_on_device_of] ?? null) : null
        const signature = signedRow ? lienReleaseRowSignature(signedRow, signedOn) : null
        const paper = bidLienWaiverPaper(cur.formType, cur.fields, signature)
        // The hold waits for a leader's signature; once his code signs this paper its outputs open signed.
        const held = bidLienWaiverOutputsHeld(cur.formType, role) && !signedRow
        const leader = bidLienWaiverLeader(leaders, cur.fields.signerName, companySignerName)
        const codeDoor = held && leader != null && bidLienWaiverCodeDoorShown(cur.formType, role)
        const doorWords = leader ? bidLienWaiverCodeDoorWords(leader.name) : null
        const footNote = signature ? signature.auditLine : held ? 'Waits for his ink or his code' : null
        const shownHistory = bidLienReleaseHistory(rows)
        // Every waiver that goes out is recorded on the bid, once per paper. For the outputs it is best
        // effort: a role the database will not let record one still prints and copies.
        const recordOutput = async (sent: boolean) => {
          let row: BidLienReleaseRow | null = recorded
          if (!row && authUser?.id) {
            const r = await mintBidLienRelease({ bidId: bid.id, formType: cur.formType, fields: cur.fields, userId: authUser.id })
            row = r.ok ? r.row : null
          }
          if (row && sent && !row.sent_to_customer_at && authUser?.id) await stampBidLienReleaseSent(row.id, authUser.id)
          await reloadHistory(bid.id)
        }
        // The code door (board 3): record this paper with the leader under the line, then open it for his code.
        const signWithHisCode = async () => {
          if (!leader || !authUser?.id || codeBusy) return
          const blocked = lienWaiverUnfinishedDateBlocksIssue(cur.formType, cur.fields, Number(todayYmdInAppTz().slice(0, 4)))
          if (blocked) {
            showToast(blocked, 'error')
            return
          }
          const sameName = cur.fields.signerName.trim().toLowerCase() === leader.name.trim().toLowerCase()
          const fields = sameName ? cur.fields : { ...cur.fields, signerName: leader.name }
          if (!sameName) setCur({ ...cur, fields })
          let row = bidLienReleaseForPaper(rows, cur.formType, fields)
          if (row && lienReleaseStatus(row) === 'signed') return
          setCodeBusy(true)
          try {
            if (!row) {
              const r = await mintBidLienRelease({ bidId: bid.id, formType: cur.formType, fields, userId: authUser.id })
              if (!r.ok) {
                showToast(r.message, 'error')
                return
              }
              row = r.row
              void reloadHistory(bid.id)
            }
            setSignTarget({ row, leader, docLabel: `Bid ${bidLabel}`, bidId: bid.id })
          } finally {
            setCodeBusy(false)
          }
        }
        const viewRecorded = (row: BidLienReleaseRow) => {
          if (isLienWaiverFormType(row.form_type)) setCur({ formType: row.form_type, fields: bidLienReleaseFields(row) })
        }
        const copyForEmail = () => {
          void copyRichHtmlToClipboard(buildLienWaiverEmailHtml(cur.formType, cur.fields, signature), buildLienWaiverEmailText(cur.formType, cur.fields)).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
          void recordOutput(true)
        }
        const printWaiver = () => {
          // A print counts as a send (docs/SENT_COPIES.md): the waiver is filed on the bid as it printed.
          const ok = printAndFile(buildLienWaiverPrintHtml(cur.formType, cur.fields, bidLabel, signature, `Bid ${bidLabel}`), {
            kind: 'bid_lien_waiver',
            title: `${lienWaiverTitle(cur.formType)}, ${signature ? 'signed' : 'unsigned'} · ${bidDisplayName(bid) || bidLabel}`,
            bidId: bid.id,
            customerId: bid.customer_id ?? null,
          })
          if (!ok) {
            showToast('Popup blocked — allow popups to print.', 'error')
            return
          }
          void recordOutput(true)
        }
        const downloadPdf = async () => {
          setPdfBusy(true)
          try {
            const blob = await buildLienWaiverPdfBlob(cur.formType, cur.fields, signature)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = lienWaiverPdfFilename(cur.formType, bidLabel)
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            void recordOutput(false)
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
                {held && codeDoor && leader && doorWords ? (
                  <div data-testid="bid-lien-waiver-hold" style={{ background: 'var(--bg-amber-100)', borderRadius: 10, padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    <div style={{ color: 'var(--text-amber-900)', fontSize: '0.78rem', lineHeight: 1.5 }}>{BID_LIEN_WAIVER_HOLD_HEAD}</div>
                    <div data-testid="bid-lien-waiver-code-door" style={{ background: 'var(--surface)', border: '1px solid var(--border-amber-soft)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'flex', gap: '0.7rem', alignItems: 'flex-start' }}>
                      <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 9999, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, flexShrink: 0 }}>
                        {leaderInitials(leader.name)}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 650, color: 'var(--text-strong)' }}>{doorWords.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{doorWords.line}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => void signWithHisCode()}
                            disabled={codeBusy}
                            style={{ padding: '0.5rem 0.9rem', fontSize: '0.8125rem', fontWeight: 650, border: 'none', borderRadius: 8, background: 'var(--text-strong)', color: 'var(--surface)', cursor: codeBusy ? 'default' : 'pointer', opacity: codeBusy ? 0.6 : 1, whiteSpace: 'nowrap' }}
                          >
                            {codeBusy ? 'Opening…' : doorWords.button}
                          </button>
                          <button
                            type="button"
                            onClick={() => setAskOpen((v) => !v)}
                            aria-expanded={askOpen}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {doorWords.askLink}
                          </button>
                        </div>
                        {askOpen ? <div style={{ fontSize: '0.75rem', color: 'var(--text-700)', lineHeight: 1.5 }}>{doorWords.askLine}</div> : null}
                      </div>
                    </div>
                  </div>
                ) : held ? (
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
                {shownHistory.length > 0 ? (
                  <div data-testid="bid-lien-waiver-history" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Already on this bid</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {shownHistory.map((row) => {
                        const chip = bidLienReleaseChip(row)
                        return (
                          <button key={row.id} type="button" onClick={() => viewRecorded(row)} title="Open this waiver on the page" style={historyChip(chip.tone)}>
                            {chip.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <TradeWaiverPaperView paper={paper} footNote={footNote} />
              </div>
            </div>
          </div>
        )
      })()}
      {signTarget ? (
        <LienReleaseSignModal
          open
          release={signTarget.row as unknown as JobLienReleaseRow}
          jobNumber={signTarget.docLabel}
          docLabel={signTarget.docLabel}
          presentSigner={{ id: signTarget.leader.id, name: signTarget.leader.name }}
          deviceUserName={(profileName ?? '').trim() || null}
          codeOnly
          onSigned={() => void reloadHistory(signTarget.bidId)}
          onClose={() => setSignTarget(null)}
        />
      ) : null}
    </div>
  )
}
