import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4985',
  date: '2026-10-08',
  title: 'Lien desk: what only the leader can approve comes first',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'For the leader, Do now opens with Only you can approve: every notice, affidavit and retainage notice waiting on his approval, before the rest of the list.',
    'For the office, those rows close the list under Waiting on and the leader’s name, each saying since when.',
    'The office’s Do now count leaves them out, so it counts only what the office can move.',
  ],
}

export default note
