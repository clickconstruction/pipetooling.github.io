import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2454',
  date: '2026-08-28',
  title: 'Edit Bid tells you when a save didn’t take',
  kind: 'fix',
  highlights: [
    'If you saved a bid you don’t have permission to edit, the window used to close as if everything worked — your changes quietly went nowhere.',
    'Now the window stays open and tells you the save didn’t apply, so nothing is lost without you knowing.',
  ],
}

export default note
