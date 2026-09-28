import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3981',
  date: '2026-09-27',
  title: 'People → Review: a person’s numbers have tests',
  kind: 'fix',
  highlights: [
    'The read behind a person’s Review panel — their jobs, each job’s money and their share of it — moved out of the tab into its own tested piece. The numbers are worked out exactly as before.',
  ],
}

export default note
