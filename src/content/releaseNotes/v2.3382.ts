import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3382',
  date: '2026-09-13',
  title: 'Accounts Receivable: the footer says what Apply will do, and Apply & next clears the pile',
  kind: 'feature',
  highlights: [
    'The footer reads the plan back before you press it — “Applies $250.00 to 992 · Done Right Foundation. The bill is settled.”, “$500.00 of the deposit stays unapplied.”, or why it can’t apply yet. The Apply button carries the amount.',
    'Apply & next applies the deposit and lands you on the next one in the list instead of closing the modal — a pile of checks is one pass.',
    'Nothing else changed about applying: the same confirmation on Stripe-hosted bills, the same Retry panel if Stripe can’t be closed.',
  ],
}

export default note
