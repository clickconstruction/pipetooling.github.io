import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7645',
  date: '2026-11-17',
  title: 'Signed contracts: each one is now filed in its job\'s Drive folder, and Find a file finds it',
  kind: 'feature',
  highlights: [
    'Every signed job contract now goes into its job\'s Google Drive folder by itself, under Team only, Contracts, within ten minutes. Find a file then finds it by its words.',
    'The Contract window has a Drive line on a signed contract. It says where the copy is, with Open in Drive, or why it is not there yet, with the door that fixes it.',
    'A paper the office already keeps in Drive is tied to its record where it sits. A voided contract\'s copy is renamed VOIDED and kept.',
    'Estimators can read a signed contract filed this way, in Drive and in Find a file. The owner chose that on Nov 17.',
  ],
}

export default note
