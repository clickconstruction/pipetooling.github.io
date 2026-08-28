import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2414',
  date: '2026-08-28',
  title: 'Won and Lost live with each GC',
  kind: 'feature',
  highlights: [
    'On a bid with versions, each GC row in Edit Bid now takes the answer: Won, Lost… (with the why-we-lost reasons), or ↩ back to waiting — the same records the Bid Board\'s GC pills write.',
    'A win with one GC automatically marks the other sent, unanswered GCs lost ("their GC lost the project"), and the bid\'s Win/Loss rolls up on its own — the segment\'s Won/Lost buttons lock on multi-version bids, with Open kept as the reset.',
    'Why-we-lost analytics get honest per-GC reasons instead of one blended answer per bid.',
  ],
}

export default note
