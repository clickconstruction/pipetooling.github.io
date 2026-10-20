import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5436',
  date: '2026-10-13',
  title: 'Messages: the morning reminders read everyone’s flow the way their own panel does, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The morning run of the reminders the app sends itself now has the piece that reads everyone’s flow at once, the same way each person’s own panel reads it.',
    'The owner’s switch is one tick per step, and every step is off until the owner turns one on. Nothing sends yet, and nothing on screen changes.',
  ],
}

export default note
