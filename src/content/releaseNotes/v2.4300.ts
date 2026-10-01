import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4300',
  date: '2026-10-01',
  title: 'Edit Job → Bill: payment lines fit a phone',
  kind: 'fix',
  highlights: [
    'A long payment line now wraps beside its amount, and its ⋯ button stays on the first line. Before, the amount, the words and the ⋯ broke onto three separate lines.',
    'In By date on a phone, a bill’s “past expected” line no longer runs off the right edge of the screen.',
  ],
}

export default note
