import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2124',
  date: '2026-08-23',
  title: 'Each bid in a package remembers when it went out, and for how much',
  kind: 'feature',
  highlights: [
    'Cover Letter (New): "Mark sent today" stamps every bid in the letter with today\'s date and its ★ value — and sets the bid\'s sent date and value in one click.',
    'The version picker and the letter panel show "sent 7/7 · $279,579" under each bid; Followup\'s Full bid details lists the bids in the package with their sends.',
    'Settings (dev) → Bid Board value for a package: sum of the base bids in the letter (default) or the active bid\'s ★. That\'s the number the Board, Followup, and hit rate see.',
  ],
}

export default note
