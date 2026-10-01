import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4289',
  date: '2026-09-30',
  title: 'Accounts Receivable: the trail names who recorded a payment, even through Mark Paid',
  kind: 'fix',
  highlights: [
    'A payment recorded with Mark Paid on a Stripe bill now carries the name of the person who pressed it. Until now those rows had no name in the job history or on the deposit trail: 13 of September’s 38 deposits.',
    'A payment recorded by hand and linked to its deposit later says both steps: “recorded as Check 3463 9/28 by Taunya · linked to this deposit 9/30 by Grace”.',
    'A name that was never kept is left out. Nothing reads “by the app”.',
  ],
}

export default note
