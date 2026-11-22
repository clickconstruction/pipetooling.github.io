import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8231',
  date: '2026-11-21',
  title: 'Dashboard on a phone: Your people fits the screen',
  kind: 'fix',
  highlights: [
    'On a phone, a row of Your people now puts the chip and 🔔 Remind on their own line under the name. Before, a long chip such as nothing moved · oldest 1 days pushed Remind out of the card.',
    'That one row made the whole Dashboard slide sideways by a hair on a phone. It no longer does.',
    'A person’s name and their open card read on one line each. They were squeezed into a column a few letters wide.',
    'On a computer the row is the one line it was.',
  ],
}

export default note
