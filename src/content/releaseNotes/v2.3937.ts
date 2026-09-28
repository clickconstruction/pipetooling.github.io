import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3937',
  date: '2026-09-27',
  title: 'Bids: the "Confirm bid sent" checklist is its own piece',
  kind: 'fix',
  highlights: [
    'The checklist you confirm before a bid’s sent date is applied moved out of the Bids page into its own piece, with tests that walk it start to finish. Nothing you see changed.',
  ],
}

export default note
