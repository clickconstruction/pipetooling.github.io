import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7291',
  date: '2026-11-14',
  title: 'The dev seat stops carrying the overhead parts reads',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. The accounting buckets behind a parts line asked the overhead reads for the shape of one line, and the dev seat was sent up with the reads, the in-kind ledger and the paging behind them for that.',
    'The shape has a file of its own now, and the dev seat is sent up at 3.75 MB where it was 3.82 MB. The Bridge’s Monday email still reads the overhead as it did.',
  ],
}

export default note
