import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2252',
  date: '2026-08-24',
  title: 'Payroll amounts: smaller cents',
  kind: 'feature',
  highlights: [
    'People → Payroll now uses the same smaller-cents styling as Sub Labor — the dollars in Gross, Net, Paid, and Balance read at a glance.',
    'The Ledger view got it too: roster balances, the journal amounts, and running balances.',
    'Copy and paste still gives the full amount with cents.',
  ],
}

export default note
