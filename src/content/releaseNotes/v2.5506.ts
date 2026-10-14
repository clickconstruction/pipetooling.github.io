import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5506',
  date: '2026-10-14',
  title: 'Messages: the morning reminders run each day at 9, still switched off',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The morning run of the reminders the app sends itself now runs each day at 9 AM.',
    'Every step is still off and nothing sends. Each morning leaves a summary of what it would send and what it kept back.',
  ],
}

export default note
