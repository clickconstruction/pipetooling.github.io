import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1909',
  date: '2026-08-20',
  title: 'Counts: try the new Count Sheet',
  kind: 'feature',
  highlights: [
    'The Counts tab now has Old and New pills. Old is the table you know; New is the Count Sheet — totals up top, and a "By plan page" view that turns your counts into a page-by-page audit against the drawings.',
    'Rows missing a plan page stand out in red — click the tile to see just those.',
    'Quick add types like a counter works: tap a fixture chip, set the count, Enter — added, and ready for the next one.',
    'Typing a fixture that is already on the bid offers a one-click Merge instead of quietly creating a duplicate.',
  ],
}

export default note
