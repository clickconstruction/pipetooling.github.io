import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5659',
  date: '2026-10-20',
  title: 'Estimators send Dispatch a draft of the job they won',
  kind: 'feature',
  roles: ['estimator', 'dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a won bid an estimator now presses Send to Dispatch. A short sheet holds the job’s name, address, GC, the figure it starts at, the trade, a wanted-by day and a note.',
    'Dispatch’s inbox shows the draft on the row. Its Open the job opens New Job with the estimator’s choices, so the assistant only adds the crew and the schedule.',
    'The bid then reads “Sent to Dispatch · waiting”, and once the job exists, the job’s number. A won bid that already has a job no longer offers an estimator a second one.',
  ],
}

export default note
