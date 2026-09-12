import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3371',
  date: '2026-09-12',
  title: 'Edit tab: Collections on the status line, Customer Contract named',
  kind: 'fix',
  highlights: [
    'On the job window’s Edit tab the Collections switch now sits at the right end of the status rail, on the same line as Paid, instead of on a line of its own. On a narrow window it wraps under the rail.',
    'The customer’s contract row under Customer is labelled Customer Contract, so it reads as what it is.',
  ],
}

export default note
