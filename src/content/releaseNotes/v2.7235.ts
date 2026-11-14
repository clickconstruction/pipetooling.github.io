import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7235',
  date: '2026-11-13',
  title: 'Subs pay: one check across several sheets, and the extra kept as a credit',
  kind: 'feature',
  highlights: [
    'Record payment on a sub sheet now takes the whole check. An amount past the sheet goes to the sub\'s other open sheets, oldest first, and the window lists each line before you press.',
    'Anything past their sheets is kept as the sub\'s credit. The next payment to that sub offers it first: "Use $… on this sheet" pays the sheet with no money leaving the bank.',
    'The credit shows on the payment, on the Subs Ledger by date and by sub, on a sub\'s statement and under Balance due on People, Subs.',
    'Every payment recorded from now on is a numbered sending. Lines that were one check share the number, and a number is never used twice.',
  ],
}

export default note
