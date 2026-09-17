import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3574',
  date: '2026-09-17',
  title: 'Bid Board: a won bid\'s "Where this bid is" keeps going — Job opened, then Job accounts',
  kind: 'feature',
  highlights: [
    'On a won or started bid, the opened row\'s step strip runs past Sent into a Won lane: step 11 Job opened (done once the win moment created the job) and step 12 Job accounts (done once every house that quoted or expects an account is open or marked not needed).',
    'While a house is still missing, step 12 rings as next and names it — "Reece missing" — and clicking it opens the same Job accounts question the row\'s "…" chip opens.',
    'Bids that are not won never show the lane; the ten poster steps read as before.',
  ],
}

export default note
