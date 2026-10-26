import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5874',
  date: '2026-10-26',
  title: 'The Bridge: a resource call holds its stage, and Market reads through the win share',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A week\'s call on Decision, Capital or Talent now holds the stage it throttled at call time, so the red does not wander across the cards while the owner clears a pile.',
    'The Market card compares asks × the window\'s win share by value against the field, not raw asks — one large invited bid no longer reads "not short" forever — and the card says which basis it stands on.',
    'The dial\'s Market reading says the same: what the asks convert to at the win share, against what the field builds.',
  ],
}

export default note
