import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4610',
  date: '2026-10-05',
  title: 'Downloads come from the app itself, so Safari asks once',
  kind: 'fix',
  highlights: [
    'Saving a file (a submittal package, a vendor PDF, a pay application workbook, an HR attachment) now hands the browser a file from clicktooling.com itself. Safari no longer asks about a second site, and asks at most once.',
    'A PDF or a picture still opens in its own tab to be read. A file the browser cannot show, like a workbook or a forwarded email, is saved instead.',
    'A new tab is no longer opened for a save, so a popup blocker cannot hold it.',
  ],
}

export default note
