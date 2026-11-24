import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8452',
  date: '2026-11-24',
  title: 'Bills sent: a paid line says what is not on record',
  kind: 'fix',
  highlights: [
    'A bill marked paid with no payment on record now reads Paid, then day not on record. Before, it read Paid alone, with nothing to say why it named no day.',
    'A bill paid before its first send on record now says so, where another paid bill says how many days the money took.',
    'The print and the spreadsheet carry the same words.',
  ],
}

export default note
