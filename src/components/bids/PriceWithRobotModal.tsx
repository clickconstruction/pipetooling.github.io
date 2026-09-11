/**
 * "Price it with the robot" (Price Matrix PR 2 — docs/PRICE_MATRIX_PLAN.md,
 * canvas board 2). Two faces of one sheet:
 *
 *  - QUEUE (no open request): the quote links on this bid's Price-requests
 *    table, ticked; what the robot will and won't do; Queue it. Writes one
 *    `bid_price_matrix_requests` row — the fixture rows and the ticked sources
 *    as a snapshot — and nothing else. No email, no cost, no bid change.
 *  - STATUS (a request is queued / working / blocked / ready): where it stands,
 *    who asked, what it is reading, and Take it back while it is still queued.
 *
 * The sources are the estimator's own pasted `quote_url`s (Edit Bid → Files &
 * Links → Price requests). A house asked with nothing in the folder yet is
 * listed as skipped — the robot never invents a quote.
 */
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../../lib/supabase'
import { fetchSupplyHousePickerRows } from '../../lib/supplyHousePickerRows'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useUserDisplayNames } from '../../hooks/useUserDisplayNames'
import {
  buildPriceMatrixScope,
  buildPriceMatrixSources,
  canTakeBack,
  requestAgeLabel,
  summarizeResult,
  type PriceMatrixRequestRow,
  type PriceMatrixSource,
  type PriceRequestLinkRow,
} from '../../lib/rfq/priceMatrixRequest'
import { linkHostLabel } from '../../lib/bids/bidPriceRequests'

// bid_price_matrix_requests predates the generated types — untyped until the post-push gen-types run.
const db = supabase as unknown as SupabaseClient

const MODAL_Z = 10060

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
  overflowY: 'auto',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 600,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
}

const eyebrow: CSSProperties = { fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const smallMuted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const btnPrimary: CSSProperties = { padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontWeight: 600 }
const btnPlain: CSSProperties = { padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }

function RobotGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <circle cx="9" cy="13.5" r="1.2" fill="#2563eb" stroke="none" />
      <circle cx="15" cy="13.5" r="1.2" fill="#2563eb" stroke="none" />
      <path d="M12 8V5" />
      <circle cx="12" cy="4" r="1" />
      <path d="M9 17h6" />
    </svg>
  )
}

function Check({ muted = false }: { muted?: boolean }) {
  return muted ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }} aria-hidden>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }} aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

export type PriceWithRobotModalProps = {
  open: boolean
  onClose: () => void
  bidId: string
  bidVersionId: string | null
  bidLabel: string
  rows: Array<{ id: string; fixture: string; count: number; unit?: string | null }>
  /** The request the chip is about, when one is open — the sheet shows status instead of the queue form. */
  activeRequest: PriceMatrixRequestRow | null
  /** False while the table is not in the schema cache yet (client ahead of the migration). */
  supported: boolean
  /** After a row was written or taken back — the caller re-derives the chip. */
  onChanged: () => void
  /** Ready → open the compare. */
  onOpenCompare: () => void
  /** Where the estimator adds a folder link when none is readable yet. */
  priceRequestsHref?: string
}

export function PriceWithRobotModal({ open, onClose, bidId, bidVersionId, bidLabel, rows, activeRequest, supported, onChanged, onOpenCompare, priceRequestsHref }: PriceWithRobotModalProps) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [rfqs, setRfqs] = useState<PriceRequestLinkRow[]>([])
  const [houseNames, setHouseNames] = useState<ReadonlyMap<string, string>>(new Map())
  const [loaded, setLoaded] = useState(false)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requesterNames = useUserDisplayNames(activeRequest ? [activeRequest.requested_by] : [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoaded(false)
    setError(null)
    void (async () => {
      const BASE = 'id, status, supply_house_id, sent_to, created_at'
      const wide = await supabase.from('bid_rfqs').select(`${BASE}, sent_via, requested_on, quote_url`).eq('bid_id', bidId).order('created_at', { ascending: false })
      let rowsOut: PriceRequestLinkRow[]
      if (!wide.error) {
        rowsOut = (wide.data ?? []) as unknown as PriceRequestLinkRow[]
      } else {
        const legacy = await supabase.from('bid_rfqs').select(BASE).eq('bid_id', bidId).order('created_at', { ascending: false })
        rowsOut = ((legacy.data ?? []) as unknown as PriceRequestLinkRow[]).map((r) => ({ ...r, sent_via: 'app', requested_on: null, quote_url: null }))
      }
      const houses = await fetchSupplyHousePickerRows().catch(() => [])
      if (cancelled) return
      setRfqs(rowsOut)
      setHouseNames(new Map(houses.map((h) => [h.id, h.name])))
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [open, bidId])

  const sources = useMemo(() => buildPriceMatrixSources(rfqs, houseNames), [rfqs, houseNames])
  const scope = useMemo(() => buildPriceMatrixScope(rows), [rows])

  // Every readable source starts ticked.
  useEffect(() => {
    setTicked(new Set(sources.readable.map((s) => s.rfq_id)))
  }, [sources.readable])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const selected: PriceMatrixSource[] = sources.readable.filter((s) => ticked.has(s.rfq_id))

  async function queueIt() {
    if (!supported) return
    setBusy(true)
    setError(null)
    const { error: err } = await db.from('bid_price_matrix_requests').insert({
      bid_id: bidId,
      bid_version_id: bidVersionId,
      requested_by: user?.id ?? null,
      scope,
      sources: selected,
      status: 'queued',
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    showToast(`Queued for the robot — ${selected.length} quote${selected.length === 1 ? '' : 's'}, ${scope.length} fixture rows.`, 'success')
    onChanged()
    onClose()
  }

  async function takeBack() {
    if (!activeRequest || !canTakeBack(activeRequest)) return
    setBusy(true)
    const { error: err } = await db.from('bid_price_matrix_requests').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', activeRequest.id).eq('status', 'queued')
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    showToast('Taken back — the robot will not pick this up.', 'success')
    onChanged()
    onClose()
  }

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <RobotGlyph />
      <div style={{ minWidth: 0, flex: 1 }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>
          {activeRequest ? `Robot pricing on ${bidLabel}` : `Ask the robot to price ${bidLabel}`}
        </h2>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {activeRequest ? statusLine(activeRequest, requesterNames[activeRequest.requested_by ?? ''] ?? null) : 'It reads the quotes in your folders and builds the best-price matrix — usually back within the hour.'}
        </div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>
        ×
      </button>
    </div>
  )

  if (activeRequest) {
    const r = activeRequest
    const summary = summarizeResult(r.result)
    return createPortal(
      <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div role="dialog" aria-modal="true" aria-label="Robot pricing status" style={panel} onMouseDown={(e) => e.stopPropagation()}>
          {header}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={eyebrow}>What it is reading</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {r.sources.length === 0 ? (
                <div style={{ padding: '0.5rem 0.7rem', ...smallMuted }}>No quote links were ticked — the robot has nothing to read on this request.</div>
              ) : (
                r.sources.map((s) => (
                  <div key={s.rfq_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--bg-muted)', fontSize: '0.8125rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: '9rem' }}>{s.house_name}</span>
                    <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {linkHostLabel(s.url)}
                    </a>
                    {s.requested_on ? <span style={smallMuted}>{s.requested_on}</span> : null}
                  </div>
                ))
              )}
            </div>
            <div style={smallMuted}>
              {r.scope.length} fixture row{r.scope.length === 1 ? '' : 's'} in the snapshot · names and counts only.
              {r.status === 'ready' && summary ? ` · ${summary}.` : ''}
              {r.status === 'blocked' && r.summary ? ` · ${r.summary}` : ''}
            </div>
          </div>
          {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            {canTakeBack(r) ? (
              <button type="button" onClick={() => void takeBack()} disabled={busy} style={{ ...btnPlain, marginRight: 'auto', color: 'var(--text-red-700)' }}>
                Take it back
              </button>
            ) : null}
            {r.status === 'ready' ? (
              <button type="button" onClick={onOpenCompare} style={btnPrimary}>
                Review the matrix
              </button>
            ) : null}
            <button type="button" onClick={onClose} style={btnPlain}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const nothingReadable = loaded && sources.readable.length === 0

  return createPortal(
    <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Ask the robot to price this bid" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        {header}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={eyebrow}>Quotes it will read</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {!loaded ? (
              <div style={{ padding: '0.5rem 0.7rem', ...smallMuted }}>Looking at the bid’s Price requests…</div>
            ) : null}
            {loaded && sources.readable.map((s) => (
              <label key={s.rfq_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.7rem', borderBottom: '1px solid var(--bg-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ticked.has(s.rfq_id)}
                  onChange={(e) => {
                    const next = new Set(ticked)
                    if (e.target.checked) next.add(s.rfq_id)
                    else next.delete(s.rfq_id)
                    setTicked(next)
                  }}
                  style={{ width: 16, height: 16, margin: 0 }}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-strong)', minWidth: '9rem' }}>{s.house_name}</span>
                <span style={{ color: 'var(--text-base)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{linkHostLabel(s.url)}</span>
                {s.requested_on ? <span style={smallMuted}>{s.requested_on}</span> : null}
              </label>
            ))}
            {loaded && sources.waiting.map((w) => (
              <div key={w.rfq_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.7rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem' }}>
                <span style={{ width: 16 }} />
                <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: '9rem' }}>{w.house_name}</span>
                <span style={{ ...smallMuted, flex: 1 }}>
                  {w.requested_on ? `requested ${w.requested_on} · ` : ''}no quote link yet — the robot skips it
                </span>
              </div>
            ))}
            {nothingReadable && sources.waiting.length === 0 ? (
              <div style={{ padding: '0.5rem 0.7rem', ...smallMuted }}>No price requests on this bid yet.</div>
            ) : null}
          </div>
          <div style={smallMuted}>
            These are the quote links on this bid’s <strong style={{ color: 'var(--text-base)' }}>Price requests</strong> table
            {priceRequestsHref ? (
              <>
                {' '}(<a href={priceRequestsHref} style={{ color: 'var(--text-link)' }}>Edit Bid → Files &amp; Links</a>)
              </>
            ) : null}
            . Paste a vendor’s PDF or folder link there and it shows up here.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={eyebrow}>What it will do</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-base)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Check />
              <span>
                Read every page and land each priced group on one of your <strong>{scope.length} fixture rows</strong> — names and counts from today’s takeoff.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Check />
              <span>Read kit subtotals as the fixture price, pull carriers from a separate sheet when the quote says so, and keep size options apart until you pick one.</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Check />
              <span>Pick the cheapest complete kit per row across every house that quoted, freight and expiry counted, and say why beside each pick. Where it would have to guess, it asks you.</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Check muted />
              <span style={{ color: 'var(--text-muted)' }}>
                It never emails a vendor and never changes your costs — <strong style={{ color: 'var(--text-base)' }}>Apply picks</strong> stays yours.
              </span>
            </div>
          </div>
        </div>

        {!supported ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-700)', background: 'var(--bg-yellow-tint)', border: '1px solid #f59e0b', borderRadius: 6, padding: '0.35rem 0.7rem' }}>
            The robot queue is not switched on yet — the database update lands with the next deploy.
          </p>
        ) : null}
        {error ? <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</p> : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          <button type="button" onClick={onClose} style={btnPlain}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void queueIt()}
            disabled={busy || !supported || !loaded || selected.length === 0 || scope.length === 0}
            title={selected.length === 0 ? 'Tick at least one quote link' : scope.length === 0 ? 'This bid has no counted fixture rows yet' : undefined}
            style={{ ...btnPrimary, opacity: busy || !supported || !loaded || selected.length === 0 || scope.length === 0 ? 0.55 : 1 }}
          >
            {busy ? 'Queuing…' : 'Queue it for the robot'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function statusLine(r: PriceMatrixRequestRow, who: string | null): string {
  const age = requestAgeLabel(r.requested_at, Date.now())
  const asked = `Queued ${age}${who ? ` by ${who}` : ''}`
  if (r.status === 'queued') return `${asked} — a robot picks it up in the next batch.`
  if (r.status === 'working') return `${asked} — working now, reading the quotes.`
  if (r.status === 'blocked') return `${asked} — blocked: it could not read a source.`
  if (r.status === 'ready') return `${asked} — the matrix is ready to review.`
  return asked
}
