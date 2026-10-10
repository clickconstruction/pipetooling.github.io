import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5209',
  date: '2026-10-10',
  title: 'GC projects: a bill email’s portal link always opens where the bill is',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A GC customer’s bill emails and the notice before a bill is due link only to a portal page that shows their GC jobs. A customer with only a GC view gets the email with no portal link.',
  ],
}

export default note
