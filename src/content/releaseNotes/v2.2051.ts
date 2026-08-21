import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2051',
  date: '2026-08-21',
  title: 'Builder cards: note a bid without logging builder contact',
  kind: 'feature',
  highlights: [
    'The quick-log bar gains a quiet second button — "bids only" — that notes the checked bids and freshens their clocks without logging builder contact, so the builder doesn\'t move down the call queue.',
    'Tap the 📝 on any bid row to aim: it checks just that bid and lands you in the note box — 📝, type, "this bid only", done.',
    'A one-line caption under the bar states exactly what each save touches, and the blue "Log for builder + N bids" button is unchanged.',
  ],
}

export default note
