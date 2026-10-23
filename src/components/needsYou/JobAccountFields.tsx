import type { CSSProperties } from 'react'
import { JOB_ACCOUNT_CHOICES, JOB_ACCOUNT_VIA_OPTIONS, type JobAccountDecision } from '../../lib/needsYou/fillInJobAccounts'

/**
 * The job-account kind's fields on the Fill them in deck (v2.5776, punch list #146): one of
 * three answers, then only what that answer needs — opened asks how and the house's reference,
 * not needed asks the reason, asked for needs nothing more. A note is always there.
 */
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0.45rem 0.6rem',
  font: 'inherit',
  fontSize: '0.875rem',
  minHeight: 36,
}
const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }

export function JobAccountFields({ houseName, decision, onChange, disabled }: { houseName: string; decision: JobAccountDecision; onChange: (d: JobAccountDecision) => void; disabled: boolean }) {
  const set = (patch: Partial<JobAccountDecision>) => onChange({ ...decision, ...patch })
  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>Is there a job account at {houseName} for this job?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={`Is there a job account at ${houseName} for this job?`}>
          {JOB_ACCOUNT_CHOICES.map((c) => {
            const active = decision.choice === c.key
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => set({ choice: c.key })}
                style={{
                  padding: '0.3rem 0.75rem',
                  minHeight: 32,
                  borderRadius: 999,
                  border: active ? '1px solid var(--text-strong)' : '1px solid var(--border-strong)',
                  background: active ? 'var(--text-strong)' : 'var(--surface)',
                  color: active ? 'var(--bg-page, var(--surface))' : 'var(--text-base)',
                  font: 'inherit',
                  fontSize: '0.8125rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {c.label}
                <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 500, opacity: 0.75 }}>{c.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {decision.choice === 'open' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }} data-job-account-open>
          <label>
            <span style={labelStyle}>How it was opened</span>
            <select value={decision.via} disabled={disabled} onChange={(e) => set({ via: e.target.value as JobAccountDecision['via'] })} style={inputStyle} aria-label="How it was opened">
              {JOB_ACCOUNT_VIA_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span style={labelStyle}>The house’s reference, if you have it</span>
            <input value={decision.ref} disabled={disabled} onChange={(e) => set({ ref: e.target.value })} placeholder="Account number" style={inputStyle} aria-label="The house’s reference" />
          </label>
        </div>
      ) : null}
      <label>
        <span style={labelStyle}>{decision.choice === 'not_needed' ? 'Why not' : 'Note, if you want one'}</span>
        <input value={decision.note} disabled={disabled} onChange={(e) => set({ note: e.target.value })} placeholder={decision.choice === 'not_needed' ? 'The insurer pays the house direct' : 'Who you asked, or what they said'} style={inputStyle} aria-label={decision.choice === 'not_needed' ? 'Why not' : 'Note'} />
      </label>
    </div>
  )
}
