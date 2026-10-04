import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4506',
  date: '2026-10-04',
  title: 'AIA G702-G703: our address prints on two lines',
  kind: 'fix',
  highlights: [
    'The contractor address starts on the lines it is typed on in Settings, street first and city under it. It was joined into one line with a comma.',
    'The download prints each line on its own row of the contractor block. With a license line too, the block starts one row higher to make room.',
  ],
}

export default note
