import { useState, type CSSProperties } from 'react'

import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import {
  JOB_ACCOUNT_OPENED_VIA,
  JOB_ACCOUNT_OPENED_VIA_LABELS,
  isJobAccountOpenedVia,
  repDisplayName,
  type JobAccountOpenedVia,
  type JobAccountRep,
  type JobSupplyHouseAccountRow,
} from '../../lib/materials/jobSupplyHouseAccounts'

/** A rep id must be a real supply_house_contacts id — a payload-only rep (name + phone) is never written as one. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Job accounts at the counter (v2.3423): the one sheet that writes a job's
 * account at a house — **Mark opened** (how, the house's reference, the rep,
 * a note) or **Not needed** (with the reason). Two taps for the common case:
 * Taunya hangs up with Curly and marks it opened by phone. Same sheet from the
 * house roster, the job window, the PO code and the Dispatch errand.
 *
 * Upserts on (job_id, supply_house_id); the server trigger stamps who / when.
 */
export function MarkJobAccountOpenedModal({
  jobId,
  jobLabel,
  house,
  existing,
  reps,
  initialMode = 'open',
  onClose,
  onSaved,
}: {
  jobId: string
  jobLabel: string
  house: { id: string; name: string }
  existing: JobSupplyHouseAccountRow | null
  /** The house's job-accounts contacts (role job_accounts), first is the default. */
  reps: JobAccountRep[]
  initialMode?: 'open' | 'not_needed'
  onClose: () => void
  onSaved: (row: JobSupplyHouseAccountRow) => void
}) {
  const { showToast } = useToastContext()
  const [mode, setMode] = useState<'open' | 'not_needed'>(initialMode)
  const [via, setVia] = useState<JobAccountOpenedVia>(isJobAccountOpenedVia(existing?.opened_via) ? existing.opened_via : 'phone')
  const [ref, setRef] = useState(existing?.account_ref ?? '')
  const [repId, setRepId] = useState<string>(existing?.rep_contact_id ?? reps[0]?.id ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [saving, setSaving] = useState(false)

  const notNeededMissingReason = mode === 'not_needed' && note.trim() === ''

  async function save() {
    if (saving || notNeededMissingReason) return
    setSaving(true)
    try {
      const payload = {
        job_id: jobId,
        supply_house_id: house.id,
        status: mode,
        account_ref: mode === 'open' ? ref.trim() : '',
        opened_via: mode === 'open' ? via : null,
        rep_contact_id: mode === 'open' && UUID_RE.test(repId) ? repId : null,
        note: note.trim(),
      }
      const { data, error } = await supabase
        .from('job_supply_house_accounts')
        .upsert(payload, { onConflict: 'job_id,supply_house_id' })
        .select('id, job_id, supply_house_id, status, account_ref, opened_via, rep_contact_id, requested_by, requested_at, requested_from_counter, opened_by, opened_at, note')
        .single()
      if (error) throw error
      showToast(mode === 'open' ? `${house.name} job account marked open for ${jobLabel}.` : `${house.name} job account marked not needed for ${jobLabel}.`, 'success')
      onSaved(data as JobSupplyHouseAccountRow)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the job account.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const inp: CSSProperties = { width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.875rem', background: 'var(--surface)', color: 'var(--text-strong)' }
  const label: CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }
  const chip = (on: boolean): CSSProperties => ({
    padding: '0.3rem 0.7rem',
    borderRadius: 999,
    border: `1px solid ${on ? '#0f766e' : 'var(--border-strong)'}`,
    background: on ? '#ccfbf1' : 'var(--surface)',
    color: on ? '#0f766e' : 'var(--text-700)',
    fontWeight: on ? 600 : 400,
    fontSize: '0.8125rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${house.name} job account for ${jobLabel}`}
        data-job-account-sheet={mode}
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 10, width: 'min(440px, 100%)', boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '1.1rem 1.25rem 1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{house.name} job account · {jobLabel}</h3>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
            <button type="button" aria-pressed={mode === 'open'} onClick={() => setMode('open')} style={chip(mode === 'open')}>Mark opened</button>
            <button type="button" aria-pressed={mode === 'not_needed'} onClick={() => setMode('not_needed')} style={chip(mode === 'not_needed')}>Not needed</button>
          </div>
        </div>

        {mode === 'open' ? (
          <>
            <div>
              <span style={label}>How</span>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {JOB_ACCOUNT_OPENED_VIA.map((v) => (
                  <button key={v} type="button" aria-pressed={via === v} onClick={() => setVia(v)} style={chip(via === v)}>
                    {JOB_ACCOUNT_OPENED_VIA_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="job-account-ref" style={label}>Reference <span style={{ fontWeight: 400 }}>(optional — the number the house gives)</span></label>
              <input id="job-account-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. JA-4114 or the property address" style={inp} />
            </div>
            <div>
              <label htmlFor="job-account-rep" style={label}>Rep</label>
              {reps.length > 0 ? (
                <select id="job-account-rep" value={repId} onChange={(e) => setRepId(e.target.value)} style={inp}>
                  <option value="">—</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{repDisplayName(r)}{r.phone ? ` · ${r.phone}` : ''}</option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No job-accounts rep on file for {house.name} — add one on the house (Contacts → role Job accounts).</span>
              )}
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="job-account-note" style={label}>{mode === 'open' ? 'Note' : 'Why not'} {mode === 'not_needed' ? <span style={{ fontWeight: 400 }}>(required)</span> : null}</label>
          <textarea
            id="job-account-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={mode === 'open' ? 'Curly wants the owner name when we have it' : 'Buys on the builder’s account · service call · house said no'}
            style={inp}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.45rem 0.9rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', font: 'inherit' }}>Cancel</button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || notNeededMissingReason}
            style={{ padding: '0.45rem 1rem', background: notNeededMissingReason ? 'var(--bg-200)' : '#0f766e', color: notNeededMissingReason ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 6, cursor: saving || notNeededMissingReason ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
          >
            {saving ? 'Saving…' : mode === 'open' ? 'Mark opened' : 'Mark not needed'}
          </button>
        </div>
      </div>
    </div>
  )
}
