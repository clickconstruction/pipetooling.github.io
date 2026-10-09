import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5033',
  date: '2026-10-09',
  title: 'Accounts Receivable: add the $30 returned check fee to the bill the check paid',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A case for a check that came back now offers Add the $30 fee to bill 1. One press adds the fee to the bill the check paid, as its own line on the bill.',
    'The line reads “$30 — the most Texas allows, Bus. & Com. Code § 3.506”. Point at it to read the law.',
    'The fee goes on once per case, and the case keeps who added it and when. A Stripe bill cannot take a line, so the case says so instead.',
  ],
}

export default note
