import type { CSSProperties } from 'react'

/**
 * Compact digit pad (counts / rough qty). Matches Bids NewCountRow keypad styling.
 */
export type NumericEntryPadProps = {
  value: string
  onChange: (next: string) => void
  /** When true, bottom row is C · 0 ⌫ with a decimal key. */
  allowDecimal?: boolean
  /** Total width in px (e.g. 132 for counts column). */
  widthPx?: number
}

const btnStyle: CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.875rem',
  background: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  cursor: 'pointer',
}

export function NumericEntryPad({ value, onChange, allowDecimal = false, widthPx }: NumericEntryPadProps) {
  const w = widthPx != null ? { width: widthPx, boxSizing: 'border-box' as const } : undefined

  function appendDigit(d: string) {
    onChange(value + d)
  }

  function appendDot() {
    if (!allowDecimal) return
    if (value.includes('.')) return
    if (value === '') {
      onChange('0.')
      return
    }
    onChange(`${value}.`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', ...w }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} type="button" tabIndex={-1} onClick={() => appendDigit(String(d))} style={btnStyle}>
            {d}
          </button>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: allowDecimal ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
          gap: '0.25rem',
        }}
      >
        <button type="button" tabIndex={-1} onClick={() => onChange('')} style={btnStyle} title="All clear">
          C
        </button>
        {allowDecimal ? (
          <button type="button" tabIndex={-1} onClick={appendDot} style={btnStyle} title="Decimal">
            .
          </button>
        ) : null}
        <button type="button" tabIndex={-1} onClick={() => appendDigit('0')} style={btnStyle}>
          0
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(value.slice(0, -1))}
          style={btnStyle}
          title="Delete"
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
