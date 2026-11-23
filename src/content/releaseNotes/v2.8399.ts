import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8399',
  date: '2026-11-23',
  title: 'Job Summary: flip through a job’s supply house invoices without leaving the page',
  kind: 'feature',
  highlights: [
    'Press an invoice number on a job’s Invoices from Supply Houses and the bill opens over the page, with the job’s list beside it. No new tab.',
    'Previous and Next, or the right and left arrow keys, move one bill at a time. They follow the search. Esc closes.',
    'The bill’s facts sit beside the paper: the supply house, the date, the total, what is on this job, the lines read and whether it is paid. Open in Drive opens the PDF in a tab of its own.',
    'A copied link now opens the bill in the app, with the same job’s list, for a teammate in the office. A bill with no PDF says so and offers Open the bill.',
  ],
}

export default note
