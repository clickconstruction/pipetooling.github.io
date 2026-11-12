import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6995',
  date: '2026-11-12',
  title: 'First look: the thank-you no longer promises a look "before 11:59 PM"',
  kind: 'fix',
  highlights: [
    'On the First look trial page, the thank-you names the office\'s closing time only when it is a real one. When the office hours run to midnight it says the office looks today.',
  ],
}

export default note
