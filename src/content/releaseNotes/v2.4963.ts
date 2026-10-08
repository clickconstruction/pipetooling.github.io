import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4963',
  date: '2026-10-08',
  title: 'Bids: History shows every change on a long bid',
  kind: 'fix',
  highlights: [
    'A bid’s History stopped at 1,000 rows and left the oldest changes out without saying so. It now shows the newest 1,000 first, with a Show older changes button for the rest.',
    'Past values under the boxes now reads every earlier value on a large bid, not only the first 1,000.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'controller', 'primary', 'dev'],
}

export default note
