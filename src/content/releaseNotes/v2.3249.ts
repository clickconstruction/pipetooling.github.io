import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3249',
  date: '2026-09-10',
  title: 'Customer Waiting, part 4: the portal form knows your number',
  kind: 'feature',
  highlights: [
    'The Request a visit and Ask us to bid forms on the customer portal now show "We\'ll call you at (512) 555-0142" with the number on file, and a "use a different number" link. A number is required — it is what the office\'s Call button dials.',
    'After sending, the customer sees "Got it, Jane — thank you. Your request is on our dispatch desk right now. We\'ll call you at … as soon as we can during office hours." Bid requests say estimating desk.',
    'The What-customers-see sample shows the prefill too.',
  ],
}

export default note
