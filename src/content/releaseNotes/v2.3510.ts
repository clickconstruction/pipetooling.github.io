import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3510',
  date: '2026-09-16',
  title: 'What customers see now shows the customer\'s own agreement: the email, the signing page, the reminder, and signed',
  kind: 'feature',
  highlights: [
    'The homeowner strip on Settings → What customers see renders the service agreement the Contract sweep sends: the email, the page where the customer reads the scope and signs, the reminder an unsigned agreement gets, and the page after signing. All four were Next release cards.',
    'The email and the reminder are built by the same code the app sends with, so what you see here is what a customer gets. The sample agreement is Sam Sample\'s water heater job; signing it on the sample page saves nothing.',
  ],
}

export default note
