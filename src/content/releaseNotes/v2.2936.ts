import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2936',
  date: '2026-09-06',
  title: 'Robots: every live bid can carry a shadow estimate, automatically',
  kind: 'feature',
  highlights: [
    'Robots can now claim the next live bid that needs a shadow estimate on their own — asked-for bids first, then oldest first — instead of waiting for someone to hand-pick each one.',
    "A shadow costs the estimator nothing: it locks its number blind before hers exists and scores itself the moment she sends, turning every bid she prices into practice data for free.",
    'The shadow queue now reports coverage — how much of the live board is shadowed — so 100% is a number you can watch.',
  ],
}

export default note
