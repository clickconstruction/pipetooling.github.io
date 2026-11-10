import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6839',
  date: '2026-11-10',
  title: 'The blue Bid button at the top shows on the Bids page only',
  kind: 'fix',
  highlights: [
    'The blue Bid button in the top bar used to sit on every page. It now shows on the Bids page alone, where it starts a new bid as before.',
    'Nothing else in the top bar moved. Dispatch, Ask estimating and Task stay on every page.',
  ],
}

export default note
