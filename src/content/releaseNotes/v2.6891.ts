import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6891',
  date: '2026-11-10',
  title: 'Permits: the page no longer times out when it opens',
  kind: 'fix',
  highlights: [
    'After four more cities were added, opening Prospects, Permits could show a red line saying the permits could not be read. The page was asking the database for three large lists at once.',
    'It now asks for one at a time. The ledger’s list is read when you open Ledger or Map, and the month’s count waits for the cards.',
    'Nothing looks different. The skim card shows as before.',
  ],
}

export default note
