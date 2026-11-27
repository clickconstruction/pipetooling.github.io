import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8734',
  date: '2026-11-27',
  title: 'Messages: a search keeps its rows when a refresh behind it fails',
  kind: 'fix',
  highlights: [
    'Messages checks for new lines by itself while you search. When one of those checks failed, the search showed the failure in place of its rows.',
    'Now the rows the search already found stay on the screen. The next check brings anything new.',
    'A search that could not load at all still says so.',
  ],
}

export default note
