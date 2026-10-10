import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5190',
  date: '2026-10-10',
  title: 'GC mode: the Project Board by customer',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A switch at the top of the Project Board shows the same jobs by customer. The board still opens by stage each time.',
    'Each customer has a heading with what we are bidding them and what is under contract. Their jobs sit under a small heading for each stage.',
    'A customer’s closed and lost jobs sit on one line under their jobs, and their name opens their window.',
  ],
}

export default note
