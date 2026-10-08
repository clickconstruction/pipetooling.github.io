import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4950',
  date: '2026-10-08',
  title: 'Accounts Receivable: card disputes and failed bank payments are cases',
  kind: 'feature',
  highlights: [
    'When a customer disputes a card payment on a Stripe bill, a case opens under Came back. It names the bill, their reason and the day to answer by, with a link to the dispute in Stripe.',
    'If the customer wins, press Put the bill back. The payment comes off the job and the bill goes back to Ready to Bill, to be billed again.',
    'A bank payment through Stripe that fails days later opens a case too. It closes when the bill is paid or voided.',
    'The office hears about each one by email and push, and the Dashboard’s Needs you card counts them.',
  ],
}

export default note
