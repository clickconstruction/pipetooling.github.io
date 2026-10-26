import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5859',
  date: '2026-10-25',
  title: 'Release of Lien window: the property record is the job’s own',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Release of Lien window could ask you to link a property record that was already linked to the job. Then the waiver’s Check from line named the GC instead of the owner of record.',
    'The window now reads the property record the job is linked to, the same one Edit Job and the Liens window show.',
  ],
}

export default note
