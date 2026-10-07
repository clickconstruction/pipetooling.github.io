import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4849',
  date: '2026-10-07',
  title: 'Demand letter: a pay code for each bill, under the amount box',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The final demand letter now carries one QR code per unpaid Stripe bill, right under Balance due and Pay in full by. Each code opens that bill’s own payment page, and its address is printed under it for anyone who will not scan.',
    'The codes show in the preview, print into the PDF and go out in the packet and the email.',
    'A new Pay codes tick under What the letter may say turns them off for one letter. It starts on. A paper bill with no payment page gets no code.',
  ],
}

export default note
