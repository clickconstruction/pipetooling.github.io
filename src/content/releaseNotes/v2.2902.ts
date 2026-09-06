import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2902',
  date: '2026-09-05',
  title: 'Search treats % and _ literally and sorts job numbers as numbers; Settings search finds itself; the Dashboard is not a pin target',
  kind: 'fix',
  highlights: [
    'Typing a % or _ into the header search, the Clock In picker or any job/bid picker now matches those characters literally instead of widening the list to the 50 newest rows.',
    'Job search sorts job numbers as numbers, so J1004 ranks above J999 and the newest jobs are the last to drop off the 50-row list — not the first.',
    'Settings search has an entry for "search" that opens the guide on finding jobs, bids, customers and estimates.',
    'The Dashboard can no longer be pinned to itself; with Pin Mode on it shows a one-line note explaining that pins land there.',
  ],
}

export default note
