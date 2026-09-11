import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3275',
  date: '2026-09-11',
  title: 'The robot tells you when a price matrix is ready — and learns from your corrections',
  kind: 'feature',
  highlights: [
    'Your Dashboard’s Needs you card gains Robot pricing: "The robot priced BP359 SpaceX BA-2 — 23 picks ready, 4 to settle." Review matrix lands you on the bid’s Pricing tab with the compare one tap away. Amber while a carrier or size still waits on your call.',
    'Robots → Scoreboard shows the pricing robot’s numbers: matrices finished, quotes read, rows priced, rows it asked about instead of guessing, and how often your final pick was the robot’s.',
    'Robots → Console lists what the robot learned — from your "remember this" taps and from its own reading, each with where it came from — and lets you retire a rule. Corrections you make in the compare wait there until the robot digests them at the start of its next run.',
  ],
}

export default note
