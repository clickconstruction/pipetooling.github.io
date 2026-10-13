import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5385',
  date: '2026-10-13',
  title: 'Lien desk: the hourly read-back from the mail service has its clock, behind the scenes (Docsmit train, PR 6a, migration 20261013150000)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Every hour, the app will ask the mail service where each open envelope is. The clock is set; it starts ticking only once a developer has set the connection up, and a pause switch holds it.',
    'A developer can save the connection’s switches from the app. Nothing secret is kept there.',
    'Nothing changes on screen.',
  ],
}

export default note
