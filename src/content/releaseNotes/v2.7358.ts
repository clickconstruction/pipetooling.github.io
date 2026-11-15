import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7358',
  date: '2026-11-15',
  title: 'GC difficulty rating, part 5: a master rates from a bid, and is asked at the end of a job',
  kind: 'feature',
  highlights: [
    'On the Bid Board, press a GC’s Rated chip, or Rate them on an opened row, to rate that GC from the bid. It is a sheet from the bottom on a phone, with the same sentences as the GC’s record.',
    'Before you save, the sheet says what your points add to this bid: the dollars of cost, the field and office hours behind them, what that is on the price, and how bids to this GC have gone.',
    'When a job with a GC moves to Ready to Bill, the master on the job is asked once how the GC was to work with, at the top of the job’s window. Not now puts the ask away for that job.',
    'The Bid Board shows Rate GCs after a job when any are waiting. One answer settles every job with that GC.',
  ],
}

export default note
