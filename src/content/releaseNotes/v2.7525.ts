import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7525',
  date: '2026-11-16',
  title: 'Lien desk: add what was mailed on a retainage notice, and take a wrong file off',
  kind: 'feature',
  highlights: [
    'A retainage notice’s row in the run now has Add what was mailed, as a monthly notice’s row does. Its file is named Retainage notice as mailed.',
    'A file on a row now has Take off beside it. The run asks first, then the notice forgets the file.',
    'Taking a file off does not delete it. It stays in the job’s Drive folder, under Sent by us.',
  ],
}

export default note
