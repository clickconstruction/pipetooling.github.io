import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4173',
  date: '2026-09-29',
  title: 'What the team sees: the Paid job and Ready to bill notices render live',
  kind: 'feature',
  highlights: [
    'Settings → What the team sees opens the Payment recorded notice on the sample water heater job — the line items, the bill, the crew\'s labor, the parts, the profit — and the Ready to bill notice on the sample gas-line job its lead just moved, as the emails lay them out.',
    'Neither email changed: both renderers moved into shared kernels the browser can run.',
    'Nineteen of the twenty-five team emails render live; the six left are the digests built inside their functions.',
  ],
}

export default note
