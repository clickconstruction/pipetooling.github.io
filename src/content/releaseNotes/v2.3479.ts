import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3479',
  date: '2026-09-15',
  title: 'Put a GC on notice: one card for the master, and the record afterwards',
  kind: 'feature',
  highlights: [
    'When the office prepares a run and sends it to the master, his Needs you shows one card — “Approve the run for Harborline Builders · 7” with the reason and the claimed total — not seven separate notices. It opens the modal on his phone; Approve all takes the set.',
    'Bids → Customer review reads the record: a GC whose notices went out as a run shows “on notice since Sep 15 · 7” beside its terms, and the button becomes “the run ›”.',
    'Step 1 of the modal names the county from the property record, not only from the roll’s lookup.',
  ],
}

export default note
