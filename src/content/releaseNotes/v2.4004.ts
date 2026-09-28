import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4004',
  date: '2026-09-28',
  title: 'People → Hours: an empty list says where to set up pay',
  kind: 'fix',
  highlights: [
    'When no one is on the Hours list, the page told you to open a window and tick a box that no longer exist. It now says where pay is set up: People → Users → Pay. The same line is fixed in Draft Payroll, on the Draft Payroll button and in Quickfill.',
    'The Hours page does less work each time it redraws.',
    'An old link to a section that was removed is gone.',
  ],
}

export default note
