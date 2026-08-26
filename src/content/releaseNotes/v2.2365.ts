import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2365',
  date: '2026-08-26',
  title: 'Copy a version into another GC’s packet',
  kind: 'feature',
  highlights: [
    'The “+ version” dialog on the Send to strip now has a Start from picker — choose any version on the bid, including another GC’s, to copy its counts, takeoff and prices into this packet.',
    'It starts on the packet’s own version, so a copy from another GC is always a deliberate pick, and the pricing checkbox names the scenario the prices actually come from.',
    'Picking another GC’s version pre-fills the name from the source — keep it or type your own.',
  ],
}

export default note
