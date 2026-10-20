import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5203',
  date: '2026-10-10',
  title: 'GC projects: a reminder, a Friday report or a schedule letter never emails a customer twice',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'If an email to a customer went out but the app lost track of it, pressing send again no longer sends it a second time. The app finds the email it already sent and marks it sent.',
  ],
}

export default note
