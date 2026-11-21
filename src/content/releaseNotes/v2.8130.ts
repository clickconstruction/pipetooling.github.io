import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8130',
  date: '2026-11-20',
  title: 'People: on a phone, the section you are in shows whole',
  kind: 'fix',
  highlights: [
    'On a narrow phone, the row of sections at the top of People now scrolls so the one you are in reads whole.',
    'Before, Paperwork read "Pape" under the page title on a 320 px screen, and Review or Feedback sat out of sight, so nothing at the top said where you were.',
  ],
}

export default note
