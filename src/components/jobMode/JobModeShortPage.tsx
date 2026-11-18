import type { ReactNode } from 'react'
import { JOB_MODE_SHORT_WORDS } from '../../lib/jobMode/jobModeShort'
import { JobModeShortRow } from './JobModeShortRow'

/**
 * The short Job Mode page (punch list #384): what a superintendent on the Short view sees with Job Mode on. Top
 * to bottom: the job card with its lower half folded (`DashboardJobModeCard short`, which holds **Open this job**
 * and the pace line), **Waiting on you** (Your record, moved up), **Tomorrow** in one line, and one door,
 * **Everything else**. Nothing is removed from the app: each cut is one press from here.
 *
 * The page's part is the order and the two rows. The Dashboard hands in the pieces it already owns, so every
 * press lands where it lands on the full page. `jobModeShort.ts` holds the rule and every word.
 */
export function JobModeShortPage({ top, card, waiting, tomorrow, coursesOwed, onTomorrow, onEverythingElse, tail }: {
  /** Above the card: the hidden clock mount the card's presses need, and the two strips that are rare. */
  top?: ReactNode
  /** The job card, short. */
  card: ReactNode
  /** Your record under its short-page name. It draws nothing while the record is clean. */
  waiting?: ReactNode
  /** Tomorrow's line, from `jobModeShortTomorrow`. */
  tomorrow: { title: string; note: string }
  /** How many required courses are owed, for the door's second line. */
  coursesOwed: number
  onTomorrow: () => void
  onEverythingElse: () => void
  /** The Leave report and Turnaway windows the card opens. */
  tail?: ReactNode
}) {
  const w = JOB_MODE_SHORT_WORDS
  return (
    <div data-job-mode-short>
      {top}
      {card}
      {waiting}
      <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem' }}>
        <JobModeShortRow testId="job-mode-short-tomorrow" title={tomorrow.title} note={tomorrow.note} onPress={onTomorrow} />
        <JobModeShortRow testId="job-mode-short-door" title={w.door} note={w.doorNote(coursesOwed)} onPress={onEverythingElse} />
      </div>
      {tail}
    </div>
  )
}

export default JobModeShortPage
