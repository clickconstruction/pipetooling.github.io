import { useMemo } from 'react'
import { isZzBidName } from '../../lib/jobs/zzTestJobSweep'
import { BID_AGING, buildBidWins, type BidSent, type BidSizeWins } from '../../lib/bridge/bidWins'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

/**
 * What we win, by the size of the bid (punch list #318, PR 2): the chart the owner asked to have on the
 * Bid Board ("I really like your chart of what bids we are winning based on size. I would like to add that to the
 * bid board somehow.", 2026-11-11). It sits in the board's Health section under The pulse and reads the board's own
 * bids, so it follows the trade and the filters the board is showing.
 *
 * The counting is the Bridge's (`bidWins.ts`): a bid is won or lost only when it is marked; with no mark it counts
 * as part lost by its age; the rate is by dollars. A ZZ test bid is left out. The day a bid was sent is a date,
 * not an instant, so it is read as written: read as an instant it lands a day early in company time, and a bid
 * would age into a loss a day too soon.
 */

const pct = (share: number): string => (share > 0 && share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`)
const usd = (n: number): string => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`)

function Row({ size }: { size: BidSizeWins }) {
  const rate = size.rate
  const decided = size.won.count + size.lost.count
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(6.5rem, 9rem) minmax(0, 1fr) minmax(4.5rem, auto)', gap: '0.2rem 0.75rem', alignItems: 'center', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }} data-testid="bid-size-wins-row">
      <b style={{ fontSize: '0.9rem', color: 'var(--text-strong)' }}>{size.label}</b>
      {/* The whole track is every dollar decided in this size; the green is the share won. */}
      <div aria-hidden style={{ height: 14, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${rate != null ? Math.max(rate > 0 ? 1 : 0, Math.min(100, rate * 100)) : 0}%`, background: '#16a34a', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: '0.95rem', fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: rate == null ? 'var(--text-muted)' : 'var(--text-strong)' }}>{rate != null ? `${pct(rate)} won` : 'no read'}</span>
      <span style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
        {decided > 0 ? `${size.won.count} won for ${usd(size.won.usd)}, ${size.lost.count} lost for ${usd(size.lost.usd)}` : 'None marked won or lost yet'}
        {size.noMark.count > 0 ? `, ${size.noMark.count} with no mark for ${usd(size.noMark.usd)}` : ''}.
      </span>
    </div>
  )
}

export function BidBoardWonBySizeSection({ filteredBids }: { filteredBids: BidWithBuilder[] }) {
  const wins = useMemo(() => {
    const todayYmd = todayYmdInAppTz()
    const bids: BidSent[] = []
    for (const b of filteredBids) {
      if (!b.bid_date_sent || isZzBidName(b.project_name)) continue
      const sentYmd = b.bid_date_sent.slice(0, 10)
      bids.push({ sentYmd, outcome: b.outcome, usd: Number(b.agreed_value ?? b.bid_value ?? 0), hasJob: false, jobUsd: null })
    }
    return buildBidWins({ todayYmd, windowStart: ymdAddDays(todayYmd, -56), bids })
  }, [filteredBids])
  const marked = wins.won.count + wins.lost.count
  const aging = [...BID_AGING].reverse()
  return (
    <div data-testid="bid-size-wins">
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.15rem 0' }}>What we win, by the size of the bid</h3>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Won by dollars, among the bids of each size that were sent. A bid counts as won or lost only when it is marked. With no mark it counts as {aging.map((a) => `${pct(a.lostShare)} lost after ${a.afterDays} days`).join(' and ')}.
      </p>
      {marked === 0 ? (
        <EmptyState compact main="No sent bid on this board is marked won or lost yet." tail="Mark a bid won or lost and its size fills in here." />
      ) : (
        <div style={{ maxWidth: 760 }}>
          {wins.sizes.map((s) => (
            <Row key={s.id} size={s} />
          ))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', fontSize: '0.8rem', color: 'var(--text-700)' }} data-testid="bid-size-wins-foot">
            {wins.noMark.count > 0
              ? `${wins.noMark.count} sent ${wins.noMark.count === 1 ? 'bid has' : 'bids have'} no mark, for ${usd(wins.noMark.usd)}.${wins.noMarkOld.count > 0 ? ` ${wins.noMarkOld.count} of them ${wins.noMarkOld.count === 1 ? 'was' : 'were'} sent over 180 days ago.` : ''} Marking them makes these rates true.`
              : 'Every sent bid on this board is marked.'}
          </div>
        </div>
      )}
    </div>
  )
}
