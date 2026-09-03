import { createContext, useContext } from 'react'
import type { SessionNotesJobIdentity } from '../../lib/jobs/sessionNotesSearch'

/**
 * How the Pipeline's per-job "Sessions" doors reach the Session notes modal
 * without threading one more prop through the two tables, the card list, and
 * the activity expand modal (the StagesSearchMark move, v2.1830). The tab
 * provides the opener only for office roles; consumers render nothing on null.
 */
export type SessionNotesOpener = (job?: SessionNotesJobIdentity | null) => void

export const SessionNotesOpenerContext = createContext<SessionNotesOpener | null>(null)

export function useSessionNotesOpener(): SessionNotesOpener | null {
  return useContext(SessionNotesOpenerContext)
}
