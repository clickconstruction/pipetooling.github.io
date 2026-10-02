import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4442',
  date: '2026-10-02',
  title: 'Submittals: Their answer, a window of its own with one answer per part',
  kind: 'feature',
  highlights: [
    'On Bids → Submittals, every row has a Their answer button. It opens a window just for what the reviewer said about that row.',
    'Each part the GC sees has its own Approved, Revise or Rejected and its own note. One Save records them all, so "approved, except the flush valve" is one trip.',
    'Who answered starts on the GC on the bid, then its contacts on file. Someone else needs only a name. An email is optional, and nobody is emailed or contacted.',
    'The row’s Edit window is about the product again. It shows their answer on one line, with Save and enter their answer… as the door.',
  ],
}

export default note
