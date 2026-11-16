import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7389',
  date: '2026-11-15',
  title: 'Jobs → Subs: a teammate’s own sheet is owed (PR 3 of the sub labor train)',
  kind: 'feature',
  highlights: [
    'A sheet that names one teammate and no sub now counts as owed on the Pay view. It used to read Payroll and sit in no figure, though nothing in payroll read it.',
    'The teammate has a group of their own with a Team · sub labor chip. Their sheet reads Ready unless you hold it or give it a later day, and Pay records it like any sheet.',
    'The first tile reads Owed for sub labor and counts people when a teammate is owed. The Ledger shows team where it showed crew, and gives the teammate a balance.',
    'A teammate’s sheets can share one payment and hold a credit, as a sub’s do.',
  ],
}

export default note
