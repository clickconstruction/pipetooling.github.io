import type { CSSProperties } from 'react'
import { CONTRACT_CHOICES, contractChoiceAvailable, type ContractDecision, type ContractFillInRow } from '../../lib/needsYou/fillInContracts'

/**
 * The contract kind's fields on the Fill them in deck (v2.5777, punch list #145): one of
 * three doors, then only what that door needs — a resend takes a line to add, a text needs
 * nothing, paper takes the signer, the day, a link or a file. A door the row cannot take
 * (no email, no mobile) is drawn dead with the reason.
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

export function ContractFields({ row, decision, onChange, disabled }: { row: ContractFillInRow; decision: ContractDecision; onChange: (d: ContractDecision) => void; disabled: boolean }) {
  const set = (patch: Partial<ContractDecision>) => onChange({ ...decision, ...patch })
  return (
    <div style={{ display: 'grid', gap: '0.65rem' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>What do you want to do?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="What do you want to do?">
          {CONTRACT_CHOICES.map((c) => {
            const active = decision.choice === c.key
            const can = contractChoiceAvailable(row, c.key)
            const why = !can ? (c.key === 'resend' ? 'no email on file' : 'no mobile on file') : c.hint
            return (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled || !can}
                title={!can ? why : undefined}
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
                  cursor: can ? 'pointer' : 'default',
                  opacity: can ? 1 : 0.45,
                }}
              >
                {c.label}
                <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 500, opacity: 0.75 }}>{why}</span>
              </button>
            )
          })}
        </div>
      </div>
      {decision.choice === 'resend' ? (
        <label data-contract-resend>
          <span style={labelStyle}>A line to add, if you want one</span>
          <input value={decision.message} disabled={disabled} onChange={(e) => set({ message: e.target.value })} placeholder="When you have a minute" style={inputStyle} aria-label="A line to add" />
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>Goes to {row.recipientEmail} with the signing link, as the Contract window sends it.</span>
        </label>
      ) : null}
      {decision.choice === 'text' ? (
        <div data-contract-text style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          Save and next opens your messages to {row.recipientPhone} with the link filled in. You press send there.
        </div>
      ) : null}
      {decision.choice === 'paper' ? (
        <div data-contract-paper style={{ display: 'grid', gap: '0.6rem' }}>
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
    </div>
  )
}
