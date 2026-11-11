import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6894',
  date: '2026-11-10',
  title: 'Permits: the lists load about four times faster',
  kind: 'fix',
  highlights: [
    'Prospects, Permits was slow to open since four more cities were added. The database was checking who you are once for every permit it read.',
    'It now checks once per list. On a test copy at the live size, the Permits list went from about 600 milliseconds to 140, and Builders and the Dashboard count the same.',
    'Who can see and change permits is exactly as before.',
  ],
}

export default note
