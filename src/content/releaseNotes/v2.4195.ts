import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4195',
  date: '2026-09-29',
  title: 'Punch list: flagged rows sit at the top',
  kind: 'feature',
  roles: ['dev', 'master_technician'],
  highlights: [
    'A to-do can be flagged. Flagged rows leave their group and sit in a Flagged section above every group, each marked ⚑; the stripe still shows the group it belongs to.',
    'Three rows are flagged today: folding the rest of the New Bid form under More details, proving Find the folder on a real bid folder, and the robot audits backlog.',
  ],
}

export default note
