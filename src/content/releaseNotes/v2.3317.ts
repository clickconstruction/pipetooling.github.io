import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3317',
  date: '2026-09-11',
  title: 'Payroll views renamed: Pay run and Balances',
  kind: 'feature',
  highlights: [
    'On People → Pay → Payroll, "Pay reports" is now **Pay run** — the week\'s work: draft the reports, record the payments, catch the weeks still waiting.',
    '"Ledger" is now **Balances** — where each person stands with us over all time: what we owe them, what they owe us, and the dated story behind the number.',
    'Nothing else moved. Saved links to the old Ledger view still open Balances.',
  ],
}

export default note
