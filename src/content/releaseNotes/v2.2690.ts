import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2690',
  date: '2026-09-03',
  title: 'Contracts remind themselves, and show up on the customer’s account page',
  kind: 'feature',
  highlights: [
    'Leave "Remind by email every 3 days" ticked when you send a contract and the app follows up on its own — up to three reminders with the same link, replies coming back to you. Signing or voiding stops them.',
    'Customers with a portal link now see Your agreements on their account page: contracts waiting for a signature with Review & sign, and signed ones with View signed copy.',
  ],
}

export default note
