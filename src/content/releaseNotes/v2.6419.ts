import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6419',
  date: '2026-11-02',
  title: 'A link to People → Writeups opens on Writeups',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Opening a Writeups link in a fresh tab used to land on Users. It now waits for your role and opens Writeups.',
    'A role that cannot open Paperwork still lands on Users, as before.',
  ],
}

export default note
