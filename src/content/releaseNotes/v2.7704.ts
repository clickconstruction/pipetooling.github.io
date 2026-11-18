import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7704',
  date: '2026-11-17',
  title: 'Signed contracts: a job whose Drive folder is gone says so, and a voided copy is found by its new name at once',
  kind: 'fix',
  highlights: [
    'When a job\'s Drive link points at a folder that is gone, the contract\'s Drive line now says the folder is gone and offers the job\'s Edit tab. It used to show Drive\'s own error.',
    'The same goes for a job folder sitting in Drive\'s trash. The line says to put it back.',
    'A voided contract\'s copy is renamed VOIDED in Drive. Find a file now shows that name the same minute, not ten minutes on.',
  ],
}

export default note
