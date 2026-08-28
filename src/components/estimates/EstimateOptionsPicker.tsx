/**
 * The customer-facing option picker (v2.2457 plan, layout A "stacked choice cards" —
 * owner-picked). Renders between the estimate header and the document on the acceptance
 * page: one card per option, the recommended one badged and pre-selected, line items one
 * tap away. Selecting swaps the document + total the parent renders below.
 *
 * Also the staff rehearsal: the Customer-experience Page preview renders this exact
 * component, so the office sees precisely what the customer will.
 *
 * Customer surfaces are pinned light; the orange accent is the accept flow's existing
 * action color (saturated action colors stay literal per house rules).
 */
import type { CSSProperties } from 'react'
import type { EstimateOption } from '@/lib/estimates/estimateOptions'
import { estimateOptionTotalCents } from '@/lib/estimates/estimateOptions'

function formatMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

const cardStyle = (selected: boolean): CSSProperties => ({
  border: selected ? '1.5px solid #ea580c' : '1.5px solid var(--border-strong)',
  boxShadow: selected ? '0 0 0 1.5px #ea580c inset' : 'none',
  background: selected ? '#fff8f3' : 'var(--surface)',
  borderRadius: 12,
  padding: '0.7rem 0.8rem',
  marginBottom: '0.55rem',
  cursor: 'pointer',
  width: '100%',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  display: 'block',
  transition: 'border-color 0.12s, background 0.12s',
})

export type EstimateOptionsPickerProps = {
  options: EstimateOption[]
  selectedKey: string | null
  onSelect: (key: string) => void
  /** Sent/accepted views: cards render but clicks do nothing. */
  readOnly?: boolean
  /** Picker heading; CX-overridable in Phase 2. */
  heading?: string
}

export default function EstimateOptionsPicker({
  options,
  selectedKey,
  onSelect,
  readOnly,
  heading,
}: EstimateOptionsPickerProps) {
  if (options.length < 2) return null
  return (
    <section role="radiogroup" aria-label={heading ?? 'Choose your option'} style={{ margin: '1rem 0 0.4rem' }}>
      <div
        style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: '#9a5b13',
          marginBottom: '0.45rem',
        }}
      >
        {heading ?? 'Choose your option'}
      </div>
      {options.map((o) => {
        const selected = o.key === selectedKey
        const total = estimateOptionTotalCents(o)
        return (
          // A div, not a <button>: the expandable "What's included" <details> inside would be
          // invalid interactive-in-interactive HTML. Keyboard: Enter/Space select.
          <div
            key={o.key}
            role="radio"
            aria-checked={selected}
            tabIndex={readOnly ? -1 : 0}
            onClick={() => {
              if (!readOnly) onSelect(o.key)
            }}
            onKeyDown={(e) => {
              if (readOnly) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(o.key)
              }
            }}
            style={{ ...cardStyle(selected), cursor: readOnly ? 'default' : 'pointer' }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.6rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                <span
                  aria-hidden
                  style={{
                    width: 14,
                    height: 14,
                    flex: '0 0 auto',
                    borderRadius: '50%',
                    border: selected ? '4px solid #ea580c' : '2px solid var(--border-strong)',
                    background: 'var(--surface)',
                    boxSizing: 'border-box',
                  }}
                />
                {o.name.trim() || 'Option'}
                {o.recommended ? (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#9a5b13',
                      background: '#fdeed9',
                      borderRadius: 999,
                      padding: '0.12rem 0.5rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Recommended
                  </span>
                ) : null}
              </span>
              <span style={{ fontWeight: 800, fontSize: '1.02rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatMoney(total)}
              </span>
            </span>
            {o.description.trim() ? (
              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 2, maxWidth: '48ch' }}>
                {o.description}
              </span>
            ) : null}
            {o.line_items.length > 0 ? (
              <details
                style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}
                onClick={(e) => e.stopPropagation()}
              >
                <summary style={{ cursor: 'pointer', color: '#b3541e', fontWeight: 600 }}>What&rsquo;s included</summary>
                <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                  {o.line_items.map((l, i) => (
                    <li key={i}>
                      {(l.line_item.trim() ? `${l.line_item.trim()} — ` : '') + l.description}
                      {' — '}
                      {formatMoney(l.amount_cents)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
