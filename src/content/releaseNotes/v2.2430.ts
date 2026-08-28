import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2430',
  date: '2026-08-28',
  title: 'Waiting to hear: notes no longer count as contact',
  kind: 'fix',
  highlights: [
    'The Waiting to hear lens (and the By builder call queue) treated any saved note as a contact — a bid with only a method-less note dropped out of the never-called bucket. Only real calls / emails / texts count now, matching the Bid Board.',
    'The lens\'s "Last contact" date and day count now use the Bid Board\'s own calendar math, so the two surfaces always show the same day and the same age.',
  ],
}

export default note
