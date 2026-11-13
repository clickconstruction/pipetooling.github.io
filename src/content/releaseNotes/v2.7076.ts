import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7076',
  date: '2026-11-12',
  title: 'Materials: Same part? joins two names for one part',
  kind: 'feature',
  highlights: [
    'On a site’s materials screen, two names that are nearly the same now ask Same part? once. Press Same part and they become one row with one total. Press Different and they stay apart.',
    'The app asks only when the sizes match and the names differ by one word or a small spelling. It never joins names by itself on a guess.',
    'An answer belongs to that site and can be undone from the open row. It never changes a count or a box.',
  ],
}

export default note
