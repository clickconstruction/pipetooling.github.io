import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6433',
  date: '2026-11-03',
  title: 'The Writeups list opens on write-ups and no-shows',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Show attendance (derived) is off when People → Writeups opens, so the list shows the write-ups and the no-call no-shows.',
    'Tick it to see the derived lates in the list with their Add note, as before.',
    'Before this, the lates filled the list: 175 of its 188 rows, over 8 write-ups and 5 no-shows.',
  ],
}

export default note
