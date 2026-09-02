/**
 * The RFQ Desk (lane B, v2.2636 — "RFQ Desk" mockup artboard 1). Every price
 * request on the bid — emailed (lane B) or copied (lane A) — as one row with
 * a progress trail (Sent → Delivered → Viewed → Quoted, bounce as the bad
 * branch), a coverage strip answering the real question ("which items does
 * NOBODY have priced?"), one-tap throttled nudges, inline bounce fixes,
 * manual Close, and the Compare door. Delivery state reads from
 * email_send_log over the rfq's Resend id (the existing webhook rail).
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import {
  canNudge,
  coverageFromCompareRows,
  deriveRfqTrail,
  rfqUrgency,
  scopeDriftCount,
  sortRfqsByUrgency,
  type DeskRfq,
  type TrailStep,
} from '../../lib/rfq/rfqDesk'
import { buildQuoteComparison, type CompareQuote } from '../../lib/rfq/quoteCompare'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

const MODAL_Z = 10050

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
  maxWidth: 940,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

type DeskRow = DeskRfq & { token: string; fixEmail?: string; sentName: string | null; sentCc: string[] }

function Trail({ steps }: { steps: TrailStep[] }) {
  const color = (s: TrailStep) =>
    s.state === 'on' ? 'var(--text-strong)' : s.state === 'bad' ? '#ef4444' : s.state === 'now' ? 'var(--text-amber-700)' : 'var(--text-faint)'
  const dot = (s: TrailStep) =>
    s.state === 'on' ? '#16a34a' : s.state === 'bad' ? '#ef4444' : s.state === 'now' ? '#f59e0b' : 'var(--border-strong)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {steps.map((s, i) => (
        <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          {i > 0 ? <span style={{ color: 'var(--text-faint)', fontSize: '0.6rem' }}>→</span> : null}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: color(s) }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot(s) }} />
            {s.label}
          </span>
        </span>
      ))}
    </span>
  )
}

export function RfqDeskModal({
  open,
  onClose,
  onCompare,
  onNewRequest,
  onChanged,
  bidId,
  bidLabel,
  rows,
}: {
  open: boolean
  onClose: () => void
  /** Open the compare view (the desk is the door). */
  onCompare: () => void
  /** Route to the Supply house list — scope there, then Send by email. */
  onNewRequest: () => void
  /** Fires after anything changed (nudge/close/resend) so chips refresh. */
  onChanged: () => void
  bidId: string
  bidLabel: string
  rows: Array<{ id: string; fixture: string; count: number }>
}) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [rfqs, setRfqs] = useState<DeskRow[]>([])
  const [quotes, setQuotes] = useState<CompareQuote[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [showBare, setShowBare] = useState(false)
  // Nudge preview-before-send: the edge function returns the exact reminder
  // email; the row shows it and asks before anything goes out.
  const [nudgePreview, setNudgePreview] = useState<{ rfqId: string; subject: string; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rfqRows, quoteRows] = await Promise.all([
        withSupabaseRetry(
          () =>
            supabase
              .from('bid_rfqs')
              .select('id, token, status, sent_to, sent_name, sent_email, sent_cc, resend_email_id, created_at, viewed_at, last_reminded_at, reminder_count, needed_by, scope')
              .eq('bid_id', bidId)
              .neq('status', 'draft')
              .order('created_at', { ascending: false }),
          'load rfqs',
        ),
        withSupabaseRetry(
          () =>
            supabase
              .from('bid_quotes')
              .select('id, supply_house_id, received_at, valid_until, bid_quote_lines(fixture, unit_price_each_cents, cant_supply, picked)')
              .eq('bid_id', bidId)
              .order('received_at'),
          'load quotes for coverage',
        ),
      ])
      const resendIds = (rfqRows ?? []).map((r) => r.resend_email_id).filter((x): x is string => !!x)
      const eventById = new Map<string, string>()
      if (resendIds.length > 0) {
        const { data: logs } = await supabase
          .from('email_send_log')
          .select('resend_email_id, last_event')
          .in('resend_email_id', resendIds)
        for (const l of logs ?? []) {
          if (l.resend_email_id && l.last_event) eventById.set(l.resend_email_id, l.last_event)
        }
      }
      setRfqs(
        (rfqRows ?? []).map((r) => {
          const scope = (r.scope ?? {}) as { lines?: Array<{ fixture?: string; count?: number }> }
          return {
            id: r.id,
            token: r.token ?? '',
            houseName: r.sent_to,
            sentName: r.sent_name ?? null,
            sentCc: (r.sent_cc as string[] | null) ?? [],
            sentEmail: r.sent_email,
            status: (r.status ?? 'sent') as DeskRfq['status'],
            createdAt: r.created_at,
            viewedAt: r.viewed_at,
            lastRemindedAt: r.last_reminded_at,
            reminderCount: r.reminder_count ?? 0,
            neededBy: r.needed_by,
            emailLastEvent: r.resend_email_id ? (eventById.get(r.resend_email_id) ?? null) : null,
            scopeLines: (Array.isArray(scope.lines) ? scope.lines : [])
              .filter((l) => typeof l.fixture === 'string')
              .map((l) => ({ fixture: l.fixture as string, count: Number(l.count) || 0 })),
          }
        }),
      )
      setQuotes(
        (quoteRows ?? [])
          .filter((q) => q.supply_house_id)
          .map((q) => ({
            id: q.id,
            supplyHouseId: q.supply_house_id!,
            houseName: '—',
            receivedAt: q.received_at,
            validUntil: q.valid_until,
            lines: (q.bid_quote_lines ?? []).map((l) => ({
              fixture: l.fixture,
              unitPriceEachCents: l.unit_price_each_cents,
              cantSupply: l.cant_supply,
              picked: l.picked,
            })),
          })),
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load the desk.', 'error')
    } finally {
      setLoading(false)
    }
  }, [bidId, showToast])

  useEffect(() => {
    if (!open) return
    setShowBare(false)
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const currentQtyByName = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = r.fixture.trim().toLowerCase()
      if (Number.isFinite(r.count) && r.count > 0) m.set(k, (m.get(k) ?? 0) + r.count)
    }
    return m
  }, [rows])

  const coverage = useMemo(() => {
    if (quotes.length === 0) return null
    const comparison = buildQuoteComparison({ quotes, currentQtyByName, today: new Date().toISOString().slice(0, 10) })
    return coverageFromCompareRows(comparison.rows)
  }, [quotes, currentQtyByName])

  async function previewNudge(rfq: DeskRow) {
    setBusy(rfq.id)
    try {
      const { data, error } = await supabase.functions.invoke('send-rfq-email', { body: { mode: 'preview', rfqId: rfq.id } })
      const res = (data ?? {}) as { ok?: boolean; previews?: Array<{ subject: string; text: string }>; error?: string }
      if (error || !res.ok || !res.previews?.[0]) throw new Error(res.error ?? error?.message ?? 'Could not build the preview')
      setNudgePreview({ rfqId: rfq.id, subject: res.previews[0].subject, text: res.previews[0].text })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not build the preview.', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function act(rfq: DeskRow, mode: 'remind' | 'resend' | 'close') {
    setBusy(rfq.id)
    try {
      if (mode === 'close') {
        const { error } = await supabase.from('bid_rfqs').update({ status: 'closed' }).eq('id', rfq.id)
        if (error) throw error
        showToast(`Closed the link for ${rfq.houseName ?? 'that vendor'} — the page now says so.`, 'success')
      } else {
        const { data, error } = await supabase.functions.invoke('send-rfq-email', {
          body: mode === 'remind' ? { mode, rfqId: rfq.id } : { mode, rfqId: rfq.id, email: (rfq.fixEmail ?? rfq.sentEmail ?? '').trim() },
        })
        const res = (data ?? {}) as { ok?: boolean; error?: string }
        if (error || !res.ok) throw new Error(res.error ?? error?.message ?? 'Send failed')
        showToast(mode === 'remind' ? `Nudged ${rfq.houseName ?? 'the vendor'}.` : `Resent to ${rfq.fixEmail ?? rfq.sentEmail}.`, 'success')
      }
      await load()
      onChanged()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'That didn’t go through.', 'error')
    } finally {
      setBusy(null)
    }
  }

  async function copyLink(rfq: DeskRow) {
    try {
      await navigator.clipboard.writeText(`https://clicktooling.com/q/${rfq.token}`)
      showToast('Link copied.', 'success')
    } catch {
      showToast('Could not copy the link.', 'error')
    }
  }

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const mini: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-faint)' }
  const ghostBtn: CSSProperties = { padding: '0.28rem 0.6rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', fontWeight: 600 }
  const blueBtn: CSSProperties = { ...ghostBtn, background: '#2563eb', color: 'white', border: 'none' }
  const now = Date.now()
  // Rung A (v2.2642): urgency order — bounced → needed-by at risk →
  // unviewed-stale → viewed-silent → fresh → quoted; oldest first in a tier.
  const openRows = sortRfqsByUrgency(rfqs.filter((r) => r.status !== 'closed'), now)
  const closedRows = rfqs.filter((r) => r.status === 'closed')

  return createPortal(
    <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Price requests" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Price requests</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bidLabel} · every request carries its own link; prices land on this bid.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={onCompare} style={{ padding: '0.4rem 0.85rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }}>Compare quotes</button>
            <button type="button" onClick={onNewRequest} style={{ padding: '0.4rem 0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }}>+ New request</button>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>×</button>
          </div>
        </div>

        {coverage ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
              <strong>{coverage.total} items</strong> · <strong style={{ color: '#15803d' }}>{coverage.priced}</strong> priced by someone
              {coverage.bare.length > 0 ? <> · <strong style={{ color: 'var(--text-amber-700)' }}>{coverage.bare.length} still bare</strong></> : ' · full coverage'}
            </span>
            <span style={{ height: 8, borderRadius: 99, flex: 1, minWidth: '6rem', background: 'var(--bg-200)', overflow: 'hidden', display: 'flex' }}>
              <span style={{ width: `${coverage.total > 0 ? Math.round((coverage.priced / coverage.total) * 100) : 0}%`, background: '#16a34a' }} />
            </span>
            {coverage.bare.length > 0 ? (
              <button type="button" style={ghostBtn} onClick={() => setShowBare((s) => !s)}>
                {showBare ? 'Hide' : 'See'} the {coverage.bare.length} bare item{coverage.bare.length === 1 ? '' : 's'}
              </button>
            ) : null}
            {showBare && coverage.bare.length > 0 ? (
              <div style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{coverage.bare.join(' · ')}</div>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading requests…</p>
        ) : rfqs.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No price requests on this bid yet — scope a list and send one.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {openRows.map((r) => {
              const trail = deriveRfqTrail(r)
              const bounced = trail.some((s) => s.state === 'bad')
              const nudge = canNudge(r, now)
              const drift = scopeDriftCount(r.scopeLines, currentQtyByName)
              const urgency = rfqUrgency(r, now)
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--bg-muted)', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: '15rem', flex: '1 1 15rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.875rem' }}>{r.houseName ?? 'Unknown house'}</div>
                    {bounced ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <input
                          aria-label={`Fix email for ${r.houseName ?? 'vendor'}`}
                          defaultValue={r.sentEmail ?? ''}
                          onChange={(e) => { r.fixEmail = e.target.value }}
                          style={{ padding: '0.22rem 0.5rem', border: '1px solid #ef4444', borderRadius: 4, font: 'inherit', fontSize: '0.72rem', background: 'var(--surface)', color: 'var(--text-strong)' }}
                        />
                        <span style={{ ...mini, color: '#ef4444' }}>bounced — fix it right here</span>
                      </div>
                    ) : (
                      <div style={mini}>
                        {r.sentName ? `${r.sentName} · ` : ''}{r.sentEmail ?? 'no email — link was copied into a text'}{r.sentCc.length > 0 ? ` (+${r.sentCc.length} cc)` : ''}
                        {r.scopeLines.length > 0 ? ` · ${r.scopeLines.length} items` : ''}
                        {r.neededBy ? ` · needed by ${r.neededBy}` : ''}
                        {r.reminderCount > 0 ? ` · nudged ×${r.reminderCount}` : ''}
                        {drift > 0 ? <span style={{ color: 'var(--text-amber-700)' }}> · counts changed since sent ({drift} line{drift === 1 ? '' : 's'})</span> : null}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                    <Trail steps={trail} />
                    {urgency.reason && !bounced ? (
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.55rem', borderRadius: 999, color: urgency.tier <= 1 ? 'var(--text-amber-700)' : 'var(--text-muted)', background: urgency.tier <= 1 ? 'var(--bg-yellow-tint)' : 'var(--bg-subtle)', border: `1px solid ${urgency.tier <= 1 ? '#f59e0b' : 'var(--border-strong)'}` }}>
                        {urgency.reason}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                    {bounced ? (
                      <button type="button" style={blueBtn} disabled={busy === r.id} onClick={() => void act(r, 'resend')}>Resend</button>
                    ) : r.status === 'quoted' ? (
                      <button type="button" style={{ ...ghostBtn, color: '#15803d', borderColor: '#16a34a' }} onClick={onCompare}>Compare</button>
                    ) : r.sentEmail ? (
                      <button type="button" style={nudge.ok ? blueBtn : { ...ghostBtn, color: 'var(--text-faint)', cursor: 'not-allowed' }} disabled={!nudge.ok || busy === r.id} title={nudge.reason ?? 'Preview the reminder before it sends'} onClick={() => void previewNudge(r)}>Nudge</button>
                    ) : null}
                    <button type="button" style={ghostBtn} onClick={() => void copyLink(r)}>Copy link</button>
                    <button type="button" style={ghostBtn} disabled={busy === r.id} onClick={() => void act(r, 'close')}>Close link</button>
                  </div>
                  {nudgePreview?.rfqId === r.id ? (
                    <div style={{ width: '100%', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This is the exact reminder — nothing sends until you say so:</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-strong)' }}>{nudgePreview.subject}</span>
                      <pre style={{ margin: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.7rem', lineHeight: 1.5, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '9rem', overflowY: 'auto' }}>{nudgePreview.text}</pre>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button type="button" style={ghostBtn} onClick={() => setNudgePreview(null)}>Cancel</button>
                        <button type="button" style={blueBtn} disabled={busy === r.id} onClick={() => { setNudgePreview(null); void act(r, 'remind') }}>Send this nudge</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
            {closedRows.length > 0 ? (
              <div style={{ padding: '0.4rem 0.8rem', ...mini }}>
                {closedRows.length} closed request{closedRows.length === 1 ? '' : 's'}: {closedRows.map((r) => r.houseName ?? '—').join(', ')}
              </div>
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={smallMuted}>Nudges are one tap and rest for 24h after any send — nobody double-taps a vendor.</span>
          <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
