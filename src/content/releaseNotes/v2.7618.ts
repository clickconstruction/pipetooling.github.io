import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7618',
  date: '2026-11-17',
  title: 'Estimates: Supporting document and Delivery are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, two parts of a draft estimate moved out of the big estimate page into their own files: Supporting document, and Delivery.',
    'Nothing changes on screen. Check link, Notify me, Also notify, Project and Internal notes work as before.',
    'Each part has its own tests now.',
  ],
}

export default note
