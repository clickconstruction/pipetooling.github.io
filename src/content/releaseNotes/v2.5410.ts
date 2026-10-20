import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5410',
  date: '2026-10-12',
  title: 'Messages: the database keeps seven kinds of contact, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A contact can be a lead, a supply house, a candidate or a sub, each tied to its own record.',
    'A homeowner who texts can be a lead before anyone adds them to Prospects, and keeps the thread when they book.',
    'A candidate’s messages show only to devs and the people on the hiring board.',
    'Nothing on screen changes yet.',
  ],
}

export default note
