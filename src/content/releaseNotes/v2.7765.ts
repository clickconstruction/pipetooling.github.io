import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7765',
  date: '2026-11-18',
  title: 'Checklist: the Review board’s rows are their own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rows of the Review board and the list that holds them moved out of the big Checklist page into their own file.',
    'Nothing changes on screen. A person’s card, its rows, the tick, the bin and the hold to reorder draw and work as they did.',
    'The Review board has its first test through the page: the tiles, the folds, a person’s rows, the ask before a delete and Undo after a tick.',
  ],
}

export default note
