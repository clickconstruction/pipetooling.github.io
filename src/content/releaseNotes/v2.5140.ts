import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5140',
  date: '2026-10-10',
  title: 'Splitting a bill keeps its trip charge',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Split bill… now moves a trip charge on the bill onto the first part big enough to hold it. Before, the next change to the job dropped it from the job’s total.',
    'If no part is big enough for the charge, Split says so and waits for new amounts.',
    'A bill that carries a GC’s card fee cannot be split. Split says so.',
  ],
}

export default note
