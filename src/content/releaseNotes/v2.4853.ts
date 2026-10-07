import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4853',
  date: '2026-10-07',
  title: 'Send the run: print one copy or one envelope',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'In the run, each copy row has Print › beside Preview ›, each envelope has Print this envelope › under its address, and the preview has a Print this copy button.',
    'Each prints just that paper and files it as printed, like the whole packet does. A notice moves to In the mail · tracking owed once both of its copies have printed.',
    'Print the packet still prints everything in envelope order.',
  ],
}

export default note
