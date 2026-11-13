import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7174',
  date: '2026-11-13',
  title: 'Subs: a Ledger of every payment, by date',
  kind: 'feature',
  highlights: [
    'Jobs, Subs has a third view beside Work and Pay: Ledger. It lists every payment and back-charge made to a sub as one line, newest first, under its month with the month\'s total.',
    'Each line shows the date sent, who was paid, the job, the memo, the amount and what the sheet still owed after it. Press the job to open the sheet.',
    'Pick This month, Last month, This quarter, This year, All or your own dates. Narrow it to one person with Paid to, or search a sub, a job, a memo or an amount.',
    'Print and Download CSV take the lines you see out of the app, to hold beside a bank statement. A payment saved with no date is marked "no date sent".',
  ],
}

export default note
