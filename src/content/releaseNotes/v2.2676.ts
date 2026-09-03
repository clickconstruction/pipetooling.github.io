import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2676',
  date: '2026-09-03',
  title: 'Overhead on the Dashboard',
  kind: 'feature',
  highlights: [
    'Devs and pay-approved masters get a fourth card in the Dashboard money row: the 90-day overhead burn per day, a bar showing what the pool is made of, the trend against the prior 30 days, and the three lens rates in one line.',
    'Tap a lens or the headline to open the same math window as People → Overhead; "Open tab ›" jumps to the full tab.',
    'It loads once the card is on screen and remembers the numbers for an hour, so the Dashboard stays fast.',
  ],
}

export default note
