import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2174',
  date: '2026-08-23',
  kind: 'feature',
  title: 'Primaries see only their own bids',
  highlights: [
    'A primary’s Bid Board (and every bid tab) now shows only the bids they are the estimator, the account manager, or the creator of — the same set as the Dashboard’s My Bids card.',
    'Enforced by the database, not just the screen, and nothing changes for any other role. (Applies once the migration is pushed.)',
  ],
}

export default note
