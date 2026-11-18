import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7766',
  date: '2026-11-18',
  title: 'Checklist: the Review board’s tiles, fold headers, Undo bar and delete ask are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, four drawn pieces of the Review board moved out of the big Checklist page: the three tiles, the fold headers, the Undo bar after a tick and the ask before a delete.',
    'Nothing changes on screen. Each piece draws what the board hands it, and the board still keeps every tick, undo and delete.',
    'The Checklist page is now about 2,150 lines, down from 4,039 at the start of the night.',
  ],
}

export default note
