import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4003',
  date: '2026-09-28',
  title: 'Bids: last contact is read in pages, for the bids on screen',
  kind: 'fix',
  highlights: [
    'The Bids page worked out each bid’s last contact by reading the whole contact log at once, which would have started dropping entries once the log passed 1,000 rows (it is at 752). It now reads the log for the bids on screen, in pages, so last contact stays right as the log grows.',
  ],
}

export default note
