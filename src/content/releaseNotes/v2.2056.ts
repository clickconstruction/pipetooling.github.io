import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2056',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Checklist repeats: never expire again',
  highlights: [
    'Weekly repeating tasks used to be created two years ahead and then silently stop. They now stay stocked five weeks ahead automatically, forever — a nightly job tops them up.',
    'The years of empty future occurrences are cleaned out, which also makes checklist screens and histories faster and truthful.',
    'Part 2 of the checklist scheduling overhaul.',
  ],
}

export default note
