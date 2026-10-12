import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5260',
  date: '2026-10-12',
  title: 'Messages: where each person stands on their flow, read from the facts',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Groundwork for the flows in Messages. Nothing changes on screen yet.',
    'The app can now read which step each person is on, from the facts it already keeps.',
    'A step that runs out, like an expired insurance certificate, shows as lapsed without holding the rest up.',
    'A declined bid ends that job’s steps, and a person off the flow gets no reminders.',
  ],
}

export default note
