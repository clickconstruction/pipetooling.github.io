import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4945',
  date: '2026-10-08',
  title: 'People: the Hours tab’s duplicates banner is its own piece',
  kind: 'infra',
  highlights: [
    'The banner on People → Hours that offers to merge a person with their app account now lives in its own part of the code, with its own tests.',
    'Nothing on screen changes.',
  ],
  roles: ['dev'],
}

export default note
