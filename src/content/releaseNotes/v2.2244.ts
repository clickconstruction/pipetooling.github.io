import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2244',
  date: '2026-08-24',
  title: 'Sub labor: changing the job saves instantly',
  kind: 'fix',
  highlights: [
    'Editing a sub labor sheet and picking a different job could silently lose the change — the pick only stuck if you also pressed Save, and closing the window threw it away.',
    'Picking a job now saves the link the moment you choose it, with a toast confirming the sheet moved — same instant-save behavior the invoice link field already had.',
    'The rest of the form (crew, line items, date) still saves with the Save button as before.',
  ],
}

export default note
