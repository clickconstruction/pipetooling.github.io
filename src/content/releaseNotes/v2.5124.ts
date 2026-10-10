import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5124',
  date: '2026-10-09',
  title: 'The Lien desk leaves out ZZ test jobs',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Lien desk, its timeline book and the GC run no longer list ZZ test jobs. Nothing real changed.',
    'The lien lines on Needs you leave them out too: releases owed, deadlines, demand letters and owner records.',
    'A dev still sees them while Hide groups shows test jobs.',
  ],
}

export default note
