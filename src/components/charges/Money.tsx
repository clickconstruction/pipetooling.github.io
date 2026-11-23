import type { CSSProperties } from 'react'
import { Money as AppMoney } from '../Money'
import { moneyWords } from '../../lib/moneyParts'

/**
 * The charges surfaces' money figure (the owner's rule, punch list #254): `$241,968` then `.73` smaller. It draws
 * through the app's one door, `src/components/Money.tsx`, and adds what these surfaces had first: figures of one
 * width, softer cents and the whole figure as the label. A new screen imports the door itself.
 */
export function Money({ amount, style, centsStyle, 'data-testid': testId }: { amount: number; style?: CSSProperties; centsStyle?: CSSProperties; 'data-testid'?: string }) {
  return <AppMoney amount={amount} style={{ fontVariantNumeric: 'tabular-nums', ...style }} centsStyle={{ opacity: 0.85, ...centsStyle }} data-testid={testId} aria-label={moneyWords(amount)} />
}
