import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2194',
  date: '2026-08-23',
  title: 'Checklist Review: tiles that talk',
  kind: 'feature',
  highlights: [
    'The three numbers at the top of Checklist → Review are now real tiles: centered, with a caption that answers who and how old — "one-offs · 7 people · oldest 118 days" — and zeros that read as done (quiet grey with a green ✓).',
    'Tap a tile to jump to its list: To sign off opens the sign-off queue, Outstanding scrolls to the by-person board, Missed this week flips that board to Missed. The tile for the view you\'re on stays outlined.',
    'Missed this week now also says which weekdays were missed, not just how many.',
  ],
}

export default note
