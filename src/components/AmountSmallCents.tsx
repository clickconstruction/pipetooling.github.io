import { formatCurrency, splitFormattedAmountCents } from '../lib/jobs/jobFormatting'

/**
 * Dollar amount with the cents rendered smaller ("$40,000.00" with a ~30%-size
 * ".00") so magnitudes read at a glance (v2.2246, Sub Labor tab). Plain spans —
 * selecting/copying still yields the full "$40,000.00".
 */
export function AmountSmallCents({ value, prefix = '$' }: { value: number; prefix?: string }) {
  const { main, cents } = splitFormattedAmountCents(formatCurrency(value))
  return (
    <>
      {prefix}
      {main}
      {cents ? <span style={{ fontSize: '0.7em' }}>{cents}</span> : null}
    </>
  )
}

/**
 * The same, for a figure that can be a loss or missing (v2.3180, Job Summary):
 * a true minus sign before the `$` for a negative value, an em dash for null.
 * Extracted from the Job Summary tiles' `JobSummaryTileMoney` (v2.3177) so the
 * table's cells, footer and group rows share it.
 */
export function SignedAmountSmallCents({ value }: { value: number | null | undefined }) {
  if (value == null) return <>—</>
  return (
    <>
      {value < 0 ? '−' : ''}
      <AmountSmallCents value={Math.abs(value)} />
    </>
  )
}
