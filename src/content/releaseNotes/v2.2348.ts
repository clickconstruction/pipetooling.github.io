import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2348',
  date: '2026-08-26',
  title: 'Invoice PDF: balance rule matches the frame',
  kind: 'fix',
  highlights: [
    'On invoice PDFs, the line above Balance due now draws at the same weight and color as the card’s outside frame — it was rendering thinner and paler.',
  ],
}

export default note
