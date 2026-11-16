import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7369',
  date: '2026-11-15',
  title: 'Bid Board: your own estimating score, and what a closed job made against its bid',
  kind: 'feature',
  highlights: [
    'An estimator or an account manager now sees their own score at the top of the Bid Board: what their bids won above the hurdle in the last 8 weeks, or how many of their priced bids can be scored yet.',
    'Press the row for the sheet: the hurdle, then your bids by what happened to them. A bid that cannot be scored has a press that opens its Labor tab.',
    'When a job is billed, its bid’s row carries a chip, Closed +$2,300 or Closed −$1,100: what the job made against what the bid was priced to make.',
    'The score now counts a job that closed in the window even when its bid was won before the window.',
  ],
}

export default note
