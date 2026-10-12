import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5279',
  date: '2026-10-12',
  title: 'Messages: each flow reads the records the app already keeps',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'Where a trade partner, a customer or an architect stands can now be read from their papers, asks, quotes, draws, pay applications, change orders and plans.',
    'A trade partner who declines to quote stays on the job with the ask done, and that job ends for them.',
    'Submittals no longer read as done just because a pay application was certified.',
  ],
}

export default note
