import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2161',
  date: '2026-08-23',
  title: 'Send to — the version picker is grouped by GC',
  kind: 'feature',
  highlights: [
    'Counts, Takeoffs, Pricing, and Cover Letter now open with "Send to": one group per GC, showing whether that GC was sent (and when), its ★ price, and its versions inside.',
    '"＋ Another GC…" asks for the GC first, starts as a copy of the packet you pick, and names itself after the GC. "+ version" inside a group adds a same-GC variant (e.g. a VE) with its own takeoff.',
    'Bids sent before per-GC tracking show the bid\'s sent date on the GCs that existed then.',
  ],
}

export default note
