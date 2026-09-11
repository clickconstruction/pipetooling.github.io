import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3274',
  date: '2026-09-11',
  title: 'Supply house quotes: kits, options, and why the robot picked what it picked',
  kind: 'feature',
  highlights: [
    'A fixture priced as a kit — bowl, flush valve and seat under one subtotal, the carrier from the second sheet attached — now shows one price per each. Tap ▸ to see the parts and where each came from. A house that skipped a part reads "incomplete" and never wins.',
    'When a quote lists options (six sizes, eight carrier variants) the cell reads "needs a choice" with the price range. Tap it, pick the one the plans call for, and the row prices normally — the quote’s own sum-of-all-options subtotal never sneaks in.',
    'A Robot column says why each pick was made; change one and it says "you changed this". Every change teaches the robot for next time. Apply picks to costs works exactly as before.',
  ],
}

export default note
