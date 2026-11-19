import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7853',
  date: '2026-11-18',
  title: 'Lien desk: Sign N notices counts only the jobs you lead',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On Approved · to sign, a leader’s Sign press counted every unsigned notice, even on jobs another leader signs.',
    'It now counts only the notices on the jobs you lead, and it opens exactly those.',
    'A line under the bin’s name says how many wait on another leader.',
    'A leader with none of his own to sign sees the office’s Remind press there.',
  ],
}

export default note
