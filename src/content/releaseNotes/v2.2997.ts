import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2997',
  date: '2026-09-07',
  title: 'Safety net under schedule blocks',
  kind: 'fix',
  highlights: [
    'Every read and write of a scheduled block — Schedule, Dispatch, Dashboard, Calendar and People all go through the same layer — now has 21 tests pinning exactly what is asked of the database and how failures come back; no behaviour change.',
  ],
}

export default note
