import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5398',
  date: '2026-10-12',
  title: 'Messages: the rules behind They owe us on Follow up, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The first piece of putting a customer’s open bill on Follow up, beside We owe them: the rules, with no screen yet.',
    'Each customer with an open bill gets one row with their worst bill: the invoice, the amount, the days since it went out and the last reminder.',
    'A bill is open and late by the same rules the Accounts Receivable page uses, so the two never disagree. A GC project’s bills stay on Owner Billing.',
    'Each row carries the bill’s reminder as a quick reply in English and Spanish, with the pay link when the bill has one.',
  ],
}

export default note
