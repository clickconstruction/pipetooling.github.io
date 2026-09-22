/**
 * "How it was sent" (v2.3717): the one method picker every Record payment door shows — the
 * pay-run row's modal, Balances' split modal. Five pills in the kinds' order; the chosen one
 * clears on a second press (a method is welcome, not required). Cash App alone opens the
 * transaction-id box, because it is the only id a person can read off a screen; the other
 * kinds' ids are the app's own rows. The door turns the pick into columns and a memo with
 * `paySourceWrite()`.
 */
import type { CSSProperties } from 'react'
import { PAY_SOURCE_KINDS, paySourceLabel, type PaySourceKind } from '../../lib/people/paySources'

export type PaySourcePickerProps = {
  kind: PaySourceKind | null
  onKind: (kind: PaySourceKind | null) => void
  cashAppId: string
  onCashAppId: (id: string) => void
  disabled?: boolean
  /** Prefix for the element ids (`${idPrefix}-cashapp-id`), so a page with two doors stays unique. */
  idPrefix?: string
}

const pill = (on: boolean, disabled: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  padding: '0.3rem 0.7rem',
  border: `1px solid ${on ? 'var(--text-link)' : 'var(--border-strong)'}`,
  borderRadius: 999,
  background: on ? 'var(--text-link)' : 'var(--surface)',
  color: on ? 'var(--surface)' : 'var(--text-700)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
})

export function PaySourcePicker({ kind, onKind, cashAppId, onCashAppId, disabled = false, idPrefix = 'pay-source' }: PaySourcePickerProps) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <span style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>How it was sent</span>
      <div role="group" aria-label="How it was sent" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {PAY_SOURCE_KINDS.map((k) => {
          const on = kind === k
          return (
            <button key={k} type="button" aria-pressed={on} disabled={disabled} onClick={() => onKind(on ? null : k)} style={pill(on, disabled)}>
              {paySourceLabel(k)}
            </button>
          )
        })}
      </div>
      {kind === 'cashapp' ? (
        <label htmlFor={`${idPrefix}-cashapp-id`} style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
          <span style={{ display: 'block', marginBottom: '0.25rem', color: 'var(--text-muted)' }}>Cash App transaction id (optional)</span>
          <input
            id={`${idPrefix}-cashapp-id`}
            type="text"
            value={cashAppId}
            disabled={disabled}
            onChange={(e) => onCashAppId(e.target.value)}
            placeholder="#D-3V3MVPKVP"
            title="Paste the Transaction ID from the activity export or the app — it goes on the payment and into the memo, so the Cash App reconcile matches this payment exactly."
            spellCheck={false}
            autoComplete="off"
            style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, width: '100%', maxWidth: 200, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text)' }}
          />
        </label>
      ) : null}
    </div>
  )
}
