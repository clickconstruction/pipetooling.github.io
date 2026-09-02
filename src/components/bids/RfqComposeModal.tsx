/**
 * RFQ compose (lane B, v2.2636 — "RFQ Desk" mockup artboard 2). Reached from
 * the Supply house list's "Send by email…" — scope rides in as {lines, text}
 * and is never re-scoped here (one scoping surface). Pick houses, each gets
 * its own email + link + bid_rfqs row via the send-rfq-email edge function.
 * Emails prefill from the newest request ever sent to that house (any bid);
 * houses with an open request on THIS bid warn instead of double-linking.
 */
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

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
  maxWidth: 760,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function RfqComposeModal({
  open,
  onClose,
  onSent,
  bidId,
  bidVersionId,
  bidLabel,
  scope,
  openRfqHouseIds,
}: {
  open: boolean
  onClose: () => void
  onSent: () => void
  bidId: string
  bidVersionId: string | null
  bidLabel: string
  scope: { lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string }
  /** Houses that already have an open (sent) request on this bid. */
  openRfqHouseIds: ReadonlySet<string>
}) {
  const { showToast } = useToastContext()
  const [houses, setHouses] = useState<Array<{ id: string; name: string }>>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [neededBy, setNeededBy] = useState('')
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState('')
  const [sending, setSending] = useState(false)
  // Preview-before-send: the edge function's `preview` mode returns the EXACT
  // email a send would produce (same builder, no writes) — what you see here
  // is what the vendor gets, byte for byte.
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [previews, setPreviews] = useState<Array<{ supplyHouseId: string; houseName: string; email: string; subject: string; html: string }>>([])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (!open) return
    setPicked(new Set())
    setNeededBy('')
    setNote('')
    setFilter('')
    setStep('edit')
    setPreviews([])
    setPreviewIdx(0)
    let cancelled = false
    void (async () => {
      try {
        const [houseRows, priorRfqs] = await Promise.all([
          withSupabaseRetry(() => supabase.from('supply_houses').select('id, name').order('name'), 'load supply houses'),
          withSupabaseRetry(
            () =>
              supabase
                .from('bid_rfqs')
                .select('supply_house_id, sent_email, created_at')
                .not('sent_email', 'is', null)
                .order('created_at', { ascending: false })
                .limit(400),
            'load prior rfq emails',
          ),
        ])
        if (cancelled) return
        setHouses((houseRows ?? []).map((h) => ({ id: h.id, name: h.name })))
        const prefill: Record<string, string> = {}
        for (const r of priorRfqs ?? []) {
          if (r.supply_house_id && r.sent_email && prefill[r.supply_house_id] === undefined) {
            prefill[r.supply_house_id] = r.sent_email
          }
        }
        setEmails(prefill)
      } catch {
        if (!cancelled) setHouses([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const ready = useMemo(
    () => [...picked].filter((id) => EMAIL_RE.test((emails[id] ?? '').trim())),
    [picked, emails],
  )

  async function loadPreview() {
    if (ready.length === 0) return
    setPreviewing(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-rfq-email', {
        body: {
          mode: 'preview',
          bidId,
          neededBy: neededBy || null,
          vendorNote: note.trim() || null,
          scope,
          requests: ready.map((id) => ({ supplyHouseId: id, email: (emails[id] ?? '').trim() })),
        },
      })
      const res = (data ?? {}) as { ok?: boolean; previews?: Array<{ supplyHouseId: string; houseName: string; email: string; subject: string; html: string }>; error?: string }
      if (error || !res.ok || !res.previews?.length) throw new Error(res.error ?? error?.message ?? 'Could not build the preview')
      setPreviews(res.previews)
      setPreviewIdx(0)
      setStep('preview')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not build the preview.', 'error')
    } finally {
      setPreviewing(false)
    }
  }

  async function send() {
    if (ready.length === 0) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-rfq-email', {
        body: {
          mode: 'send',
          bidId,
          bidVersionId,
          neededBy: neededBy || null,
          vendorNote: note.trim() || null,
          scope,
          requests: ready.map((id) => ({ supplyHouseId: id, email: (emails[id] ?? '').trim() })),
        },
      })
      const res = (data ?? {}) as { ok?: boolean; results?: Array<{ ok: boolean; error?: string }> }
      if (error || !res.ok) throw new Error(error?.message ?? res.results?.find((r) => !r.ok)?.error ?? 'Send failed')
      const failed = (res.results ?? []).filter((r) => !r.ok).length
      showToast(
        failed === 0
          ? `Sent ${ready.length} price request${ready.length === 1 ? '' : 's'} — watch them on the desk.`
          : `Sent ${ready.length - failed} of ${ready.length} — the desk shows what needs fixing.`,
        failed === 0 ? 'success' : 'error',
      )
      onSent()
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not send the requests.', 'error')
    } finally {
      setSending(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const input: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }
  const needle = filter.trim().toLowerCase()
  const visibleHouses = needle ? houses.filter((h) => h.name.toLowerCase().includes(needle)) : houses

  return createPortal(
    <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Send price requests" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Send price requests</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bidLabel} · {scope.lines.length} items, scoped on the Supply house list. Each house gets its own email and its own link.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>×</button>
        </div>

        {step === 'preview' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={smallMuted}>This is the exact email — one per house:</span>
              {previews.map((p, i) => (
                <button key={p.supplyHouseId} type="button" onClick={() => setPreviewIdx(i)} style={{ padding: '0.25rem 0.7rem', borderRadius: 999, border: `1px solid ${i === previewIdx ? '#2563eb' : 'var(--border-strong)'}`, background: i === previewIdx ? '#2563eb' : 'var(--surface)', color: i === previewIdx ? 'white' : 'var(--text-strong)', font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                  {p.houseName}
                </button>
              ))}
            </div>
            {previews[previewIdx] ? (
              <div data-theme="light" style={{ border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: '#f6f7f9' }}>
                <div style={{ padding: '0.5rem 0.9rem', borderBottom: '1px solid #e4e8f0', fontSize: '0.75rem', color: '#5b6577' }}>
                  To: <b style={{ color: '#1c2434' }}>{previews[previewIdx].email}</b> · Subject: <b style={{ color: '#1c2434' }}>{previews[previewIdx].subject}</b>
                </div>
                <div style={{ padding: '0.75rem 1rem', maxHeight: '46vh', overflowY: 'auto' }} dangerouslySetInnerHTML={{ __html: previews[previewIdx].html }} />
              </div>
            ) : null}
            <p style={{ ...smallMuted, margin: 0 }}>The link button is a placeholder here — each house's real link is minted the moment you hit Send.</p>
          </>
        ) : (
          <>
        <pre style={{ margin: 0, padding: '0.55rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.72rem', lineHeight: 1.5, color: 'var(--text-muted)', maxHeight: '7.5rem', overflow: 'hidden' }}>{scope.text}</pre>

        <input style={{ ...input, width: '14rem' }} placeholder="find a supply house…" value={filter} onChange={(e) => setFilter(e.target.value)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '38vh', overflowY: 'auto' }}>
          {visibleHouses.map((h) => {
            const on = picked.has(h.id)
            const hasOpen = openRfqHouseIds.has(h.id)
            const email = emails[h.id] ?? ''
            const bad = on && email.trim() !== '' && !EMAIL_RE.test(email.trim())
            return (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', border: `1px solid ${hasOpen ? '#f59e0b' : 'var(--border)'}`, borderRadius: 8, padding: '0.45rem 0.7rem', background: on ? 'var(--bg-subtle)' : 'var(--surface)' }}>
                <input
                  type="checkbox"
                  checked={on}
                  aria-label={`Send to ${h.name}`}
                  onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(h.id)) n.delete(h.id); else n.add(h.id); return n })}
                />
                <span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.875rem', minWidth: '10rem' }}>{h.name}</span>
                <input
                  style={{ ...input, flex: 1, borderColor: bad ? '#ef4444' : undefined }}
                  placeholder="add an email…"
                  aria-label={`Email for ${h.name}`}
                  value={email}
                  onChange={(e) => setEmails((m) => ({ ...m, [h.id]: e.target.value }))}
                />
                {hasOpen ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>already has an open request — nudge it from the desk instead?</span> : null}
              </div>
            )
          })}
          {visibleHouses.length === 0 ? <p style={{ ...smallMuted, margin: 0 }}>No supply house matches that.</p> : null}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ ...smallMuted, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            needed by
            <input type="date" style={input} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </label>
          <input style={{ ...input, flex: 1, minWidth: '14rem' }} placeholder="note to vendors (optional) — e.g. bid due Friday, even a partial list helps" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={smallMuted}>Replies go straight to your inbox — a vendor who answers by email is just a paste away from a quote.</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {step === 'preview' ? (
              <>
                <button type="button" onClick={() => setStep('edit')} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
                  ‹ Back to edit
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void send()}
                  style={{ padding: '0.5rem 1.1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: sending ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
                >
                  {sending ? 'Sending…' : `Send ${ready.length} request${ready.length === 1 ? '' : 's'}`}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={previewing || ready.length === 0}
                onClick={() => void loadPreview()}
                style={{ padding: '0.5rem 1.1rem', background: ready.length === 0 ? 'var(--bg-200)' : '#2563eb', color: ready.length === 0 ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: previewing || ready.length === 0 ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
              >
                {previewing ? 'Building preview…' : `Preview ${ready.length || ''} email${ready.length === 1 ? '' : 's'} →`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
