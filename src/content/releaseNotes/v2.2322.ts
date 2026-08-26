import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2322',
  date: '2026-08-26',
  title: 'Cleaner payment lines on the portal',
  kind: 'fix',
  highlights: [
    'Payment lines in the per-job recap box now read simply "Paid Jul 31, 2026" — the generic "Payment" label is gone. Real methods, like a check number, still show.',
  ],
}

export default note
