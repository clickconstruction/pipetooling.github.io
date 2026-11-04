import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6480',
  date: '2026-11-03',
  title: 'The rules for bringing back a teammate who left',
  kind: 'feature',
  highlights: [
    'A teammate whose employment ended can only be restored today, and Restore brings back the login alone. The app now holds the rules for a real return on the same account, so their hours, logbook and HR file stay with them.',
    'The return asks about what time away makes stale: the sign-in email, the wage, who approves their hours, licenses that lapsed and paperwork for the new stint. The wage must always be confirmed. Old roadmap tasks come back by default only after 90 days away or less, and training mode starts off.',
    'Nothing changes on screen yet. The next releases add Bring back to an archived person’s desk, keep each stint’s dates, and stop + Hire when the name or email belongs to someone archived.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
