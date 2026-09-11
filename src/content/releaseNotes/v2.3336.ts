import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3336',
  date: '2026-09-11',
  title: 'Bid Costs: the pursuit ledger',
  kind: 'feature',
  highlights: [
    'Bids → Bid Costs now answers what bidding costs us: one table with the outcome as a filter, a summary strip (spend, per bid, won of decided, spent on lost), and an estimator rail. Robot bids and bids with no time are folded until you ask.',
    'The tab opens to the office: dev, master and controller read dollars; assistants and estimators read the same ledger in hours.',
    'Card charges moved onto a bid now count as cost instead of subtracting from it, clocked time never reads 5:60 again, and the retired Plan Pages column is gone.',
  ],
}

export default note
