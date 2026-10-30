import type { CSSProperties } from 'react'
import { splitMoneyForDisplay, splitMoneyString } from '../../lib/jobs/otherChargeRowDisplay'

/** The cents, drawn smaller than the dollars (punch list #215). */
const CENTS_STYLE: CSSProperties = { fontSize: '0.78em' }

/** 39796.7 drawn as "39,796" with ".70" smaller. */
export function MoneyWithSmallCents({ value, style }: { value: number; style?: CSSProperties }) {
  const { whole, cents } = splitMoneyForDisplay(value)
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...style }}>
      {whole}
      <span data-testid="money-cents" style={CENTS_STYLE}>
        {cents}
      </span>
    </span>
  )
}

/**
 * The same for a string that is already formatted ("14,115.35"); anything
 * that is not money ("—", "…") passes through untouched.
 */
export function MoneyStringWithSmallCents({ text }: { text: string }) {
  const parts = splitMoneyString(text)
  if (!parts) return <>{text}</>
  return (
    <>
      {parts.whole}
      <span data-testid="money-cents" style={CENTS_STYLE}>
        {parts.cents}
      </span>
    </>
  )
}
