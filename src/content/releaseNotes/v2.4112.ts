import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4112',
  date: '2026-09-28',
  title: 'Bids: the Delete bid and Go/no-go windows are their own pieces',
  kind: 'fix',
  highlights: [
    'Groundwork inside the Bids page: the window that confirms a delete and the Go/no-go checklist now live in pieces of their own, each with tests. Nothing you see changed — the checklist still starts empty every time you open it.',
  ],
}

export default note
