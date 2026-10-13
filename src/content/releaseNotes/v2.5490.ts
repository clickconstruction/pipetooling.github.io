import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5490',
  date: '2026-10-13',
  title: 'Messages: where a residential customer is on their job is read in its own place, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules that read where a residential customer is on their job now sit apart from the rest of the flow’s reading. Nothing on screen changes.',
    'This keeps the bills’ rules out of the server code the morning reminders run on.',
  ],
}

export default note
