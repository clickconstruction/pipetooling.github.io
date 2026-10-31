import { useEffect, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useHoldsUnsavedWork } from '../../hooks/useHoldsUnsavedWork'
import { useReloadDraft } from '../../hooks/useReloadDraft'
import { DRAFT_RESTORED_TOAST, draftStorageKey } from '../../lib/reloadDraft'
import { legalFirmSaveErrorWords } from '../../lib/legal/legalFirmSave'
import { legalFirmInputProblem } from '../../lib/legal/legalFirmFacts'
import { countiesLine, type FirmHue } from '../../lib/legal/firmCounties'
import { EMPTY_FIRM_FORM, firmToForm, type LegalFirmForm } from '../../lib/legal/legalFirmForm'
import type { LegalFirmRow } from '../../lib/legal/legalMatters'

const db = supabase as unknown as SupabaseClient


const input = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text)', fontSize: '0.9rem' } as const
const label = { display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' } as const

/**
 * One collections law firm: its details form, and on Settings the card around it (v2.5756,
 * punch list #144). Pressing the card picks the firm for the county map; the picked card
 * wears the firm's hue on its edge and says its counties in words. A firm that exists opens
 * folded to its facts, with *Edit details* for the form; a new firm opens on the form. In
 * the Legal desk's firm window (`bare`) it is the form alone, as before v2.5756.
 */
export default function LegalFirmCard({ firm, hue, counties, alsoIn, picked, bare = false, startOpen = false, firmFacts = null, onPick, onSaved, onDiscard }: {
  firm: LegalFirmRow | null
  hue?: FirmHue
  counties?: ReadonlyArray<string>
  /** The counties among them the firm covers without being first call (v2.6227): the line marks them `(also)`. */
  alsoIn?: ReadonlySet<string>
  picked?: boolean
  bare?: boolean
  startOpen?: boolean
  firmFacts?: ReactNode
  onPick?: () => void
  onSaved: (row: LegalFirmRow) => void
  onDiscard?: () => void
}) {
  const { showToast } = useToastContext()
  const [form, setForm] = useState<LegalFirmForm>(firm ? firmToForm(firm) : EMPTY_FIRM_FORM)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(bare || startOpen || !firm)
  useHoldsUnsavedWork(saving, 'Legal firm settings')
  // v2.3742: unsaved edits live in a per-tab draft, so the auto-reload may land over them.
  const draft = useReloadDraft<LegalFirmForm>(draftStorageKey('legal-firm', `form-${firm?.id ?? 'new'}`))
  useEffect(() => {
    if (dirty) draft.write(form)
  }, [dirty, form, draft])
  useEffect(() => {
    const kept = draft.read()
    if (kept) {
      setForm({ ...kept, id: firm?.id ?? kept.id })
      setDirty(true)
      setOpen(true)
      showToast(DRAFT_RESTORED_TOAST, 'success')
    }
    // Once, when the card mounts for this firm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: keyof LegalFirmForm) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setDirty(true)
  }

  const save = async () => {
    const problem = legalFirmInputProblem(form)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), handling_name: form.handling_name.trim(), email: form.email.trim(), phone: form.phone.trim(), contingency_pct: Number(form.contingency_pct), filing_cost: Number(form.filing_cost), active: true, updated_at: new Date().toISOString() }
      const res = form.id ? await db.from('legal_firms').update(payload).eq('id', form.id).select('*').single() : await db.from('legal_firms').insert(payload).select('*').single()
      if (res.error) {
        showToast(legalFirmSaveErrorWords(res.error.message), 'error')
        return
      }
      const row = res.data as LegalFirmRow
      setForm(firmToForm(row))
      setDirty(false)
      draft.clear()
      showToast('Law firm saved. The Legal desk reads it now.', 'success')
      onSaved(row)
    } finally {
      setSaving(false)
    }
  }

  const fields = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: bare ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr', gap: 10, marginTop: '0.75rem' }}>
        <label style={label}>Firm<input style={input} value={form.name} onChange={set('name')} placeholder="Example Law Firm, PLLC" /></label>
        <label style={label}>Handling person<input style={input} value={form.handling_name} onChange={set('handling_name')} placeholder="A. Attorney" /></label>
        <label style={label}>Email (contact — the firm’s people subscribe on their portal)<input style={input} type="email" value={form.email} onChange={set('email')} placeholder="attorney@firm.example" /></label>
        <label style={label}>Phone<input style={input} value={form.phone} onChange={set('phone')} /></label>
        <label style={label}>Contingency %<input style={input} type="number" min={0} max={100} step={1} value={form.contingency_pct} onChange={set('contingency_pct')} /></label>
        <label style={label}>Filing cost ($)<input style={input} type="number" min={0} step={1} value={form.filing_cost} onChange={set('filing_cost')} /></label>
      </div>
      {bare && firmFacts ? <div style={{ marginTop: 10 }}>{firmFacts}</div> : null}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void save()} disabled={!dirty || saving} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: dirty ? 'var(--text-700)' : 'var(--bg-muted)', color: dirty ? 'var(--surface)' : 'var(--text-muted)', fontSize: '0.86rem', cursor: dirty ? 'pointer' : 'default' }}>
          {saving ? 'Saving…' : form.id ? 'Save firm' : 'Add firm'}
        </button>
        {!firm && onDiscard ? (
          <button type="button" onClick={onDiscard} style={{ padding: '0.4rem 0.9rem', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.86rem', cursor: 'pointer' }}>
            Not now
          </button>
        ) : null}
        {bare ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Saving changes this firm’s details. Its people, its link and its accounts stay with it.</span> : null}
      </div>
    </>
  )

  if (bare) return <div data-legal-firm-form={firm?.id ?? 'new'}>{fields}</div>

  const edge = picked && hue ? hue.ink : 'transparent'
  return (
    <div
      data-legal-firm-card={firm?.id ?? 'new'}
      data-picked={picked ? '1' : '0'}
      style={{ border: `1px solid ${picked ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 12px', background: 'var(--surface)', boxShadow: `inset 3px 0 0 ${edge}` }}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={!firm}
        aria-pressed={picked ? true : false}
        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: firm ? 'pointer' : 'default', color: 'var(--text)' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.92rem' }}>
          {hue ? <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: hue.fill, border: `1px solid ${hue.border}`, display: 'inline-block', flexShrink: 0 }} /> : null}
          {firm ? firm.name : 'New firm'}
        </span>
        {firm ? (
          <>
            <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.76rem', marginTop: 2 }}>
              {firm.handling_name || 'no handling person yet'} · {firm.contingency_pct}% · ${firm.filing_cost} filing
            </span>
            <span data-legal-firm-counties style={{ display: 'block', fontSize: '0.8rem', marginTop: 6 }}>{countiesLine(counties ?? [], alsoIn)}</span>
          </>
        ) : null}
      </button>
      {firm ? (
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ marginTop: 6, padding: 0, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}>
          {open ? 'Hide details' : 'Edit details'}
        </button>
      ) : null}
      {open ? fields : null}
    </div>
  )
}
