import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7725',
  date: '2026-11-17',
  title: 'Bill Customer: the Invoice Modifications card is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the gray Invoice Modifications card moved out of the big Bill Customer window into its own files, one for the Stripe bill and one for the physical invoice. The row of memo presets moved with it.',
    'Nothing changes on screen. The line item override, the memo and the footer read, open and save exactly as before, and no send or record press was touched.',
    'The Bill Customer window is about a sixth smaller, which makes each part easier to change safely.',
  ],
}

export default note
