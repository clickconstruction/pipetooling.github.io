import type { CSSProperties } from 'react'
import { moveWindowChoices, type MoveWindowDecision, type MoveWindowFillInRow } from '../../lib/needsYou/fillInMoveWindow'

/**
 * The move-window kind's fields on the Fill them in deck (v2.6086, punch list #178): one of
 * three answers, the job-account sheet's states on this one charge, then only what that answer
 * needs. Moved with no account open on record asks the house's reference, which records the
 * account as opened by phone; asked shows who the email goes to; not needed asks the reason.
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

export function MoveWindowFields({ row, decision, onChange, disabled }: { row: MoveWindowFillInRow; decision: MoveWindowDecision; onChange: (d: MoveWindowDecision) => void; disabled: boolean }) {
  const set = (patch: Partial<MoveWindowDecision>) => onChange({ ...decision, ...patch })
  const question = `What happened with this charge at ${row.houseName}?`
  return (
    <div style={{ display: 'grid', gap: '0.65rem' }} data-move-window-fields>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>{question}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label={question}>
          {moveWindowChoices(row).map((c) => {
            const active = decision.choice === c.key
            const dead = disabled || c.disabled
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={dead}
                title={c.disabled ? c.hint : undefined}
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
                  cursor: dead ? 'default' : 'pointer',
                  opacity: c.disabled ? 0.5 : 1,
                }}
              >
                {c.label}
                <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 500, opacity: 0.75 }}>{c.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      {decision.choice === 'moved' && row.account?.status !== 'open' ? (
        <label data-move-window-ref>
          <span style={labelStyle}>The house’s reference, if they gave you one</span>
          <input value={decision.ref} disabled={disabled} onChange={(e) => set({ ref: e.target.value })} placeholder="Account number" style={inputStyle} aria-label="The house’s reference" />
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>With a reference the account is recorded as opened by phone on the house roster.</span>
        </label>
      ) : null}
      {decision.choice === 'asked' && row.rep?.email ? (
        <div data-move-window-email style={{ padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <div>
            <strong style={{ color: 'var(--text-base)' }}>To:</strong> {row.rep.name} · {row.rep.email}
          </div>
          <div style={{ marginTop: 3 }}>
            The email asks {row.houseName} to move invoice {row.invoiceNumber || '—'} onto the job account for {row.jobLabel}. Replies come to you.
          </div>
        </div>
      ) : null}
      {decision.choice === 'not_needed' ? (
        <label>
          <span style={labelStyle}>Why not</span>
          <input value={decision.note} disabled={disabled} onChange={(e) => set({ note: e.target.value })} placeholder="The insurer pays the house direct" style={inputStyle} aria-label="Why not" />
        </label>
      ) : null}
    </div>
  )
}
