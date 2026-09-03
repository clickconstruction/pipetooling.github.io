import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2731',
  date: '2026-09-03',
  title: '"+ version" fallback source follows the book that holds the bid\'s prices',
  kind: 'fix',
  highlights: [
    'Splitting a bid clones its prices from the bid\'s active price option. When a bid has no active option yet (an older bid priced straight on a shared book, in the moment before it resolves), the split now starts from the book that actually holds the bid\'s prices instead of your default book for new bids.',
    'Bids with their own price copy are unchanged; your default book for new bids is unchanged.',
  ],
}

export default note
