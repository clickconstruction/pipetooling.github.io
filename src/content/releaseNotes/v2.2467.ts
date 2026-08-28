import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2467',
  date: '2026-08-28',
  title: 'Type a stage\'s exact amount and the bill shows that stage',
  kind: 'fix',
  highlights: [
    'Billing part of a job by typing a dollar amount used to produce a bill listing every line item, scaled down proportionally — type $1,980 for a $1,980 change order and the customer saw "change order $1,080 + other work $900". Confusing for them, wrong-looking for you.',
    'Now, when the amount you type exactly matches one stage\'s remaining value, the invoice attaches to that stage — the customer\'s bill shows that one line at its real price, and the stage locks in Line Items just like ticking its checkbox would.',
    'A toast tells you when it happened ("Billed as …"). Amounts that don\'t match a single stage exactly keep working as before.',
    'Ticking the stage\'s checkbox and pressing "Create invoice from remaining on selected segments" remains the most direct way to bill specific stages.',
  ],
}

export default note
