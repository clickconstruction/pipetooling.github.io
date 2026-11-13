import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7101',
  date: '2026-11-12',
  title: 'A receipt link for a card charge: a page with no sign-in where the holder photographs the receipt',
  kind: 'feature',
  highlights: [
    'On the Team queue a charge line has Copy the receipt link. Paste it into a text or an email to the person who has the receipt.',
    'The link opens a page for that one charge, with no sign-in: the store, the amount, the day and whose card. One press takes the photo, and the receipt lands on the charge.',
    'The page offers the holder’s jobs around that day, and the job can be skipped. A charge the office sorted already asks no job.',
    'The charge then wears a green chip, Receipt from the link, with its job first. A link opens for 14 days and shows nothing but its charge. The app sends no text by itself yet.',
  ],
}

export default note
