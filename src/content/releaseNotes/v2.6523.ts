import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6523',
  date: '2026-11-04',
  title: 'Bring back a teammate who left, in one window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'An archived person whose employment ended gets Bring back… on their desk and on People → Users → Archived, in Restore’s place. One window takes the day back, restores the login and the roster row together, clears the end date and opens a new stint beside the old one, so their hours, logbook and HR file stay on the same account.',
    'The window lists what time away made stale: the sign-in email, the wage with Keep or Change, the team, licenses that expired meanwhile in red, and paperwork signed in the old stint. The wage must be pressed; team, licenses and paperwork can be left open with a reason.',
    'Old open roadmap tasks come back only when the box is ticked. It starts ticked within 90 days of leaving and unticked after. Training mode starts off for a returner. “Ended by mistake? Undo the end instead” reopens the old stint.',
    'End employment archives the account of a person with no login too. Before, a worker with no email stayed active in every list after their last day.',
  ],
}

export default note
