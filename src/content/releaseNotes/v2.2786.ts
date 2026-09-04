import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2786',
  date: '2026-09-04',
  title: 'Send a sub a signed work order from their sheet',
  kind: 'feature',
  highlights: [
    'Jobs → Sub Labor → Edit: a new Work order box ticks the trade\'s scope from the library, adds lines for this job, freezes the sheet total as the price, and sends it to the sub to sign on their portal.',
    'The box shows where it stands (Draft → Awaiting signature → Signed → the sheet\'s stages), who signed and what they confirmed, and warns when the sheet total drifts from the signed amount.',
    'Ledger rows show a small chip under the stage: Awaiting signature, Signed, Draft, or Declined.',
  ],
}

export default note
