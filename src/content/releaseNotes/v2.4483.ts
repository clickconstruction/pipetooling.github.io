import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4483',
  date: '2026-10-03',
  title: 'Submittals: a row says what each part got',
  kind: 'fix',
  highlights: [
    'A row with one part rejected out of three used to read Rejected in red. It now reads 1 of 3 rejected · 2 with no answer yet.',
    'The row gets one word, like Approved, only when every part the GC sees has the same answer.',
    'The Their call line counts those rows apart: 4 with a part rejected, not 4 rejected.',
  ],
}

export default note
