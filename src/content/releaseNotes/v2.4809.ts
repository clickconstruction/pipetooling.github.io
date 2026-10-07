import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4809',
  date: '2026-10-07',
  title: 'GC mode: the tables for moves and the schedule’s records',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule gets the rest of its record tables: each move with what it pushed and who was told, the weekly walks, a week’s look-ahead marks, what the work waits on, a trade’s late notice and crew count, and the customer’s schedule as it was sent.',
    'Records that never change are kept that way: a saved move can only be undone or redone, and a late notice only pushed back. Only a dev can see them while they are built, and nothing reads or writes them yet.',
  ],
}

export default note
