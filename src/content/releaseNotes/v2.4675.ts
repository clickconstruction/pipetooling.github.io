import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4675',
  date: '2026-10-06',
  title: 'Lien desk: Find the owner opens the Property record',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Lien desk, Find the owner opens Edit Job with the Property record already open. That is where you link the property and its owner of record.',
    'Settings → Jobs & billing says the nightly owner lookup covers every GC job with no owner, with or without clock hours.',
  ],
}

export default note
