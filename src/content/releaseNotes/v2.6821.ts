import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6821',
  date: '2026-11-09',
  title: 'The ticket’s other doors: the Job Mode card, a paper handed in at the desk, and a ticket that becomes a bill',
  kind: 'feature',
  highlights: [
    'The Job Mode card has a Ticket line beside Photos. Press it and the camera opens with that job picked already, the same press as Tally’s.',
    'On the Team queue a charge line has + Ticket for a paper handed in at the desk. Pick the scan, the photo or the PDF and it lands on that charge, with the holder named as its taker.',
    'Add invoice’s Start from now offers a tech’s ticket bought on a PO code at that house, beside the thread’s files. Pick it and the fields fill from the ticket’s photo; Save ties the ticket to the bill.',
    'On the Tickets tab, a ticket on account has Record as a bill, which opens Add invoice on that ticket at its house.',
  ],
}

export default note
