import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4255',
  date: '2026-09-30',
  title: 'GC statement email: one property at a time, with payments shown and a QR code',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The statement a GC gets opens with what is owed. Then each property is listed once, with its own subtotal.',
    'Each open bill is one line: the job number, the day it was sent and what is still owed. A payment recorded on a bill shows under that bill.',
    'The account card at the bottom keeps the link and adds a QR code the GC can scan with a phone.',
    'When a job has a payment that is on no bill, the Draft Message window tells you before you send.',
  ],
}

export default note
