import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3019',
  date: '2026-09-07',
  title: 'Safety net under People duplicate merges',
  kind: 'fix',
  highlights: [
    'Finding and merging a person listed twice on People — a roster name and a login name, or a name and its role-suffixed twin — now has 7 tests pinning who is flagged and exactly what a merge writes; no behaviour change.',
  ],
}

export default note
