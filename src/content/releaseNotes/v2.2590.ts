import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2590',
  date: '2026-09-01',
  kind: 'feature',
  title: 'One check covering several bills is now one tap',
  highlights: [
    'When a matched customer\'s bills don\'t match a deposit one-to-one but a set of them adds up exactly — "2 bills = $4,091.50" — Accounts Receivable offers that set as a single chip.',
    'Tapping it fills one allocation line per bill, ready to review and Apply; nothing applies on its own.',
    'The suggestion only appears when exactly one combination works — several possible combinations means no guessing.',
    'Bill picker rows now show the customer or GC name next to the job name, matching the search.',
  ],
}

export default note
