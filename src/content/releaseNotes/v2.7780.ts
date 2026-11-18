import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7780',
  date: '2026-11-18',
  title: 'Lien desk: An owner asked for records moved into the call window, and the title bar is one line',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'An owner asked for records no longer has a line of the title bar to itself. Press the blue phone at the top right, and it is the last row of the window that opens.',
    'On To do, By date and By job the title bar is now one line, so the Board starts higher.',
    'The row opens the records packet on the job you have open, when you have one. With none it opens on the list of owners, as before.',
    'A phone is the same. An owner asked for records is still a row of More.',
  ],
}

export default note
