/**
 * Per-house contacts editor (RFQ Round 2 Rung D, v2.2648 — "RFQ Desk" canvas
 * artboard 8). Rendered inside SupplyHouseForm when editing an existing
 * house. Rows live in supply_house_contacts (the v2.1605 org-wide shortlist
 * table, extended with supply_house_id) — these are the To/CC chips the RFQ
 * compose offers. Archive, never delete: sent requests reference them.
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react'

import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { useToastContext } from '../contexts/ToastContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ContactRow = { id: string; name: string | null; email: string; label: string | null; is_default: boolean }

export function SupplyHouseContactsSection({ supplyHouseId }: { supplyHouseId: string }) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<ContactRow[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase
            .from('supply_house_contacts')
            .select('id, name, email, label, is_default')
            .eq('supply_house_id', supplyHouseId)
            .is('archived_at', null)
            .order('is_default', { ascending: false })
            .order('name'),
        'load supply house contacts',
      )
      setRows(data ?? [])
    } catch {
      setRows([])
    }
  }, [supplyHouseId])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    if (!EMAIL_RE.test(email.trim())) return
    setBusy(true)
    try {
      const { error } = await supabase.from('supply_house_contacts').insert({
        supply_house_id: supplyHouseId,
        name: name.trim() || email.trim().split('@')[0],
        email: email.trim(),
        label: label.trim() || '',
        is_default: rows.length === 0,
      })
      if (error) throw error
      setName('')
      setEmail('')
      setLabel('')
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add the contact.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function makeDefault(id: string) {
    setBusy(true)
    try {
      const { error: clearErr } = await supabase
        .from('supply_house_contacts')
        .update({ is_default: false })
        .eq('supply_house_id', supplyHouseId)
      if (clearErr) throw clearErr
      const { error } = await supabase.from('supply_house_contacts').update({ is_default: true }).eq('id', id)
      if (error) throw error
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not set the default.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function archive(id: string) {
    setBusy(true)
    try {
      const { error } = await supabase
        .from('supply_house_contacts')
        .update({ archived_at: new Date().toISOString(), is_default: false })
        .eq('id', id)
      if (error) throw error
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not archive the contact.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const inp: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)' }
  const mini: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-faint)' }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Contacts — who price requests go to
      </span>
      {rows.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>{r.name ?? r.email}</span>
          <span style={mini}>{r.email}{r.label ? ` · ${r.label}` : ''}</span>
          {r.is_default ? (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803d', border: '1px solid #16a34a', borderRadius: 999, padding: '0.05rem 0.5rem' }}>default</span>
          ) : (
            <button type="button" disabled={busy} onClick={() => void makeDefault(r.id)} style={{ font: 'inherit', fontSize: '0.68rem', padding: '0.1rem 0.5rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 999, cursor: 'pointer' }}>
              make default
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => void archive(r.id)} title="Archive (past requests keep their history)" style={{ font: 'inherit', fontSize: '0.75rem', background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', marginLeft: 'auto' }}>
            ×
          </button>
        </div>
      ))}
      {rows.length === 0 ? <span style={mini}>No contacts yet — the first one added becomes the default.</span> : null}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        <input style={{ ...inp, width: '8rem' }} placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={{ ...inp, flex: 1, minWidth: '11rem' }} placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input style={{ ...inp, width: '7.5rem' }} placeholder="label (rep…)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" disabled={busy || !EMAIL_RE.test(email.trim())} onClick={() => void add()} style={{ padding: '0.35rem 0.8rem', background: EMAIL_RE.test(email.trim()) ? '#2563eb' : 'var(--bg-200)', color: EMAIL_RE.test(email.trim()) ? 'white' : 'var(--text-faint)', border: 'none', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: EMAIL_RE.test(email.trim()) ? 'pointer' : 'not-allowed' }}>
          + add contact
        </button>
      </div>
    </div>
  )
}
