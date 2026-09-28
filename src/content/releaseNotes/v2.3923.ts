import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3923',
  date: '2026-09-27',
  title: 'Bids: a link to a bid under another trade reads one tested rule',
  kind: 'fix',
  highlights: [
    'When a link opens a bid that lives under a different trade, the Bids page switches trades to find it. That lookup was written five times; it is now one rule with tests. Nothing you see changed.',
  ],
}

export default note
