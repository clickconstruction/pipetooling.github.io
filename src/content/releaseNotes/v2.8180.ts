import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8180',
  date: '2026-11-21',
  title: 'Document builder: the list of jobs under your usual sheet says how many are on it',
  kind: 'fix',
  highlights: [
    'On Insurance requirements for subs, the card under your usual sheet read Every job is on your usual whenever nothing was waiting to publish. It said so with a job held behind, and with a job that had no sheet yet.',
    'It now counts them, as in 1 of 2 jobs is on your usual, and says every job only when every one is.',
    'A job the last publish left behind says so on its row. Publish that job to bring it up.',
  ],
}

export default note
