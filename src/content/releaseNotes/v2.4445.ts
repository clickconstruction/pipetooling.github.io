import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4445',
  date: '2026-10-02',
  title: 'Submittals: pick for each part in Choose from the takeoff',
  kind: 'feature',
  highlights: [
    'In Choose from the takeoff, Show parts opens a fixture’s parts. Each part has the same three buttons: GC sees it, Order only and Left out.',
    'This works for fixtures already on the draft too. Their parts show as the row holds them, and Update changes the row.',
    'Setting a whole fixture to Order only keeps your picks for its parts. They come back when you set it to GC sees it.',
    'A part that is already ordered cannot be left out.',
  ],
}

export default note
