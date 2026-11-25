import { useState } from 'react'
import { BID_BOARD_MAP_SECTION_COLOR, BID_BOARD_MAP_SECTION_LABEL, bidBoardMapDirectionsUrl, type BidBoardMapBid } from '../../lib/bids/bidBoardMap'
import { addressDraftReady, missingAddressMemory, missingAddressStatus, missingAddressSummary, type MissingAddressRow } from '../../lib/bids/bidBoardMissingAddresses'
import { tryAgainWords, type TryAgainOutcome } from '../../lib/map/unplacedMemory'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'

type Props = {
  open: boolean
  rows: readonly MissingAddressRow[]
  isMobile: boolean
  onClose: () => void
  /** Writes the address (and fills a blank distance); resolves true when the row was written. */
  onSave: (bid: BidBoardMapBid, address: string) => Promise<boolean>
  /** Asks the map services about the bid's saved address past the memory of its miss, and says what they found. */
  onTryAgain: (bid: BidBoardMapBid) => Promise<TryAgainOutcome>
  onEditBid: (bid: BidBoardMapBid) => void
  onFocusRow: (bidId: string) => void
}

const TONE: Record<'muted' | 'warn' | 'ok', string> = {
  muted: 'var(--text-muted)',
  warn: 'var(--text-amber-800)',
  ok: 'var(--text-emerald-800)',
}

/**
 * The door behind "N bids have no map location yet" (v2.3205): every bid the
 * map can't place, with its address ready to type or fix in place. A row the
 * person fixes stays until the sheet closes, so they see the pin land.
 *
 * An address no map service could place is remembered (punch list #441): its
 * row says why, the day it was checked and the day the app asks again by
 * itself, and **Try again** beside **Save** asks now, past that memory. The
 * words are the Map page list's own (`unplacedMemory.ts`).
 */
export function BidBoardMissingAddressesModal({ open, rows, isMobile, onClose, onSave, onTryAgain, onEditBid, onFocusRow }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  // What each **Try again** found, by bid: the words stay under the row until the sheet closes.
  const [tried, setTried] = useState<Record<string, { busy: boolean; outcome?: TryAgainOutcome; at?: string }>>({})
  if (!open) return null

  async function tryAgain(r: MissingAddressRow) {
    setTried((p) => ({ ...p, [r.bid.id]: { busy: true } }))
    const outcome = await onTryAgain(r.bid)
    setTried((p) => ({ ...p, [r.bid.id]: { busy: false, outcome, at: new Date().toISOString() } }))
  }

  const draftOf = (r: MissingAddressRow) => drafts[r.bid.id] ?? r.bid.address

  async function save(r: MissingAddressRow) {
    const text = draftOf(r).trim()
    if (!addressDraftReady(text, r.bid.address)) return
    setSaving(r.bid.id)
    try {
      const ok = await onSave(r.bid, text)
      if (ok) setDrafts((p) => { const n = { ...p }; delete n[r.bid.id]; return n })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="bid-map-missing-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 1005, padding: isMobile ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: isMobile ? '12px 12px 0 0' : 8,
          maxWidth: 720,
          width: '100%',
          maxHeight: isMobile ? 'min(92vh, 100%)' : 'min(85vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="bid-map-missing-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Bids the map can’t place</h2>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {missingAddressSummary(rows)}. Type the site address and save — the pin lands as soon as the map finds it.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, color: 'var(--text-muted)', padding: '0.25rem' }}>×</button>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: '0.5rem 1.25rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {rows.length === 0 ? (
            <li style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Every bid on the board is on the map.</li>
          ) : null}
          {rows.map((r) => {
            const draft = draftOf(r)
            const ready = addressDraftReady(draft, r.bid.address)
            const status = missingAddressStatus(r)
            const busy = saving === r.bid.id
            const st = tried[r.bid.id]
            // Null for a bid with no address, one still being looked for and one that is placed: no Try again there.
            const memory = missingAddressMemory(r, st?.at ?? new Date().toISOString(), st?.outcome)
            const inputId = `bid-map-address-${r.bid.id}`
            return (
              <li key={r.bid.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
                  {/* v2.3214: the stage in words, not just a dot — "Lost" or "Unsent" decides whether an address is worth typing. */}
                  <span
                    data-testid="bid-map-stage"
                    title={`${BID_BOARD_MAP_SECTION_LABEL[r.bid.section]} — the Bid Board section this bid sits in`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flex: '0 0 auto', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: BID_BOARD_MAP_SECTION_COLOR[r.bid.section] }}
                  >
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: BID_BOARD_MAP_SECTION_COLOR[r.bid.section] }} />
                    {BID_BOARD_MAP_SECTION_LABEL[r.bid.section]}
                  </span>
                  <button type="button" onClick={() => onFocusRow(r.bid.id)} title="Show this bid's row" style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-strong)', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
                    {r.bid.numberLabel}
                  </button>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 12rem' }}>{r.bid.projectName}</span>
                  {r.bid.gcName ? <span style={{ color: 'var(--text-muted)' }}>· {r.bid.gcName}</span> : null}
                  {r.bid.dueLabel ? <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>· due {r.bid.dueLabel}</span> : null}
                </div>
                <label htmlFor={inputId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Address for {r.bid.label}</label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'stretch', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  <input
                    id={inputId}
                    type="text"
                    value={draft}
                    placeholder="Street, city, state"
                    autoComplete="street-address"
                    disabled={busy}
                    onChange={(e) => setDrafts((p) => ({ ...p, [r.bid.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void save(r) }}
                    style={{ flex: '1 1 16rem', minWidth: 0, font: 'inherit', fontSize: '0.9rem', padding: '0.45rem 0.6rem', border: `1px solid ${r.reason === 'placed' ? 'var(--border)' : 'var(--border-strong)'}`, borderRadius: 6, background: 'var(--surface)', color: 'inherit', minHeight: isMobile ? 44 : undefined }}
                  />
                  <button
                    type="button"
                    onClick={() => void save(r)}
                    disabled={!ready || busy}
                    style={{ padding: '0.45rem 0.85rem', border: 'none', borderRadius: 6, background: ready && !busy ? '#2563eb' : 'var(--bg-muted)', color: ready && !busy ? '#fff' : 'var(--text-muted)', fontWeight: 600, cursor: ready && !busy ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: '0.85rem', whiteSpace: 'nowrap', minHeight: isMobile ? 44 : undefined }}
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  {memory ? (
                    <button
                      type="button"
                      onClick={() => void tryAgain(r)}
                      disabled={st?.busy || busy}
                      title="Ask the map services about the saved address now"
                      style={{ ...TRY_AGAIN, ...(st?.busy ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'default' } : null), minHeight: isMobile ? 44 : undefined }}
                    >
                      {st?.busy ? 'Asking the map services…' : 'Try again'}
                    </button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                  <span style={{ color: TONE[status.tone], flex: '1 1 14rem' }}>{status.text}</span>
                  {draft.trim().length >= 3 ? (
                    <button type="button" onClick={() => openInExternalBrowser(bidBoardMapDirectionsUrl(draft))} style={LINK} title="Open this address in Google Maps to check it">
                      Check on Google Maps ↗
                    </button>
                  ) : null}
                  <button type="button" onClick={() => { onClose(); onEditBid(r.bid) }} style={LINK}>Edit bid</button>
                </div>
                {memory && (memory.reason || memory.checked) ? (
                  <div data-miss-memory style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.6rem' }}>
                    {memory.reason ? <span data-miss-reason>{memory.reason}</span> : null}
                    {memory.checked ? (
                      <span data-miss-checked>
                        <ValueSentence text={memory.checked} />
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {st?.outcome ? (
                  <div data-try-again-result={st.outcome.kind} role="status" style={{ fontSize: '0.78rem', color: st.outcome.kind === 'failed' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                    {tryAgainWords(st.outcome, 'box')}
                  </div>
                ) : null}
                {r.customerAddress ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{r.bid.gcName ?? 'Customer'}’s address on file: {r.customerAddress}</span>
                    <button type="button" onClick={() => setDrafts((p) => ({ ...p, [r.bid.id]: r.customerAddress ?? '' }))} style={LINK} title="Fill the box with the customer's address — only right when the job is at their address">
                      Use it
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>

        <div style={{ padding: '0.6rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem', minHeight: isMobile ? 44 : undefined }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/** **Try again**: a press beside **Save**, drawn as the Map page list draws its own. */
const TRY_AGAIN: React.CSSProperties = { padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', whiteSpace: 'nowrap' }

const LINK: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: '0.78rem',
  color: 'var(--text-blue-500)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
