import { useState, type CSSProperties } from 'react'

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
}

export function MoneyDecimalAmountInput({
  value,
  onChange,
  placeholder = '0',
  'aria-label': ariaLabel,
  id,
  style,
}: MoneyDecimalAmountInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const displayValue = focused
    ? draft
    : value !== 0
      ? formatCurrency(value)
      : ''

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => {
        setFocused(true)
        setDraft(value === 0 ? '' : String(value))
      }}
      onBlur={() => {
        setFocused(false)
        onChange(parseMoneyInputToNumber(draft))
      }}
      onChange={(e) => setDraft(sanitizeMoneyTyping(e.target.value))}
      style={style}
    />
  )
}
