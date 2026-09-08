import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2963',
  date: '2026-09-06',
  title: 'Jobs → Subs: the four tiles open queues you clear from inside, and the toolbars move up beside Work / Pay',
  kind: 'feature',
  highlights: [
    'Click On a handshake, Stages waiting, Offers out or Signed this month and a queue opens: the rows the tile counts, the row you are on expanded into the one form that resolves it, a bar counting what you handled, and the counting rule in the footer.',
    'On a handshake sends the work order from the row — price and window pre-read from the sheet, a Job picker for a sheet that is not in Pipeline, and Send the rest as drafted for the remaining ones.',
    'Stages waiting picks the sub with a chip per roster sub for the window (free · on another job · off), moves a passed window in the same form, and answers a GC ask on the row. Offers out re-sends an expired offer with a fresh good-through, nudges, extends +7 days, or hands the work to someone else. Signed this month turns each row’s next move into a button: schedule the inspection or mark it passed, bill the customer, pay the sub.',
    'The Work toolbar (+ New work order, search, the filter chips) and the Pay toolbar (New Sub Labor, search) now sit on the Work / Pay row, so the tiles start higher. One money column (agreed · paid in green · open in red) and the rail label centered under its dots. Dev only: a Classic | Compact prototype switch on the Work toolbar.',
  ],
}

export default note
