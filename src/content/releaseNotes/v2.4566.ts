import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4566',
  date: '2026-10-05',
  title: 'Team purchases: go back to a sorted purchase, and tick more than one invoice',
  kind: 'feature',
  highlights: [
    'Team purchases follow-up has a third list, Sorted: every card purchase sorted in the last 30 days, with where it went, who sorted it and when. Open one to add an invoice or change its job.',
    'In Link invoices, the invoices you tick stay in a Chosen box at the top while you search for the next one. Before, a ticked invoice dropped out of sight as soon as you searched again.',
    'A line under the box says whether the invoices add up to the card charge, and how much is left when they do not.',
    'The Sorted list marks any purchase whose invoices add up to less than the charge, so one with a missing invoice is easy to find and finish.',
  ],
}

export default note
