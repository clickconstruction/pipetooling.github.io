import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3070',
  date: '2026-09-07',
  title: 'One company, tidy-up: the old adoption checks leave the server functions',
  kind: 'infra',
  highlights: [
    'No visible change. Thirty-two server functions that still asked "who adopted whom" before marking a job paid, filing a hazmat fee, moving costs or reading labels now ask the one-company question directly. Merging two duplicate accounts works again.',
  ],
}

export default note
