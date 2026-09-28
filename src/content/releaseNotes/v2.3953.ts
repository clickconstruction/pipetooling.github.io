import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3953',
  date: '2026-09-27',
  title: 'Bids: the robot layer is its own piece',
  kind: 'fix',
  highlights: [
    'Everything behind the robot icon on a bid — its status and needs sheets, the envelope at send, answering a robot’s question, asking for a robot bid — moved out of the Bids page into its own piece with tests. Nothing you see changed.',
  ],
}

export default note
