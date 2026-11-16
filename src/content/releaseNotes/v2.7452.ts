import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7452',
  date: '2026-11-16',
  title: 'Morning reminders read a bill’s own due day and terms in days',
  kind: 'fix',
  highlights: [
    'The morning run that plans a customer’s Paid reminder now reads a bill’s own due day, as the Pipeline row shows it.',
    'It also reads pay terms set as a number of days after the bill. Before, such a bill was judged by the payer’s usual pace.',
    'This starts with the morning run’s next update, which waits on the office’s go. No bill has a due day of its own yet, and no payer is on terms in days.',
  ],
}

export default note
