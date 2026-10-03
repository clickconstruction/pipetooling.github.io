import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4472',
  date: '2026-10-03',
  title: 'Pipeline and Job Summary: a percent or a job set in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'On a Pipeline row, a percent typed, set or reported after 7 pm Central read the next day, as in 80% typed Sep 4. It now reads the day it was set.',
    'A percent typed in the evening is now marked behind once the crew works the next day.',
    'Job Summary dated a job with no clock hours, and a return visit, from the day after an evening start. Capacity counted a person archived in the evening for one more day.',
    'A clock-in with no work date reads its own day in Quickfill and on the phone’s hours list.',
  ],
}

export default note
