import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'

const db = supabase as unknown as SupabaseClient

/**
 * Settings → Jobs & dispatch: the collections law firm (Legal portal PR 2,
 * v2.3313). One active row in legal_firms — its name, the handling person and
 * their email (who hears about a release today), and the fee model the Legal
 * desk's worth panel uses. Dev-only (RLS). Self-contained like the sub-portal
 * pay block beside it.
 */
type Form = { id: string | null; name: string; handling_name: string; email: string; phone: string; contingency_pct: string; filing_cost: string }
type Particulars = { entity: string; license: string; agent: string; custodian: string; affiant: string; phone: string; email: string; w9: string }
const EMPTY_PARTICULARS: Particulars = { entity: '', license: '', agent: '', custodian: '', affiant: '', phone: '', email: '', w9: '' }
const PARTICULARS_KEY = 'legal_particulars_v1'
const EMPTY: Form = { id: null, name: '', handling_name: '', email: '', phone: '', contingency_pct: '33', filing_cost: '350' }

export default function LegalFirmSettingsBlock() {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [form, setForm] = useState<Form>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [available, setAvailable] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [particulars, setParticulars] = useState<Particulars>(EMPTY_PARTICULARS)
  const [pDirty, setPDirty] = useState(false)
  const [pSaving, setPSaving] = useState(false)

  useEffect(() => {
    if (role !== 'dev') return
    void (async () => {
      const { data } = await db.from('app_settings').select('value_text').eq('key', PARTICULARS_KEY).maybeSingle()
      try {
        const parsed = JSON.parse(((data as { value_text?: string | null } | null)?.value_text ?? '') || '{}') as Partial<Particulars>
        setParticulars({ ...EMPTY_PARTICULARS, ...parsed })
      } catch {
        setParticulars(EMPTY_PARTICULARS)
      }
    })()
  }, [role])

  useEffect(() => {
    if (role !== 'dev') return
    void (async () => {
      const { data, error } = await db.from('legal_firms').select('id, name, handling_name, email, phone, contingency_pct, filing_cost, active').eq('active', true).order('created_at').limit(1)
      if (error) {
        setAvailable(false)
        setLoaded(true)
        return
      }
      const row = (data ?? [])[0] as { id: string; name: string; handling_name: string; email: string; phone: string; contingency_pct: number; filing_cost: number } | undefined
      if (row) setForm({ id: row.id, name: row.name, handling_name: row.handling_name, email: row.email, phone: row.phone, contingency_pct: String(row.contingency_pct), filing_cost: String(row.filing_cost) })
      setLoaded(true)
    })()
  }, [role])

  if (role !== 'dev') return null

  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setDirty(true)
  }

  const save = async () => {
    const pct = Number(form.contingency_pct)
    const cost = Number(form.filing_cost)
    if (!form.name.trim()) {
      showToast('Give the firm a name.', 'error')
      return
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !Number.isFinite(cost) || cost < 0) {
      showToast('Contingency is a percent (0–100); the filing cost is dollars.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), handling_name: form.handling_name.trim(), email: form.email.trim(), phone: form.phone.trim(), contingency_pct: pct, filing_cost: cost, active: true, updated_at: new Date().toISOString() }
      const res = form.id ? await db.from('legal_firms').update(payload).eq('id', form.id).select('id').single() : await db.from('legal_firms').insert(payload).select('id').single()
      if (res.error) {
        showToast(`Could not save: ${res.error.message}`, 'error')
        return
      }
      setForm((f) => ({ ...f, id: (res.data as { id: string }).id }))
      setDirty(false)
      showToast('Law firm saved. The Legal desk reads it now.', 'success')
    } finally {
      setSaving(false)
    }
  }

  const setP = (k: keyof Particulars) => (e: { target: { value: string } }) => {
    setParticulars((p) => ({ ...p, [k]: e.target.value }))
    setPDirty(true)
  }
  const saveParticulars = async () => {
    setPSaving(true)
    try {
      const { error } = await db.from('app_settings').upsert([{ key: PARTICULARS_KEY, value_text: JSON.stringify(particulars) }])
      if (error) {
        showToast(`Could not save: ${error.message}`, 'error')
        return
      }
      setPDirty(false)
      showToast('Particulars saved. The firm’s portal shows them now.', 'success')
    } finally {
      setPSaving(false)
    }
  }

  const input = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem' } as const
  const label = { display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' } as const

  return (
    <div id="settings-legal-firm" style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>⚖ Collections law firm</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Who the Legal desk releases accounts to, and the fee model behind “Click keeps”. One firm today.</span>
      </div>
      {!available ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>The legal tables aren’t on this database yet — apply the v2.3313 migration first.</p>
      ) : !loaded ? (
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.75rem 0 0' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: '0.75rem' }}>
            <label style={label}>Firm<input style={input} value={form.name} onChange={set('name')} placeholder="Example Law Firm, PLLC" /></label>
            <label style={label}>Handling person<input style={input} value={form.handling_name} onChange={set('handling_name')} placeholder="A. Attorney" /></label>
            <label style={label}>Email (contact — the firm’s people subscribe on their portal)<input style={input} type="email" value={form.email} onChange={set('email')} placeholder="attorney@firm.example" /></label>
            <label style={label}>Phone<input style={input} value={form.phone} onChange={set('phone')} /></label>
            <label style={label}>Contingency %<input style={input} type="number" min={0} max={100} step={1} value={form.contingency_pct} onChange={set('contingency_pct')} /></label>
            <label style={label}>Filing cost ($)<input style={input} type="number" min={0} step={1} value={form.filing_cost} onChange={set('filing_cost')} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <button type="button" onClick={() => void save()} disabled={!dirty || saving} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: dirty ? 'var(--text-700)' : 'var(--bg-muted)', color: dirty ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: dirty ? 'pointer' : 'default' }}>
              {saving ? 'Saving…' : form.id ? 'Save firm' : 'Add firm'}
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>The firm’s own people and their email rules arrive with the portal.</span>
          </div>
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem' }}>Click’s particulars for filing</h4>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>What a petition or lien affidavit needs from the claimant — shown on the firm’s portal.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: '0.75rem' }}>
              <label style={label}>Legal entity<input style={input} value={particulars.entity} onChange={setP('entity')} placeholder="Click Plumbing and Electrical, LLC" /></label>
              <label style={label}>License<input style={input} value={particulars.license} onChange={setP('license')} placeholder="TX RMP M-…" /></label>
              <label style={label}>Registered agent<input style={input} value={particulars.agent} onChange={setP('agent')} /></label>
              <label style={label}>Custodian of records<input style={input} value={particulars.custodian} onChange={setP('custodian')} placeholder="Who signs the business-records affidavit" /></label>
              <label style={label}>Affiant for sworn accounts<input style={input} value={particulars.affiant} onChange={setP('affiant')} /></label>
              <label style={label}>Office phone<input style={input} value={particulars.phone} onChange={setP('phone')} /></label>
              <label style={label}>Office email<input style={input} value={particulars.email} onChange={setP('email')} /></label>
              <label style={label}>W-9 / EIN note<input style={input} value={particulars.w9} onChange={setP('w9')} placeholder="on request from the office" /></label>
            </div>
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={() => void saveParticulars()} disabled={!pDirty || pSaving} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: pDirty ? 'var(--text-700)' : 'var(--bg-muted)', color: pDirty ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: pDirty ? 'pointer' : 'default' }}>
                {pSaving ? 'Saving…' : 'Save particulars'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
