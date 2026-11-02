import { useState, type CSSProperties } from 'react'
import { MoneyWithSmallCents } from './jobs/MoneySmallCents'

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function sanitizeMoneyTyping(raw: string): string {
  const noComma = raw.replace(/,/g, '')
  let out = ''
  let dotSeen = false
  for (const c of noComma) {
    if (c >= '0' && c <= '9') out += c
    else if (c === '.' && !dotSeen) {
      dotSeen = true
      out += '.'
    }
  }
  return out
}

function parseMoneyInputToNumber(s: string): number {
  const t = s.replace(/,/g, '').trim()
  if (t === '' || t === '.') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

export type MoneyDecimalAmountInputProps = {
  value: number
  onChange: (n: number) => void
  placeholder?: string
  'aria-label'?: string
  id?: string
  style?: CSSProperties
  /** When true, shows formatted value and does not accept edits. */
  readOnly?: boolean
  /**
   * Commit on every keystroke instead of only on blur, so live-derived readouts
   * (job total, billing bar, break-off slider) move as the user types. Only for
   * consumers whose onChange is pure client state — never one that persists.
   */
  commitOnType?: boolean
  /**
   * At rest, draw the cents smaller than the dollars the way the app's other
   * money reads (`MoneyWithSmallCents`, v2.6110's Other charges box): the box
   * stays one real `<input>` — its label, tab stop and click target — and the
   * reading is an overlay that lifts while the box is focused or empty.
   */
  smallCents?: boolean
}

export function MoneyDecimalAmountInput({
  value,
  onChange,
  placeholder = '0',
  'aria-label': ariaLabel,
  id,
  style,
  readOnly = false,
  commitOnType = false,
  smallCents = false,
}: MoneyDecimalAmountInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const overlay = smallCents && !focused && value !== 0

  const displayValue =
    readOnly
      ? value !== 0
        ? formatCurrency(value)
        : formatCurrency(0)
      : focused
        ? draft
        : value !== 0
          ? formatCurrency(value)
          : ''

  const input = (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      readOnly={readOnly}
      value={displayValue}
      placeholder={readOnly ? undefined : placeholder}
      aria-label={ariaLabel}
      title={readOnly ? 'Amount is set by the Stripe invoice allocation and cannot be edited here.' : undefined}
      onFocus={() => {
        if (readOnly) return
        setFocused(true)
        setDraft(value === 0 ? '' : String(value))
      }}
      onBlur={() => {
        if (readOnly) return
        setFocused(false)
        onChange(parseMoneyInputToNumber(draft))
      }}
      onChange={(e) => {
        if (readOnly) return
        const next = sanitizeMoneyTyping(e.target.value)
        setDraft(next)
        if (commitOnType) onChange(parseMoneyInputToNumber(next))
      }}
      style={{
        ...(readOnly
          ? {
              ...style,
              cursor: 'not-allowed',
              background: 'var(--bg-muted)',
              color: 'var(--text-700)',
            }
          : style),
        ...(overlay ? { color: 'transparent' } : null),
      }}
    />
  )
  if (!smallCents) return input
  // The overlay takes the box's own padding, size and alignment so the reading
  // sits exactly where the typed digits do.
  return (
    <span style={{ position: 'relative', display: 'inline-flex', minWidth: 0 }}>
      {input}
      {overlay ? (
        <span
          aria-hidden
          data-testid="money-input-reading"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: style?.textAlign === 'right' ? 'flex-end' : 'flex-start',
            boxSizing: 'border-box',
            padding: style?.padding,
            fontSize: style?.fontSize,
            fontWeight: style?.fontWeight,
            color: readOnly ? 'var(--text-700)' : undefined,
            pointerEvents: 'none',
          }}
        >
          <MoneyWithSmallCents value={value} />
        </span>
      ) : null}
    </span>
  )
}
