import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4951',
  date: '2026-10-08',
  title: 'My Time day editor: the day’s timeline draws from one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the part of the time editor that draws the day moved to its own file. That covers the strips, the Off clock gaps, the overlap warnings and Add session.',
    'Nothing changes on screen.',
    'New tests cover what it draws in both layouts, and when Add session shows.',
  ],
}

export default note
