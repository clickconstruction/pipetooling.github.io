import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3476',
  date: '2026-09-15',
  title: 'The supply house invoice form, rebuilt around the paper',
  kind: 'feature',
  highlights: [
    'Materials → Supply Houses → Add / Edit Invoice now reads the way the invoice does: Invoice #, date and amount across the top, then the PO — and a five-digit PO Generator code is checked against the house\'s ledger while you type, not after Save.',
    'Add the job by typing its J#, name or address right in the form; it becomes a card with its address, and the "On job account" flag sits on that card. Percent boxes appear only once there are two jobs to split.',
    'Paid is a status with a date — "Paid on" records the day it cleared — and the due date says where its prefill came from (the house\'s payment day). The Drive link is labeled Invoice PDF with an Open button.',
    'Save, Cancel and Delete sit in a footer that stays on screen while the form scrolls, so nothing is ever out of reach on a short screen or a phone.',
  ],
}

export default note
