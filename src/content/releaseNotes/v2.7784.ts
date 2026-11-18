import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7784',
  date: '2026-11-18',
  title: 'Lien desk: the view tabs read Date, Paper and Job on a computer',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a computer the three tabs after Lien desk now read Date, Paper and Job. They read By date, By paper and By job before. They open the same views.',
    'The tabs sit a little closer together, and so do Monthly notices, Lien affidavits and Retainage notices. The row of four is about a fifth shorter.',
    'Point at a tab to read its full name and what it holds. A screen reader still says By date, By paper and By job.',
    'A phone is the same as before. Its tabs still read By date, By paper and By job.',
  ],
}

export default note
