import { createContext, useContext } from 'react'
import type { ChangeOrderDetail, PayAppDetail } from '../../../lib/flows/roundWindow'
import type { FlowStep, RoundReading } from '../../../lib/flows/state'

/**
 * Open a round's window from anywhere below the GC projects page (Messages cut 4, the prototype's v1.168): the flow panel's
 * round pills call it (helper 4's panel) with the person's reading in hand. Null outside the page.
 */
export interface RoundSpec {
  contactId: string
  who: { name: string; firstName: string }
  step: FlowStep
  round: RoundReading
  /** The job the round is on; null on a lane with no job. */
  projectId: string | null
  /** A change order's or a pay application's own facts, the money only when the reader may see it. */
  detail?: { changeOrder?: ChangeOrderDetail; payApp?: PayAppDetail; theirPage?: boolean }
  /** The records the person's own windows open by, for Ask again until the thread window does. */
  record: { partnerId: string | null; customerId: string | null }
}

export interface RoundOpener {
  openRound: (spec: RoundSpec) => void
}

export const GcRoundOpenerContext = createContext<RoundOpener | null>(null)

export function useRoundOpener(): RoundOpener | null {
  return useContext(GcRoundOpenerContext)
}
