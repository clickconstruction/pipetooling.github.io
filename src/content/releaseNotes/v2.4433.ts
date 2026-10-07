import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4433',
  date: '2026-10-02',
  title: 'Procurement log: one part sent back no longer marks its whole fixture',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, when the GC rejected one part of a fixture, the procurement log showed every part of that fixture as Rejected by the GC.',
    'Each part now shows its own answer. The parts nobody answered stay waiting on the GC.',
    'Nothing was stored wrong. Only the one part ever held the rejection, and the row above still reads Rejected.',
  ],
}

export default note
