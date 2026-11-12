import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6979',
  date: '2026-11-11',
  title: 'The Bridge reads Market one way on the whole page',
  kind: 'feature',
  highlights: [
    'On the Bridge, behind The flow, the Market card now reads what the asks are worth a week. It is the same amount the pipe shows. Its badge reads short of the field against that amount.',
    'The dial for Market moves that amount, and Push for more bids says what it adds to it.',
    'On the Sales card, won counts a bid only when it is marked won, or marked started or complete. A bid a job was made from, with no mark, is still awaiting an answer.',
    'In the Sales window, an asker with few marked bids has each ask read at the won rate for bids its size. Estimates are read at the estimates’ own won rate.',
  ],
}

export default note
