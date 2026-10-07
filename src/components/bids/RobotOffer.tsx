import { robotOfferNote } from '../../lib/submittals/robotNote'
import type { RobotKind, RobotSeatState } from '../../lib/submittals/robotOffer'
import { RobotNote } from './RobotNote'

/**
 * One robot offer (v2.4136, punch list #59): the same at every spot on Submittals. Since
 * 2026-10-05 it is one line — the ask button, second to the human door beside it — and the
 * three lines it used to print (what the robot does, what it needs and whether this bid has it
 * with the awake line, what you do after) open in a card on hover, on focus and on a tap, with
 * the door to the guide's robot section (`RobotNote`). A need the bid does not meet holds the
 * button and says why beside it. Draws nothing while no seat is live.
 */
export function RobotOffer({
  kind,
  seat,
  hasPlans,
  busy,
  onAsk,
  testId,
  tour,
}: {
  kind: RobotKind
  seat: RobotSeatState
  /** The schedule read needs the plans on the bid; the other kinds have what they need when offered. */
  hasPlans?: boolean
  busy: boolean
  onAsk: () => void
  /** The button's `data-testid`. */
  testId: string
  /** The walkthrough anchor on the block, when the tour has a stop for it. */
  tour?: string
}) {
  const note = robotOfferNote(kind, seat, { hasPlans })
  if (!note) return null
  return <RobotNote note={note} busy={busy} onPress={onAsk} testId={`robot-offer-${kind}`} buttonTestId={testId} needsTestId={`robot-needs-${kind}`} tour={tour} />
}
