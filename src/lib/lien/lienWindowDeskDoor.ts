/**
 * Where the Lien window's next-step button lands on the Lien desk (punch list #335, Also seen).
 *
 * A notice, a retainage notice and an affidavit to draft, approve or review are worked on the desk, so the window's
 * header button for those steps opens the desk (`lienWindowNextStep.ts`). The two openers that hold the window, the
 * Pipeline and the Lien desk page, sent the job only for a notice: an affidavit's button opened the Affidavits list
 * with no job, and the list opened on its own first row, which is another job's paper.
 *
 * The desk reads a job on each of its three paper lists (`lienDeskAim.ts`): it opens the job's row, or says the job
 * is not on that list and offers where it is. So the door always names the job, as the Accounts Receivable chip's
 * door does (`lienArChipHref`). Pure.
 */
import { lienDeskHref } from './lienDeskRoute'

/** The three papers the window sends back to the desk. */
export type LienWindowDeskDoorKind = 'notice' | 'retainage' | 'affidavit'

/** The desk's address for one job's paper: its list, on that job. */
export function lienWindowDeskDoorHref(jobId: string, kind: LienWindowDeskDoorKind): string {
  return lienDeskHref({ kind, job: jobId })
}
