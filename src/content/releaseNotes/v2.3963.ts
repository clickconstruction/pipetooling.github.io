import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3963',
  date: '2026-09-27',
  title: 'Bid Board and Dashboard maps: scrolling past them no longer zooms them out',
  kind: 'fix',
  highlights: [
    'The Bid Board’s Bids on a map and the Dashboard’s Your jobs on a map now behave like the Pipeline map: the mouse wheel scrolls the page when the pointer crosses the map.',
    'Click the map once — anywhere on it, a pin, or the + / − buttons — and the wheel zooms the map from then on.',
    'The + / − buttons, dragging and the pins work from the start. Phones are unchanged.',
  ],
}

export default note
