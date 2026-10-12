import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5249',
  date: '2026-10-12',
  title: 'Messages: who a contact is, whose move it is, and the stamps, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules under one thread per person are written and tested: who a contact is, whose move it is, and when each side last wrote.',
    'A contact is always one of the people the app already has. A number nobody knows can be named later, and its messages stay with it.',
    'Days are read in Chicago, so a text late in the evening is never dated the next day.',
    'Nothing on screen changes yet.',
  ],
}

export default note
