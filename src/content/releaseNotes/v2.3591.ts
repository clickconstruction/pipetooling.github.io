import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3591',
  date: '2026-09-18',
  title: 'Pricing locks once a bid is sent — Revise to change it on purpose',
  kind: 'feature',
  highlights: [
    "A bid that has been marked sent now refuses pricing changes: assigning or removing a book entry, typing a price, the margin brush, Fill from book, the solver's Apply and \"Use $X on this bid\" each stop with a reminder of the sent date.",
    'A chip beside the Sent-vs-today line says the bid is locked. Revise… unlocks it for this browser session and turns the chip amber; Lock again closes it. The sent number on the record never changes.',
    'Two older bids that were still pricing straight on a shared book (BP430, BP431) now own their own copies, so book edits no longer move them.',
  ],
}

export default note
