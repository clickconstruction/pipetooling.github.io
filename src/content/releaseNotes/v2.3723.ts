import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3723',
  date: '2026-09-22',
  title: 'Contract sweep: the one-job send stays put, and three slips from the first live pass',
  kind: 'fix',
  highlights: [
    'On the Contract sweep, “Email the PDF — stay on this job” now does what it says: the pane shows what just went and offers Next, instead of sliding onto the next customer with the blue button armed.',
    'Filing a signed contract no longer loses the sheet when you type the link and click Record without pressing Enter first — a press that starts inside any window never closes it.',
    'An agreement emailed as a PDF and then sent again as a signing link reads as a link send; Edit & re-send leaves a line in the record every time.',
  ],
}

export default note
