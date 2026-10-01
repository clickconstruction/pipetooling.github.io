import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4318',
  date: '2026-10-01',
  title: 'Lien waivers: a bill marked paid asks for the unconditional',
  kind: 'fix',
  highlights: [
    'A bill marked paid now counts as paid for its lien waiver, even when the payment was not tied to that bill. The Bill tab offers Add the unconditional instead of the conditional.',
    'On View bill the Contract row reads None on file and both its buttons stay plain while a waiver step is owed.',
    'On View bill the email under To no longer breaks in the middle on a phone.',
    'On the customer portal the View buttons are easier to tap on a phone, and a part-paid bill reads billed, then paid, with a space between.',
  ],
}

export default note
