import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6144',
  date: '2026-10-30',
  title: 'A house’s notice window as a bar under Held for suppliers',
  kind: 'feature',
  highlights: [
    'A job open on Held for suppliers can draw each owed house’s notice window on one calendar: the window as a bar ending on the date we expect its notice by, its unpaid invoices as ticks on their days, and today as a blue line.',
    'Under the rows, one mark per house says where its date came from. A dashed mark reads guessed from the invoice months. A solid mark reads they said, with who said it and when it was written down. A day the house gave draws as its own diamond on the row.',
    'The job’s red line reads as chips with the strip on, paid in full and N houses can still notice, and the per-house notice words go. They told us… stays under each house and on each guessed mark.',
    'The strip is a prototype from punch list #217, Show it, don’t say it, and sits behind a press above the list. The tab reads as before until you press Show the window strips. Press Show today’s look to go back. Nothing about the dates, the invoices or what the houses told us has changed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
