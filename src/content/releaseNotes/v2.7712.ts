import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7712',
  date: '2026-11-17',
  title: 'Lien desk: an approved notice that waits on a signature has its own bin, Approved · to sign (punch list #383)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Board has a new bin, Approved · to sign, between Awaiting Master approval and Approved · to print. An approved notice the leader has not signed stands there.',
    'Approved · to print now holds exactly what its press takes. A bin that reads 1 has a press that reads Print and mail 1 notice.',
    'The third tile counts the same two bins under it. A notice to sign is counted on the second tile alone.',
    'The office’s Remind press stands beside the new bin’s name. On the leader’s desk the press there reads like Sign 7 notices, and opens them to sign.',
  ],
}

export default note
