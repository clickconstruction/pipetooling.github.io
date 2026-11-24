import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8455',
  date: '2026-11-24',
  title: 'Job Mode no longer wears a green “New” on the row at the top',
  kind: 'fix',
  highlights: [
    'On a phone, the row at the top of the Dashboard reads Task Mode, Dashboard and Job Mode. Job Mode carried a small green “New” until a part of the row was first tapped on that phone.',
    'The mark is gone. It showed again on every new phone, and for anyone looking through View as, long after Job Mode stopped being new.',
    'Nothing else on the row changes yet. This is the first step of a row that shows for five seconds on each visit and then slides away.',
  ],
}

export default note
