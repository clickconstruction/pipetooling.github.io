import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3824',
  date: '2026-09-25',
  title: 'The fact sheet says more exactly who reads and changes each value',
  kind: 'fix',
  highlights: [
    'The developer fact sheet for a big screen file now counts a value as changed when its setter is handed to a child part, not only when it is called on the spot.',
    'It no longer mistakes a field name on another object for the screen’s own value, and every read is credited to the smallest named part that holds it, or to its line when no named part does.',
  ],
}

export default note
