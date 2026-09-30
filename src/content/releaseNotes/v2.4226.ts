import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4226',
  date: '2026-09-30',
  title: 'Map card checks no longer depend on a developer’s map key',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The automated checks for the Bid Board, Jobs and Dashboard maps now pass the same on a developer’s machine with Google Maps set up locally as they do in the build.',
    'Nothing changes in the app.',
  ],
}

export default note
