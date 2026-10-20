import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5526',
  date: '2026-10-14',
  title: 'Job Mode: a helper on the crew leaves a note for the office',
  kind: 'fix',
  roles: ['dev', 'helpers', 'subcontractor'],
  highlights: [
    'A helper on a job’s crew can now leave the office a note from Something else. Before, it said you did not have permission.',
    'A helper on the crew now reads the job’s notes in Job updates, the office’s and the crew’s.',
  ],
}

export default note
