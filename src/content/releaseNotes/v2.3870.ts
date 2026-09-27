import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3870',
  date: '2026-09-26',
  title: 'Estimates: the line-item catalog window is its own piece',
  kind: 'fix',
  highlights: [
    'The window that picks a saved line into a draft — and, for the catalog’s editors, edits the catalog with each item’s history — moved out of the Estimates page into its own component, unchanged, with a smoke test and a tested reading of the history sentences and the filter. The page’s shared input and button styles moved with it into one file both use.',
    'Nothing on screen changes.',
  ],
}

export default note
