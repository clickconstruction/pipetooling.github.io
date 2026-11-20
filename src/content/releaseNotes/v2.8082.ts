import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8082',
  date: '2026-11-20',
  title: 'HR files: a correction that was not linked no longer rides into the next entry',
  kind: 'fix',
  highlights: [
    'When an entry is saved but its correction link is refused, the entry box forgets the link. Before, the next entry you added carried it and could be linked to the wrong entry.',
    'A link picked on one person’s file no longer shows in the entry box after you open another person’s file.',
  ],
}

export default note
