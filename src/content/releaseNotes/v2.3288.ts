import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3288',
  date: '2026-09-11',
  title: 'Bill Customer shows the bill before Stripe can',
  kind: 'feature',
  highlights: [
    '"What the customer will see" is filled in the moment Bill Customer opens: every line the bill will list, a discount as its negative line, and the total — built from the job\'s own line items. Before, it showed one "Draft line" until the customer had an email and the bill row existed.',
    'Stripe\'s exact rendering still replaces it as soon as it can run; until then a small tag reads "from the job\'s lines".',
    'The note above the preview now names what Stripe is waiting on — "Add the customer\'s email above…" — instead of always blaming the bill row.',
  ],
}

export default note
