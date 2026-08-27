import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2400',
  date: '2026-08-27',
  title: 'Margin breakdown chips land on the row',
  kind: 'feature',
  highlights: [
    'The breakdown window\'s # Counts / 📐 Takeoffs / 🛠 Labor chips now take you to that tab AND to that fixture\'s row — scrolled into view and flashed for a moment, so it\'s clear where you landed (the same follow-the-row flash Jobs → Pipeline uses).',
    'If the row doesn\'t exist over there yet (no labor row, no assembly), the tab still opens and a note says why nothing flashed.',
  ],
}

export default note
