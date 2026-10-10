import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5140',
  date: '2026-10-10',
  title: 'Splitting a bill keeps its trip charge or card fee',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Split bill… now moves a trip charge or a card fee on the bill onto one of the parts.',
    'The fee goes on the first part big enough to hold it. Before, the next change to the job dropped it from the job’s total.',
  ],
}

export default note
