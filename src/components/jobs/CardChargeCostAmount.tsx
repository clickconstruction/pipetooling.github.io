import { formatCurrency } from '../../lib/format'
import { cardChargeCostUsd } from '../../lib/jobs/cardChargeAllocationFilter'

/**
 * A Mercury job allocation shown as cost (v2.3519): "40.00" for a purchase,
 * "−40.00 refund" when the bank paid the money back. The sign comes from
 * `cardChargeCostUsd`, the one rule every card-charge number reads, so a row
 * and the total it feeds can never disagree.
 */
export function CardChargeCostAmount({
  amount,
  dollarSign = false,
}: {
  amount: number | string | null | undefined
  dollarSign?: boolean
}) {
  const cost = cardChargeCostUsd(amount)
  const refund = cost < 0
  return (
    <>
      {refund ? '−' : ''}
      {dollarSign ? '$' : ''}
      {formatCurrency(Math.abs(cost))}
      {refund ? (
        <span data-testid="card-refund-mark" style={{ marginLeft: '0.35rem', fontSize: '0.72em', color: 'var(--text-muted)' }}>
          refund
        </span>
      ) : null}
    </>
  )
}
