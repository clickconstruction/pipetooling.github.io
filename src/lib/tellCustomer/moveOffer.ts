/**
 * The board's ask (v2.5627, punch list #123 PR 2): when the office moves a job forward on the Pipeline to a stage the
 * customer feels, Tell the customer opens with that step's text, so the move and the word to the customer are one
 * moment and nobody hunts for a door. The moves are `flows/stageSends.ts`'s felt moves less Paid; the switch is the
 * residential step's in Settings → Flows (`messages_nudge_app_sends_v1`), off until the owner turns it on. Pure.
 */
import { appSendMode, type AppSends } from '../flows/nudgeDispatch'
import { FELT_MOVES } from '../flows/stageSends'
import { isMoveMoment, MOMENT_STEP, type MoveMoment } from './tellCustomer'

export type JobMoveStatus = 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'paid'

/** The board's order, so a move back asks nothing. */
export const MOVE_RANK: Readonly<Record<JobMoveStatus, number>> = { waiting: 0, working: 1, ready_to_bill: 2, billed: 3, paid: 4 }

const rankOf = (status: string | null | undefined): number | null => (status && status in MOVE_RANK ? MOVE_RANK[status as JobMoveStatus] : null)

/**
 * The moment a move asks about: Working, Done or Billed when the job went forward to Working, Ready to Bill or Billed.
 * Null for a move back (a send-back), a move to Waiting or Paid, or a status the board does not know. A job whose
 * status before the move is unknown asks as a forward move.
 */
export function moveMoment(fromStatus: string | null | undefined, toStatus: string): MoveMoment | null {
  const step = FELT_MOVES[toStatus]
  if (!step || !isMoveMoment(step as never)) return null
  const from = rankOf(fromStatus)
  const to = rankOf(toStatus)
  if (from != null && to != null && to <= from) return null
  return step as MoveMoment
}

/**
 * Whether the board asks before the move's text: the residential step is set to Offers or Sends in Settings → Flows.
 * Both ask on the board, since a person is there to press; Off asks nothing.
 */
export function moveAsks(sends: AppSends, moment: MoveMoment): boolean {
  return appSendMode(sends, 'residential', MOMENT_STEP[moment]) !== 'off'
}
