import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2774',
  date: '2026-09-04',
  kind: 'infra',
  title: 'Takeoffs refresh: the app can now recall what a fixture got last time',
  highlights: [
    'Behind the scenes: a new lookup returns, for any fixture on a bid, the last few bids that costed the same fixture and exactly which parts they used. New 1\'s "Same as B383" and New 2\'s "Copy fixtures from a previous bid" are built on it. Nothing on screen changes yet.',
  ],
}

export default note
