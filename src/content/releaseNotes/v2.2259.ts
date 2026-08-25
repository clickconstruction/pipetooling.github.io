import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2259',
  date: '2026-08-25',
  title: 'Pay speeds show their own data health',
  kind: 'feature',
  highlights: [
    'The Pay speeds breakdown now carries a one-line health check: how many payments the math can actually measure, plus unlinked payments and undated bills waiting to be fixed.',
    'Every number explains itself on hover — including what to do about it.',
    'One click sets up a recurring Billing hygiene checklist task pre-filled with the worklist link; you pick who and how often.',
  ],
}

export default note
