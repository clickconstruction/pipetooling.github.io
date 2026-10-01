import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4340',
  date: '2026-10-01',
  title: 'Lien desk Calendar: overdue, this month, next month and later',
  kind: 'feature',
  highlights: [
    'Pills at the top of the Calendar count what is overdue, due this month, due next month and due later, with the money on each. Press one to see only that month.',
    'Each job is counted once, at its next date: the notice it still owes, else its lien date. The months add up to the whole board.',
    'Overdue sits folded at the top. This month’s bar carries Draft the N, which opens the Notices tab on those jobs.',
    'The search moved to the row of dates, each 15th shows how many jobs fall due on it, and the key is one line at the bottom. The jobs start much higher on the screen.',
  ],
}

export default note
