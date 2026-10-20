import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5434',
  date: '2026-10-13',
  title: 'Messages: every file a job has, read into one list, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'One read gathers a job’s files from the papers the app makes, the plan sets, its Drive folder, the trades’ uploads, what we sent and what came in.',
    'A file saved to Drive shows once, where it lives.',
    'When Drive does not answer, the rest of the list still shows.',
    'Nothing on screen changes yet. The Attach picker comes next.',
  ],
}

export default note
