import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5983',
  date: '2026-10-27',
  title: 'The Monday sheet names the same jobs on the page and in the email',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The move to price jobs with no contract names them in job-number order, so the Bridge and the weekly email list the same jobs.',
  ],
}

export default note
