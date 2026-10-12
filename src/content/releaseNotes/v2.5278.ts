import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5278',
  date: '2026-10-12',
  title: 'Messages: a place for calls and texts from the company number, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A person’s thread can now keep a call’s recording, transcript, summary and length, and whether a text arrived.',
    'A call or a text that the phone service sends twice is kept once.',
    'Nothing on screen changes yet.',
  ],
}

export default note
