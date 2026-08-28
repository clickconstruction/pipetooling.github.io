import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { toDatetimeLocal, fromDatetimeLocal } from '../../utils/datetimeLocal'
import { ContactMethodQuickPicks } from '../shared/ContactMethodQuickPicks'

/**
 * Edit Bid → "Last Contact" (Per-GC bids Phase 1, docs/PER_GC_BID_PLAN.md): the raw
 * datetime field is gone on saved bids — a contact IS a `bids_submission_entries` row
 * (method required; the entries sync trigger derives `bids.last_contact` from method
 * entries). This control shows the derived value read-only and logs new contacts.
 * On multi-GC bids a GC picker attributes the entry (own GC = null, the ledger's rule).
 */

type GcOption = { id: string | null; name: string }

export function BidLogContactControl({
  bidId,
  lastContactLocal,
  onLogged,
  onOpenChange,
}: {
  bidId: string
  /** The form's datetime-local string ('' = never contacted). */
  lastContactLocal: string
  /** Sync the form state so Save writes the same value the trigger derives. */
  onLogged: (newLocal: string) => void
  /** Fires as the inline editor opens/closes — the parent form gates its own Save on it. */
  onOpenChange?: (open: boolean) => void
}) {
  const { showToast } = useToastContext()
  const { user: authUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [method, setMethod] = useState<string | null>(null)
  const [whenLocal, setWhenLocal] = useState('')
  const [note, setNote] = useState('')
  const [gcOptions, setGcOptions] = useState<GcOption[] | null>(null)
  const [gcId, setGcId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // A form submit while the editor is open would discard the half-entered contact —
  // keep the parent informed so it can gate its Save, and release it on unmount.
  useEffect(() => {
    onOpenChange?.(open)
    return () => onOpenChange?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The form seeds from the board row, which can be stale (a contact logged since the last
  // board load) — refresh from the DB on open so Save can never write an old value back.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('bids').select('last_contact').eq('id', bidId).maybeSingle()
      if (cancelled || !data) return
      const local = data.last_contact ? toDatetimeLocal(data.last_contact) : ''
      onLogged(local)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId])

  async function openEditor() {
    setOpen(true)
    setMethod(null)
    setNote('')
    setWhenLocal(toDatetimeLocal(new Date().toISOString()))
    setGcId(null)
    if (gcOptions === null) {
      // GC options only matter on multi-GC bids — versions with a customer override + recipients.
      const [vRes, rRes] = await Promise.all([
        supabase.from('bid_versions').select('customer_id').eq('bid_id', bidId).not('customer_id', 'is', null),
        supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', bidId),
      ])
      const ids = new Set<string>()
      for (const v of vRes.data ?? []) if (v.customer_id) ids.add(v.customer_id)
      type RecRow = { customer_id: string; customers: { name: string | null } | { name: string | null }[] | null }
      const names: Record<string, string> = {}
      for (const r of (rRes.data ?? []) as RecRow[]) {
        ids.add(r.customer_id)
        names[r.customer_id] = (Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name) ?? '—'
      }
      const missing = [...ids].filter((id) => !names[id])
      if (missing.length > 0) {
        const { data } = await supabase.from('customers').select('id, name').in('id', missing)
        for (const c of data ?? []) names[c.id] = c.name ?? '—'
      }
      setGcOptions([{ id: null, name: "This bid's GC" }, ...[...ids].map((id) => ({ id, name: names[id] ?? '—' }))])
    }
  }

  async function save() {
    if (!method) {
      showToast('Pick how you reached them — a contact needs a method.', 'error')
      return
    }
    const iso = fromDatetimeLocal(whenLocal)
    if (!iso) {
      showToast('Pick when the contact happened.', 'error')
      return
    }
    setSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('bids_submission_entries').insert({
            bid_id: bidId,
            gc_customer_id: gcId,
            contact_method: method,
            notes: note.trim() || null,
            occurred_at: iso,
            created_by: authUser?.id ?? null,
          }),
        'log bid contact',
      )
      // The entry insert fired the sync trigger — read the derived value back for the form.
      const fresh = await withSupabaseRetry(
        async () => supabase.from('bids').select('last_contact').eq('id', bidId).maybeSingle(),
        'bid last-contact re-read',
      )
      const derivedIso = (fresh as { last_contact: string | null } | null)?.last_contact ?? iso
      onLogged(toDatetimeLocal(derivedIso))
      window.dispatchEvent(new Event('bid-gc-notes-changed'))
      showToast('Contact logged.', 'success')
      setOpen(false)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not log the contact'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const multiGc = (gcOptions?.length ?? 0) > 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-subtle)', fontSize: '0.875rem', color: lastContactLocal ? 'var(--text-strong)' : 'var(--text-muted)', flex: '1 1 auto', minWidth: '9rem' }}>
          {lastContactLocal ? lastContactLocal.replace('T', ' · ') : 'No contact logged yet'}
        </span>
        {!open ? (
          <button
            type="button"
            onClick={() => void openEditor()}
            style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, padding: '0.4rem 0.8rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Log contact…
          </button>
        ) : null}
      </div>
      {open ? (
        <div style={{ marginTop: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <ContactMethodQuickPicks onPick={(v) => setMethod(v)} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: method ? 'var(--text-strong)' : 'var(--text-muted)' }}>{method ?? 'How did you reach them?'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="datetime-local" value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)} aria-label="When the contact happened" style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
            {multiGc ? (
              <select value={gcId ?? ''} onChange={(e) => setGcId(e.target.value || null)} aria-label="Which GC this contact was with" style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, maxWidth: '14rem' }}>
                {(gcOptions ?? []).map((o) => (
                  <option key={o.id ?? ''} value={o.id ?? ''}>{o.name}</option>
                ))}
              </select>
            ) : null}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said (optional — lands in the bid's notes)" rows={2} style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setOpen(false)} disabled={saving} style={{ font: 'inherit', fontSize: '0.8125rem', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={saving || !method} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, padding: '0.35rem 0.9rem', border: 'none', borderRadius: 5, background: '#3b82f6', color: '#fff', cursor: saving ? 'wait' : 'pointer', opacity: !method ? 0.6 : 1 }}>
              {saving ? 'Logging…' : 'Log contact'}
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        Contacts land in the bid's notes; only real contacts (with a method) move this clock.
      </div>
    </div>
  )
}
