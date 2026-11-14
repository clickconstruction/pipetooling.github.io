import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7246',
  date: '2026-11-14',
  title: 'Materials on site: a short count with no price is said, not $0.00',
  kind: 'fix',
  highlights: [
    'On the materials desk, Missing this week was money alone. A part with no price added nothing to it, so a job that came up short on typed parts read $0.00 and looked fine.',
    'Under the money, the desk now says how many lines came up short, and how many of them have no price. The same words are on a site’s row, a site’s screen and a job’s window.',
    'A job that came up short is amber and sorts toward the top, whether or not its short parts have a price.',
    'On the Materials page, the Track caption says when lines came up short and none of them has a price.',
  ],
}

export default note
