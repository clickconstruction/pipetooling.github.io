import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5030',
  date: '2026-10-09',
  title: 'Demand letter: the theft-of-services line is yours to tick',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The help guides no longer say the theft-of-services line waits on the attorney.',
    'It starts off on every demand letter. On a job with no payment you may tick it. Once anything is paid on the job, the box is greyed out.',
  ],
}

export default note
