import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7362',
  date: '2026-11-15',
  title: 'Sub payments and the bank: a transfer between the company\'s own accounts is never offered',
  kind: 'fix',
  highlights: [
    'Matching a sub payment to a bank line no longer offers a transfer between the company\'s own accounts. It paid nobody.',
    'This holds on both sides: Find bank lines on the Subs Ledger, and Match to a sub payment… on Banking → Ledger.',
  ],
}

export default note
