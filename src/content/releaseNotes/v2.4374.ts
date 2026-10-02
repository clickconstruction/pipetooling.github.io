import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4374',
  date: '2026-10-02',
  title: 'Accounts Receivable: a closed-out deposit drops the Apply note',
  kind: 'fix',
  highlights: [
    'A deposit closed out as not a customer’s payment no longer says Apply leaves its label alone. Its record already names the label, and Apply is not offered.',
  ],
}

export default note
