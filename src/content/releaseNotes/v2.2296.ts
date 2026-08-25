import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2296',
  date: '2026-08-25',
  title: 'Paste a whole bid tab from a GC email',
  kind: 'feature',
  highlights: [
    'The bid-tab capture gains a "Paste the tab" mode: paste a project\'s lines from a GC\'s bid-tab email and every dollar amount becomes a rung — our line auto-marked, alternates and bidder names kept.',
    'The low / high / our-rank / bidder-count summary fills itself from the paste, so all the tab analytics keep working — and the full ladder stays on the bid, ours highlighted with the gap to the next bid.',
    'Available on Waiting to hear, Why we lost, and the Call queue; phone-call capture ("Type the numbers") is unchanged.',
  ],
}

export default note
