import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4829',
  date: '2026-10-07',
  title: 'Lien window: § Rules knows which job you have open',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Press § Rules inside a job’s Lien window and the window names that job, with its notice date and its lien date, the same way it does from the Lien desk.',
    'The dates table lights the job’s own work month. A last day set by hand counts.',
  ],
}

export default note
