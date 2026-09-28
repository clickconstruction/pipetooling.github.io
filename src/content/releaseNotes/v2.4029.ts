import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4029',
  date: '2026-09-28',
  title: 'Edit Job: removing a payment no longer makes the job save again',
  kind: 'fix',
  highlights: [
    'After you removed, unlinked or moved a saved payment, Edit Job saved the whole Bill section once more about a second later, and asked the database to delete the payment that was already gone. It now takes the payments as they are and writes nothing.',
    'If you had typed something a moment before, it is still saved as before.',
  ],
}

export default note
