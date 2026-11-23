import { Money } from './Money'

/**
 * The older name for `Money` (v2.2246, Sub Labor tab): a dollar amount with its cents smaller. It draws through
 * the app's one door now, so a new screen imports `Money` from `./Money` and this name goes with the sweep.
 * `prefix=""` is a column of bare figures.
 */
export function AmountSmallCents({ value, prefix = '$' }: { value: number; prefix?: string }) {
  return <Money amount={value} symbol={prefix} />
}

/**
 * The same for a figure that can be a loss or missing (v2.3180, Job Summary): a true minus sign before the `$`
 * for a negative value, an em dash for null. `Money` does both by itself.
 */
export function SignedAmountSmallCents({ value }: { value: number | null | undefined }) {
  return <Money amount={value} />
}
