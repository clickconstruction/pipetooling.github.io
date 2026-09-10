/**
 * Bid basis (v2.3219) — the Cover Letter step-2 card for the marked-up plans
 * handoff, its waiting dialog, the by-hand stamp dialog, and the export history
 * list Followup's Full bid details reuses. Data comes from useBidBasisExports;
 * pure logic from src/lib/bids/bidBasis.ts.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useBidBasisExports, type BidBasisExportRow, type BidBasisExportsApi } from '../../hooks/useBidBasisExports'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { BID_BASIS_DEV_ORIGIN_KEY, bidBasisExportUrl, bidBasisRefForBid, bidBasisSearchTerm, expectedBidBasisFilename, shortSheetLabels } from '../../lib/bids/bidBasis'

/** DEV builds only: `localStorage.setItem('bidBasis.ctOrigin', 'http://localhost:4571')` walks the handoff against a local CountTooling. */
function devCountToolingOrigin(): string | null {
  if (!import.meta.env.DEV) return null
  try { return localStorage.getItem(BID_BASIS_DEV_ORIGIN_KEY) } catch { return null }
}
import type { BidWithBuilder } from '../../types/bidWithBuilder'

export function formatBidBasisWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17L17 7" />
      <path d="M8 7h9v9" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}
function FileCheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  )
}
function WarnIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  )
}

const primaryBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  background: '#3b82f6',
  border: '1px solid #3b82f6',
  color: '#fff',
  borderRadius: 6,
  padding: '0.45rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  lineHeight: 1.25,
  cursor: 'pointer',
}
const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-link)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
}
const codeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.72rem',
  color: 'var(--text-strong)',
  flex: 1,
  minWidth: 0,
  wordBreak: 'break-all',
  lineHeight: 1.4,
}
const dialogBackdrop: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }
const dialogCard: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem 1.1rem', maxWidth: 560, width: '94%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }

function useCopyFilename() {
  const { showToast } = useToastContext()
  return async (filename: string) => {
    try {
      await navigator.clipboard.writeText(filename)
      showToast('File name copied', 'success', 2500)
    } catch {
      showToast('Couldn’t copy — your browser blocked clipboard access.', 'error')
    }
  }
}

export type BidBasisCardProps = {
  bid: BidWithBuilder
  exports: BidBasisExportsApi
}

/** The step-2 card. Renders nothing when the bid has neither a CountTooling link nor an export. */
export function BidBasisCard({ bid, exports }: BidBasisCardProps) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const { user } = useAuth()
  const copyFilename = useCopyFilename()
  const ref = bidBasisRefForBid(bid)
  // The Counts import stores the view link on count_tooling_plans_link; the twin pipeline stamps count_tooling_link. Either works.
  const planLink = bid.count_tooling_plans_link || bid.count_tooling_link || null
  const url = bidBasisExportUrl(planLink, ref, devCountToolingOrigin())
  const current = exports.current
  const [waiting, setWaiting] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [staleDismissedFor, setStaleDismissedFor] = useState<string | null>(null)

  // A manifest arriving while the waiting dialog is up closes it — the toast says what was stamped.
  useEffect(() => {
    if (exports.lastStamp) setWaiting(false)
  }, [exports.lastStamp])

  if (!url && !current) return null

  const projectNameForFilename = current?.ct_project_name ?? bid.project_name ?? ''

  function openCountTooling() {
    if (!url) {
      showToast('This bid has no CountTooling plans link — paste the takeoff’s view link into Edit Bid first.', 'error')
      return
    }
    // No `noopener`: CountTooling posts the manifest back to window.opener.
    const win = window.open(url, '_blank')
    if (!win) {
      showToast('The browser blocked the CountTooling tab. Allow popups for this site and try again.', 'error', 8000)
      return
    }
    setWaiting(true)
  }

  async function removeCurrent() {
    if (!current) return
    const ok = await confirmDialog({
      title: 'Remove this bid basis?',
      message: `The stamp for ${current.filename} is deleted and the letter goes back to "plans as issued". The file on your computer is not touched.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    await exports.remove(current.id)
  }

  const stale = !!current && exports.takeoffMoved && staleDismissedFor !== current.id
  const sheets = current ? shortSheetLabels(current.sheet_labels ?? [], current.ct_project_name) : []
  const exportedByMe = !!current && !!user && current.exported_by === user.id

  const tone = stale
    ? { border: 'var(--border-amber)', bg: 'var(--bg-amber-tint)', text: 'var(--text-amber-700)' }
    : current
      ? { border: 'var(--border-green)', bg: 'var(--bg-green-tint)', text: 'var(--text-green-700)' }
      : { border: 'var(--border-blue)', bg: 'var(--bg-blue-tint)', text: 'var(--text-blue-700)' }

  return (
    <div id="bid-basis-card" style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 8, padding: '0.7rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.7rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8125rem', fontWeight: 600, color: tone.text }}>
          {stale ? <WarnIcon color={tone.text} /> : <FileCheckIcon color={tone.text} />}
          Bid basis
        </div>
        <span style={{ fontSize: '0.68rem', color: tone.text, background: 'var(--surface)', border: `1px solid ${tone.border}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontWeight: current ? 600 : 400 }}>
          {stale ? 'Takeoff changed since' : current ? 'Marked-up plans · stamped' : 'Plans as issued'}
        </span>
      </div>

      {!current ? (
        <>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-700)', lineHeight: 1.35 }}>
            Plans too rough to read? Bid to your marks instead. Export the marked sheets from CountTooling. The bid is stamped with the file name, so you can always find what you sent.
          </div>
          <button type="button" id="bid-basis-get" onClick={openCountTooling} style={{ ...primaryBtn, alignSelf: 'flex-start' }}>
            Get marked-up plans from CountTooling
            <ExternalIcon />
          </button>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Linked takeoff: {planLink ? planLink.replace(/^https?:\/\//, '').slice(0, 48) + (planLink.length > 56 ? '…' : '') : '—'}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.5rem' }}>
            <code style={codeStyle} data-testid="bid-basis-filename">{current.filename}</code>
            <button type="button" title="Copy file name" aria-label="Copy file name" onClick={() => void copyFilename(current.filename)} style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.25rem 0.4rem', display: 'inline-flex', alignItems: 'center', color: 'var(--text-700)', cursor: 'pointer' }}>
              <CopyIcon />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.74rem', color: 'var(--text-700)', lineHeight: 1.4 }}>
            <div data-testid="bid-basis-summary">
              {current.save_method === 'manual' ? (
                <span>Marked as attached by hand · no marks snapshot</span>
              ) : (
                <>
                  <strong>{current.sheet_count} {current.sheet_count === 1 ? 'sheet' : 'sheets'}</strong>
                  {sheets.length > 0 ? ' · ' + sheets.join(', ') : ''}
                  {current.include_report ? ' · report' : ''}
                  {current.notes_count ? ` · ${current.notes_count} ${current.notes_count === 1 ? 'note' : 'notes'}` : ''}
                </>
              )}
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Exported {formatBidBasisWhen(current.exported_at)}{exportedByMe ? ' by you' : ''}
              {current.ct_updated_at ? ` · takeoff last saved ${formatBidBasisWhen(current.ct_updated_at)}` : ''}
            </div>
          </div>
          {stale && (
            <div style={{ fontSize: '0.74rem', color: tone.text, lineHeight: 1.4 }}>
              The takeoff was saved again on <strong>{formatBidBasisWhen(exports.loadedNotice?.ctUpdatedAt)}</strong>, after this export. If you send the letter now, the file no longer matches what’s counted.
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
            {stale ? (
              <>
                <button type="button" onClick={openCountTooling} style={{ ...primaryBtn, padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}>
                  Export again <ExternalIcon />
                </button>
                <button type="button" onClick={() => setStaleDismissedFor(current.id)} style={{ ...linkBtn, color: 'var(--text-muted)' }}>
                  Keep the {formatBidBasisWhen(current.exported_at)} file
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={openCountTooling} style={linkBtn} disabled={!url} title={url ? undefined : 'No CountTooling plans link on this bid'}>
                  Export again <ExternalIcon />
                </button>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <button type="button" onClick={() => setHistoryOpen((v) => !v)} style={linkBtn}>
                  History ({exports.rows.length})
                </button>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={() => void removeCurrent()} style={{ ...linkBtn, color: 'var(--text-muted)' }}>
                  Remove
                </button>
              </>
            )}
          </div>
          {historyOpen && <BidBasisExportsRows rows={exports.rows} currentId={current.id} />}
        </>
      )}

      {waiting && (
        <BidBasisExportModal
          bidRef={ref}
          projectName={bid.project_name ?? ''}
          expectedFilename={expectedBidBasisFilename(ref, projectNameForFilename)}
          onOpenAgain={openCountTooling}
          onMarkByHand={() => { setWaiting(false); setManualOpen(true) }}
          onClose={() => setWaiting(false)}
        />
      )}
      {manualOpen && (
        <BidBasisManualModal
          defaultFilename={expectedBidBasisFilename(ref, projectNameForFilename)}
          onCancel={() => setManualOpen(false)}
          onStamp={async (name) => {
            const row = await exports.stampManual(name)
            if (row) setManualOpen(false)
          }}
        />
      )}
    </div>
  )
}

type BidBasisExportModalProps = {
  bidRef: string
  projectName: string
  expectedFilename: string
  onOpenAgain: () => void
  onMarkByHand: () => void
  onClose: () => void
}

/** The waiting dialog shown after the CountTooling tab opens. */
export function BidBasisExportModal({ bidRef, projectName, expectedFilename, onOpenAgain, onMarkByHand, onClose }: BidBasisExportModalProps) {
  const step = (n: number) => (
    <span style={{ width: '1.35rem', height: '1.35rem', borderRadius: 999, background: '#3b82f6', color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
  )
  return (
    <div style={dialogBackdrop} onClick={onClose} role="presentation">
      <div role="dialog" aria-label="CountTooling opened in a new tab" style={dialogCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.02rem' }}>CountTooling opened in a new tab</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{bidRef}{projectName ? ` · ${projectName}` : ''} · marked sheets only</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Dismiss" title="Dismiss" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', lineHeight: 1, color: 'var(--text-muted)', padding: '2px 6px', cursor: 'pointer' }}>×</button>
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.875rem' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>{step(1)}<span>Check the sheets CountTooling picked. Only pages with your marks are in.</span></li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>{step(2)}<span>Click <strong>Download</strong> there. The file lands in your Downloads folder.</span></li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>{step(3)}<span>Attach it to the proposal you send. This bid stamps itself when the download finishes.</span></li>
        </ol>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.6rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text-amber-700)', lineHeight: 1.35 }}>
          <span><strong>Waiting for the download.</strong> You can close this and keep working on the letter. The card in step 2 updates on its own.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>The file will be named</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.45rem 0.6rem' }}>
            <code style={{ ...codeStyle, fontSize: '0.78rem' }}>{expectedFilename}</code>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lose it later? Search your computer for {bidBasisSearchTerm(expectedFilename)}.</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: '0.2rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <button type="button" onClick={onOpenAgain} style={{ ...linkBtn, fontSize: '0.8rem' }}>Tab didn’t open? Open it again</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onMarkByHand}>Mark as attached by hand</button>
            <button type="button" onClick={onClose} style={{ color: 'var(--text-muted)' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

type BidBasisManualModalProps = {
  defaultFilename: string
  onCancel: () => void
  onStamp: (filename: string) => Promise<void>
}

export function BidBasisManualModal({ defaultFilename, onCancel, onStamp }: BidBasisManualModalProps) {
  const [name, setName] = useState(defaultFilename)
  const [busy, setBusy] = useState(false)
  return (
    <div style={dialogBackdrop} onClick={() => !busy && onCancel()} role="presentation">
      <div role="dialog" aria-label="Mark as attached" style={dialogCard} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: '1.02rem' }}>Mark as attached</h3>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Use this when the download finished but PipeTooling didn’t hear back. The stamp is kept, without a marks snapshot.
        </p>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>File name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="File name"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, width: '100%', boxSizing: 'border-box' }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Prefilled with the expected name. Fix it if your browser renamed the file, for example with “(1)”.</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ color: 'var(--text-muted)' }}>Cancel</button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={async () => { setBusy(true); try { await onStamp(name) } finally { setBusy(false) } }}
            style={{ ...primaryBtn, padding: '0.4rem 0.85rem', fontSize: '0.875rem' }}
          >
            Stamp this bid
          </button>
        </div>
      </div>
    </div>
  )
}

function BidBasisExportsRows({ rows, currentId }: { rows: BidBasisExportRow[]; currentId: string | null }) {
  const copyFilename = useCopyFilename()
  if (rows.length === 0) return <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No exports yet.</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="bid-basis-history">
      {rows.map((r) => {
        const isCurrent = r.id === currentId
        return (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) auto', gap: 8, alignItems: 'start', fontSize: '0.75rem', padding: '0.45rem 0.5rem', background: isCurrent ? 'var(--bg-green-tint)' : 'var(--bg-subtle)', border: `1px solid ${isCurrent ? 'var(--border-green)' : 'var(--border)'}`, borderRadius: 6, color: isCurrent ? 'var(--text-strong)' : 'var(--text-muted)' }}>
            <span style={{ fontWeight: isCurrent ? 600 : 400 }}>{formatBidBasisWhen(r.exported_at)}</span>
            <button type="button" onClick={() => void copyFilename(r.filename)} title="Copy file name" style={{ ...linkBtn, color: 'inherit', textAlign: 'left', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.7rem', wordBreak: 'break-all', display: 'inline', lineHeight: 1.35 }}>
              {r.filename}
            </button>
            <span style={{ textAlign: 'right' }}>{isCurrent ? 'current' : 'replaced'}{r.save_method === 'manual' ? ' · by hand' : ''}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Followup → Full bid details: the bid's export history (read-only, no window listener). */
export function BidBasisExportsList({ bidId }: { bidId: string }) {
  const exports = useBidBasisExports(bidId, null, { listen: false })
  if (exports.rows.length === 0) return <span style={{ fontSize: '0.875rem', color: 'var(--text-strong)' }}>—</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <BidBasisExportsRows rows={exports.rows} currentId={exports.current?.id ?? null} />
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Each reported row keeps its marks snapshot.</div>
    </div>
  )
}
