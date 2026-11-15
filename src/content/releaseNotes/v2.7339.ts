import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7339',
  date: '2026-11-15',
  title: 'Pay calendar: a job on its own calendar is scored on its own payments',
  kind: 'feature',
  highlights: [
    'A job on its own pay calendar is scored on that job’s payments once it has two. The line under its due day ends this job’s record.',
    'Until then the line ends their record on other jobs, and the hover says the job is scored on its own once it has two payments.',
    'The pay calendar window says the same on the job’s side: This job’s record against this, or whose record stands in.',
    'In Money waiting and Accounts Receivable, a customer’s line reads the calendar of the bill furthest past its day. A customer with no calendar and one job on its own no longer reads by its wait.',
  ],
}

export default note
