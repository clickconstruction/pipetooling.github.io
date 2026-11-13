import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7045',
  date: '2026-11-12',
  title: 'Bids: the pricing text you share with a teammate reads in whole dollars',
  kind: 'feature',
  highlights: [
    'Copy for text, in Share with a teammate on the Pricing tab, now shows no cents on a price, a line or the total.',
    'Each line and the total is the true amount rounded, so the total can sit a dollar or two off the lines added up.',
    'A count is never rounded, and a price that needs its cents to add up, like $12.50 a foot, keeps them.',
    'The email, the Pricing tab and what the GC receives are unchanged.',
  ],
}

export default note
