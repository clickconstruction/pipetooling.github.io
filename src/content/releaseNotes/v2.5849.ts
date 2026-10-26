import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5849',
  date: '2026-10-25',
  title: 'Legal desk: How much? reads the claim, and the rail says Under review',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When a GC holds retainage on a job, How much? reads the claim with the open bills inside it, such as $3,706 with $2,028 of open bills plus $1,678 of retainage held. The firm’s cut and What’s left for us? work from the claim.',
    'The rail’s first group is Under review, not Needs a dev’s eyes, and the header names the three paths: in house, attorney-ready, write it down.',
  ],
}

export default note
