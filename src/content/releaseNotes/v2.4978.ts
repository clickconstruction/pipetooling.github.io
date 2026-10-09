import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4978',
  date: '2026-10-08',
  title: 'Bids: History no longer shows half a change at the bottom',
  kind: 'fix',
  highlights: [
    'On a long bid, the last change before Show older changes could be cut in two. It read as a smaller change with fewer rows, such as Removed Toilets with 21 rows when 8 count rows and 80 rows were removed.',
    'That change now waits for Show older changes and then shows whole.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'controller', 'primary', 'dev'],
}

export default note
