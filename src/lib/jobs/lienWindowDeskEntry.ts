/**
 * One job's place on the Lien desk, as an opener of the Lien window hands it over (punch list #335, Also seen).
 *
 * The window builds its path from the job's filings. It cannot see a notice that is drafted, waiting on approval
 * or printed, or an affidavit that is not yet filed, so an opener that holds the desk's lists hands it the job's
 * two entries (`lienWindowDeskNotice`, `lienWindowDeskAffidavit`) and the header names the desk's step. The
 * Pipeline and the Lien desk page do that from the desk they already hold. The job window's Documents tab held
 * no desk, so the Lien window it opens read *Draft the notice* at every step. This is the same pick for an
 * opener that reads the desk for one job (`useJobLienDeskEntry`). Pure.
 */
import type { LienDeskEntry } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import { lienWindowDeskAffidavit, lienWindowDeskNotice, type LienWindowDeskAffidavit, type LienWindowDeskNotice } from './lienTimelineDesk'

/** What the desk's lists hold, as much as the pick reads. */
export type LienWindowDeskLists = {
  queue: { entries: ReadonlyArray<Pick<LienDeskEntry, 'jobId' | 'pile' | 'item'>> }
  affidavits: { entries: ReadonlyArray<Pick<LienAffidavitEntry, 'jobId' | 'pile' | 'gates' | 'item'>> }
}

/** The two words the window's header reads: where the job's notice stands and where its affidavit stands. */
export type LienWindowDeskEntry = { deskNotice: LienWindowDeskNotice | null; deskAffidavit: LienWindowDeskAffidavit | null }

const NONE: LienWindowDeskEntry = { deskNotice: null, deskAffidavit: null }

/** The job's two entries from the desk's lists; both null with no desk, no job, or a job on neither list. */
export function lienWindowDeskEntryFor(desk: LienWindowDeskLists | null | undefined, jobId: string | null | undefined): LienWindowDeskEntry {
  if (!desk || !jobId) return NONE
  return {
    deskNotice: lienWindowDeskNotice(desk.queue.entries.find((e) => e.jobId === jobId)),
    deskAffidavit: lienWindowDeskAffidavit(desk.affidavits.entries.find((e) => e.jobId === jobId)),
  }
}
