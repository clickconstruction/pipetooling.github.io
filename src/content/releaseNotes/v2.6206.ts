import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6206',
  date: '2026-10-30',
  title: 'The Development page says Jobs & bids, not Pieces',
  kind: 'fix',
  highlights: [
    'The second look on a Development page is now called Jobs & bids. It is the same table: each bid beside the job it became.',
    'Every door that pointed at it says so too: See them in Jobs & bids, Show all N in Jobs & bids, and the pairing window reads as the rows will read in Jobs & bids.',
    'Where a sentence said pieces, it now says jobs and bids.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
