import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3359',
  date: '2026-09-12',
  title: 'Stripe bills reach the second person too — copies with the same Pay link',
  kind: 'feature',
  highlights: [
    'Bill Customer\'s Stripe tab now has the same Send to list as the PDF tab: the billing address, the customer\'s people (the ones marked "gets every bill" start ticked), Copy the GC or the customer, and a one-off address.',
    'Stripe still emails the one address it knows. When you press Send Email invoice, everyone else on the list gets a copy from ClickTooling — amount, due date, the same Pay link, and a line saying who was billed — one email each, so nobody sees the others.',
    'The Send Email invoice confirm shows who will be copied; the toast afterward names who was.',
  ],
}

export default note
