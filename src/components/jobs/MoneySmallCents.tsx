import type { CSSProperties } from 'react'
import { Money, MoneyText } from '../Money'

/**
 * The job form's older names for `Money` (punch list #215): a bare figure with its cents smaller. They draw
 * through the app's one door now, so a new screen imports from `../Money` and these names go with the sweep.
 */

/** 39796.7 drawn as "39,796" with ".70" smaller. */
export function MoneyWithSmallCents({ value, style }: { value: number; style?: CSSProperties }) {
  return <Money amount={value} symbol="" style={{ fontVariantNumeric: 'tabular-nums', ...style }} />
}

/**
 * The same for a string that is already formatted ("14,115.35"); anything
 * that is not money ("—", "…") passes through untouched.
 */
export function MoneyStringWithSmallCents({ text }: { text: string }) {
  return <MoneyText text={text} bare />
}
