import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6717',
  date: '2026-11-08',
  title: 'The job window’s email chip and Job Mode’s email go through the company, not your own mail app',
  kind: 'feature',
  highlights: [
    'On the Job window’s Job tab, pressing the customer’s email address now opens the customer’s sheet on Email, tied to the job. The email goes from the office, lands in their thread and in the job’s activity under Customer, and their answer comes back to the office’s box. Before this, the chip opened your own mail app and nothing was recorded. A small copy press beside the address copies it.',
    'In Job Mode the customer’s email address is plain words with a copy press. A tech texts the customer from Job Mode and does not email, so Message the customer sits under the address and opens the card’s own sheet, a text from the company number. The phone line still dials from your phone.',
    'Nothing is sent until you press Send in the sheet. The sheet’s holds, Send texts off, STOP and a prospect not yet asked, say why in its own words.',
  ],
}

export default note
