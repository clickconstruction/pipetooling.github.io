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
  plansLink,
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
  /** Rung A (v2.2642): the bid's shareable plans link (bids.plans_link ONLY — never internal tooling links). */
  plansLink?: string | null
}) {
  const { showToast } = useToastContext()
  const [houses, setHouses] = useState<Array<{ id: string; name: string }>>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  // Rung D (v2.2648): per-house contacts. sel[houseId] = who's To (contact id
  // or 'custom'), which contacts ride as CC, the free-text escape hatch, and
  // whether to remember it. Tap a chip to cycle Off → CC → To.
  const [contacts, setContacts] = useState<Record<string, Array<{ id: string; name: string; email: string; label: string | null; isDefault: boolean }>>>({})
  const [sel, setSel] = useState<Record<string, { to: string | null; cc: Set<string>; custom: string; remember: boolean }>>({})
  const [neededBy, setNeededBy] = useState('')
  const [note, setNote] = useState('')
  const [includePlans, setIncludePlans] = useState(true)
  const [filter, setFilter] = useState('')
  const [sending, setSending] = useState(false)
  // Preview-before-send: the edge function's `preview` mode returns the EXACT
  // email a send would produce (same builder, no writes) — what you see here
  // is what the vendor gets, byte for byte.
  const [step, setStep] = useState<'edit' | 'preview'>('edit')
  const [previews, setPreviews] = useState<Array<{ supplyHouseId: string; houseName: string; email: string; cc?: string[]; subject: string; html: string }>>([])
  const [previewIdx, setPreviewIdx] = useState(0)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    if (!open) return
    setPicked(new Set())
    setSel({})
    setNeededBy('')
    setNote('')
    setFilter('')
    setIncludePlans(true)
    setStep('edit')
    setPreviews([])
    setPreviewIdx(0)
    let cancelled = false
    void (async () => {
      try {
        const [houseRows, contactRows] = await Promise.all([
          withSupabaseRetry(() => supabase.from('supply_houses').select('id, name').order('name'), 'load supply houses'),
          withSupabaseRetry(
            () =>
              supabase
                .from('supply_house_contacts')
                .select('id, supply_house_id, name, email, label, is_default')
                .not('supply_house_id', 'is', null)
                .is('archived_at', null)
                .order('is_default', { ascending: false })
                .order('name'),
            'load supply house contacts',
          ),
        ])
        if (cancelled) return
        setHouses((houseRows ?? []).map((h) => ({ id: h.id, name: h.name })))
        const byHouse: Record<string, Array<{ id: string; name: string; email: string; label: string | null; isDefault: boolean }>> = {}
        for (const c of contactRows ?? []) {
          if (!c.supply_house_id) continue
          ;(byHouse[c.supply_house_id] ??= []).push({ id: c.id, name: c.name ?? c.label ?? c.email, email: c.email, label: c.label, isDefault: c.is_default })
        }
        setContacts(byHouse)
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

  const selFor = (houseId: string) => {
    const existing = sel[houseId]
    if (existing) return existing
    const list = contacts[houseId] ?? []
    const def = list.find((c) => c.isDefault) ?? list[0]
    return { to: def?.id ?? null, cc: new Set<string>(), custom: '', remember: (contacts[houseId] ?? []).length === 0 }
  }

  /** Resolve a house's selection into a concrete request, or null when not sendable. */
  function resolve(houseId: string): { email: string; name: string | null; cc: string[] } | null {
    const s2 = selFor(houseId)
    const list = contacts[houseId] ?? []
    const custom = s2.custom.trim()
    const toContact = s2.to && s2.to !== 'custom' ? list.find((c) => c.id === s2.to) : undefined
    const to = toContact ?? (custom && EMAIL_RE.test(custom) ? { email: custom, name: null as string | null } : undefined)
    if (!to) return null
    const cc = list.filter((c) => s2.cc.has(c.id) && c.email !== to.email).map((c) => c.email)
    if (toContact && custom && EMAIL_RE.test(custom) && custom !== to.email) cc.push(custom)
    return { email: to.email, name: 'name' in to ? (to.name as string | null) : null, cc }
  }

  const ready = useMemo(
    () => [...picked].filter((id) => resolve(id) != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve reads contacts/sel
    [picked, sel, contacts],
  )

  /** Cycle a contact chip: Off → CC → To (promoting demotes the old To to CC). */
  function cycleChip(houseId: string, contactId: string) {
    setSel((m) => {
      const cur = { ...selFor(houseId), cc: new Set(selFor(houseId).cc) }
      if (cur.to === contactId) {
        // Full cycle: tapping the To chip turns it off — the free-text
        // address (if valid) becomes To, so a brand-new rep can be the To.
        cur.to = null
        return { ...m, [houseId]: cur }
      }
      if (cur.cc.has(contactId)) {
        cur.cc.delete(contactId)
        if (cur.to && cur.to !== 'custom') cur.cc.add(cur.to)
        cur.to = contactId
      } else {
        cur.cc.add(contactId)
      }
      return { ...m, [houseId]: cur }
    })
  }

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
          plansLink: includePlans && plansLink ? plansLink : null,
          scope,
          requests: ready.map((id) => {
            const r = resolve(id)!
            return { supplyHouseId: id, email: r.email, name: r.name, cc: r.cc }
          }),
        },
      })
      const res = (data ?? {}) as { ok?: boolean; previews?: Array<{ supplyHouseId: string; houseName: string; email: string; cc?: string[]; subject: string; html: string }>; error?: string }
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
          plansLink: includePlans && plansLink ? plansLink : null,
          scope,
          requests: ready.map((id) => {
            const r = resolve(id)!
            return { supplyHouseId: id, email: r.email, name: r.name, cc: r.cc }
          }),
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
      // Remember free-text addresses as contacts (best effort, after the send).
      const toRemember = ready
        .map((id) => ({ id, s: selFor(id) }))
        .filter(({ id, s: s3 }) => s3.remember && s3.custom.trim() && EMAIL_RE.test(s3.custom.trim()) && !(contacts[id] ?? []).some((c) => c.email === s3.custom.trim()))
        .map(({ id, s: s3 }) => ({
          supply_house_id: id,
          name: s3.custom.trim().split('@')[0] ?? s3.custom.trim(),
          email: s3.custom.trim(),
          label: 'from a request',
          is_default: (contacts[id] ?? []).length === 0,
        }))
      if (toRemember.length > 0) {
        const { error: cErr } = await supabase.from('supply_house_contacts').insert(toRemember)
        if (cErr) showToast('Sent, but couldn’t save the new contact — add it on the supply house.', 'error')
      }
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
                  To: <b style={{ color: '#1c2434' }}>{previews[previewIdx].email}</b>
                  {previews[previewIdx].cc?.length ? <> · CC: <b style={{ color: '#1c2434' }}>{previews[previewIdx].cc.join(', ')}</b></> : null} · Subject: <b style={{ color: '#1c2434' }}>{previews[previewIdx].subject}</b>
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
            const list = contacts[h.id] ?? []
            const s3 = selFor(h.id)
            const custom = s3.custom.trim()
            const bad = on && custom !== '' && !EMAIL_RE.test(custom)
            return (
              <div key={h.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: `1px solid ${hasOpen ? '#f59e0b' : 'var(--border)'}`, borderRadius: 8, padding: '0.45rem 0.7rem', background: on ? 'var(--bg-subtle)' : 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="checkbox"
                    checked={on}
                    aria-label={`Send to ${h.name}`}
                    onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(h.id)) n.delete(h.id); else n.add(h.id); return n })}
                  />
                  <span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.875rem' }}>{h.name}</span>
                  <span style={smallMuted}>{list.length === 0 ? 'no contacts yet' : `${list.length} contact${list.length === 1 ? '' : 's'}`}</span>
                  {hasOpen ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)', marginLeft: 'auto' }}>already has an open request — nudge it from the desk instead?</span> : null}
                </div>
                {on ? (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', paddingLeft: '1.6rem' }}>
                    {list.map((c) => {
                      const isTo = s3.to === c.id
                      const isCc = s3.cc.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => cycleChip(h.id, c.id)}
                          title={isTo ? `${c.email} — the To address; tap to unset` : isCc ? `${c.email} — CC'd; tap to make To` : `${c.email} — tap to CC`}
                          style={{
                            padding: '0.22rem 0.65rem',
                            borderRadius: 999,
                            font: 'inherit',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: isTo ? '1px solid #2563eb' : isCc ? '1px solid var(--border-strong)' : '1px dashed var(--border-strong)',
                            background: isTo ? '#2563eb' : isCc ? 'var(--bg-muted)' : 'transparent',
                            color: isTo ? 'white' : isCc ? 'var(--text-strong)' : 'var(--text-faint)',
                          }}
                        >
                          {isTo ? 'To · ' : isCc ? 'CC · ' : ''}{c.name}{c.label ? ` (${c.label})` : ''}
                        </button>
                      )
                    })}
                    <input
                      style={{ ...input, minWidth: '12rem', flex: 1, borderColor: bad ? '#ef4444' : undefined }}
                      placeholder={list.length === 0 ? 'add an email…' : 'CC someone else…'}
                      aria-label={`Email for ${h.name}`}
                      value={s3.custom}
                      onChange={(e) => setSel((m) => ({ ...m, [h.id]: { ...selFor(h.id), custom: e.target.value } }))}
                    />
                    {custom && !bad ? (
                      <label style={{ ...smallMuted, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={s3.remember} onChange={(e) => setSel((m) => ({ ...m, [h.id]: { ...selFor(h.id), remember: e.target.checked } }))} />
                        remember as {h.name}’s contact
                      </label>
                    ) : null}
                  </div>
                ) : null}
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

        {plansLink ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.7rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={includePlans} onChange={(e) => setIncludePlans(e.target.checked)} />
            <span>
              Include the <strong>job plans link</strong> — vendors can open cut sheets before pricing fixtures
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)' }}>rides the request, its reminders, and the quote page · make sure the link itself is shareable</span>
            </span>
          </label>
        ) : null}
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
