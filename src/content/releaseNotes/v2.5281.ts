import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5281',
  date: '2026-10-12',
  title: 'Messages: the link to the phone service is written, not yet switched on',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Calls and texts from the company number are ready to land in each person’s thread once the phone service is connected.',
    'Texts from the reply box are ready to go out from the company number.',
    'Nothing on screen changes yet, and nothing is switched on.',
  ],
}

export default note
