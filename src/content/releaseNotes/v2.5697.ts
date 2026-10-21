import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5697',
  date: '2026-10-20',
  title: 'Estimates: What went names only the texts that carried this estimate’s link',
  kind: 'fix',
  highlights: [
    'An older estimate’s What went card could list a text that was sent for a newer estimate to the same customer, since it matched any later text with an estimate link.',
    'The card now checks the link inside each text against the estimate’s own, so it lists only the texts that carried this estimate’s live link.',
    'After Send the link again, the card shows the texts carrying the fresh link.',
  ],
}

export default note
