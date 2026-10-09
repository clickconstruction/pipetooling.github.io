import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5014',
  date: '2026-10-09',
  title: 'People → Review: overhead rates come from the same scan as People → Overhead',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Review’s 90-day overhead rates now come from the same scan as People → Overhead, the Dashboard and the Bridge. Today’s figures are unchanged.',
    'If the link from a login to its person can’t be read, Review’s rates still show, priced by name, instead of going blank.',
  ],
}

export default note
