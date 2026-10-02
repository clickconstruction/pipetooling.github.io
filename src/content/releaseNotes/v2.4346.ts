import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4346',
  date: '2026-10-01',
  title: 'Merge a duplicate from the desk, and restore an archived login from People',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A dev can press Merge a duplicate… on a person’s desk. The person whose desk it is is kept, the list says why any account is left out, and a preview shows what would move.',
    'People → Users → Archived now lists archived logins beside the roster rows, each with Restore.',
  ],
}

export default note
