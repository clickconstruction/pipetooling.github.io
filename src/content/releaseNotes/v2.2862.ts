import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2862',
  date: '2026-09-05',
  title: 'One set of billing numbers — Dashboard, Pipeline, Quickfill and the Customer pages now agree',
  kind: 'fix',
  highlights: [
    'Ready to Bill, Billed Awaiting Payment and the money owed now come from one rule everywhere: the Dashboard AR card, the Billed pin, the Pipeline money strip, Quickfill\'s "who owes what", the Customer Hub and the Customers list all show the same counts and totals.',
    'A bill sitting on a job that is already Paid in Full, or on a job that no longer exists, is never counted as owed — the AR card and Quickfill say how many such bills were left out and for how much, instead of listing an "Unknown job" nobody can act on.',
    'A bill that has been fully paid but never marked Paid stays in the list at $0 with a "not yet marked Paid" note, so the bill count matches the Pipeline and nobody is chased for it.',
    'The Customer Hub\'s Invoices footer now shows the same Lifetime and collected figures as the money strip up top, including jobs billed before the app kept invoice rows; over-paid jobs no longer shrink another job\'s balance.',
  ],
}

export default note
