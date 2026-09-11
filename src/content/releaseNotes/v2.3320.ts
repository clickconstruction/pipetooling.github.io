import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3320',
  date: '2026-09-11',
  title: 'Bank transfer card says "direct deposit"',
  kind: 'fix',
  highlights: [
    'The collapsed "Prefer to pay by bank transfer?" line on the customer statement now reads "ACH (direct deposit) • wire • check", so a customer who knows it as direct deposit sees their word before opening it. The opened card\'s first line says the same.',
  ],
}

export default note
