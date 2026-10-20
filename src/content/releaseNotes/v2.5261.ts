import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5261',
  date: '2026-10-12',
  title: 'Messages: calls and texts from the company number, read into the thread, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules are ready for a call, a voicemail, a missed call or a text to land as one line in the person’s thread.',
    'A number that sends STOP is stopped in the app too, and the app answers HELP with how to reach us.',
    'A text going out is checked first: never to a number that sent STOP, always from the company number.',
    'Nothing on screen changes yet.',
  ],
}

export default note
