/**
 * What was offered (v2.5988, punch list #206 PR 2): every option of a sent estimate on the office
 * page, in offered order, each with its lines and total — the picker's content read as a record,
 * on a sent, expired, declined or superseded row alike. On an accepted row the same blocks sit
 * under a fold below the accepted document, so what they passed on can still be read in full.
 * Words from `lib/estimates/estimateOfferedOptionsView.ts`; the lines table is the one the page
 * already draws.
 */
import type { CSSProperties } from 'react'
import { EstimateLineItemsTable } from './EstimateCustomerDocument'
import { estimateOfferedOptionsView, OFFERED_OPTIONS_WORDS } from '../../lib/estimates/estimateOfferedOptionsView'
import type { EstimateOption } from '../../lib/estimates/estimateOptions'

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export type EstimateOfferedOptionsProps = {
  options: EstimateOption[]
  /** An accepted row: the blocks fold under *Every option as sent* and the Pipeline note is gone. */
  accepted?: boolean
  style?: CSSProperties
}

const chipStyle = (kind: 'star' | 'addon' | 'ticked'): CSSProperties => ({
  display: 'inline-block',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.03em',
  padding: '0.1rem 0.5rem',
  borderRadius: 999,
  marginLeft: '0.4rem',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
  background: kind === 'star' ? 'var(--bg-amber-100)' : kind === 'addon' ? 'var(--bg-blue-200)' : 'var(--bg-muted)',
  color: kind === 'star' ? 'var(--text-amber-800)' : kind === 'addon' ? 'var(--text-blue-800)' : 'var(--text-700)',
})

const chipKind = (chip: string): 'star' | 'addon' | 'ticked' =>
  chip === OFFERED_OPTIONS_WORDS.recommended ? 'star' : chip === OFFERED_OPTIONS_WORDS.addOn ? 'addon' : 'ticked'

export default function EstimateOfferedOptions({ options, accepted = false, style }: EstimateOfferedOptionsProps) {
  const view = estimateOfferedOptionsView(options, formatMoney, { accepted })
  if (!view.active) return null
  const blocks = (
    <div data-testid="estimate-offered-options-blocks">
      {view.blocks.map((b) => (
        <div
          key={b.key}
          data-testid="estimate-offered-option"
          style={{
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            padding: '0.65rem 0.8rem',
            marginTop: '0.5rem',
            fontSize: '0.9rem',
            color: 'var(--text-700)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-strong)' }}>
              {b.heading}
              {b.chips.map((c) => (
                <span key={c} style={chipStyle(chipKind(c))}>
                  {c}
                </span>
              ))}
            </h3>
            <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }} data-testid="estimate-offered-option-money">
              {b.money}
            </strong>
          </div>
          {b.pitch ? <p style={{ margin: '0.15rem 0 0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{b.pitch}</p> : null}
          <EstimateLineItemsTable lines={b.lines} />
          {b.note ? (
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="estimate-offered-option-note">
              {b.note}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
  if (accepted) {
    return (
      <details style={{ marginTop: '0.75rem', ...style }} data-testid="estimate-offered-options">
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-strong)' }}>
          {OFFERED_OPTIONS_WORDS.acceptedFold}{' '}
          <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.85rem' }}>· {view.countWords}</span>
        </summary>
        {blocks}
      </details>
    )
  }
  return (
    <section style={{ marginTop: '1rem', ...style }} data-testid="estimate-offered-options">
      <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>
        {view.heading}{' '}
        <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.85rem' }}>· {view.countWords}</span>
      </h2>
      {blocks}
    </section>
  )
}
