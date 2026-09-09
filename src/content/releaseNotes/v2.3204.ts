import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3204',
  date: '2026-09-09',
  title: 'The review caption names the reviewer',
  kind: 'fix',
  highlights: [
    'After Mark reviewed, the flow strip now reads “by Wendi · Wed 9/9” under Review instead of the date alone — the name lookup was finishing after the strip had already drawn.',
  ],
}

export default note
