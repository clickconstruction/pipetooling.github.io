import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3311',
  date: '2026-09-11',
  title: 'Pay ledger: a tidier Balances header',
  kind: 'fix',
  highlights: [
    'On People → Pay → Payroll → Ledger, the company totals now read as two centered lines — what we owe, then what is owed to us — instead of one long sentence.',
    'The All / We owe / Owes us / Even chips are centered under them and always sit on one line; the even count lives on its chip.',
  ],
}

export default note
