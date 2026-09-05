import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2846',
  date: '2026-09-05',
  title: 'Ready to Bill never lists a paid job; billing a paid job asks twice',
  kind: 'fix',
  highlights: [
    'The Dashboard\'s Ready to Bill and Billed Waiting for Payment queues no longer show bills on jobs that are already Paid in Full — the counts now match the Pipeline board. If you remember an old draft there, it has been retired.',
    'Bill Customer on a paid job now says "This job is already paid in full — nothing to bill." instead of a preview claiming $0.00 paid, and the send buttons stay off unless you tick "Bill this job again anyway".',
    'Stripe bills and physical invoice emails refuse a paid job on the server too, so a stale draft can never become a real invoice by accident.',
    'Settings → Data & recovery (dev) gets "Draft bills on paid jobs" — lists the leftover drafts and retires each with one click, through the same audited delete as before.',
  ],
}

export default note
