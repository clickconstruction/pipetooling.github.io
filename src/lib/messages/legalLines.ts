/**
 * Residential build, R8 · 7: the Lien desk's sends in a person's thread. A notice, a demand letter or a lien release
 * that went to them shows as a grey line from the office, read only. Under it the reply box is off for everyone but the
 * office, and a reply that comes after it goes to the office alone. The after state is card 7 of
 * `customer-messages-integrations-mockups.html` on branch spike/gc-mode. Pure: a loader hands it the rows.
 *
 * The lines are an overlay, as `sentLines.ts`'s are, never rows written into `messages`. Each is an `event` going out,
 * so the thread draws it as its own grey row and the stamps and the move line skip it: a certified letter never reads
 * as an email we sent. Its id carries `legal:`, and it is marked `legal: true` with its paper.
 *
 * Where the desk keeps its sends: `job_lien_filings` (a notice, a retainage notice, an affidavit, a release, each with
 * `sends`: who it went to, how and on what day), `job_lien_desk_items` (a sent item marked `letterTwo` names the filing
 * that was the second letter) and `job_demand_letters`.
 */
import { isLienOffice } from '../jobs/lienDesk'
import { standingLegalLine } from './legalRoute'
import type { ThreadMessage } from './thread'

// The papers, the lines, the standing line and the route live in `legalRoute.ts`, light enough for the edge copy (R5's
// push). They are this file's too.
export * from './legalRoute'

/** What the reply box says when a legal line keeps it off. */
export const LEGAL_BOX_WORDS = 'Replies on a legal line go to the office. Open the Lien desk to answer.'

export interface BoxState {
  open: boolean
  /** Why it is off, in the box's place. Null while it is open. */
  words: string | null
}

/**
 * The reply box under a thread's lines. Under a legal line it is off for everyone but the office (`isLienOffice`: dev,
 * master, assistant, controller), who answer from the Lien desk. A Lien release on that job turns it back on.
 */
export function boxStateAfter(lines: readonly ThreadMessage[], role: string | null | undefined): BoxState {
  if (isLienOffice(role) || !standingLegalLine(lines)) return { open: true, words: null }
  return { open: false, words: LEGAL_BOX_WORDS }
}
