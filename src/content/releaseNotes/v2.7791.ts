import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7791',
  date: '2026-11-18',
  title: 'Job Mode: a date in a job name reads as the day and the month and day',
  kind: 'fix',
  highlights: [
    'A job named with a date, like 2026-11-08, shows it on the Job Mode card as Sun, Nov 8. The title and the list of today’s stops both read that way.',
    'The Tomorrow line on the short page and the lines under Waiting on you say the date the same way.',
    'The job’s name itself is not changed. Search, the job window and every other page show it as it was typed.',
  ],
}

export default note
