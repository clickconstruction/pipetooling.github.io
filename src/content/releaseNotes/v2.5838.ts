import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5838',
  date: '2026-10-25',
  title: 'Legal desk: mark a supply house paid from the Paper tab',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Each owed house on the Paper tab’s Supply houses card gains Mark paid…: pick the day the house was paid and which of its unpaid invoices on the job the payment covered, every one ticked to start.',
    'It is the Supply houses tab’s own Paid check, so Held for suppliers, the Liens window and the Legal desk read one truth. An invoice split across jobs is marked paid as a whole, and the form says so.',
  ],
}

export default note
