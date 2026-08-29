import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2481',
  date: '2026-08-29',
  title: 'Estimate documents read clearly everywhere',
  kind: 'fix',
  highlights: [
    'The customer acceptance page had washed-out titles, option prices, and terms; the same document in dark mode showed dark text on a dark card. The document now paints its own white paper wherever it appears — accept page, dark mode, previews.',
    'On phones, the Recommended badge no longer crowds the option price.',
  ],
}

export default note
