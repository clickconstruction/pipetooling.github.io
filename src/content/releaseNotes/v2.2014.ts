import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2014',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal modal: custom address up front, everything else one gear away',
  highlights: [
    "The globe modal now leads with the customer's portal address — editable until it's first shared, with a friendly hard-to-guess meter, then Copy link locks it so printed copies never go stale.",
    'Behind the gear: the direct token link, address changes (with a 🎲 random tail), separate GC-only / own-jobs-only views created on demand, Rotate / Turn off, and a fuller history that now includes address changes.',
    'The modal manages the merged statement by default — one link showing their own jobs beside the properties they GC.',
  ],
}

export default note
