import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6710',
  date: '2026-11-08',
  title: 'A sent bill’s Text and Email go through the company, not your own phone or mail app',
  kind: 'feature',
  highlights: [
    'Under a sent Stripe bill, on the Job window’s Bills tab, in View bill and right after Bill Customer makes one, Text now opens the customer’s orange box with the bill’s words and its pay link already in it, tied to the job. Press Send text… and the text goes from the company number. Before this, Text showed the words for you to copy into your own phone.',
    'Email still shows the subject and the words first. Its button now reads Send the email, and the email goes from the office, with the sent copy filed and the customer’s reply coming back to the office’s box. Open in email app is gone, and Copy stays for pasting the words elsewhere.',
    'Both sends land in the customer’s thread and in the job’s activity under Customer, so the office can read what the customer was sent and what they answered. Nothing is sent until you press Send in the box or Send the email in the draft window.',
    'When the company number cannot text, the box says why in its own words, and Copy link in its head still works. When the customer’s contact has no email, the draft window says so instead of sending.',
  ],
}

export default note
