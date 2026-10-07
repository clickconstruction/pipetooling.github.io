import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4486',
  date: '2026-10-04',
  title: 'Submittals: build the package while cut sheets are still to follow',
  kind: 'feature',
  highlights: [
    'A row with no cut sheet no longer holds the package. Only a row that still owes a reason does.',
    'The button counts them: Build package · 6 cut sheets to follow.',
    'Before it builds, a question names those rows. The cover lists them as cut sheets to follow.',
    'Once the package is built you can Share, as before.',
  ],
}

export default note
