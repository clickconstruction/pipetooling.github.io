import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2478',
  date: '2026-08-29',
  title: 'Bid room text is fully readable',
  kind: 'fix',
  highlights: [
    'Several headings and prices on the GC\'s bid room page were rendering washed-out (inheriting the login screen\'s light text) — caught in a screenshot review before any GC saw it. All text is dark on white now.',
  ],
}

export default note
