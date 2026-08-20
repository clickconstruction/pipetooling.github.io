import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1914',
  date: '2026-08-20',
  title: 'Bid Board: due-date colors only where they mean action',
  kind: 'fix',
  highlights: [
    'Bids in "Not yet won or lost" no longer show red or amber due dates — once a bid is sent, the wait is on the GC, so the chip goes quiet.',
    'Red and amber now appear only in the Unsent section, where a due date still means a bid has to go out.',
    'The due-date color legend explains the new rule.',
  ],
}

export default note
