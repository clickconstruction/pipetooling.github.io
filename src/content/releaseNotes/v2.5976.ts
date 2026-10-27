import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5976',
  date: '2026-10-27',
  title: 'Find a job asks the server for your jobs alone',
  kind: 'fix',
  roles: ['helpers', 'subcontractor'],
  highlights: [
    'Each search in Find a job also asked the server for customers by name. The box never shows customers, so that answer was thrown away. It now asks for your jobs alone.',
    'Nothing on the screen changes. Your jobs and the guides for your role show as before.',
  ],
}

export default note
