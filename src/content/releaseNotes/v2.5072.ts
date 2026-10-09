import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5072',
  date: '2026-10-09',
  title: 'GC Review: the week’s checks, marks and account men are read in one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, how GC Review reads the week’s checks, its marks and each GC’s account man moved out of the window into one shared piece. The Stages board can read through the same piece next.',
    'Nothing changes on screen. Every open still reads the week afresh, and a mark, a check, an undo, a call sheet or a new account man still shows right away.',
    'New tests cover each read and each of those writes.',
  ],
}

export default note
