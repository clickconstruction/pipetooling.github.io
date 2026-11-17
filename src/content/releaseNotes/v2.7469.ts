import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7469',
  date: '2026-11-16',
  title: 'Supply houses: payments that still need how they were paid, in one list',
  kind: 'feature',
  highlights: [
    'Mark paid stays one press. A bill marked paid now says "how it was paid is missing" on its row, with Finish beside it.',
    'Finish asks how it was sent, its number, the day and a receipt link. The amount stays as it is.',
    'Accounts payable counts every payment that still waits, in a line you press to open the list. Needs you counts them too, under Supply houses.',
    'A recorded payment can be corrected the same way, with Edit how it was sent in its window.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
