import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2154',
  date: '2026-08-23',
  title: 'Price options per GC — offer a second price to the same GC',
  kind: 'feature',
  highlights: [
    'The Workbench now speaks GC: "This GC — Burd & Assoc." and "Price options — what Burd & Assoc. receives". ★ is the base price on their letter.',
    'Any other priced scenario can be offered to that GC as an alternate with one click ("Offer as alternate") — same counts, no new version. It shows on their cover letter as an alternate section.',
    '"Another price point" asks for a name (no more "WENDI copy"), starts from a scenario you pick, and can be offered right away.',
    'Cover Letter (New): one tab per GC — that GC\'s base bid, the prices offered to them, and "Mark sent to <GC>". A GC with no prices yet can start from another GC\'s base price on the Pricing tab.',
  ],
}

export default note
