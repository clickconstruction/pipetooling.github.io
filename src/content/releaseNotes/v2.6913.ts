import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6913',
  date: '2026-11-10',
  title: 'Find their names on permits: an honest count, and it fits a phone',
  kind: 'fix',
  highlights: [
    'A suggested name said it was listed on its permits in the last year. The records do not reach back a year yet, so it now says permits we can see.',
    'On a phone the window was wider than the screen and its right edge was cut off. Each city is its own chip now, and the window fits.',
    'Compare no longer says a name is with itself, and two permits on one address the same day read as one line with a count.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
