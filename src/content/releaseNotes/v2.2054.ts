import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2054',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal modal: jump straight to a job on the statement',
  highlights: [
    'The portal modal now shows "Jobs on this statement" under the live preview — one chip per billed job with its trade, number, and amount.',
    'Click a chip and that job\'s Edit window opens; the customer never sees any of it — the chips live in your modal, not on their page.',
  ],
}

export default note
