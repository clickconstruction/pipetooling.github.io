import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7118',
  date: '2026-11-13',
  title: 'What we buy: What to stock, the parts we keep going back for',
  kind: 'feature',
  highlights: [
    'Materials → What we buy has a third view, **What to stock**: the parts bought on three or more separate days, ranked by trips. The trip is what stock on a shelf would save.',
    'Each row says how many trips, how many at a time, for how many jobs, what was spent, and whether it was bought at the counter or came on big orders.',
    'Pick the last 30, 90 or 180 days. A row’s name opens its prices bill by bill.',
    'The page says what it cannot tell: a bill is a purchase, not a use, and card purchases at big-box stores are not in it.',
  ],
}

export default note
