import { Fragment } from 'react'
import type { buildBidBoardWeeklySentSummaries } from '../../lib/bidBoardWeeklySentStats'
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
  return (
    <Fragment>
      <BidBoardEstimatingPulseSection filteredBids={filteredBids} openBid={openBid} />
      {isDev && (
        <Fragment>
          <BidBoardWeeklyEstimatorLaborDevSection weeks={weeklySentSummaries} />
          <BidBoardSentShareDevSection filteredBids={filteredBids} />
        </Fragment>
      )}
    </Fragment>
  )
}
