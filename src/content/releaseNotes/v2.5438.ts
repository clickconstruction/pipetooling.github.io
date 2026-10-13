import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5438',
  date: '2026-10-13',
  title: 'Messages: a place for the owner’s switch on the morning reminders, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The reminders the app may send itself each morning get the owner’s switch, one tick per step. Every step starts off, and only the owner or a dev turns one on.',
    'The morning run gets a place to leave its summary of what went and what was kept back. Nothing sends yet, and nothing on screen changes.',
  ],
}

export default note
