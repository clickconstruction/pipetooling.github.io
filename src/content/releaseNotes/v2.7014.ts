import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7014',
  date: '2026-11-12',
  title: 'The Pipeline stays inside a tablet-wide screen again',
  kind: 'fix',
  highlights: [
    'On a screen about as wide as a tablet, the Pipeline’s search box squeezed in beside New Job, Follow-ups, Forecast and Projects, and its ⋯ menu ran off the right edge, so the whole page slid sideways. When the box no longer fits beside those buttons, it now moves down to a line of its own, full width.',
  ],
}

export default note
