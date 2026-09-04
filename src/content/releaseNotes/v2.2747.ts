import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2747',
  date: '2026-09-04',
  title: 'Estimate emails: a real button, a subject that files itself, and your letterhead',
  kind: 'feature',
  highlights: [
    'The estimate email customers receive now has a "Review & accept the estimate" button that works in Outlook and Gmail, with the plain link underneath just in case.',
    'The subject reads "Estimate #482 — Water heater replacement — $4,380 · Click Plumbing", so it is easy to find later; change orders follow the same shape.',
    'The email shows the logo, the estimate number and address, the total (or the option ladder), and "Pricing is good through" when an expiry is set; your Settings body template still opens and signs it off.',
    'Replies reach the person who sent it, the From name is the company instead of "ClickTooling", and Estimates → Customer experience → Email previews the exact email before you send.',
  ],
}

export default note
