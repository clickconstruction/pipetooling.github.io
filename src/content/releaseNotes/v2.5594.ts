import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5594',
  date: '2026-10-16',
  title: 'Estimates: Send to customer opens Tell the customer, which emails the estimate, texts the link, and shows the receipt with the call to make',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Send to customer on a normal estimate now opens the Tell the customer sheet: the email ticked with the address it goes to, and the text ticked when the customer has a number, with the office’s Estimate line filled for this estimate in a box you can change. Send both to Dana emails the estimate first, then texts the same accept link from the company number. Email only skips the text; Skip sends nothing.',
    'After the send, the receipt: the email and the text as they went, when, and Call Dana to talk it through? with what to say. One press dials; the call lands in the customer’s thread when it ends.',
    'When the customer has no number, sent STOP, or texts are off, the sheet says so and the button reads Send email to Dana. A change order, and an estimate with a $0 total, keep the old one-line question.',
    'The office writes the Estimate line in the quick replies editor on the Estimate sent step; until then the app uses its own words. Keep the word link in braces where you want the estimate’s link.',
  ],
}

export default note
