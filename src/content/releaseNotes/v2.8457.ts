import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8457',
  date: '2026-11-24',
  title: 'Bills sent: the tiles fill their rows on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, five tiles over Bills sent now sit three and two with the bottom two filling the row. Before, the second row had an empty space.',
    'Three tiles fill one row, and one tile fills the width. An even count still sits two to a row.',
    'Nothing changes at a desk.',
  ],
}

export default note
