import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3979',
  date: '2026-09-27',
  title: 'Draft Payroll: Generate Remaining skips a week that comes to $0',
  kind: 'fix',
  highlights: [
    'Generate Remaining made a $0 pay report for a salaried person who was out unpaid all week, or who had not started yet. It leaves them out now.',
    'The count beside the button and the list the button uses are the same list — they could disagree before.',
    'The line beside the button reads “with pay due and no report yet”.',
  ],
}

export default note
