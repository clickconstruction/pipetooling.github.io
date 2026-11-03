import type { CSSProperties } from 'react'
import { moneyParts } from '../../lib/charges/moneyParts'

/**
 * A money figure with its cents smaller than the dollars (the owner's rule, punch list #254): `$241,968` then `.73` at
 * three quarters the size. One component for every charges surface, so no screen formats money by hand.
 */
export function Money({ amount, style, centsStyle, 'data-testid': testId }: { amount: number; style?: CSSProperties; centsStyle?: CSSProperties; 'data-testid'?: string }) {
  const p = moneyParts(amount)
  return (
    <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...style }} data-testid={testId} aria-label={p.words}>
      {p.sign}
      {p.dollars}
      <span style={{ fontSize: '0.78em', opacity: 0.85, ...centsStyle }}>{p.cents}</span>
    </span>
  )
}
