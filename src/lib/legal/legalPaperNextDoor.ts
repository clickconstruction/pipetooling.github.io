import type { LienTimelineNext } from '../jobs/lienTimeline'
import type { StagesLienWindowTab } from '../jobs/stagesDeepLinks'

/**
 * The Legal desk's door to a job's next lien step (v2.6104, punch list #214, PR 1): the verb on the
 * button at the verdict band's right, and where it opens. A § 53.056 notice and the § 53.057
 * retainage notice are drafted, approved and sent on the Lien desk, so those doors open the Lien
 * desk on the job; the affidavit, its service and the release are recorded in the job's Lien
 * window, so those open the window on its tab. Pure. Null when the next step is nobody's press
 * from here — the suit is counsel's, a gone lien has none, and so has nothing.
 */
export type LegalPaperNextDoor =
  | { label: string; to: 'desk' }
  | { label: string; to: 'window'; tab: StagesLienWindowTab }

export function legalPaperNextDoor(next: Pick<LienTimelineNext, 'kind'>): LegalPaperNextDoor | null {
  switch (next.kind) {
    case 'notice':
    case 'late_notice':
      return { label: 'Draft the notice…', to: 'desk' }
    case 'retainage':
      return { label: 'Draft the retainage notice…', to: 'desk' }
    case 'affidavit':
      return { label: 'Go to the affidavit…', to: 'window', tab: 'affidavit' }
    case 'serve':
      return { label: 'Record the service…', to: 'window', tab: 'affidavit' }
    case 'release':
      return { label: 'Record the release…', to: 'window', tab: 'release_record' }
    case 'suit':
    case 'lien_gone':
    case 'none':
      return null
  }
}
