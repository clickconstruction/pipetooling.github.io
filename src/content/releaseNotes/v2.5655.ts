import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5655',
  date: '2026-10-19',
  title: 'A primary marks paid, allocates and removes payments on their own jobs only',
  kind: 'fix',
  highlights: [
    'Mark paid, mark a bill paid, allocate a bank deposit, remove a payment and record a tip now check that a primary is one of the job’s people: its account manager, or the estimator or account manager of the bid it came from.',
    'On any other job the press reads Not authorized, as the Pipeline already hid it. The office is unchanged.',
  ],
}

export default note
