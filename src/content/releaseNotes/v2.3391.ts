import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3391',
  date: '2026-09-14',
  title: 'Drive pass: reads the folder the signed contracts actually live in',
  kind: 'fix',
  highlights: [
    'The owner shared the contracts folder with the intake account, so Look in Drive for signed contracts… now reads that tree as well as the jobs folder. A file sitting directly in the folder is matched by its own name.',
  ],
}

export default note
