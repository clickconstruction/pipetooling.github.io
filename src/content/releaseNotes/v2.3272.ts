import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3272',
  date: '2026-09-11',
  title: 'A standing discount for a customer',
  kind: 'feature',
  highlights: [
    'Put a rate on the customer once — Customers → Edit → Standing discount, 5%, Repeat customer — and every new job and every bill for them offers it: "Done Right Foundation gets 5% · Apply · not on this job."',
    'Nothing is added by itself. Apply writes the ordinary discount row and the trail; "not on this job" waves it off for that job. A job that already has a discount gets no offer, so a bid that was already cut is never cut twice.',
    'In Bill Customer the offer is the first line of − Add discount: Use it fills in the rate and the reason.',
  ],
}

export default note
