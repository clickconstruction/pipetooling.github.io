import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3514',
  date: '2026-09-16',
  title: 'A deposit you match to a bill is booked as Income on its own',
  kind: 'feature',
  highlights: [
    'When the office applies a bank deposit to a bill in Accounts Receivable, the deposit now gets the Income label in Banking by itself — so the P&L counts it without anyone opening Banking. A label a rule or a person already set is never changed.',
    'The footer in Accounts Receivable says so as you apply: "…and books it as Income." If the deposit was already labelled something else, a line under the header names that label and Apply leaves it alone.',
    'A new org-wide switch on Banking → Accounting turns the rule on. Flipping it on also labels every deposit that was applied before today and tells you how many — 24 deposits, about $171,700, on the day it shipped.',
    'Remove the payment later and the label the rule set is withdrawn with it, as long as nothing else was recorded against that deposit.',
  ],
}

export default note
