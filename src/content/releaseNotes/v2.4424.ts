import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4424',
  date: '2026-10-02',
  title: 'Submittals: the Edit window fits the screen, and "no house" opens on its part',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, a row with many parts opened an Edit window taller than the screen. Its top was cut off and could not be scrolled to.',
    'The window now fits the screen. The title and the Save button stay in view, and the parts scroll between them.',
    'Tapping "no house" on the procurement log opens the window on that part, ringed in blue, with its house box ready.',
    'On a row with no parts, tapping its house puts you in the Supply house box.',
  ],
}

export default note
