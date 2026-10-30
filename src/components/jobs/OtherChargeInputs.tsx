import { useState, type CSSProperties } from 'react'
import { formatCurrency, parseMoneyInputToNumber, sanitizeMoneyTyping } from '../../lib/jobs/jobFormMoney'
import { moneyDraftForEditing } from '../../lib/jobs/otherChargeRowDisplay'
import { MoneyWithSmallCents } from './MoneySmallCents'

const BOX_STYLE: CSSProperties = {
  width: '100%',
  padding: '0.25rem 0.1rem',
  border: 'none',
  borderBottom: '1px solid var(--border-strong)',
  borderRadius: 0,
  fontSize: '0.875rem',
  textAlign: 'right',
  background: 'transparent',
  fontVariantNumeric: 'tabular-nums',
}

/**
 * The amount box of an Other job charge (punch list #215, PR 1). Blurred, it
 * reads as money: thousands with commas and the cents drawn smaller. Focused,
 * it is the plain digits with the caret, commas allowed while typing. It is one
 * real `<input>` throughout — the formatted reading is an overlay — so the box
 * keeps its label, its tab stop and its click target. Commits on every
 * keystroke, as the number box it replaces did, so the accordion total and the
 * autosave follow the typing.
 */
export function OtherChargeAmountInput({
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  value: number
  onChange: (n: number) => void
  'aria-label': string
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const overlay = !focused && value !== 0
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: '7rem', flexShrink: 0 }}>
      <input
        type="text"
        inputMode="decimal"
        value={focused ? draft : value !== 0 ? formatCurrency(value) : ''}
        placeholder={focused ? '' : '0'}
        aria-label={ariaLabel}
        onFocus={() => {
          setDraft(moneyDraftForEditing(value))
          setFocused(true)
        }}
        onBlur={() => {
          setFocused(false)
          onChange(parseMoneyInputToNumber(draft))
        }}
        onChange={(e) => {
          const next = sanitizeMoneyTyping(e.target.value)
          setDraft(next)
          onChange(parseMoneyInputToNumber(next))
        }}
        style={{ ...BOX_STYLE, color: overlay ? 'transparent' : undefined }}
      />
      {overlay ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0.25rem 0.1rem',
            fontSize: '0.875rem',
            pointerEvents: 'none',
          }}
        >
          <MoneyWithSmallCents value={value} />
        </span>
      ) : null}
    </span>
  )
}

/** The chip an `ESTIMATE —` description wears; the prefix stays in the data. */
export function EstimateChip() {
  return (
    <span
      data-testid="estimate-chip"
      title="An estimate, not a charge that has posted: the description starts with ESTIMATE. Click into the description to see or change it."
      style={{
        display: 'inline-block',
        padding: '0 0.45rem',
        borderRadius: 999,
        fontSize: '0.66rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: '1.1rem',
        background: 'var(--bg-amber-tint)',
        color: 'var(--text-amber-800)',
        flexShrink: 0,
      }}
    >
      Estimate
    </span>
  )
}
