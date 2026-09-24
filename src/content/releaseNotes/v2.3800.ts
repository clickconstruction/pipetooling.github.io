import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3800',
  date: '2026-09-24',
  title: 'Day book: a follow-up counts when the estimator wrote one',
  kind: 'fix',
  highlights: [
    'The estimating strip’s “No follow-up in 7 days” tile counted a bid as never followed up unless the entry named a contact method — most human notes don’t, so “touched base with them and did follow up today” didn’t count. Any note on the bid from the day it first went out through seven days after now does.',
    'A note written before the bid was sent is not a follow-up to it, and the app’s own “Win/Loss changed” line never is.',
    'The other two tiles the Sep 22 live pass questioned were right as written: both lost bids carry a reason on a version, and no price request in the window was Wendi’s.',
  ],
}

export default note
