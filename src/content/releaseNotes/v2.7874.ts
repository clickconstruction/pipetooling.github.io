import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7874',
  date: '2026-11-18',
  title: 'Lien desk: the three paper tabs stay on the top line as the window widens',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'In a window between about 1,130 and 1,175 pixels wide, Monthly notices, Lien affidavits and Retainage notices dropped back to the second line. They fit in narrower windows and in wider ones.',
    'They now stay on the top line from about 1,100 pixels up to any width.',
    'To make the room, a window up to 1,279 pixels wide draws the top line a little closer together and shows Share as its icon. Point at the icon to read its name.',
    'A window 1,280 pixels or wider looks the same as before.',
  ],
}

export default note
