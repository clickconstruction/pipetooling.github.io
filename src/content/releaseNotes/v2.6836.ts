import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6836',
  date: '2026-11-10',
  title: 'What was given in kind counts as a cost, and every arrangement is on one page',
  kind: 'feature',
  highlights: [
    'A line given in kind now counts as a cost. With no job on it, it is overhead on the day it was given.',
    'A line put on a job counts as that job’s material. The Costs tab shows it as Given in kind, and the job’s profit counts it.',
    'A new page, In kind, lists every customer who pays this way. Open Accounts Receivable and press In kind at the top.',
    'Each row says what is given, how far along it is and what is still to come. A row with a month due comes first.',
  ],
}

export default note
