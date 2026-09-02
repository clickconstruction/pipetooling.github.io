import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2587',
  date: '2026-09-01',
  title: 'Copy fixtures for text now groups by Division 22',
  kind: 'feature',
  highlights: [
    'The parts-house fixture list is now grouped under spec-section headers (22 11 16 Domestic Water Piping, 22 42 13 Water Closets & Urinals, …) in spec-book order.',
    'Names the ledger doesn’t recognize land in a “No code yet” tail — the copy never blocks, and the toast tells you how many need a code.',
    'Still strictly names and counts: no prices, totals, or margins ever leave the building.',
  ],
}

export default note
