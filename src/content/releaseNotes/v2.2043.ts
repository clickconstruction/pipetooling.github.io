import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2043',
  date: '2026-08-21',
  title: 'Followup: lands at the top + two-tap lost capture',
  kind: 'feature',
  highlights: [
    'By builder stops replaying old jumps — deep links scroll exactly once, and the page opens at the top of the call queue on every later visit (all four Bids surfaces fixed).',
    'Every unsent/pending row on a builder card has a "Lost…" action: a small panel with the six reason chips and an optional note — mark a bid lost and say why in two taps, no modal.',
    'Lost bids now wear their reason: a colored chip on builder cards and the By-status Lost table (tap to change), or an amber "why? →" when one is still missing.',
  ],
}

export default note
