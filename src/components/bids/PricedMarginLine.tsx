import { pricedMarginDetailWords, pricedMarginPctWords, type BidPricedMargin } from '../../lib/bids/pricedMargin'

/**
 * The line under the Pricing workbench's strip (Burn against the bid, piece 1, v2.5043): the
 * margin kept on the bid, with the inputs behind it and why it may read high. A sent bid says it
 * went out at that margin and that repricing does not move it. Nothing until the bid has a stamp.
 */
export function PricedMarginLine({ stamp, sent }: { stamp: BidPricedMargin | null; sent: boolean }) {
  if (!stamp) return null
  const when = stamp.at ? new Date(stamp.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
  return (
    <div data-testid="pricing-priced-margin" style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--text-muted)' }} title="The margin the job's Costs tab and Bids → Bid Costs → Bid vs actual read beside the job's burn">
      {sent ? (
        <>
          Went out at <b style={{ color: 'var(--text-strong)' }}>{pricedMarginPctWords(stamp)}</b> · {pricedMarginDetailWords(stamp)} · kept at send, so repricing does not move it
        </>
      ) : (
        <>
          Kept on the bid as its priced margin: <b style={{ color: 'var(--text-strong)' }}>{pricedMarginPctWords(stamp)}</b> · {pricedMarginDetailWords(stamp)}
          {when ? ` · ${when}` : ''}
        </>
      )}
    </div>
  )
}
