import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4521',
  date: '2026-10-04',
  title: 'Pipeline: a Stripe bill you mark paid moves to Paid in Full right away',
  kind: 'fix',
  highlights: [
    'Recording the full balance on a Stripe bill used to leave the job in Billed or Collections until you refreshed the page.',
    'The window now waits until Stripe has confirmed the payment. The button reads Confirming with Stripe… for that moment, and the row moves as the window closes.',
    'If Stripe takes longer than ten seconds, the window closes with a note and the row moves on its own when the payment lands.',
  ],
}

export default note
