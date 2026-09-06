import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2891',
  date: '2026-09-05',
  title: 'Partnerships: the Ledger, Timeline and Statements tabs read one journal — and say who owes whom',
  kind: 'fix',
  highlights: [
    'The three office tabs now read the very same payload the partner’s own statement reads, so their balances can no longer drift apart. The Ledger headline is the partner’s settle-up balance; the Timeline’s running column is what statements have posted; the Statements tab’s “attaching” figure is exactly the gap between the two — and each tab says so in one line: “posted we owe Bryan $967.60 · −$1,975.73 not yet on a statement (2) → Bryan owes us $1,008.13”.',
    'Every balance carries its words — “we owe Bryan” or “Bryan owes us” — with a tooltip naming the sign convention (+ we owe the partner, − the partner owes us).',
    'Labor hours on the office tabs now come from the stamped rate-tier days, the number the partner already sees, so the 0.01 h differences between the office Ledger and the partner’s statement are gone. Dollars were always the same and still are.',
    'Nothing changes on the partner’s side — their statement, week cards and Full ledger reconcile to the cent exactly as before.',
  ],
}

export default note
