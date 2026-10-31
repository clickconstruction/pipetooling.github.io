import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6232',
  date: '2026-10-31',
  title: 'A residential customer’s steps read from their job',
  kind: 'fix',
  highlights: [
    'A residential customer’s flow now reads for real. The step card in their thread and on their window shows the steps their Pipeline job has done: booked, on the way, arrived, the estimate, the yes, the work, the bill and the review.',
    'The morning run reads them the same way, so the Approved, Paid and Review asked reminders come due when they should. A bill past its pay-by day puts the Paid reminder on the morning’s list, on Offers or Sends as the step is set.',
    'Nothing changes for a trade partner, a GC customer or an architect, and no contact is a residential customer until the office marks one.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
