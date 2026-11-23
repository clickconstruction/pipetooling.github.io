import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8349',
  date: '2026-11-23',
  title: 'Dashboard: swipe a bid left to hide it',
  kind: 'feature',
  highlights: [
    'On a phone, swipe a bid on My Bids to the left to hide it. A strip under the bid reads Hide and turns blue when letting go will hide it. A shorter swipe springs back.',
    'Hiding a bid says which one, with Undo for ten seconds. The bid also waits in Hidden, where Show again brings it back any time.',
    'At a desk, Hide stays a word press on each bid. On a phone Tab still reaches Hide, and a screen reader hears Hide and the bid’s name.',
  ],
}

export default note
