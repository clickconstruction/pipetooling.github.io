import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2999',
  date: '2026-09-07',
  title: 'One company, finished: the old adoption lists are gone',
  kind: 'infra',
  highlights: [
    'No visible change. The retired "who adopted whom" and "who shares with whom" tables from part 5 are dropped; adoption and sharing are computed from the roster and nothing else remembers the old walls.',
  ],
}

export default note
