import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2403',
  date: '2026-08-27',
  title: 'The "or total" box rides the margin slider',
  kind: 'feature',
  highlights: [
    'Dragging the solver\'s margin slider (or typing a margin) now carries the "or total" box with it — the bid\'s ideal total rises and falls live, so you can see where you\'re landing and step straight over to fine-tune the number.',
    'Clicking into the box selects the whole total for type-to-replace, and while you\'re in it the slider keeps its hands off — your typing is never overwritten.',
  ],
}

export default note
