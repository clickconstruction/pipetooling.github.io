import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5352',
  date: '2026-10-12',
  title: 'Messages: texts say when they are paused for the phone balance',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When the phone service turns a text away for money, the send now says texts are paused.',
    'The next text that goes through ends the pause, and so does a text that reaches a phone.',
    'A text waiting on the carriers to approve the company number says so, and so does one over the daily limit.',
    'Nothing on screen changes yet. The strip and the Settings line come next.',
  ],
}

export default note
