import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7747',
  date: '2026-11-18',
  title: 'Bill Customer: the two banners are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, two banners of the Bill Customer window moved into their own files: the yellow box that asks for a missing email, and the note that says a GC or another recipient is being billed.',
    'Nothing changes on screen. Saving a missing email works exactly as before, and no send or record press was touched.',
  ],
}

export default note
