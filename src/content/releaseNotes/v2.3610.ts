import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3610',
  date: '2026-09-19',
  title: 'Pipeline: the board you last saw appears at once while the fresh one loads',
  kind: 'feature',
  highlights: [
    'Opening Pipeline in a new tab, after a reload, or on a phone that closed the app no longer starts blank. The board this device saw last is on screen right away, with "Updating jobs… board from 6 h ago" under the tabs, and the live board replaces it about a second later.',
    'While the remembered board is showing, every dollar reads greyed and the rows\' buttons wait — nothing can act on a remembered row. A board older than 24 hours is not shown; the page then loads as before.',
    'The remembered board is kept on the device only, per account, and is dropped when you sign out.',
  ],
}

export default note
