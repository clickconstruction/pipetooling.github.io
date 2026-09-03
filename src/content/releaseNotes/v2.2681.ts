import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2681',
  date: '2026-09-03',
  title: 'Send a job contract and let the customer sign it on their phone',
  kind: 'feature',
  highlights: [
    'Tap the contract chip (or the ✍ icon) on any Pipeline row: the Contract modal prefills who signs and what they’re signing from the job — scope, amount, payment terms, and your Contract Book terms — and autosaves as you edit.',
    'Send by email, copy the link, text it, or hand the customer your phone with Sign in person. Once sent, the row shows how many times it was opened, and Resend / Void & redo keep the same link working.',
    'Customers get a clean page: the work in plain words, one amount, the payment line, the full terms one tap away, and a Type-or-Draw signature block. Signing emails them a copy and turns the chip green.',
  ],
}

export default note
