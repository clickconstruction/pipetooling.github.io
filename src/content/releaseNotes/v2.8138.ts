import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8138',
  date: '2026-11-20',
  title: 'Permits: Builders and the call list count our bids the way the table of companies does',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Our bids with a name on the permits are now the bids of the last two years, and a robot’s practice bid is not one of them.',
    'On Market, a name’s We bid tag and its row in the table of companies now stand on the same count.',
    'Builders shows the same count in its Our bids column and on a builder’s sheet.',
  ],
}

export default note
