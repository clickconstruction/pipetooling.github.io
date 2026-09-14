import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3445',
  date: '2026-09-14',
  title: 'Demand letter: dates and numbers as the bill shows them',
  kind: 'fix',
  highlights: [
    'The statement of account now reads “sent” as the day the bill went out, not the day it was later delivered or re-sent, and shows the due date from the Stripe bill when the job never recorded one.',
    'A job’s first bill no longer reads “#0” when the app has to fall back to a number — it reads by the job number.',
    'One grammar slip in the letter’s opening sentence fixed.',
  ],
}

export default note
