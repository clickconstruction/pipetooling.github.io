import { useEffect, useState } from 'react'

import { supabase } from '../../lib/supabase'
import { itbLinkLabel } from '../../lib/itbLinks'
import { gcDetailsSummary, normalizeItbLinks, type BidGcDetailsRow } from '../../lib/bids/bidGcDetails'
import { withSupabaseRetry } from '../../utils/errorHandling'

/**
 * Per-GC due / submitted-to / ITB editor (Per-GC Phase 4, docs/PER_GC_BID_PLAN.md) — lives
 * under each GC card in Edit Bid. State is a lazily-created `bid_gcs` row (customer_id NULL =
 * the bid's own GC); the DB trigger derives `bids.bid_due_date`/`bid_due_time` from the
 * earliest OPEN due, so `onBidDueMaybeChanged` lets the form re-sync its Due fields after a
 * save (the v2.2407 don't-clobber pattern). Table reads are cast until gen-types runs
 * post-push, and everything hides when the table isn't deployed yet (Banking quirk-#17).
 */

type RawRow = Omit<BidGcDetailsRow, 'itb_links'> & { itb_links: unknown }

type Draft = {
  dueDate: string
  dueTime: string
  name: string
  phone: string
  email: string
  links: string[]
}

const INPUT_STYLE = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem' } as const

function draftFromRow(row: BidGcDetailsRow | null): Draft {
  return {
    dueDate: row?.due_date ?? '',
    dueTime: row?.due_time ? row.due_time.slice(0, 5) : '',
    name: row?.submitted_to_name ?? '',
    phone: row?.submitted_to_phone ?? '',
    email: row?.submitted_to_email ?? '',
    links: row && row.itb_links.length > 0 ? [...row.itb_links] : [],
  }
}

export function BidGcDetailsEditor({
  bidId,
  gcCustomerId,
  canEdit,
  onBidDueMaybeChanged,
}: {
  bidId: string
  /** NULL = the bid's own GC. */
  gcCustomerId: string | null
  canEdit: boolean
  /** The save may have moved the derived bids.bid_due_date/_time — re-read and sync form state. */
  onBidDueMaybeChanged?: () => void
}) {
  const [available, setAvailable] = useState(true)
  const [row, setRow] = useState<BidGcDetailsRow | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(draftFromRow(null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRow(null)
    setOpen(false)
    void (async () => {
      const q = (supabase as never as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              is: (k: string, v: null) => Promise<{ data: RawRow[] | null; error: { message: string } | null }>
              eq: (k: string, v: string) => Promise<{ data: RawRow[] | null; error: { message: string } | null }>
            }
          }
        }
      }).from('bid_gcs').select('id, bid_id, customer_id, due_date, due_time, submitted_to_name, submitted_to_phone, submitted_to_email, itb_links').eq('bid_id', bidId)
      const { data, error: e } = gcCustomerId == null ? await q.is('customer_id', null) : await q.eq('customer_id', gcCustomerId)
      if (cancelled) return
      if (e) {
        setAvailable(false) // table not deployed yet — render nothing
        return
      }
      setAvailable(true)
      const r = data?.[0] ?? null
      setRow(r ? { ...r, itb_links: normalizeItbLinks(r.itb_links) } : null)
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, gcCustomerId])

  if (!available) return null

  const summary = gcDetailsSummary(row)

  async function save() {
    if (busy) return
    setBusy(true)
    setError(null)
    const payload = {
      due_date: draft.dueDate || null,
      due_time: draft.dueDate && draft.dueTime ? draft.dueTime : null,
      submitted_to_name: draft.name.trim() || null,
      submitted_to_phone: draft.phone.trim() || null,
      submitted_to_email: draft.email.trim() || null,
      itb_links: draft.links.map((l) => l.trim()).filter(Boolean),
    }
    try {
      const table = (supabase as never as {
        from: (t: string) => {
          update: (v: object) => { eq: (k: string, v: string) => { select: (c: string) => Promise<{ data: RawRow[] | null; error: { message: string } | null }> } }
          insert: (v: object) => { select: (c: string) => Promise<{ data: RawRow[] | null; error: { message: string } | null }> }
        }
      }).from('bid_gcs')
      const res = await withSupabaseRetry(
        async () =>
          row
            ? await table.update({ ...payload, updated_at: new Date().toISOString() }).eq('id', row.id).select('id, bid_id, customer_id, due_date, due_time, submitted_to_name, submitted_to_phone, submitted_to_email, itb_links')
            : await table.insert({ bid_id: bidId, customer_id: gcCustomerId, ...payload }).select('id, bid_id, customer_id, due_date, due_time, submitted_to_name, submitted_to_phone, submitted_to_email, itb_links'),
        'save per-GC bid details',
      )
      const r = (res as RawRow[] | null)?.[0] ?? null
      if (r) setRow({ ...r, itb_links: normalizeItbLinks(r.itb_links) })
      setOpen(false)
      onBidDueMaybeChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
        {summary ? <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{summary}</span> : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setDraft(draftFromRow(row))
              setOpen(true)
            }}
            style={{ font: 'inherit', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {summary ? '✎ edit' : '＋ due / submitted to / ITB'}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', marginTop: '0.35rem', padding: '0.55rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', display: 'grid', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Due date
          <input type="date" value={draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} style={INPUT_STYLE} />
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Time
          <input type="time" value={draft.dueTime} disabled={!draft.dueDate} onChange={(e) => setDraft((d) => ({ ...d, dueTime: e.target.value }))} style={INPUT_STYLE} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 10rem', display: 'grid', gap: '0.2rem', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Submitted to — name
          <input type="text" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} style={INPUT_STYLE} />
        </label>
        <label style={{ flex: '1 1 8rem', display: 'grid', gap: '0.2rem', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Phone
          <input type="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} style={INPUT_STYLE} />
        </label>
        <label style={{ flex: '1 1 10rem', display: 'grid', gap: '0.2rem', fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>
          Email
          <input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} style={INPUT_STYLE} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-700)' }}>ITB links</span>
        {draft.links.map((link, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              type="url"
              aria-label={`ITB link ${i + 1}`}
              value={link}
              onChange={(e) => setDraft((d) => ({ ...d, links: d.links.map((l, j) => (j === i ? e.target.value : l)) }))}
              placeholder="https://app.planhub.com/… or buildingconnected.com/…"
              style={{ ...INPUT_STYLE, flex: 1, minWidth: 0 }}
            />
            {link.trim() ? <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{itbLinkLabel(link)}</span> : null}
            <button
              type="button"
              aria-label={`Remove ITB link ${i + 1}`}
              onClick={() => setDraft((d) => ({ ...d, links: d.links.filter((_, j) => j !== i) }))}
              style={{ padding: '0.2rem 0.45rem', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, links: [...d.links, ''] }))}
            style={{ padding: '0.25rem 0.55rem', fontSize: '0.76rem', background: 'var(--bg-subtle)', border: '1px dashed var(--border-strong)', borderRadius: 5, color: 'var(--text-700)', cursor: 'pointer' }}
          >
            + Add ITB link
          </button>
        </div>
      </div>
      {error ? <div style={{ fontSize: '0.74rem', color: 'var(--text-red-800)' }}>{error}</div> : null}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.28rem 0.7rem', background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>
          Cancel
        </button>
        <button type="button" onClick={() => void save()} disabled={busy} style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, padding: '0.28rem 0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
