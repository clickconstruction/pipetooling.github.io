import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3355',
  date: '2026-09-12',
  title: 'Bid Costs: History & forecast',
  kind: 'feature',
  highlights: [
    'A fourth lens on Bids → Bid Costs: bids sent by month as won / lost / still open, with the win rate by count and by value, filtered to everyone or one estimator.',
    'A forecast of the open bids: each one counted at the odds bids of its size have actually won (small bids win far more often than big ones), with expected wins and value by person, and the largest bid called out.',
    'Click any bar, odds card, age bucket, or row to list the bids behind the number; click a bid there to select it across the tabs. How long a decision takes fills in now that bids record the day they were decided.',
  ],
}

export default note
