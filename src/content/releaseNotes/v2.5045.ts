import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5045',
  date: '2026-10-09',
  title: 'GC mode: Start and Start anyway, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A won GC job can now be started. It moves to building on the company’s day.',
    'Start anyway keeps who started the job before everything was in, why, and what was still missing.',
    'Nothing on screen changes yet.',
  ],
}

export default note
