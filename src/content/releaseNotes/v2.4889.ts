import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4889',
  date: '2026-10-08',
  title: 'GC mode: the Project Board on real data, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev sees the Project Board at the top of GC projects. It shows every GC project by its stage, with a strip that jumps between them.',
    'Each row says the days left before our bid is due, or the days to the start once we won. It also shows the customer, the architect and the price so far.',
    'The line under the price opens a card. It lists each trade by what happens next and about what the price comes to once every trade is in.',
    'Everyone else sees GC projects as before, with the list of projects.',
  ],
}

export default note
