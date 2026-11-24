import type { LienTimelineNext } from '../jobs/lienTimeline'
import { lienWindowHref, type StagesLienWindowTab } from '../jobs/stagesDeepLinks'
import { lienWindowDeskDoorHref } from '../lien/lienWindowDeskDoor'
import { PIPELINE_HREF } from './legalDeskRoute'

/**
 * The Legal desk's door to a job's next lien step (v2.6104, punch list #214, PR 1): the verb on the
 * button at the verdict band's right, and where it opens. A § 53.056 notice and the § 53.057
 * retainage notice are drafted, approved and sent on the Lien desk, so those doors open the Lien
 * desk on the job; the affidavit, its service and the release are recorded in the job's Lien
 * window, so those open the window on its tab. Pure. Null when the next step is nobody's press
 * from here — the suit is counsel's, a gone lien has none, and so has nothing.
 *
 * A desk door names its list (v2.8498). The two notices are worked on two lists of the Lien desk,
 * Monthly notices and Retainage notices, and the page sent both to Monthly notices: the retainage
 * door landed on a list the job is not on, where the desk said so and offered the other list.
 * `legalPaperNextDoorHref` is the one place a door becomes an address, and the page reads it.
 */
export type LegalPaperNextDoor =
  | { label: string; to: 'desk'; kind: 'notice' | 'retainage' }
  | { label: string; to: 'window'; tab: StagesLienWindowTab }

export function legalPaperNextDoor(next: Pick<LienTimelineNext, 'kind'>): LegalPaperNextDoor | null {
  switch (next.kind) {
    case 'notice':
    case 'late_notice':
      return { label: 'Draft the notice…', to: 'desk', kind: 'notice' }
    case 'retainage':
      return { label: 'Draft the retainage notice…', to: 'desk', kind: 'retainage' }
    case 'affidavit':
      return { label: 'Go to the affidavit…', to: 'window', tab: 'affidavit' }
    case 'serve':
      // The Lien window's form by its own name (v2.7816). *Record the service…* before.
      return { label: 'Enter mail numbers…', to: 'window', tab: 'affidavit' }
    case 'release':
      return { label: 'Record the release…', to: 'window', tab: 'release_record' }
    case 'suit':
    case 'lien_gone':
    case 'none':
      return null
  }
}

/**
 * Where a press on a job's liens goes from the Legal desk: the Lien desk's list for the paper, on the
 * job; the job's Lien window on the door's tab; and with no door, the job's Lien window as it opens.
 */
export function legalPaperNextDoorHref(jobId: string, door?: LegalPaperNextDoor | null): string {
  if (door?.to === 'desk') return lienWindowDeskDoorHref(jobId, door.kind)
  if (door?.to === 'window') return lienWindowHref(jobId, door.tab)
  return `${PIPELINE_HREF}&lienwindow=${encodeURIComponent(jobId)}`
}
