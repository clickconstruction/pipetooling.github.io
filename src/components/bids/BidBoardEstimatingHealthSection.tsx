import { Fragment, useMemo } from 'react'
import type { buildBidBoardWeeklySentSummaries } from '../../lib/bidBoardWeeklySentStats'
import { BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS } from '../../lib/bidBoardWeeklySentStats'
import { buildPulseStats } from '../../lib/bids/estimatingPulse'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { BidBoardEstimatingPulseSection } from './BidBoardEstimatingPulseSection'
import { BidBoardWeeklyEstimatorLaborDevSection } from './BidBoardWeeklyEstimatorLaborDevSection'
import { BidBoardSentShareDevSection } from './BidBoardSentShareDevSection'

type BidBoardEstimatingHealthSectionProps = {
  weeklySentSummaries: ReturnType<typeof buildBidBoardWeeklySentSummaries>
  filteredBids: BidWithBuilder[]
  isDev: boolean
  /** Bids-page override (v2.2390): open the tabbed Bid window instead of the standalone preview. */
  openBid?: (bid: BidWithBuilder) => void
}

/**
 * The Health section at the bottom of Bid Board. Since v2.2215 the Estimating
 * Pulse IS the section — the owner retired the classic weekly pivot + band
 * legend + sliders + Scoreboard tables (the "Old" pill of v2.1918) after
 * living with the Pulse. The old view's components
 * (BidBoardWeeklySentSection, BidBoardEstimatingHealthSliders,
 * StaffOutcomeDrilldownCountCell) were deleted with it; the dev-only
 * estimator labor table stays.
 */
export function BidBoardEstimatingHealthSection({
  weeklySentSummaries,
  filteredBids,
  isDev,
  openBid,
}: BidBoardEstimatingHealthSectionProps) {
  // Bidding-cost card context (v2.2541): won $/week over the same window as the
  // pulse's Won / week card, so the dev card's percentage agrees with the strip.
  const wonDollarsPerWeek = useMemo(() => {
    const stats = buildPulseStats(filteredBids, getDefaultWeekRange().start)
    return stats.wonDollars / BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS
  }, [filteredBids])

  return (
    <Fragment>
      <BidBoardEstimatingPulseSection filteredBids={filteredBids} openBid={openBid} />
      {isDev && (
        <Fragment>
          <BidBoardWeeklyEstimatorLaborDevSection weeks={weeklySentSummaries} wonDollarsPerWeek={wonDollarsPerWeek} />
          <BidBoardSentShareDevSection filteredBids={filteredBids} />
        </Fragment>
      )}
    </Fragment>
  )
}
