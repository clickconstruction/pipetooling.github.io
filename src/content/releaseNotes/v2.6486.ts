import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6486',
  date: '2026-11-04',
  title: 'The Subs tab counts a settled order and its paid sheet once',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Settling a step work order writes the sub a sheet for the released amount. Once the office paid that sheet, the track record counted the same work twice and read "2 settled".',
    'The settled step order now counts once, and the sheet it made adds nothing when paid.',
    'The sheet still shows in the sub’s sheet count and balance due until it is paid.',
  ],
}

export default note
