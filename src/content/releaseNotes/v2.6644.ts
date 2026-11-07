import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6644',
  date: '2026-11-07',
  title: 'Your people’s week lists only our staff to pick from',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The Monday email’s people picker no longer lists subcontractor companies. Helpers and every other teammate stay.',
    'A subcontractor with a card on Review’s board is no longer picked out of sight when the sheet opens.',
  ],
}

export default note
