import type { CSSProperties } from 'react'
import { CONTRACT_MISSING_CHOICES, CONTRACT_MISSING_REASON_MIN, type ContractMissingDecision } from '../../lib/needsYou/fillInContractsMissing'

/**
 * The contract-missing kind's fields on the Fill them in deck (v2.5844, punch list #176): the
 * two answers the deck saves, then only what each needs — paper takes the signer, the day, a
 * link or a file; No contract needed takes the reason. Sending the agreement is the sweep's
 * and sits behind the row's door, so the fields say so under the choices.
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
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }

export function ContractMissingFields({ decision, onChange, disabled, hasEmail }: { decision: ContractMissingDecision; onChange: (d: ContractMissingDecision) => void; disabled: boolean; hasEmail: boolean }) {
  const set = (patch: Partial<ContractMissingDecision>) => onChange({ ...decision, ...patch })
  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>What do you want to do?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="What do you want to do?">
          {CONTRACT_MISSING_CHOICES.map((c) => {
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
        <div data-contract-missing-send style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
          {hasEmail ? 'To send the agreement, press Send it from the sweep. The sweep shows it before it goes out.' : 'To send the agreement the job needs an email first. Send it from the sweep opens the row.'}
        </div>
      </div>
      {decision.choice === 'paper' ? (
        <div data-contract-missing-paper style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={grid}>
            <label>
              <span style={labelStyle}>Who signed</span>
              <input value={decision.signerName} disabled={disabled} onChange={(e) => set({ signerName: e.target.value })} placeholder="The name on the paper" style={inputStyle} aria-label="Who signed" />
            </label>
            <label>
              <span style={labelStyle}>Signed on</span>
              <input type="date" value={decision.signedOn} disabled={disabled} onChange={(e) => set({ signedOn: e.target.value })} style={inputStyle} aria-label="Signed on" />
            </label>
          </div>
          <div style={grid}>
            <label>
              <span style={labelStyle}>The scan, if you have it</span>
              <input type="file" accept="application/pdf,image/*" disabled={disabled} onChange={(e) => set({ file: e.target.files?.[0] ?? null })} style={{ ...inputStyle, padding: '0.35rem 0.6rem' }} aria-label="The scan" />
            </label>
            <label>
              <span style={labelStyle}>Or a link to it</span>
              <input value={decision.link} disabled={disabled} onChange={(e) => set({ link: e.target.value })} placeholder="A Drive link" style={inputStyle} aria-label="A link to the scan" />
            </label>
          </div>
        </div>
      ) : null}
      {decision.choice === 'not-needed' ? (
        <label data-contract-missing-reason>
          <span style={labelStyle}>Why no contract is needed</span>
          <input value={decision.reason} disabled={disabled} onChange={(e) => set({ reason: e.target.value })} placeholder="A PO stands in for it" style={inputStyle} aria-label="Why no contract is needed" />
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>
            {decision.reason.trim().length < CONTRACT_MISSING_REASON_MIN ? 'A few words, so the next person knows.' : 'The job leaves the count. Undo brings it back.'}
          </span>
        </label>
      ) : null}
    </div>
  )
}
