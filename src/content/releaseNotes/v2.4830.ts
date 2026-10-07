import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4830',
  date: '2026-10-07',
  title: 'Lien desk: a last day of work set by hand moves the Deadlines too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When you set the last day of work by hand, the Deadlines view, the Billed row’s lien clock and the Dashboard’s lien reminders now count from that day. Before, only the notice list and the Lien window did.',
    'A job dated from its creation with no hours moved to the right month on the Lien window but stayed under Overdue on the Deadlines. Now it moves there as well.',
    'The hover on the clock says where the day came from: set by hand, from clock hours, or from the job’s creation.',
  ],
}

export default note
