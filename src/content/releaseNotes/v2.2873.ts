import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2873',
  date: '2026-09-05',
  title: 'Estimates: the row says opened or never opened, and a "no" finally has somewhere to go',
  kind: 'feature',
  highlights: [
    'Sent rows on the Estimates Pipeline now read "opened Tue · quiet 2d" or "never opened · sent 7d ago — nudge?" instead of the same chip for everyone — so you call the people who went quiet, not the ones who never got the email. Mail-scanner prefetches are filtered out.',
    'Customers get a quiet "No thanks" under Approve on the acceptance page, with an optional reason. A decline moves the estimate to a new Declined bucket and shows "Declined by customer" in its activity.',
    'Heard "no" on the phone? On a sent estimate, Record a decline (phone / in person) marks it declined with a short note — the row stops asking for a nudge.',
    'Opening the customer link from the office no longer counts as the customer opening it.',
  ],
}

export default note
