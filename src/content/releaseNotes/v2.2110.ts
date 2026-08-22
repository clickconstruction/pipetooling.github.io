import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2110',
  date: '2026-08-22',
  title: 'Versions send bids. Scenarios try prices.',
  kind: 'feature',
  highlights: [
    'The version picker now says what versions are for: "Bids in this package — each sends on its own," and every chip shows whether it\'s in the cover letter and which GC it goes to.',
    'The Workbench button is now "＋ New price or version…" with two plain moves: Another price point (same counts, different price) or Another bid to send (own counts, own GC, its own cover-letter section).',
    'Splitting a bid now reads like what it is: "Split into two sendable bids" — name this bid, name the new bid.',
    'A "Send… →" button on the picker jumps straight to the Cover Letter, where your versions bundle into one submission.',
  ],
}

export default note
