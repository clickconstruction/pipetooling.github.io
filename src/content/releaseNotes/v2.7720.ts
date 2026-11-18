import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7720',
  date: '2026-11-17',
  title: 'Bids: copying one GC’s price to another has its own tested piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the step that moves copied prices onto the other GC’s rows left the big Pricing file for a file of its own.',
    'It now has tests for which prices move, which are dropped, and where a failed write stops.',
    'Nothing changes on screen.',
  ],
}

export default note
