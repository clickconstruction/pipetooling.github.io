import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5445',
  date: '2026-10-13',
  title: 'Messages: a tech can read the phone’s lines, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A tech can now read the customer lines the office puts on the phone.',
    'They read only the team’s lines for customers that are on the phone and not removed.',
    'Nothing else in the office’s quick replies opens to them, and they still change none.',
    'Nothing on screen changes yet. Job Mode’s Message the customer will read these lines.',
  ],
}

export default note
