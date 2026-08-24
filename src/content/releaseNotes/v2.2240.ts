import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2240',
  date: '2026-08-24',
  title: 'Payments link themselves to the bill they pay',
  kind: 'feature',
  highlights: [
    'Typing an amount on a new payment line auto-fills "Applies to" when the job has exactly one open bill — no more orphaned check payments.',
    'A payment left unapplied on a job with open bills wears a small warning until someone picks the bill it pays.',
    'A paid date earlier than the bill’s date gets flagged in red — money can’t arrive before the bill goes out.',
  ],
}

export default note
