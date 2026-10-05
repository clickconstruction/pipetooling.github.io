import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4541',
  date: '2026-10-05',
  title: 'Put a GC on notice: undo an Approve all pressed by mistake',
  kind: 'feature',
  highlights: [
    'After Approve all, the run window shows a strip under its title with Undo the approval. It is there for a click made by mistake.',
    'Undo asks first and lists what goes back: the notices return to drafts, and the standing rule, the payment terms and what owners see on their portals go back to what they were.',
    'A Legal desk matter is the one thing it cannot remove, and the window says so.',
    'The offer lasts while Put a GC on notice stays open, and ends once the run is recorded.',
  ],
}

export default note
