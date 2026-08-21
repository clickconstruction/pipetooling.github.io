import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1942',
  date: '2026-08-21',
  title: 'Partnerships: View as Partner lens',
  kind: 'feature',
  highlights: [
    'A "View as …" button on each partnership flips the page into exactly what that partner\'s own account can see — their weekly ledger card, statement, and checked-off jobs — read-only, without leaving your session.',
    'The lens is served by the same server gates the partner\'s account hits, so it can\'t drift from the truth — including showing nothing when a deal is paused or ended.',
    'A footer strip lists what the lens is hiding (deal config, job review, infractions, the raw journal), so you always know what the partner can\'t see.',
  ],
}

export default note
