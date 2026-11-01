import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6285',
  date: '2026-11-01',
  title: 'Days on the job: the range is one quiet menu, and an empty card says what fills it',
  kind: 'feature',
  highlights: [
    'The row of Whole job, Last 90d, Last 365d and Dates… pills on the job window\'s History tab is gone. One small Whole job menu on the card\'s top line holds the same four choices, so the card no longer reads as a second tab bar.',
    'A job with no clock-ins yet reads "No days on this job yet. The first clock-in on this job starts the calendar." A narrowed range with nothing in it offers Whole job as the way back out.',
    'The legend under the calendar draws only when there is a calendar to read.',
  ],
}

export default note
