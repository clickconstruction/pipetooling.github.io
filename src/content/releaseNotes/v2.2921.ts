import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2921',
  date: '2026-09-06',
  title: 'Help guides for the money side read the way the app now works',
  kind: 'fix',
  highlights: [
    'Two new guides: "close the money week" (Moneyfill\'s queues, the week picker, the report button, the Quickfill close-week chip, the auto-approve switch) and "sort the bank feed" (jobs in Job Parts Tally, people and labels on Banking, what Reconciliation checks).',
    'Billing guides name the job window\'s Bill tab, say where call mode and the deposit-matching desk live, and explain what a trip charge does to the job total and what a lien deadline counts from.',
    'GC statement round: the three lanes named, the $0 "nothing owed" rule, and the "app never emails a GC" line corrected to match Draft Message and scheduled sends.',
    'Crew P&L explains why office rows read negative; Quickfill\'s guide now lists every role that can open it.',
  ],
}

export default note
