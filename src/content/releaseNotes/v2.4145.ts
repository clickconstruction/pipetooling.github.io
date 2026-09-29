import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4145',
  date: '2026-09-29',
  title: 'Pipeline: air between the service chip and the two-week strip',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'In the Crew & Dates cell the “1008 PLUM” chip sat right on the top row of the two-week strip; the strip now starts a little lower, so the chip, the strip and the DONE / BILL lines read as three things.',
  ],
}

export default note
