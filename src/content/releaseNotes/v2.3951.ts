import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3951',
  date: '2026-09-27',
  title: 'Pipeline map: scrolling past it no longer zooms it out',
  kind: 'fix',
  highlights: [
    'On Jobs → Pipeline, the mouse wheel now scrolls the page when the pointer crosses the map, so scrolling down to the board leaves the map where it was.',
    'Click the map once — anywhere on it, a pin, or the + / − buttons — and the wheel zooms the map from then on.',
    'The + / − buttons, dragging and the pins work from the start. Phones are unchanged.',
  ],
}

export default note
