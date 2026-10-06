import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4664',
  date: '2026-10-06',
  title: 'People: the roster read is checked against the database types',
  kind: 'infra',
  highlights: [
    'The read behind the pay lists now uses the roster view by its own name, so a change to the view shows up when the app is built.',
    'Nothing changes on any screen.',
  ],
  roles: ['dev'],
}

export default note
