/**
 * The five windows the Bids page's robot layer opens: the envelope at send, the status and
 * needs sheets behind the robot icon, the reference grade, and the robot-vs-ours comparison.
 * Moved out of `src/pages/Bids.tsx` verbatim (the Bids map's step 5); `useBidRobotLayer`
 * holds their state, the page hands in the doors that lead back into it.
 */
import type { User } from '@supabase/supabase-js'
import type { BidRobotLayer } from '../../hooks/useBidRobotLayer'
import type { BidFormFocus } from '../../lib/bids/bidFormFocus'
import type { BidsTabKey } from '../../lib/bids/bidsTabAccess'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { RobotBidComparisonModal } from './RobotBidComparisonModal'
import { RobotEnvelopeModal } from './RobotEnvelopeModal'
import { RobotNeedsSheet } from './RobotNeedsSheet'
import { RobotReferenceGradeModal } from './RobotReferenceGradeModal'
import { RobotStatusSheet } from './RobotStatusSheet'

export function BidsRobotOverlays({
  robot,
  authUser,
  selectBidsTab,
  selectBidAndSyncUrl,
  openEditBid,
  serviceTypes,
}: {
  robot: BidRobotLayer
  authUser: User | null
  selectBidsTab: (tab: BidsTabKey) => void
  selectBidAndSyncUrl: (bid: BidWithBuilder, tab: BidsTabKey) => void
  openEditBid: (bid: BidWithBuilder, opts?: { focus?: BidFormFocus; tab?: 'bid' | 'edit' }) => void
  /** v2.4165: the plans card on the needs sheet opens the bid's division folder. */
  serviceTypes?: ReadonlyArray<{ id: string; name: string }>
}) {
  const {
    robotEnvelope,
    setRobotEnvelope,
    setFocusAuditId,
    robotStatusBid,
    setRobotStatusBid,
    robotRowInputFor,
    twinBidBySourceId,
    setRobotComparePair,
    toggleRobotRequest,
    bumpShadowRuns,
    robotNeedsBid,
    setRobotNeedsBid,
    openQuestionsByBidId,
    answerRobotQuestion,
    robotGradeBid,
    setRobotGradeBid,
    referencePresence,
    robotComparePair,
  } = robot
  return (
    <>
      {/* v2.3222: the robot's envelope, opened at send — after the row saved with value + date. */}
      <RobotEnvelopeModal
        bid={robotEnvelope?.bid ?? null}
        run={robotEnvelope?.run ?? null}
        authUser={authUser}
        onClose={() => setRobotEnvelope(null)}
        onOpenAudits={(auditId) => { setRobotEnvelope(null); setFocusAuditId(auditId); selectBidsTab('audits') }}
      />

      <RobotStatusSheet
        input={robotStatusBid ? { ...robotRowInputFor(robotStatusBid), bid: robotStatusBid } : null}
        twin={robotStatusBid ? (twinBidBySourceId.get(robotStatusBid.id) ?? null) : null}
        onClose={() => setRobotStatusBid(null)}
        // v2.3222: shells no longer list on any board — the robot's bid opens on its Counts tab.
        onOpenRobotBoard={(twin) => { setRobotStatusBid(null); selectBidAndSyncUrl(twin as BidWithBuilder, 'counts') }}
        onCompare={(twin, source) => { setRobotStatusBid(null); setRobotComparePair({ source: source as BidWithBuilder, twin: twin as BidWithBuilder }) }}
        onToggleRequest={(bid) => { void toggleRobotRequest(bid as BidWithBuilder); bumpShadowRuns() }}
        onOpenQuestions={() => { setRobotStatusBid(null); selectBidsTab('audits') }}
      />

      <RobotNeedsSheet
        bid={robotNeedsBid}
        questions={robotNeedsBid ? (openQuestionsByBidId.get(robotNeedsBid.id) ?? []) : []}
        onClose={() => setRobotNeedsBid(null)}
        onEditBid={(bid, opts) => openEditBid(bid as BidWithBuilder, opts)}
        onAnswer={answerRobotQuestion}
        serviceTypeName={robotNeedsBid ? (serviceTypes?.find((st) => st.id === robotNeedsBid.service_type_id)?.name ?? '') : ''}
      />

      <RobotReferenceGradeModal
        bid={robotGradeBid}
        presence={robotGradeBid ? (referencePresence.get(robotGradeBid.id) ?? null) : null}
        onClose={() => setRobotGradeBid(null)}
        onEditBid={(bid) => openEditBid(bid as BidWithBuilder)}
      />

      <RobotBidComparisonModal
        pair={robotComparePair}
        onClose={() => setRobotComparePair(null)}
        onOpenBidTab={(bid, tab) => selectBidAndSyncUrl(bid as BidWithBuilder, tab)}
        // v2.3222: the robot's bid opens on its Counts tab — shells no longer list on a board.
        onOpenRobotBoard={(twin) => selectBidAndSyncUrl(twin as BidWithBuilder, 'counts')}
      />
    </>
  )
}
