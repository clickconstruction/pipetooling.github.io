import type { CSSProperties } from 'react'
import { splitSend, type Splittable } from '../../lib/people/openReports'
import { AmountSmallCents } from '../AmountSmallCents'

/**
 * One send split across a person's open weeks, oldest first (v2.3693). The
 * boxes start at the oldest-first fill and stay editable; the kernel
 * (`splitSend`) clamps each to what its week can take and reports the
 * leftover. Shared by the Cash App reconcile modal's Record lane and the
 * Balances settle line, so there is one way a send becomes payments.
 */
export type SplitEditorRow = Splittable & { label: string }

export type PaymentSplitEditorProps = {
  /** The send, in dollars. */
  amount: number
  /** Oldest first; rows with nothing left are skipped by the kernel. */
  rows: readonly SplitEditorRow[]
  /** The boxes as typed, keyed by stub id; an untouched box takes the fill. */
  edits: Readonly<Record<string, string>>
  onChange: (edits: Record<string, string>) => void
  disabled?: boolean
  /** The id prefix for the inputs — two editors on one page must differ. */
  idPrefix?: string
}

const TH: CSSProperties = { fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, padding: '0.3rem 0.5rem', background: 'var(--bg-muted)', textAlign: 'left' }
const TD: CSSProperties = { padding: '0.3rem 0.5rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', verticalAlign: 'middle' }

export function PaymentSplitEditor({ amount, rows, edits, onChange, disabled = false, idPrefix = 'split' }: PaymentSplitEditorProps) {
  const { splits, total, leftover } = splitSend(amount, rows, edits)
  const labelById = new Map(rows.map((r) => [r.stubId, r.label]))
  const count = splits.filter((s) => s.amount > 0.005).length
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>Applies to · oldest first</th>
            <th style={{ ...TH, textAlign: 'right' }}>Left</th>
            <th style={{ ...TH, textAlign: 'right', width: 120 }}>This send</th>
          </tr>
        </thead>
        <tbody>
          {splits.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ ...TD, color: 'var(--text-muted)' }}>Nothing is open to apply this to.</td>
            </tr>
          ) : null}
          {splits.map((s) => {
            const typed = edits[s.stubId]
            return (
              <tr key={s.stubId} style={{ color: s.amount > 0.005 ? undefined : 'var(--text-muted)' }}>
                <td style={TD}>{labelById.get(s.stubId) ?? s.stubId}</td>
                <td style={{ ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  <AmountSmallCents value={s.balance} />
                </td>
                <td style={{ ...TD, textAlign: 'right' }}>
                  <input
                    id={`${idPrefix}-${s.stubId}`}
                    aria-label={`Amount for ${labelById.get(s.stubId) ?? s.stubId}`}
                    inputMode="decimal"
                    disabled={disabled}
                    value={typed ?? (s.amount > 0.005 ? s.amount.toFixed(2) : '')}
                    placeholder="0.00"
                    onChange={(e) => onChange({ ...edits, [s.stubId]: e.target.value })}
                    onBlur={(e) => {
                      // Settle the box on what the kernel kept (clamped, rounded) so what you read is what saves.
                      const kept = splitSend(amount, rows, { ...edits, [s.stubId]: e.target.value }).splits.find((x) => x.stubId === s.stubId)
                      onChange({ ...edits, [s.stubId]: kept && kept.amount > 0.005 ? kept.amount.toFixed(2) : '' })
                    }}
                    style={{ font: 'inherit', fontSize: '0.8rem', textAlign: 'right', width: 100, padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', padding: '0.35rem 0.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-muted)', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        <span>
          <b style={{ color: 'var(--text-strong)' }}><AmountSmallCents value={total} /></b> across <b style={{ color: 'var(--text-strong)' }}>{count} payment{count === 1 ? '' : 's'}</b>
        </span>
        <span style={{ color: leftover < -0.005 ? 'var(--text-red-600)' : leftover > 0.005 ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>
          {leftover < -0.005 ? (
            <>The boxes add up <AmountSmallCents value={-leftover} /> past the send.</>
          ) : leftover > 0.005 ? (
            <><AmountSmallCents value={leftover} /> left over — nothing open takes it; file it as an advance or a credit.</>
          ) : (
            'Nothing left over.'
          )}
        </span>
      </div>
    </div>
  )
}
